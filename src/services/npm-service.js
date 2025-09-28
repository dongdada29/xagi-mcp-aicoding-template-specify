/**
 * NpmService - npm Registry Operations Service
 *
 * Handles npm registry communication and package management operations.
 * Supports both public and private registries with authentication,
 * caching, and performance optimization.
 */

const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');
const { validateRegistryUrl } = require('../utils/validation');

/**
 * NpmService Class
 *
 * Manages npm registry operations including package retrieval,
 * searching, downloading, and validation.
 */
class NpmService {
  /**
   * Create a new NpmService instance
   * @param {Object} config - Service configuration
   * @param {string} [config.registryUrl='https://registry.npmjs.org'] - Default npm registry URL
   * @param {string} [config.authToken] - Authentication token for private registries
   * @param {number} [config.timeout=30000] - Request timeout in milliseconds
   * @param {boolean} [config.enableCache=true] - Enable package caching
   * @param {string} [config.cacheDir] - Cache directory path
   * @param {number} [config.cacheTtl=3600000] - Cache TTL in milliseconds (1 hour)
   * @param {number} [config.maxCacheSize=524288000] - Maximum cache size in bytes (500MB)
   * @param {Object} [config.headers] - Additional HTTP headers
   */
  constructor(config = {}) {
    /**
     * Default npm registry URL
     * @type {string}
     * @private
     */
    this._registryUrl = config.registryUrl || 'https://registry.npmjs.org';

    /**
     * Authentication token for private registries
     * @type {string|null}
     * @private
     */
    this._authToken = config.authToken || null;

    /**
     * Request timeout in milliseconds
     * @type {number}
     * @private
     */
    this._timeout = config.timeout || 30000;

    /**
     * Whether caching is enabled
     * @type {boolean}
     * @private
     */
    this._enableCache = config.enableCache !== false;

    /**
     * Cache directory path
     * @type {string}
     * @private
     */
    this._cacheDir = config.cacheDir || path.join(process.cwd(), '.npm-cache');

    /**
     * Cache TTL in milliseconds
     * @type {number}
     * @private
     */
    this._cacheTtl = config.cacheTtl || 3600000;

    /**
     * Maximum cache size in bytes
     * @type {number}
     * @private
     */
    this._maxCacheSize = config.maxCacheSize || 524288000;

    /**
     * Additional HTTP headers
     * @type {Object}
     * @private
     */
    this._headers = config.headers || {};

    /**
     * In-memory cache store
     * @type {Map}
     * @private
     */
    this._memoryCache = new Map();

    /**
     * Axios instance for HTTP requests
     * @type {Object}
     * @private
     */
    this._httpClient = null;

    this._validateConfig();
    this._initializeCache();
    this._createHttpClient();
  }

  /**
   * Validate service configuration
   * @private
   * @throws {Error} If configuration is invalid
   */
  _validateConfig() {
    const urlValidation = validateRegistryUrl(this._registryUrl);
    if (!urlValidation.isValid) {
      throw new Error(`Invalid registry URL: ${urlValidation.errors.join(', ')}`);
    }

    if (this._timeout && (typeof this._timeout !== 'number' || this._timeout <= 0)) {
      throw new Error('Timeout must be a positive number');
    }

    if (this._cacheTtl && (typeof this._cacheTtl !== 'number' || this._cacheTtl <= 0)) {
      throw new Error('Cache TTL must be a positive number');
    }

    if (this._maxCacheSize && (typeof this._maxCacheSize !== 'number' || this._maxCacheSize <= 0)) {
      throw new Error('Maximum cache size must be a positive number');
    }
  }

  /**
   * Initialize cache system
   * @private
   */
  _initializeCache() {
    if (this._enableCache) {
      try {
        fs.ensureDirSync(this._cacheDir);
        // Load cache from disk if available
        this._loadCacheFromDisk();
      } catch (error) {
        console.warn(`Failed to initialize cache: ${error.message}`);
        this._enableCache = false;
      }
    }
  }

  /**
   * Create HTTP client instance
   * @private
   */
  _createHttpClient() {
    const headers = {
      'User-Agent': 'NpmService/1.0.0',
      'Accept': 'application/json',
      ...this._headers
    };

    if (this._authToken) {
      headers.Authorization = `Bearer ${this._authToken}`;
    }

    this._httpClient = axios.create({
      baseURL: this._registryUrl,
      timeout: this._timeout,
      headers: headers,
      validateStatus: (status) => status < 500
    });

    // Store the created instance for testing
    this._httpClientInstance = this._httpClient;
  }

