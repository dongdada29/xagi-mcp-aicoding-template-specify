const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');
const { validateFilePath } = require('../utils/validation');

/**
 * CacheStore Model
 *
 * Represents a cached template package entry in the local filesystem.
 * Manages cache entry lifecycle, validation, and filesystem operations.
 *
 * @class CacheStore
 * @property {string} id - Unique cache entry identifier
 * @property {string} templateId - Reference to TemplatePackage
 * @property {string} version - Cached template version
 * @property {string} path - Local file system path
 * @property {number} size - Cache entry size in bytes
 * @property {Date} createdAt - Cache creation timestamp
 * @property {Date} lastAccessed - Last access timestamp
 * @property {number} accessCount - Number of times accessed
 * @property {string} checksum - Template package checksum
 * @property {boolean} isValid - Whether cache entry is valid
 */
class CacheStore {
  /**
   * Create a new CacheStore instance
   *
   * @param {Object} options - Cache entry options
   * @param {string} options.id - Unique cache entry identifier
   * @param {string} options.templateId - Reference to TemplatePackage
   * @param {string} options.version - Cached template version
   * @param {string} options.path - Local file system path
   * @param {number} [options.size] - Cache entry size in bytes
   * @param {Date} [options.createdAt] - Cache creation timestamp
   * @param {Date} [options.lastAccessed] - Last access timestamp
   * @param {number} [options.accessCount=0] - Number of times accessed
   * @param {string} [options.checksum] - Template package checksum
   * @param {boolean} [options.isValid=true] - Whether cache entry is valid
   */
  constructor({
    id,
    templateId,
    version,
    path,
    size,
    createdAt,
    lastAccessed,
    accessCount = 0,
    checksum,
    isValid = true
  }) {
    this.validateConstructorParams({
      id,
      templateId,
      version,
      path,
      size,
      createdAt,
      lastAccessed,
      accessCount,
      checksum,
      isValid
    });

    this.id = id;
    this.templateId = templateId;
    this.version = version;
    this.path = path;
    this.size = size;
    this.createdAt = createdAt || new Date();
    this.lastAccessed = lastAccessed || new Date();
    this.accessCount = accessCount;
    this.checksum = checksum;
    this.isValid = isValid;
  }

  /**
   * Validate constructor parameters
   * @private
   */
  validateConstructorParams(params) {
    if (!params.id || typeof params.id !== 'string') {
      throw new Error('Cache entry ID is required and must be a string');
    }

    if (!params.templateId || typeof params.templateId !== 'string') {
      throw new Error('Template ID is required and must be a string');
    }

    if (!params.version || typeof params.version !== 'string') {
      throw new Error('Version is required and must be a string');
    }

    if (!params.path || typeof params.path !== 'string') {
      throw new Error('Path is required and must be a string');
    }

    if (params.size && (typeof params.size !== 'number' || params.size < 0)) {
      throw new Error('Size must be a non-negative number');
    }

    if (params.accessCount && (typeof params.accessCount !== 'number' || params.accessCount < 0)) {
      throw new Error('Access count must be a non-negative number');
    }

    if (params.checksum && typeof params.checksum !== 'string') {
      throw new Error('Checksum must be a string');
    }

    if (typeof params.isValid !== 'boolean' && params.isValid !== undefined) {
      throw new Error('isValid must be a boolean');
    }
  }

