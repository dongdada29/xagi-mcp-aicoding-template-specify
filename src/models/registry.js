/**
 * TemplateRegistry Model
 * Represents a template registry with configuration, synchronization, and authentication capabilities
 */

const { validateRegistryUrl } = require('../utils/validation');
const https = require('https');
const http = require('http');
const url = require('url');

/**
 * Template Registry Class
 * Manages template registries with various access types and authentication methods
 */
class TemplateRegistry {
  /**
   * Create a new TemplateRegistry instance
   * @param {Object} config - Registry configuration
   * @param {string} config.id - Unique registry identifier
   * @param {string} config.name - Registry name
   * @param {string} config.url - Registry URL
   * @param {string} config.type - Registry type (public, private, local)
   * @param {boolean} config.authRequired - Whether authentication is required
   * @param {string} config.cachePolicy - Caching strategy
   * @param {Date} config.lastSync - Last synchronization timestamp
   * @param {number} config.templateCount - Number of available templates
   * @param {string} config.status - Registry status (active, inactive, error)
   */
  constructor(config) {
    this.validateConfig(config);

    /**
     * Unique registry identifier
     * @type {string}
     */
    this.id = config.id || this.generateId();

    /**
     * Registry name
     * @type {string}
     */
    this.name = config.name;

    /**
     * Registry URL
     * @type {string}
     */
    this.url = config.url;

    /**
     * Registry type
     * @type {'public'|'private'|'local'}
     */
    this.type = config.type;

    /**
     * Whether authentication is required
     * @type {boolean}
     */
    this.authRequired = config.authRequired || false;

    /**
     * Caching strategy
     * @type {string}
     */
    this.cachePolicy = config.cachePolicy || 'default';

    /**
     * Last synchronization timestamp
     * @type {Date|null}
     */
    this.lastSync = config.lastSync ? new Date(config.lastSync) : null;

    /**
     * Number of available templates
     * @type {number}
     */
    this.templateCount = config.templateCount || 0;

    /**
     * Registry status
     * @type {'active'|'inactive'|'error'}
     */
    this.status = config.status || 'active';

    /**
     * Authentication token
     * @type {string|null}
     * @private
     */
    this._authToken = null;

    /**
     * Cache for templates
     * @type {Array}
     * @private
     */
    this._templateCache = [];

    /**
     * Cache expiry timestamp
     * @type {Date|null}
     * @private
     */
    this._cacheExpiry = null;
  }

  /**
   * Validate registry configuration
   * @param {Object} config - Configuration to validate
   * @throws {Error} If configuration is invalid
   */
  validateConfig(config) {
    if (!config || typeof config !== 'object') {
      throw new Error('Configuration must be an object');
    }

    if (!config.name || typeof config.name !== 'string') {
      throw new Error('Registry name is required and must be a string');
    }

    if (!config.url || typeof config.url !== 'string') {
      throw new Error('Registry URL is required and must be a string');
    }

    // Validate URL format
    const urlValidation = validateRegistryUrl(config.url);
    if (!urlValidation.isValid) {
      throw new Error(`Invalid registry URL: ${urlValidation.errors.join(', ')}`);
    }

    // Validate registry type
    const validTypes = ['public', 'private', 'local'];
    if (config.type && !validTypes.includes(config.type)) {
      throw new Error(`Invalid registry type: ${config.type}. Must be one of: ${validTypes.join(', ')}`);
    }

    // Validate status
    const validStatuses = ['active', 'inactive', 'error'];
    if (config.status && !validStatuses.includes(config.status)) {
      throw new Error(`Invalid status: ${config.status}. Must be one of: ${validStatuses.join(', ')}`);
    }

    // Validate template count
    if (config.templateCount && (typeof config.templateCount !== 'number' || config.templateCount < 0)) {
      throw new Error('Template count must be a non-negative number');
    }
  }

