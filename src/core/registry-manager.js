/**
 * Private Registry Management Service
 *
 * Provides comprehensive support for private npm registries with multiple authentication methods,
 * credential management, and secure token handling.
 */

const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs-extra');
const path = require('path');
const { validateRegistryUrl } = require('../utils/validation');
const Logger = require('./logger');

/**
 * Registry Manager Class
 *
 * Manages multiple private npm registries with authentication,
 * credential storage, and secure operations.
 */
class RegistryManager {
  /**
   * Create a new RegistryManager instance
   * @param {Object} options - Configuration options
   * @param {string} options.configDir - Configuration directory
   * @param {Object} options.logger - Logger instance
   * @param {boolean} options.enableEncryption - Enable credential encryption
   */
  constructor(options = {}) {
    /**
     * Configuration directory
     * @type {string}
     * @private
     */
    this._configDir = options.configDir || path.join(process.cwd(), '.xagi');

    /**
     * Logger instance
     * @type {Object}
     * @private
     */
    this._logger = options.logger || Logger.create('RegistryManager');

    /**
     * Enable credential encryption
     * @type {boolean}
     * @private
     */
    this._enableEncryption = options.enableEncryption !== false;

    /**
     * Encryption key for credentials
     * @type {string|null}
     * @private
     */
    this._encryptionKey = null;

    /**
     * In-memory registry cache
     * @type {Map}
     * @private
     */
    this._registryCache = new Map();

    /**
     * Credential storage path
     * @type {string}
     * @private
     */
    this._credentialPath = path.join(this._configDir, 'credentials.json');

    // Initialize the registry manager
    this._initialize();
  }

  /**
   * Initialize the registry manager
   * @private
   */
  _initialize() {
    try {
      // Ensure configuration directory exists
      fs.ensureDirSync(this._configDir);

      // Initialize encryption if enabled
      if (this._enableEncryption) {
        this._initializeEncryption();
      }

      // Load existing credentials
      this._loadCredentials();

      this._logger.info('RegistryManager initialized', {
        configDir: this._configDir,
        encryptionEnabled: this._enableEncryption,
        registryCount: this._registryCache.size
      });
    } catch (error) {
      this._logger.error('Failed to initialize RegistryManager', { error: error.message });
      throw new Error(`RegistryManager initialization failed: ${error.message}`);
    }
  }

  /**
   * Initialize encryption for credential storage
   * @private
   */
  _initializeEncryption() {
    // Generate or load encryption key
    const keyPath = path.join(this._configDir, '.encryption_key');

    try {
      if (fs.existsSync(keyPath)) {
        this._encryptionKey = fs.readFileSync(keyPath, 'utf8');
      } else {
        // Generate a new encryption key
        this._encryptionKey = crypto.randomBytes(32).toString('hex');
        fs.writeFileSync(keyPath, this._encryptionKey, { mode: 0o600 });
        this._logger.info('Generated new encryption key');
      }
    } catch (error) {
      this._logger.warn('Failed to initialize encryption, falling back to plaintext storage', { error: error.message });
      this._enableEncryption = false;
    }
  }

  /**
   * Encrypt sensitive data
   * @param {string} data - Data to encrypt
   * @returns {string} Encrypted data
   * @private
   */
  _encrypt(data) {
    if (!this._enableEncryption || !this._encryptionKey) {
      return data;
    }

    try {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipher('aes-256-cbc', this._encryptionKey);
      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      return `${iv.toString('hex')}:${encrypted}`;
    } catch (error) {
      this._logger.warn('Failed to encrypt data', { error: error.message });
      return data;
    }
  }