  /**
   * Generate cache key for package data
   * @param {string} packageName - Package name
   * @param {string} [version] - Package version
   * @returns {string} Cache key
   * @private
   */
  _generateCacheKey(packageName, version = 'latest') {
    const keyData = `${packageName}@${version}`;
    return crypto.createHash('md5').update(keyData).digest('hex');
  }

  /**
   * Load cache from disk
   * @private
   */
  _loadCacheFromDisk() {
    const cacheFile = path.join(this._cacheDir, 'cache.json');
    try {
      if (fs.existsSync(cacheFile)) {
        const cacheData = fs.readJsonSync(cacheFile);
        const now = Date.now();

        // Load only non-expired entries
        Object.entries(cacheData).forEach(([key, entry]) => {
          if (now - entry.timestamp < this._cacheTtl) {
            this._memoryCache.set(key, entry.data);
          }
        });
      }
    } catch (error) {
      console.warn(`Failed to load cache from disk: ${error.message}`);
    }
  }

  /**
   * Save cache to disk
   * @private
   */
  _saveCacheToDisk() {
    if (!this._enableCache) {return;}

    const cacheFile = path.join(this._cacheDir, 'cache.json');
    const cacheData = {};
    const now = Date.now();

    this._memoryCache.forEach((data, key) => {
      cacheData[key] = {
        data,
        timestamp: now
      };
    });

    try {
      fs.writeJsonSync(cacheFile, cacheData, { spaces: 2 });
    } catch (error) {
      console.warn(`Failed to save cache to disk: ${error.message}`);
    }
  }

  /**
   * Get data from cache
   * @param {string} cacheKey - Cache key
   * @returns {Object|null} Cached data or null if not found
   * @private
   */
  _getFromCache(cacheKey) {
    if (!this._enableCache) {
      return null;
    }

    try {
      if (this._memoryCache.has(cacheKey)) {
        return this._memoryCache.get(cacheKey);
      }
    } catch (error) {
      console.warn(`Cache retrieval failed: ${error.message}`);
    }

    return null;
  }

  /**
   * Store data in cache
   * @param {string} cacheKey - Cache key
   * @param {Object} data - Data to cache
   * @private
   */
  _setToCache(cacheKey, data) {
    if (!this._enableCache) {
      return;
    }

    try {
      this._memoryCache.set(cacheKey, data);

      // Periodically save to disk
      if (this._memoryCache.size % 10 === 0) {
        this._saveCacheToDisk();
      }
    } catch (error) {
      console.warn(`Cache storage failed: ${error.message}`);
    }
  }

  /**
   * Handle HTTP errors
   * @param {Error} error - HTTP error
   * @param {string} operation - Operation name for error context
   * @throws {Error} Enhanced error with operation context
   * @private
   */
  _handleHttpError(error, operation) {
    if (error.response) {
      const status = error.response.status;
      const message = error.response.data?.message || error.message;

      switch (status) {
      case 401:
        throw new Error(`Authentication failed for ${operation}: ${message}`);
      case 403:
        throw new Error(`Authorization failed for ${operation}: ${message}`);
      case 404:
        throw new Error(`Resource not found for ${operation}: ${message}`);
      case 429:
        throw new Error(`Rate limit exceeded for ${operation}: ${message}`);
      default:
        throw new Error(`HTTP ${status} error for ${operation}: ${message}`);
      }
    } else if (error.code === 'ECONNABORTED') {
      throw new Error(`Timeout during ${operation}: Request took longer than ${this._timeout}ms`);
    } else if (error.code === 'ENOTFOUND') {
      throw new Error(`Network error during ${operation}: Registry not reachable`);
    } else {
      throw new Error(`Network error during ${operation}: ${error.message}`);
    }
  }