  /**
   * Validate cache entry integrity
   *
   * Validates the cache entry by checking:
   * - Filesystem path existence
   * - Checksum validation (if checksum is set)
   * - Directory structure integrity
   *
   * @returns {Promise<boolean>} True if cache entry is valid
   * @throws {Error} If validation fails with specific error details
   */
  async validate() {
    try {
      // Check if path exists
      const pathExists = await fs.pathExists(this.path);
      if (!pathExists) {
        this.isValid = false;
        throw new Error(`Cache path does not exist: ${this.path}`);
      }

      // Validate file path
      const pathValidation = validateFilePath(this.path);
      if (!pathValidation.isValid) {
        this.isValid = false;
        throw new Error(`Invalid cache path: ${pathValidation.errors.join(', ')}`);
      }

      // Check if it's a directory
      const stats = await fs.stat(this.path);
      if (!stats.isDirectory()) {
        this.isValid = false;
        throw new Error(`Cache path is not a directory: ${this.path}`);
      }

      // Calculate actual size if not set
      if (this.size === undefined) {
        this.size = await this.calculateDirectorySize();
      }

      // Validate checksum if provided
      if (this.checksum) {
        const actualChecksum = await this.calculateChecksum();
        if (actualChecksum !== this.checksum) {
          this.isValid = false;
          throw new Error(`Checksum mismatch. Expected: ${this.checksum}, Actual: ${actualChecksum}`);
        }
      }

      this.isValid = true;
      return true;
    } catch (error) {
      this.isValid = false;
      throw error;
    }
  }

  /**
   * Update last accessed timestamp and increment access count
   *
   * @returns {Promise<void>}
   */
  async touch() {
    this.lastAccessed = new Date();
    this.accessCount++;

    // Optionally persist to a metadata file
    await this.saveMetadata();
  }

  /**
   * Check if cache entry is expired based on TTL
   *
   * @param {number} ttl - Time to live in milliseconds
   * @returns {boolean} True if cache entry is expired
   */
  isExpired(ttl) {
    const now = new Date();
    const expirationTime = new Date(this.lastAccessed.getTime() + ttl);
    return now > expirationTime;
  }

  /**
   * Get cache entry size
   *
   * Returns the size of the cache entry in bytes.
   * If size is not set, calculates it from the filesystem.
   *
   * @returns {Promise<number>} Size in bytes
   */
  async getSize() {
    if (this.size === undefined) {
      this.size = await this.calculateDirectorySize();
    }
    return this.size;
  }

  /**
   * Remove cache entry from filesystem
   *
   * Safely removes the cache directory and all its contents.
   * Validates the path before deletion to prevent accidental removal.
   *
   * @returns {Promise<boolean>} True if removal was successful
   * @throws {Error} If removal fails or path validation fails
   */
  async remove() {
    try {
      // Validate path before removal
      const pathValidation = validateFilePath(this.path);
      if (!pathValidation.isValid) {
        throw new Error(`Cannot remove cache entry - invalid path: ${pathValidation.errors.join(', ')}`);
      }

      // Additional safety check - ensure path is not a critical system directory
      const systemDirs = ['/etc', '/usr/bin', '/usr/sbin', '/usr/lib', '/bin', '/sbin', '/System'];
      const isInSystemDir = systemDirs.some(dir => this.path.startsWith(dir));
      if (isInSystemDir) {
        throw new Error(`Cannot remove cache entry - path is in system directory: ${this.path}`);
      }

      await fs.remove(this.path);
      this.isValid = false;
      return true;
    } catch (error) {
      throw new Error(`Failed to remove cache entry: ${error.message}`);
    }
  }

  /**
   * Serialize cache entry to JSON
   *
   * Returns a JSON-serializable object with all cache entry properties.
   * Dates are converted to ISO strings for serialization.
   *
   * @returns {Object} JSON-serializable object
   */
  toJSON() {
    return {
      id: this.id,
      templateId: this.templateId,
      version: this.version,
      path: this.path,
      size: this.size,
      createdAt: this.createdAt.toISOString(),
      lastAccessed: this.lastAccessed.toISOString(),
      accessCount: this.accessCount,
      checksum: this.checksum,
      isValid: this.isValid
    };
  }

  /**
   * Create CacheStore instance from JSON data
   *
   * @static
   * @param {Object} data - JSON data
   * @returns {CacheStore} CacheStore instance
   */
  static fromJSON(data) {
    return new CacheStore({
      id: data.id,
      templateId: data.templateId,
      version: data.version,
      path: data.path,
      size: data.size,
      createdAt: new Date(data.createdAt),
      lastAccessed: new Date(data.lastAccessed),
      accessCount: data.accessCount,
      checksum: data.checksum,
      isValid: data.isValid
    });
  }