  /**
   * Decrypt sensitive data
   * @param {string} encryptedData - Encrypted data
   * @returns {string} Decrypted data
   * @private
   */
  _decrypt(encryptedData) {
    if (!this._enableEncryption || !this._encryptionKey) {
      return encryptedData;
    }

    try {
      const [ivHex, encrypted] = encryptedData.split(':');
      const iv = Buffer.from(ivHex, 'hex');
      const decipher = crypto.createDecipher('aes-256-cbc', this._encryptionKey);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (error) {
      this._logger.warn('Failed to decrypt data', { error: error.message });
      return encryptedData;
    }
  }

  /**
   * Load credentials from storage
   * @private
   */
  _loadCredentials() {
    try {
      if (fs.existsSync(this._credentialPath)) {
        const data = fs.readJSONSync(this._credentialPath);

        for (const [registryId, credentials] of Object.entries(data)) {
          // Decrypt credentials if encryption is enabled
          const decryptedCredentials = {
            ...credentials,
            authToken: credentials.authToken ? this._decrypt(credentials.authToken) : null,
            username: credentials.username ? this._decrypt(credentials.username) : null,
            password: credentials.password ? this._decrypt(credentials.password) : null,
            email: credentials.email ? this._decrypt(credentials.email) : null
          };

          this._registryCache.set(registryId, decryptedCredentials);
        }

        this._logger.info(`Loaded ${this._registryCache.size} registry credentials`);
      }
    } catch (error) {
      this._logger.warn('Failed to load credentials', { error: error.message });
    }
  }

  /**
   * Save credentials to storage
   * @private
   */
  _saveCredentials() {
    try {
      const data = {};

      for (const [registryId, credentials] of this._registryCache.entries()) {
        // Encrypt credentials before saving
        data[registryId] = {
          ...credentials,
          authToken: credentials.authToken ? this._encrypt(credentials.authToken) : null,
          username: credentials.username ? this._encrypt(credentials.username) : null,
          password: credentials.password ? this._encrypt(credentials.password) : null,
          email: credentials.email ? this._encrypt(credentials.email) : null
        };
      }

      fs.writeJSONSync(this._credentialPath, data, { spaces: 2 });
      this._logger.debug('Credentials saved successfully');
    } catch (error) {
      this._logger.error('Failed to save credentials', { error: error.message });
      throw new Error(`Failed to save credentials: ${error.message}`);
    }
  }

  /**
   * Add a private registry
   * @param {Object} registryConfig - Registry configuration
   * @param {string} registryConfig.id - Unique registry identifier
   * @param {string} registryConfig.name - Registry name
   * @param {string} registryConfig.url - Registry URL
   * @param {string} registryConfig.authType - Authentication type ('token', 'basic', 'oauth')
   * @param {Object} registryConfig.credentials - Authentication credentials
   * @returns {Object} Registry configuration
   */
  addRegistry(registryConfig) {
    const { id, name, url, authType, credentials } = registryConfig;

    // Validate configuration
    if (!id || !name || !url) {
      throw new Error('Registry id, name, and url are required');
    }

    const urlValidation = validateRegistryUrl(url);
    if (!urlValidation.isValid) {
      throw new Error(`Invalid registry URL: ${urlValidation.errors.join(', ')}`);
    }

    const validAuthTypes = ['token', 'basic', 'oauth', 'none'];
    if (!validAuthTypes.includes(authType)) {
      throw new Error(`Invalid auth type: ${authType}. Must be one of: ${validAuthTypes.join(', ')}`);
    }

    // Validate credentials based on auth type
    this._validateCredentials(authType, credentials);

    const registry = {
      id,
      name,
      url,
      authType,
      type: 'private',
      enabled: true,
      priority: credentials.priority || registryConfig.priority || 0,
      createdAt: new Date().toISOString(),
      lastUsed: null,
      ...credentials
    };

    this._registryCache.set(id, registry);
    this._saveCredentials();

    this._logger.info('Added private registry', { id, name, url, authType });

    return registry;
  }

  /**
   * Validate credentials based on auth type
   * @param {string} authType - Authentication type
   * @param {Object} credentials - Credentials to validate
   * @private
   */
  _validateCredentials(authType, credentials) {
    if (!credentials || authType === 'none') {
      return;
    }

    switch (authType) {
      case 'token':
        if (!credentials.authToken) {
          throw new Error('authToken is required for token authentication');
        }
        break;
      case 'basic':
        if (!credentials.username || !credentials.password) {
          throw new Error('username and password are required for basic authentication');
        }
        break;
      case 'oauth':
        if (!credentials.accessToken && !credentials.clientId) {
          throw new Error('accessToken or clientId is required for OAuth authentication');
        }
        break;
    }
  }

  /**
   * Remove a registry
   * @param {string} registryId - Registry identifier
   * @returns {boolean} Whether registry was removed
   */
  removeRegistry(registryId) {
    if (!this._registryCache.has(registryId)) {
      throw new Error(`Registry not found: ${registryId}`);
    }

    this._registryCache.delete(registryId);
    this._saveCredentials();

    this._logger.info('Removed private registry', { registryId });

    return true;
  }

  /**
   * Get registry configuration
   * @param {string} registryId - Registry identifier
   * @returns {Object} Registry configuration
   */
  getRegistry(registryId) {
    const registry = this._registryCache.get(registryId);
    if (!registry) {
      throw new Error(`Registry not found: ${registryId}`);
    }

    return { ...registry };
  }

  /**
   * List all configured registries
   * @param {Object} options - Listing options
   * @param {boolean} options.includeDisabled - Include disabled registries
   * @param {string} options.type - Filter by type
   * @returns {Array} Array of registry configurations
   */
  listRegistries(options = {}) {
    const { includeDisabled = false, type = null } = options;

    let registries = Array.from(this._registryCache.values());

    // Filter by type
    if (type) {
      registries = registries.filter(registry => registry.type === type);
    }

    // Filter out disabled if requested
    if (!includeDisabled) {
      registries = registries.filter(registry => registry.enabled);
    }

    // Sort by priority (descending) then by name
    registries.sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      return a.name.localeCompare(b.name);
    });