  /**
   * Validate package name format
   * @param {string} packageName - Package name to validate
   * @throws {Error} If package name is invalid
   * @private
   */
  _validatePackageName(packageName) {
    if (!packageName || typeof packageName !== 'string') {
      throw new Error('Package name is required and must be a string');
    }

    // Basic npm package name validation
    const packageNamePattern = /^(?:@[a-z0-9-*~][a-z0-9-*._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/;
    if (!packageNamePattern.test(packageName)) {
      throw new Error(`Invalid package name format: ${packageName}`);
    }
  }

  /**
   * Get package information from registry
   * @param {string} packageName - Package name
   * @param {Object} [options] - Additional options
   * @param {boolean} [options.useCache=true] - Use cached data if available
   * @returns {Promise<Object>} Package information
   */
  async getPackageInfo(packageName, options = {}) {
    const { useCache = true } = options;

    this._validatePackageName(packageName);

    const cacheKey = this._generateCacheKey(packageName, 'info');

    if (useCache) {
      const cached = this._getFromCache(cacheKey);
      if (cached) {
        return cached;
      }
    }

    try {
      const response = await this._httpClient.get(`/${packageName}`);
      const packageInfo = response.data;

      if (useCache) {
        this._setToCache(cacheKey, packageInfo);
      }

      return packageInfo;
    } catch (error) {
      this._handleHttpError(error, `getPackageInfo(${packageName})`);
    }
  }

  /**
   * Get available package versions from registry
   * @param {string} packageName - Package name
   * @param {Object} [options] - Additional options
   * @param {boolean} [options.useCache=true] - Use cached data if available
   * @returns {Promise<Array>} Array of available versions
   */
  async getPackageVersions(packageName, options = {}) {
    const { useCache = true } = options;

    this._validatePackageName(packageName);

    const cacheKey = this._generateCacheKey(packageName, 'versions');

    if (useCache) {
      const cached = this._getFromCache(cacheKey);
      if (cached) {
        return cached;
      }
    }

    try {
      const packageInfo = await this.getPackageInfo(packageName, { useCache });
      const versions = Object.keys(packageInfo.versions || {});

      if (useCache) {
        this._setToCache(cacheKey, versions);
      }

      return versions;
    } catch (error) {
      this._handleHttpError(error, `getPackageVersions(${packageName})`);
    }
  }

  /**
   * Download package from registry
   * @param {string} packageName - Package name
   * @param {string} [version='latest'] - Package version
   * @param {Object} [options] - Additional options
   * @param {string} [options.destination] - Destination directory
   * @param {boolean} [options.useCache=true] - Use cached data if available
   * @returns {Promise<Object>} Download result with package info and path
   */
  async downloadPackage(packageName, version = 'latest', options = {}) {
    const { destination, useCache = true } = options;

    this._validatePackageName(packageName);

    try {
      const packageInfo = await this.getPackageInfo(packageName, { useCache });

      if (version === 'latest') {
        version = packageInfo['dist-tags']?.latest;
      }

      if (!packageInfo.versions || !packageInfo.versions[version]) {
        throw new Error(`Version ${version} not found for package ${packageName}`);
      }

      const versionInfo = packageInfo.versions[version];
      const tarballUrl = versionInfo.dist?.tarball;

      if (!tarballUrl) {
        throw new Error(`No tarball URL found for ${packageName}@${version}`);
      }

      // Download the tarball
      const response = await this._httpClient.get(tarballUrl, {
        responseType: 'arraybuffer'
      });

      // Create destination directory if specified
      let packagePath;
      if (destination) {
        await fs.ensureDir(destination);
        packagePath = path.join(destination, `${packageName}-${version}.tgz`);
      } else {
        const tempDir = path.join(this._cacheDir, 'downloads');
        await fs.ensureDir(tempDir);
        packagePath = path.join(tempDir, `${packageName}-${version}.tgz`);
      }

      await fs.writeFile(packagePath, response.data);

      return {
        packageName,
        version,
        packagePath,
        size: response.data.byteLength,
        checksum: versionInfo.dist?.shasum,
        downloadedAt: new Date().toISOString()
      };
    } catch (error) {
      this._handleHttpError(error, `downloadPackage(${packageName}@${version})`);
    }
  }

  /**
   * Search packages in registry
   * @param {string} query - Search query
   * @param {Object} [options] - Additional options
   * @param {number} [options.limit=20] - Maximum number of results
   * @param {number} [options.offset=0] - Offset for pagination
   * @param {string} [options.sort='popularity'] - Sort order (popularity, quality, maintenance)
   * @param {boolean} [options.useCache=true] - Use cached data if available
   * @returns {Promise<Object>} Search results
   */
  async searchPackages(query, options = {}) {
    const { limit = 20, offset = 0, sort = 'popularity', useCache = true } = options;

    if (!query || typeof query !== 'string') {
      throw new Error('Search query is required and must be a string');
    }

    const cacheKey = this._generateCacheKey(`search:${query}:${limit}:${offset}:${sort}`);

    if (useCache) {
      const cached = this._getFromCache(cacheKey);
      if (cached) {
        return cached;
      }
    }

    try {
      const searchParams = new URLSearchParams({
        text: query,
        size: limit,
        from: offset
      });

      if (sort !== 'popularity') {
        searchParams.append('sort', sort);
      }

      const response = await this._httpClient.get(`/-/v1/search?${searchParams}`);
      const searchResults = response.data;

      if (useCache) {
        this._setToCache(cacheKey, searchResults);
      }

      return searchResults;
    } catch (error) {
      this._handleHttpError(error, `searchPackages(${query})`);
    }
  }

  /**
   * Validate package exists and follows conventions
   * @param {string} packageName - Package name to validate
   * @param {Object} [options] - Additional options
   * @param {boolean} [options.checkRegistry=true] - Check if package exists in registry
   * @param {boolean} [options.useCache=true] - Use cached data if available
   * @returns {Promise<Object>} Validation result
   */
  async validatePackage(packageName, options = {}) {
    const { checkRegistry = true, useCache = true } = options;

    this._validatePackageName(packageName);

    const validation = {
      packageName,
      isValid: true,
      errors: [],
      warnings: [],
      registryInfo: null
    };

    // Basic format validation
    const packageNamePattern = /^(?:@[a-z0-9-*~][a-z0-9-*._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/;
    if (!packageNamePattern.test(packageName)) {
      validation.isValid = false;
      validation.errors.push('Package name does not follow npm naming conventions');
    }

    // Check for reserved names and prefixes
    const reservedNames = ['npm', 'node_modules', 'favicon.ico', 'package.json'];
    if (reservedNames.includes(packageName.toLowerCase())) {
      validation.isValid = false;
      validation.errors.push('Package name is reserved');
    }

    // Check for invalid characters and patterns
    if (packageName.includes(' ')) {
      validation.isValid = false;
      validation.errors.push('Package name cannot contain spaces');
    }

    if (packageName.startsWith('.') || packageName.startsWith('_')) {
      validation.warnings.push('Package name starts with dot or underscore');
    }

    if (packageName.toUpperCase() === packageName) {
      validation.warnings.push('Package name is all uppercase');
    }

    // Check registry if requested
    if (checkRegistry) {
      try {
        const packageInfo = await this.getPackageInfo(packageName, { useCache });
        validation.registryInfo = {
          exists: true,
          versionCount: Object.keys(packageInfo.versions || {}).length,
          latestVersion: packageInfo['dist-tags']?.latest,
          lastModified: packageInfo.time?.modified,
          author: packageInfo.author,
          maintainers: packageInfo.maintainers
        };
      } catch (error) {
        if (error.message.includes('404')) {
          validation.registryInfo = {
            exists: false,
            error: 'Package not found in registry'
          };
          validation.warnings.push('Package does not exist in registry');
        } else {
          validation.registryInfo = {
            exists: false,
            error: error.message
          };
          validation.errors.push(`Registry check failed: ${error.message}`);
        }
      }
    }

    validation.isValid = validation.errors.length === 0;

    return validation;
  }

  /**
   * Get registry information
   * @param {string} [registryUrl] - Registry URL (uses default if not provided)
   * @returns {Promise<Object>} Registry information
   */
  async getRegistryInfo(registryUrl) {
    const targetUrl = registryUrl || this._registryUrl;

    try {
      const client = axios.create({
        baseURL: targetUrl,
        timeout: this._timeout,
        headers: {
          'User-Agent': 'NpmService/1.0.0',
          'Accept': 'application/json'
        }
      });

      // Try different endpoints to get registry info
      const endpoints = ['/', '/-/ping', '/-/whoami'];

      for (const endpoint of endpoints) {
        try {
          const response = await client.get(endpoint);
          return {
            url: targetUrl,
            status: 'online',
            endpoint: endpoint,
            response: response.data,
            responseTime: response.headers['x-response-time'] || 'unknown',
            timestamp: new Date().toISOString()
          };
        } catch (error) {
          // Continue to next endpoint
          continue;
        }
      }

      // If all endpoints fail
      return {
        url: targetUrl,
        status: 'limited',
        error: 'Registry is accessible but standard endpoints are not available',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      if (error.code === 'ENOTFOUND') {
        return {
          url: targetUrl,
          status: 'offline',
          error: 'Registry not reachable',
          timestamp: new Date().toISOString()
        };
      }
      return {
        url: targetUrl,
        status: 'error',
        error: error.message,
        timestamp: new Date().toISOString()
      };

    }
  }

  /**
   * Authenticate with registry
   * @param {string} registryUrl - Registry URL
   * @param {string} token - Authentication token
   * @returns {Promise<Object>} Authentication result
   */
  async authenticateRegistry(registryUrl, token) {
    if (!registryUrl || typeof registryUrl !== 'string') {
      throw new Error('Registry URL is required and must be a string');
    }

    if (!token || typeof token !== 'string') {
      throw new Error('Authentication token is required and must be a string');
    }

    const urlValidation = validateRegistryUrl(registryUrl);
    if (!urlValidation.isValid) {
      throw new Error(`Invalid registry URL: ${urlValidation.errors.join(', ')}`);
    }

    try {
      const client = axios.create({
        baseURL: registryUrl,
        timeout: this._timeout,
        headers: {
          'Authorization': `Bearer ${token}`,
          'User-Agent': 'NpmService/1.0.0',
          'Accept': 'application/json'
        }
      });

      // Try to authenticate with different endpoints
      const endpoints = ['/-/whoami', '/-/npm/user', '/-/orgs'];

      for (const endpoint of endpoints) {
        try {
          const response = await client.get(endpoint);
          return {
            success: true,
            registryUrl,
            endpoint: endpoint,
            user: response.data,
            timestamp: new Date().toISOString()
          };
        } catch (error) {
          // Continue to next endpoint
          continue;
        }
      }

      // If no standard endpoint works, try a simple package lookup
      try {
        await client.get('/npm');
        return {
          success: true,
          registryUrl,
          endpoint: 'basic-access',
          message: 'Basic authentication confirmed via package access',
          timestamp: new Date().toISOString()
        };
      } catch (error) {
        // Authentication failed
        throw new Error('Authentication failed: Unable to access registry with provided token');
      }
    } catch (error) {
      if (error.response) {
        const status = error.response.status;
        if (status === 401) {
          throw new Error('Authentication failed: Invalid token');
        } else if (status === 403) {
          throw new Error('Authentication failed: Token does not have required permissions');
        }
      }
      throw new Error(`Authentication error: ${error.message}`);
    }
  }

  /**
   * Clear the package cache
   * @returns {Promise<Object>} Cache clearing result
   */
  async clearCache() {
    if (!this._enableCache) {
      return {
        success: false,
        message: 'Cache is not enabled'
      };
    }

    try {
      this._memoryCache.clear();

      // Clear cache file
      const cacheFile = path.join(this._cacheDir, 'cache.json');
      if (fs.existsSync(cacheFile)) {
        fs.removeSync(cacheFile);
      }

      return {
        success: true,
        message: 'Cache cleared successfully',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to clear cache: ${error.message}`,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Get cache statistics
   * @returns {Promise<Object>} Cache statistics
   */
  async getCacheStats() {
    if (!this._enableCache) {
      return {
        enabled: false,
        message: 'Cache is not enabled'
      };
    }

    try {
      const cacheFile = path.join(this._cacheDir, 'cache.json');
      let diskSize = 0;

      if (fs.existsSync(cacheFile)) {
        const stats = fs.statSync(cacheFile);
        diskSize = stats.size;
      }

      return {
        enabled: true,
        entryCount: this._memoryCache.size,
        memoryUsage: process.memoryUsage().heapUsed,
        diskSize: diskSize,
        maxCacheSize: this._maxCacheSize,
        cacheTtl: this._cacheTtl,
        cacheDir: this._cacheDir,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        enabled: true,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Update service configuration
   * @param {Object} config - New configuration
   */
  updateConfig(config) {
    if (config.registryUrl) {
      const urlValidation = validateRegistryUrl(config.registryUrl);
      if (!urlValidation.isValid) {
        throw new Error(`Invalid registry URL: ${urlValidation.errors.join(', ')}`);
      }
      this._registryUrl = config.registryUrl;
    }

    if (config.authToken !== undefined) {
      this._authToken = config.authToken;
    }

    if (config.timeout !== undefined) {
      if (typeof config.timeout !== 'number' || config.timeout <= 0) {
        throw new Error('Timeout must be a positive number');
      }
      this._timeout = config.timeout;
    }

    if (config.enableCache !== undefined) {
      this._enableCache = config.enableCache;
    }

    if (config.headers !== undefined) {
      this._headers = { ...this._headers, ...config.headers };
    }

    // Recreate HTTP client with new configuration
    this._createHttpClient();
  }

  /**
   * Get service configuration
   * @returns {Object} Current configuration
   */
  getConfig() {
    return {
      registryUrl: this._registryUrl,
      timeout: this._timeout,
      enableCache: this._enableCache,
      cacheDir: this._cacheDir,
      cacheTtl: this._cacheTtl,
      maxCacheSize: this._maxCacheSize,
      hasAuthToken: Boolean(this._authToken),
      headers: this._headers
    };
  }
}

module.exports = NpmService;
