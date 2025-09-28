const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const CacheStore = require('../models/cache');
const { validateFilePath } = require('../utils/validation');

/**
 * CacheManager Service
 *
 * Manages template caching operations including storage, retrieval, validation,
 * and cleanup of cached template packages. Implements cache policies, performance
 * monitoring, and persistent storage.
 *
 * @class CacheManager
 * @property {string} cacheDir - Root cache directory path
 * @property {Object} config - Cache configuration
 * @property {Map} lruCache - In-memory LRU cache for frequently accessed entries
 * @property {Object} metrics - Performance metrics and statistics
 * @property {Object} policies - Cache policies (TTL, size limits, etc.)
 */
class CacheManager {
  /**
   * Create a new CacheManager instance
   *
   * @param {Object} options - Cache manager configuration
   * @param {string} [options.cacheDir] - Cache directory path (defaults to ~/.xagi/create-ai-project/cache)
   * @param {number} [options.ttl=24*60*60*1000] - Default TTL in milliseconds (24 hours)
   * @param {number} [options.maxSize=100*1024*1024] - Maximum cache size in bytes (100MB)
   * @param {number} [options.maxEntries=100] - Maximum number of cache entries
   * @param {boolean} [options.persistent=true] - Whether to use persistent storage
   * @param {boolean} [options.enableMetrics=true] - Whether to collect performance metrics
   * @param {number} [options.lruSize=50] - Size of in-memory LRU cache
   */
  constructor({
    cacheDir,
    ttl = 24 * 60 * 60 * 1000, // 24 hours
    maxSize = 100 * 1024 * 1024, // 100MB
    maxEntries = 100,
    persistent = true,
    enableMetrics = true,
    lruSize = 50
  } = {}) {
    this.cacheDir = cacheDir || path.join(os.homedir(), '.xagi', 'create-ai-project', 'cache');
    this.config = {
      ttl,
      maxSize,
      maxEntries,
      persistent,
      enableMetrics,
      lruSize
    };

    // Initialize LRU cache for frequently accessed entries
    this.lruCache = new Map();
    this.maxLruSize = lruSize;

    // Initialize metrics collection
    this.metrics = {
      hits: 0,
      misses: 0,
      evictions: 0,
      errors: 0,
      totalSize: 0,
      totalAccessTime: 0,
      accessCount: 0,
      startTime: Date.now()
    };

    // Cache policies
    this.policies = {
      ttl,
      maxSize,
      maxEntries,
      cleanupInterval: 60 * 60 * 1000, // 1 hour
      enableCompression: false
    };

    // Performance monitoring
    this.performance = {
      accessTimes: [],
      operationTimes: new Map(),
      lastCleanup: Date.now()
    };

    // Store intervals for cleanup
    this.intervals = [];

    // Initialize cache directory
    this.initialize();
  }

  /**
   * Initialize cache manager
   * @private
   */
  async initialize() {
    try {
      // Ensure cache directory exists
      await fs.ensureDir(this.cacheDir);

      // Load existing cache metadata if persistent storage is enabled
      if (this.config.persistent) {
        await this.loadCacheMetadata();
      }

      // Set up periodic cleanup
      this.setupPeriodicCleanup();

      // Log initialization
      if (this.config.enableMetrics) {
        console.log(`CacheManager initialized with directory: ${this.cacheDir}`);
      }
    } catch (error) {
      console.error('Failed to initialize CacheManager:', error);
      throw error;
    }
  }