  /**
   * Calculate directory size recursively
   * @private
   */
  async calculateDirectorySize() {
    let totalSize = 0;

    try {
      const files = await fs.readdir(this.path);

      for (const file of files) {
        const filePath = path.join(this.path, file);
        const stats = await fs.stat(filePath);

        if (stats.isFile()) {
          totalSize += stats.size;
        } else if (stats.isDirectory()) {
          // Recursively calculate subdirectory sizes
          const subDirSize = await this.calculateSubdirectorySize(filePath);
          totalSize += subDirSize;
        }
      }
    } catch (error) {
      throw new Error(`Failed to calculate directory size: ${error.message}`);
    }

    return totalSize;
  }

  /**
   * Calculate subdirectory size recursively
   * @private
   */
  async calculateSubdirectorySize(dirPath) {
    let size = 0;

    try {
      const files = await fs.readdir(dirPath);

      for (const file of files) {
        const filePath = path.join(dirPath, file);
        const stats = await fs.stat(filePath);

        if (stats.isFile()) {
          size += stats.size;
        } else if (stats.isDirectory()) {
          size += await this.calculateSubdirectorySize(filePath);
        }
      }
    } catch (error) {
      // If directory doesn't exist, return 0
      return 0;
    }

    return size;
  }

  /**
   * Calculate checksum for cache directory
   * @returns {Promise<string>} SHA-256 checksum hex string
   */
  async calculateChecksum() {
    const hash = crypto.createHash('sha256');

    try {
      await this.addFilesToHash(this.path, hash);
      return hash.digest('hex');
    } catch (error) {
      throw new Error(`Failed to calculate checksum: ${error.message}`);
    }
  }

  /**
   * Recursively add files to hash calculation
   * @private
   */
  async addFilesToHash(dirPath, hash) {
    const files = await fs.readdir(dirPath);

    // Sort files for consistent hashing
    files.sort();

    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stats = await fs.stat(filePath);

      if (stats.isFile()) {
        const fileContent = await fs.readFile(filePath);
        hash.update(fileContent);
      } else if (stats.isDirectory()) {
        await this.addFilesToHash(filePath, hash);
      }
    }
  }

  /**
   * Save metadata to cache directory
   * @private
   */
  async saveMetadata() {
    const metadataPath = path.join(this.path, '.cache-metadata.json');

    try {
      await fs.writeFile(
        metadataPath,
        JSON.stringify(this.toJSON(), null, 2),
        'utf8'
      );
    } catch (error) {
      // Non-critical error, don't throw
      console.warn(`Failed to save cache metadata: ${error.message}`);
    }
  }

  /**
   * Load metadata from cache directory
   * @private
   */
  async loadMetadata() {
    const metadataPath = path.join(this.path, '.cache-metadata.json');

    try {
      if (await fs.pathExists(metadataPath)) {
        const metadata = await fs.readJSON(metadataPath);
        this.lastAccessed = new Date(metadata.lastAccessed);
        this.accessCount = metadata.accessCount;
        this.isValid = metadata.isValid;
      }
    } catch (error) {
      // Non-critical error, don't throw
      console.warn(`Failed to load cache metadata: ${error.message}`);
    }
  }

  /**
   * Get human-readable size format
   *
   * @returns {string} Human-readable size (e.g., "1.2 MB")
   */
  getFormattedSize() {
    const bytes = this.size || 0;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 B';

    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Get cache age in human-readable format
   *
   * @returns {string} Human-readable age (e.g., "2 days ago")
   */
  getFormattedAge() {
    const now = new Date();
    const diff = now - this.createdAt;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 60) {
      return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
    } else if (hours < 24) {
      return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    } else {
      return `${days} day${days !== 1 ? 's' : ''} ago`;
    }
  }
}

module.exports = CacheStore;