  /**
   * Generate a unique ID for the registry
   * @returns {string} Generated ID
   */
  generateId() {
    return `registry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Synchronize registry with remote
   * @returns {Promise<Object>} Synchronization result
   */
  async sync() {
    if (this.type === 'local') {
      throw new Error('Local registries cannot be synchronized');
    }

    try {
      this.status = 'active';

      // Simulate API call to sync with remote registry
      const result = await this.makeRequest('/sync', 'GET');

      // Update registry state
      this.lastSync = new Date();
      this.templateCount = result.templateCount || 0;
      this._templateCache = result.templates || [];
      this.updateCacheExpiry();

      return {
        success: true,
        message: 'Registry synchronized successfully',
        templateCount: this.templateCount,
        lastSync: this.lastSync
      };
    } catch (error) {
      this.status = 'error';
      throw new Error(`Synchronization failed: ${error.message}`);
    }
  }

  /**
   * Authenticate with registry
   * @param {string} token - Authentication token
   * @returns {Promise<Object>} Authentication result
   */
  async authenticate(token) {
    if (!this.authRequired) {
      return {
        success: true,
        message: 'Authentication not required for this registry'
      };
    }

    if (!token || typeof token !== 'string') {
      throw new Error('Authentication token is required');
    }

    try {
      // Simulate authentication request
      const result = await this.makeRequest('/auth', 'POST', { token });

      if (result.success) {
        this._authToken = token;
        this.status = 'active';
        return {
          success: true,
          message: 'Authentication successful',
          expiresAt: result.expiresAt
        };
      } else {
        throw new Error(result.message || 'Authentication failed');
      }
    } catch (error) {
      this.status = 'error';
      throw new Error(`Authentication failed: ${error.message}`);
    }
  }

  /**
   * Check if registry is available
   * @returns {Promise<boolean>} Whether registry is available
   */
  async isAvailable() {
    try {
      const result = await this.makeRequest('/health', 'GET');
      return result.status === 'healthy';
    } catch (error) {
      return false;
    }
  }

  /**
   * Get templates from registry
   * @param {Object} options - Options for getting templates
   * @param {boolean} options.forceRefresh - Force refresh from registry
   * @param {string} options.filter - Filter templates
   * @returns {Promise<Array>} Array of templates
   */
  async getTemplates(options = {}) {
    const { forceRefresh = false, filter = null } = options;

    // Check cache first
    if (!forceRefresh && this._templateCache.length > 0 && !this.isCacheExpired()) {
      let templates = [...this._templateCache];

      if (filter) {
        templates = templates.filter(template =>
          template.name.toLowerCase().includes(filter.toLowerCase()) ||
          template.description.toLowerCase().includes(filter.toLowerCase())
        );
      }

      return templates;
    }

    // Fetch from registry
    try {
      const endpoint = filter ? `/templates?filter=${encodeURIComponent(filter)}` : '/templates';
      const result = await this.makeRequest(endpoint, 'GET');

      this._templateCache = result.templates || [];
      this.updateCacheExpiry();

      return this._templateCache;
    } catch (error) {
      throw new Error(`Failed to get templates: ${error.message}`);
    }
  }

  /**
   * Make HTTP request to registry
   * @param {string} endpoint - API endpoint
   * @param {string} method - HTTP method
   * @param {Object} data - Request data
   * @returns {Promise<Object>} Response data
   * @private
   */
  async makeRequest(endpoint, method = 'GET', data = null) {
    return new Promise((resolve, reject) => {
      const parsedUrl = url.parse(this.url);
      const isHttps = parsedUrl.protocol === 'https:';
      const client = isHttps ? https : http;

      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: `${parsedUrl.pathname}${endpoint}`,
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'TemplateRegistry/1.0'
        }
      };

      // Add authentication header if token is available
      if (this._authToken) {
        options.headers['Authorization'] = `Bearer ${this._authToken}`;
      }

      const req = client.request(options, (res) => {
        let responseData = '';

        res.on('data', (chunk) => {
          responseData += chunk;
        });

        res.on('end', () => {
          try {
            const parsed = JSON.parse(responseData);

            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(parsed);
            } else {
              reject(new Error(parsed.message || `HTTP ${res.statusCode}`));
            }
          } catch (error) {
            reject(new Error(`Invalid response: ${error.message}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(new Error(`Network error: ${error.message}`));
      });

      if (data) {
        req.write(JSON.stringify(data));
      }

      req.end();
    });
  }

  /**
   * Check if cache is expired
   * @returns {boolean} Whether cache is expired
   * @private
   */
  isCacheExpired() {
    if (!this._cacheExpiry) return true;
    return new Date() > this._cacheExpiry;
  }

  /**
   * Update cache expiry based on cache policy
   * @private
   */
  updateCacheExpiry() {
    const now = new Date();
    let expiryMinutes = 60; // Default: 1 hour

    switch (this.cachePolicy) {
      case 'aggressive':
        expiryMinutes = 5; // 5 minutes
        break;
      case 'conservative':
        expiryMinutes = 1440; // 24 hours
        break;
      case 'none':
        expiryMinutes = 0; // No caching
        break;
      default:
        expiryMinutes = 60; // Default: 1 hour
    }

    if (expiryMinutes > 0) {
      this._cacheExpiry = new Date(now.getTime() + expiryMinutes * 60 * 1000);
    } else {
      this._cacheExpiry = null;
    }
  }

  /**
   * Serialize registry to JSON
   * @returns {Object} JSON representation
   */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      url: this.url,
      type: this.type,
      authRequired: this.authRequired,
      cachePolicy: this.cachePolicy,
      lastSync: this.lastSync ? this.lastSync.toISOString() : null,
      templateCount: this.templateCount,
      status: this.status
    };
  }

  /**
   * Create registry from JSON
   * @param {Object} json - JSON representation
   * @returns {TemplateRegistry} Registry instance
   */
  static fromJSON(json) {
    return new TemplateRegistry(json);
  }

  /**
   * Get registry info
   * @returns {Object} Registry information
   */
  getInfo() {
    return {
      id: this.id,
      name: this.name,
      url: this.url,
      type: this.type,
      status: this.status,
      templateCount: this.templateCount,
      lastSync: this.lastSync,
      isAvailable: this.isAvailable(),
      cachePolicy: this.cachePolicy
    };
  }
}

module.exports = TemplateRegistry;