  /**
   * Get cache entry for a specific template and version
   *
   * Retrieves a cache entry by template ID and version. Updates access
   * statistics and implements LRU eviction policy.
   *
   * @param {string} templateId - Template identifier
   * @param {string} version - Template version
   * @returns {Promise<CacheStore|null>} Cache entry or null if not found
   * @throws {Error} If cache retrieval fails
   */
  async getCacheEntry(templateId, version) {
    const startTime = Date.now();

    try {
      // Generate cache entry ID
      const cacheId = this.generateCacheId(templateId, version);
      const cachePath = path.join(this.cacheDir, cacheId);

      // Check LRU cache first
      if (this.lruCache.has(cacheId)) {
        const cacheEntry = this.lruCache.get(cacheId);
        await cacheEntry.touch();
        this.updateLruCache(cacheId, cacheEntry);

        // Update metrics
        this.metrics.hits++;
        this.updateAccessMetrics(Date.now() - startTime);

        return cacheEntry;
      }

      // Check if cache entry exists on disk
      if (!(await fs.pathExists(cachePath))) {
        this.metrics.misses++;
        return null;
      }

      // Load cache entry from metadata
      const cacheEntry = await this.loadCacheEntryFromDisk(templateId, version, cachePath);

      if (!cacheEntry) {
        this.metrics.misses++;
        return null;
      }

      // Validate cache entry
      const isValid = await this.validateCacheEntry(cacheEntry);
      if (!isValid) {
        await this.removeCacheEntry(templateId, version);
        this.metrics.misses++;
        return null;
      }

      // Add to LRU cache
      this.updateLruCache(cacheId, cacheEntry);

      // Update metrics
      this.metrics.hits++;
      this.updateAccessMetrics(Date.now() - startTime);

      return cacheEntry;
    } catch (error) {
      this.metrics.errors++;
      console.error(`Failed to get cache entry for ${templateId}@${version}:`, error);
      throw error;
    }
  }

  /**
   * Set cache entry for a specific template and version
   *
   * Creates or updates a cache entry with the specified template data.
   * Enforces cache policies and size limits.
   *
   * @param {string} templateId - Template identifier
   * @param {string} version - Template version
   * @param {string} sourcePath - Source path to template files
   * @returns {Promise<CacheStore>} Created cache entry
   * @throws {Error} If cache creation fails
   */
  async setCacheEntry(templateId, version, sourcePath) {
    const startTime = Date.now();

    try {
      // Validate inputs
      if (!templateId || !version || !sourcePath) {
        throw new Error('Template ID, version, and source path are required');
      }

      // Validate source path
      const pathValidation = validateFilePath(sourcePath);
      if (!pathValidation.isValid) {
        throw new Error(`Invalid source path: ${pathValidation.errors.join(', ')}`);
      }

      // Check if source exists
      if (!(await fs.pathExists(sourcePath))) {
        throw new Error(`Source path does not exist: ${sourcePath}`);
      }

      // Generate cache entry ID and path
      const cacheId = this.generateCacheId(templateId, version);
      const cachePath = path.join(this.cacheDir, cacheId);

      // Remove existing cache entry if it exists
      if (await fs.pathExists(cachePath)) {
        await this.removeCacheEntry(templateId, version);
      }

      // Check cache policies before creating new entry
      await this.enforceCachePolicies();

      // Create cache directory
      await fs.ensureDir(cachePath);

      // Copy template files to cache
      await fs.copy(sourcePath, cachePath);

      // Calculate checksum
      const checksum = await this.calculateDirectoryChecksum(sourcePath);

      // Create cache entry
      const cacheEntry = new CacheStore({
        id: cacheId,
        templateId,
        version,
        path: cachePath,
        checksum,
        isValid: true,
        accessCount: 0
      });

      // Save cache entry metadata
      await this.saveCacheEntryMetadata(cacheEntry);

      // Add to LRU cache
      this.updateLruCache(cacheId, cacheEntry);

      // Update metrics
      this.updateSizeMetrics();
      this.updateAccessMetrics(Date.now() - startTime);

      return cacheEntry;
    } catch (error) {
      this.metrics.errors++;
      console.error(`Failed to set cache entry for ${templateId}@${version}:`, error);
      throw error;
    }
  }