    return registries.map(registry => ({
      id: registry.id,
      name: registry.name,
      url: registry.url,
      type: registry.type,
      authType: registry.authType,
      enabled: registry.enabled,
      priority: registry.priority,
      createdAt: registry.createdAt,
      lastUsed: registry.lastUsed
    }));
  }

  /**
   * Update registry configuration
   * @param {string} registryId - Registry identifier
   * @param {Object} updates - Updates to apply
   * @returns {Object} Updated registry configuration
   */
  updateRegistry(registryId, updates) {
    const registry = this._registryCache.get(registryId);
    if (!registry) {
      throw new Error(`Registry not found: ${registryId}`);
    }

    // Apply updates
    const updatedRegistry = {
      ...registry,
      ...updates,
      id: registryId, // Don't allow changing ID
      updatedAt: new Date().toISOString()
    };

    // Validate URL if it's being updated
    if (updates.url) {
      const urlValidation = validateRegistryUrl(updates.url);
      if (!urlValidation.isValid) {
        throw new Error(`Invalid registry URL: ${urlValidation.errors.join(', ')}`);
      }
    }

    // Validate credentials if they're being updated
    if (updates.authType && updates.credentials) {
      this._validateCredentials(updates.authType, updates.credentials);
    }

    this._registryCache.set(registryId, updatedRegistry);
    this._saveCredentials();

    this._logger.info('Updated private registry', { registryId, updates: Object.keys(updates) });

    return updatedRegistry;
  }

  /**
   * Test registry connectivity
   * @param {string} registryId - Registry identifier
   * @returns {Promise<Object>} Connectivity test result
   */
  async testConnectivity(registryId) {
    const registry = this._registryCache.get(registryId);
    if (!registry) {
      throw new Error(`Registry not found: ${registryId}`);
    }

    try {
      this._logger.info('Testing registry connectivity', { registryId, url: registry.url });

      const client = await this._createAuthenticatedClient(registry);

      // Test with different endpoints
      const endpoints = ['/-/ping', '/-/whoami', '/'];
      let success = false;
      let endpoint = null;
      let responseTime = 0;

      for (const testEndpoint of endpoints) {
        const startTime = Date.now();
        try {
          const response = await client.get(testEndpoint);
          responseTime = Date.now() - startTime;

          if (response.status >= 200 && response.status < 300) {
            success = true;
            endpoint = testEndpoint;
            break;
          }
        } catch (error) {
          this._logger.debug('Endpoint test failed', { registryId, endpoint: testEndpoint, error: error.message });
          continue;
        }
      }

      // Update last used timestamp on success
      if (success) {
        registry.lastUsed = new Date().toISOString();
        this._saveCredentials();
      }

      const result = {
        success,
        registryId,
        url: registry.url,
        endpoint,
        responseTime,
        message: success ? 'Registry is accessible' : 'Registry is not accessible',
        timestamp: new Date().toISOString()
      };

      this._logger.info('Connectivity test completed', result);

      return result;
    } catch (error) {
      const result = {
        success: false,
        registryId,
        url: registry.url,
        error: error.message,
        message: `Connectivity test failed: ${error.message}`,
        timestamp: new Date().toISOString()
      };

      this._logger.warn('Connectivity test failed', result);

      return result;
    }
  }

  /**
   * Create authenticated HTTP client for registry
   * @param {Object} registry - Registry configuration
   * @returns {Promise<Object>} HTTP client instance
   * @private
   */
  async _createAuthenticatedClient(registry) {
    const headers = {
      'User-Agent': '@xagi/create-ai-project/1.0.0',
      'Accept': 'application/json',
      'npm-command': 'view'
    };

    // Add authentication headers based on auth type
    switch (registry.authType) {
      case 'token':
        if (registry.authToken) {
          if (registry.url.includes('registry.npmjs.org')) {
            headers.Authorization = `Bearer ${registry.authToken}`;
          } else {
            headers.Authorization = `Basic ${Buffer.from(`:${registry.authToken}`).toString('base64')}`;
          }
        }
        break;
      case 'basic':
        if (registry.username && registry.password) {
          const authString = `${registry.username}:${registry.password}`;
          headers.Authorization = `Basic ${Buffer.from(authString).toString('base64')}`;
        }
        break;
      case 'oauth':
        if (registry.accessToken) {
          headers.Authorization = `Bearer ${registry.accessToken}`;
        }
        break;
    }

    const client = axios.create({
      baseURL: registry.url,
      timeout: 30000,
      headers: headers,
      validateStatus: (status) => status < 500
    });

    return client;
  }

  /**
   * Search packages in private registry
   * @param {string} registryId - Registry identifier
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Promise<Array>} Search results
   */
  async searchPackages(registryId, query, options = {}) {
    const registry = this._registryCache.get(registryId);
    if (!registry) {
      throw new Error(`Registry not found: ${registryId}`);
    }

    try {
      this._logger.info('Searching packages', { registryId, query });

      const client = await this._createAuthenticatedClient(registry);
      const searchUrl = `/-/v1/search?text=${encodeURIComponent(query)}&size=${options.limit || 20}`;

      const response = await client.get(searchUrl);

      if (response.data && response.data.objects) {
        return response.data.objects.map(obj => obj.package);
      }

      return [];
    } catch (error) {
      this._logger.error('Package search failed', { registryId, query, error: error.message });
      throw new Error(`Failed to search packages: ${error.message}`);
    }
  }

  /**
   * Get package information from private registry
   * @param {string} registryId - Registry identifier
   * @param {string} packageName - Package name
   * @returns {Promise<Object>} Package information
   */
  async getPackageInfo(registryId, packageName) {
    const registry = this._registryCache.get(registryId);
    if (!registry) {
      throw new Error(`Registry not found: ${registryId}`);
    }

    try {
      this._logger.info('Getting package info', { registryId, packageName });

      const client = await this._createAuthenticatedClient(registry);
      const response = await client.get(`/${packageName}`);

      return response.data;
    } catch (error) {
      this._logger.error('Failed to get package info', { registryId, packageName, error: error.message });
      throw new Error(`Failed to get package info: ${error.message}`);
    }
  }

  /**
   * Get registry statistics
   * @returns {Object} Registry statistics
   */
  getStats() {
    const registries = Array.from(this._registryCache.values());

    return {
      totalRegistries: registries.length,
      enabledRegistries: registries.filter(r => r.enabled).length,
      privateRegistries: registries.filter(r => r.type === 'private').length,
      authTypes: {
        token: registries.filter(r => r.authType === 'token').length,
        basic: registries.filter(r => r.authType === 'basic').length,
        oauth: registries.filter(r => r.authType === 'oauth').length,
        none: registries.filter(r => r.authType === 'none').length
      },
      encryptionEnabled: this._enableEncryption,
      configDir: this._configDir
    };
  }

  /**
   * Clear all registry credentials
   * @returns {Object} Clear result
   */
  clearAll() {
    const count = this._registryCache.size;
    this._registryCache.clear();

    try {
      if (fs.existsSync(this._credentialPath)) {
        fs.removeSync(this._credentialPath);
      }
    } catch (error) {
      this._logger.warn('Failed to remove credential file', { error: error.message });
    }

    this._logger.info('Cleared all registry credentials', { count });

    return {
      success: true,
      message: `Cleared ${count} registry configurations`,
      count
    };
  }
}

module.exports = RegistryManager;