  /**
   * Remove cache entry for a specific template and version
   *
   * Safely removes a cache entry and its associated files from the filesystem.
   * Updates cache statistics and cleans up metadata.
   *
   * @param {string} templateId - Template identifier
   * @param {string} version - Template version
   * @returns {Promise<boolean>} True if removal was successful
   * @throws {Error} If cache removal fails
   */
  async removeCacheEntry(templateId, version) {
    const startTime = Date.now();

    try {
      const cacheId = this.generateCacheId(templateId, version);
      const cachePath = path.join(this.cacheDir, cacheId);

      // Remove from LRU cache
      this.lruCache.delete(cacheId);

      // Remove from disk if it exists
      if (await fs.pathExists(cachePath)) {
        await fs.remove(cachePath);
      }

      // Remove metadata file
      const metadataPath = path.join(this.cacheDir, `${cacheId}.meta.json`);
      if (await fs.pathExists(metadataPath)) {
        await fs.remove(metadataPath);
      }

      // Update metrics
      this.metrics.evictions++;
      this.updateSizeMetrics();
      this.updateAccessMetrics(Date.now() - startTime);

      return true;
    } catch (error) {
      this.metrics.errors++;
      console.error(`Failed to remove cache entry for ${templateId}@${version}:`, error);
      throw error;
    }
  }

  /**
   * Clear all cache entries
   *
   * Removes all cache entries and metadata. Optionally preserves
   * specific entries based on criteria.
   *
   * @param {Object} options - Clear options
   * @param {Array<string>} [options.preserve] - Template IDs to preserve
   * @param {boolean} [options.force=false] - Force clear without confirmation
   * @returns {Promise<Object>} Clear operation results
   * @throws {Error} If cache clearing fails
   */
  async clearCache(options = {}) {
    const startTime = Date.now();
    const { preserve = [], force = false } = options;

    try {
      // Get all cache entries
      const entries = await this.getAllCacheEntries();
      let clearedCount = 0;
      let preservedCount = 0;

      for (const entry of entries) {
        if (preserve.includes(entry.templateId)) {
          preservedCount++;
          continue;
        }

        try {
          await this.removeCacheEntry(entry.templateId, entry.version);
          clearedCount++;
        } catch (error) {
          console.warn(`Failed to clear cache entry ${entry.templateId}@${entry.version}:`, error);
        }
      }

      // Clear LRU cache
      this.lruCache.clear();

      // Update metrics
      this.updateSizeMetrics();
      this.updateAccessMetrics(Date.now() - startTime);

      return {
        success: true,
        clearedEntries: clearedCount,
        preservedEntries: preservedCount,
        totalEntries: entries.length,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.metrics.errors++;
      console.error('Failed to clear cache:', error);
      throw error;
    }
  }

  /**
   * Prune expired or invalid cache entries
   *
   * Removes cache entries that are expired, invalid, or exceed
   * size limits. Can perform dry run to preview changes.
   *
   * @param {Object} options - Prune options
   * @param {boolean} [options.dryRun=false] - Preview without actual removal
   * @param {boolean} [options.aggressive=false] - Remove all invalid entries
   * @returns {Promise<Object>} Prune operation results
   * @throws {Error} If pruning fails
   */
  async pruneCache(options = {}) {
    const startTime = Date.now();
    const { dryRun = false, aggressive = false } = options;

    try {
      const entries = await this.getAllCacheEntries();
      let removedCount = 0;
      let remainingCount = 0;
      const removedEntries = [];
      const reasons = new Map();

      for (const entry of entries) {
        let shouldRemove = false;
        let reason = '';

        // Check if entry is expired
        if (entry.isExpired(this.policies.ttl)) {
          shouldRemove = true;
          reason = 'expired';
        }

        // Check if entry is valid
        if (!entry.isValid || aggressive) {
          try {
            const isValid = await entry.validate();
            if (!isValid) {
              shouldRemove = true;
              reason = 'invalid';
            }
          } catch (error) {
            shouldRemove = true;
            reason = 'validation_failed';
          }
        }

        // Check size limits
        if (this.metrics.totalSize > this.policies.maxSize) {
          shouldRemove = true;
          reason = 'size_limit';
        }

        if (shouldRemove) {
          if (!dryRun) {
            try {
              await this.removeCacheEntry(entry.templateId, entry.version);
              removedCount++;
              removedEntries.push(entry);
              reasons.set(entry.id, reason);
            } catch (error) {
              console.warn(`Failed to prune cache entry ${entry.templateId}@${entry.version}:`, error);
            }
          } else {
            removedCount++;
            removedEntries.push(entry);
            reasons.set(entry.id, reason);
          }
        } else {
          remainingCount++;
        }
      }

      // Update metrics
      this.metrics.evictions += removedCount;
      this.updateSizeMetrics();
      this.updateAccessMetrics(Date.now() - startTime);

      return {
        success: true,
        removedEntries: removedCount,
        remainingEntries: remainingCount,
        totalEntries: entries.length,
        dryRun,
        removedEntries: removedEntries,
        reasons: Object.fromEntries(reasons),
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.metrics.errors++;
      console.error('Failed to prune cache:', error);
      throw error;
    }
  }

  /**
   * Get cache statistics and performance metrics
   *
   * Returns comprehensive cache statistics including size, entry counts,
   * performance metrics, and policy information.
   *
   * @returns {Promise<Object>} Cache statistics
   */
  async getCacheStats() {
    try {
      // Get current cache entries
      const entries = await this.getAllCacheEntries();

      // Calculate statistics
      const stats = {
        basic: {
          totalEntries: entries.length,
          totalSize: this.metrics.totalSize,
          cacheDirectory: this.cacheDir,
          uptime: Date.now() - this.metrics.startTime
        },
        performance: {
          hits: this.metrics.hits,
          misses: this.metrics.misses,
          hitRate: this.calculateHitRate(),
          evictions: this.metrics.evictions,
          errors: this.metrics.errors,
          averageAccessTime: this.calculateAverageAccessTime(),
          totalAccessTime: this.metrics.totalAccessTime,
          accessCount: this.metrics.accessCount
        },
        policies: {
          ttl: this.policies.ttl,
          maxSize: this.policies.maxSize,
          maxEntries: this.policies.maxEntries,
          currentUtilization: this.calculateUtilization(),
          sizeRemaining: Math.max(0, this.policies.maxSize - this.metrics.totalSize)
        },
        lru: {
          lruSize: this.lruCache.size,
          maxLruSize: this.maxLruSize,
          lruHitRate: this.calculateLruHitRate()
        },
        entries: entries.map(entry => ({
          id: entry.id,
          templateId: entry.templateId,
          version: entry.version,
          size: entry.size || 0,
          accessCount: entry.accessCount,
          lastAccessed: entry.lastAccessed,
          createdAt: entry.createdAt,
          isValid: entry.isValid,
          formattedSize: entry.getFormattedSize(),
          formattedAge: entry.getFormattedAge()
        }))
      };

      return stats;
    } catch (error) {
      console.error('Failed to get cache stats:', error);
      throw error;
    }
  }

  /**
   * Check if a template is cached
   *
   * Quickly checks if a specific template version exists in the cache
   * without loading the full cache entry.
   *
   * @param {string} templateId - Template identifier
   * @param {string} version - Template version
   * @returns {Promise<boolean>} True if template is cached
   */
  async isCached(templateId, version) {
    try {
      const cacheId = this.generateCacheId(templateId, version);
      const cachePath = path.join(this.cacheDir, cacheId);

      // Check LRU cache first
      if (this.lruCache.has(cacheId)) {
        return true;
      }

      // Check if cache entry exists on disk
      return await fs.pathExists(cachePath);
    } catch (error) {
      console.error(`Failed to check if ${templateId}@${version} is cached:`, error);
      return false;
    }
  }

  /**
   * Generate unique cache ID from template ID and version
   * @private
   */
  generateCacheId(templateId, version) {
    return `${templateId}@${version}`;
  }

  /**
   * Load cache entry from disk
   * @private
   */
  async loadCacheEntryFromDisk(templateId, version, cachePath) {
    try {
      const metadataPath = path.join(this.cacheDir, `${this.generateCacheId(templateId, version)}.meta.json`);

      if (!(await fs.pathExists(metadataPath))) {
        return null;
      }

      const metadata = await fs.readJSON(metadataPath);
      return CacheStore.fromJSON(metadata);
    } catch (error) {
      console.error('Failed to load cache entry from disk:', error);
      return null;
    }
  }

  /**
   * Save cache entry metadata
   * @private
   */
  async saveCacheEntryMetadata(cacheEntry) {
    try {
      if (!this.config.persistent) {
        return;
      }

      const metadataPath = path.join(this.cacheDir, `${cacheEntry.id}.meta.json`);
      await fs.writeJSON(metadataPath, cacheEntry.toJSON(), { spaces: 2 });
    } catch (error) {
      console.error('Failed to save cache entry metadata:', error);
    }
  }

  /**
   * Load all cache metadata
   * @private
   */
  async loadCacheMetadata() {
    try {
      const files = await fs.readdir(this.cacheDir);
      const metadataFiles = files.filter(file => file.endsWith('.meta.json'));

      for (const file of metadataFiles) {
        try {
          const metadataPath = path.join(this.cacheDir, file);
          const metadata = await fs.readJSON(metadataPath);
          const cacheEntry = CacheStore.fromJSON(metadata);

          // Add to LRU cache if space allows
          if (this.lruCache.size < this.maxLruSize) {
            this.lruCache.set(cacheEntry.id, cacheEntry);
          }
        } catch (error) {
          console.warn(`Failed to load metadata from ${file}:`, error);
        }
      }
    } catch (error) {
      console.error('Failed to load cache metadata:', error);
    }
  }

  /**
   * Get all cache entries
   * @private
   */
  async getAllCacheEntries() {
    try {
      const entries = [];

      // Add entries from LRU cache
      for (const [cacheId, cacheEntry] of this.lruCache) {
        entries.push(cacheEntry);
      }

      // Add entries from disk
      const files = await fs.readdir(this.cacheDir);
      const metadataFiles = files.filter(file => file.endsWith('.meta.json'));

      for (const file of metadataFiles) {
        const cacheId = file.replace('.meta.json', '');

        // Skip if already in LRU cache
        if (this.lruCache.has(cacheId)) {
          continue;
        }

        try {
          const metadataPath = path.join(this.cacheDir, file);
          const metadata = await fs.readJSON(metadataPath);
          const cacheEntry = CacheStore.fromJSON(metadata);
          entries.push(cacheEntry);
        } catch (error) {
          console.warn(`Failed to load cache entry from ${file}:`, error);
        }
      }

      return entries;
    } catch (error) {
      console.error('Failed to get all cache entries:', error);
      return [];
    }
  }

  /**
   * Validate cache entry
   * @private
   */
  async validateCacheEntry(cacheEntry) {
    try {
      return await cacheEntry.validate();
    } catch (error) {
      console.error(`Cache entry validation failed for ${cacheEntry.templateId}@${cacheEntry.version}:`, error);
      return false;
    }
  }

  /**
   * Update LRU cache with eviction policy
   * @private
   */
  updateLruCache(cacheId, cacheEntry) {
    // Remove from cache if it exists (to update position)
    if (this.lruCache.has(cacheId)) {
      this.lruCache.delete(cacheId);
    }

    // Add to cache
    this.lruCache.set(cacheId, cacheEntry);

    // Evict oldest entry if cache is full
    if (this.lruCache.size > this.maxLruSize) {
      const oldestKey = this.lruCache.keys().next().value;
      this.lruCache.delete(oldestKey);
    }
  }

  /**
   * Enforce cache policies (size limits, entry limits)
   * @private
   */
  async enforceCachePolicies() {
    const entries = await this.getAllCacheEntries();

    // Check entry count limit
    if (entries.length >= this.policies.maxEntries) {
      // Sort by last accessed (oldest first)
      entries.sort((a, b) => a.lastAccessed - b.lastAccessed);

      // Remove oldest entries until under limit
      const toRemove = entries.length - this.policies.maxEntries + 1;
      for (let i = 0; i < toRemove; i++) {
        await this.removeCacheEntry(entries[i].templateId, entries[i].version);
      }
    }

    // Check size limit
    if (this.metrics.totalSize >= this.policies.maxSize) {
      // Sort by size (largest first)
      entries.sort((a, b) => (b.size || 0) - (a.size || 0));

      // Remove largest entries until under limit
      for (const entry of entries) {
        if (this.metrics.totalSize < this.policies.maxSize) {
          break;
        }
        await this.removeCacheEntry(entry.templateId, entry.version);
      }
    }
  }

  /**
   * Update size metrics
   * @private
   */
  async updateSizeMetrics() {
    try {
      const entries = await this.getAllCacheEntries();
      this.metrics.totalSize = entries.reduce((total, entry) => total + (entry.size || 0), 0);
    } catch (error) {
      console.error('Failed to update size metrics:', error);
    }
  }

  /**
   * Update access metrics
   * @private
   */
  updateAccessMetrics(accessTime) {
    this.metrics.totalAccessTime += accessTime;
    this.metrics.accessCount++;

    // Track recent access times for performance analysis
    this.performance.accessTimes.push(accessTime);
    if (this.performance.accessTimes.length > 100) {
      this.performance.accessTimes.shift();
    }
  }

  /**
   * Calculate hit rate
   * @private
   */
  calculateHitRate() {
    const total = this.metrics.hits + this.metrics.misses;
    return total > 0 ? (this.metrics.hits / total) * 100 : 0;
  }

  /**
   * Calculate average access time
   * @private
   */
  calculateAverageAccessTime() {
    return this.metrics.accessCount > 0 ? this.metrics.totalAccessTime / this.metrics.accessCount : 0;
  }

  /**
   * Calculate cache utilization
   * @private
   */
  calculateUtilization() {
    return this.policies.maxSize > 0 ? (this.metrics.totalSize / this.policies.maxSize) * 100 : 0;
  }

  /**
   * Calculate LRU hit rate
   * @private
   */
  calculateLruHitRate() {
    // This would need to be tracked separately for accurate LRU hit rate
    return this.calculateHitRate(); // Fallback to overall hit rate
  }

  /**
   * Calculate directory checksum
   * @private
   */
  async calculateDirectoryChecksum(dirPath) {
    const hash = crypto.createHash('sha256');

    try {
      await this.addFilesToHash(dirPath, hash);
      return hash.digest('hex');
    } catch (error) {
      throw new Error(`Failed to calculate directory checksum: ${error.message}`);
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
   * Set up periodic cleanup
   * @private
   */
  setupPeriodicCleanup() {
    // Only set up periodic cleanup if not in test environment
    if (process.env.NODE_ENV !== 'test') {
      // Set up periodic cleanup interval
      const interval = setInterval(async() => {
        try {
          await this.pruneCache({ aggressive: false });
          this.performance.lastCleanup = Date.now();
        } catch (error) {
          console.error('Periodic cache cleanup failed:', error);
        }
      }, this.policies.cleanupInterval);

      this.intervals.push(interval);
    }
  }

  /**
   * Get detailed performance metrics
   * @returns {Object} Performance metrics
   */
  getPerformanceMetrics() {
    return {
      accessTimes: [...this.performance.accessTimes],
      operationTimes: Object.fromEntries(this.performance.operationTimes),
      lastCleanup: this.performance.lastCleanup,
      averageAccessTime: this.calculateAverageAccessTime(),
      recentAccessTimes: this.performance.accessTimes.slice(-10),
      cacheHitRate: this.calculateHitRate(),
      lruHitRate: this.calculateLruHitRate()
    };
  }

  /**
   * Reset performance metrics
   */
  resetMetrics() {
    this.metrics = {
      hits: 0,
      misses: 0,
      evictions: 0,
      errors: 0,
      totalSize: this.metrics.totalSize,
      totalAccessTime: 0,
      accessCount: 0,
      startTime: Date.now()
    };

    this.performance.accessTimes = [];
    this.performance.operationTimes.clear();
  }

  /**
   * Clean up resources and intervals
   * Call this method when destroying the CacheManager instance
   */
  destroy() {
    // Clear all intervals
    this.intervals.forEach(interval => clearInterval(interval));
    this.intervals = [];

    // Clear LRU cache
    this.lruCache.clear();

    // Clear performance data
    this.performance.accessTimes = [];
    this.performance.operationTimes.clear();
  }
}

module.exports = CacheManager;
