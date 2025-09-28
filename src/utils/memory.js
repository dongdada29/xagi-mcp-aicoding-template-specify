/**
 * Memory usage optimization utilities
 */

const v8 = require('v8');
const fs = require('fs');
const path = require('path');

class MemoryMonitor {
  constructor(options = {}) {
    this.thresholds = {
      warning: options.warning || 50 * 1024 * 1024, // 50MB
      critical: options.critical || 100 * 1024 * 1024, // 100MB
      cleanup: options.cleanup || 75 * 1024 * 1024 // 75MB
    };
    this.snapshots = [];
    this.maxSnapshots = options.maxSnapshots || 10;
  }

  /**
   * Get current memory usage statistics
   * @returns {Object} Memory usage information
   */
  getMemoryUsage() {
    const usage = process.memoryUsage();
    const gcStats = v8.getHeapStatistics();

    return {
      rss: this.formatBytes(usage.rss), // Resident Set Size
      heapTotal: this.formatBytes(usage.heapTotal), // Total allocated heap
      heapUsed: this.formatBytes(usage.heapUsed), // Actually used heap
      external: this.formatBytes(usage.external), // External memory (C++ objects)
      arrayBuffers: this.formatBytes(usage.arrayBuffers), // Array buffers
      heapLimit: this.formatBytes(gcStats.heap_size_limit),
      mallocedMemory: this.formatBytes(gcStats.malloced_memory),
      peakMallocedMemory: this.formatBytes(gcStats.peak_malloced_memory),
      doesZapGarbage: gcStats.does_zap_garbage,
      numberOfNativeContexts: gcStats.number_of_native_contexts,
      numberOfDetachedContexts: gcStats.number_of_detached_contexts,
      usagePercentage: ((usage.heapUsed / usage.heapTotal) * 100).toFixed(2) + '%',
      raw: {
        rss: usage.rss,
        heapTotal: usage.heapTotal,
        heapUsed: usage.heapUsed,
        external: usage.external,
        arrayBuffers: usage.arrayBuffers
      }
    };
  }

  /**
   * Take a memory snapshot
   * @returns {Object} Snapshot data
   */
  takeSnapshot() {
    const snapshot = {
      timestamp: Date.now(),
      memory: this.getMemoryUsage()
    };

    this.snapshots.push(snapshot);

    // Keep only the most recent snapshots
    if (this.snapshots.length > this.maxSnapshots) {
      this.snapshots.shift();
    }

    return snapshot;
  }

  /**
   * Check if memory usage exceeds thresholds
   * @returns {Object} Status information
   */
  checkThresholds() {
    const heapUsed = process.memoryUsage().heapUsed;
    const status = {
      current: this.formatBytes(heapUsed),
      warning: this.formatBytes(this.thresholds.warning),
      critical: this.formatBytes(this.thresholds.critical),
      level: 'normal',
      shouldCleanup: false
    };

    if (heapUsed > this.thresholds.critical) {
      status.level = 'critical';
      status.shouldCleanup = true;
    } else if (heapUsed > this.thresholds.warning) {
      status.level = 'warning';
    } else if (heapUsed > this.thresholds.cleanup) {
      status.level = 'cleanup';
      status.shouldCleanup = true;
    }

    return status;
  }

  /**
   * Format bytes to human readable format
   * @param {number} bytes - Number of bytes
   * @returns {string} Formatted string
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Force garbage collection if available
   * @returns {boolean} True if GC was triggered
   */
  forceGarbageCollection() {
    if (global.gc) {
      global.gc();
      return true;
    }
    return false;
  }

  /**
   * Get memory usage history
   * @returns {Array} Array of snapshots
   */
  getHistory() {
    return [...this.snapshots];
  }

  /**
   * Clear memory history
   */
  clearHistory() {
    this.snapshots = [];
  }
}

class MemoryOptimizer {
  constructor(monitor = new MemoryMonitor()) {
    this.monitor = monitor;
    this.optimizations = new Map();
    this.caches = new Map();
  }

  /**
   * Create an optimized cache with size limits
   * @param {string} name - Cache name
   * @param {Object} options - Cache options
   * @returns {Object} Cache object
   */
  createCache(name, options = {}) {
    const cache = {
      data: new Map(),
      maxSize: options.maxSize || 100,
      maxMemory: options.maxMemory || 10 * 1024 * 1024, // 10MB
      ttl: options.ttl || 0, // 0 = no expiration
      cleanupInterval: options.cleanupInterval || 60000, // 1 minute
      hitCount: 0,
      missCount: 0,

      set(key, value, ttl = this.ttl) {
        // Check memory limits
        if (this.getMemorySize() > this.maxMemory) {
          this.evictLeastRecentlyUsed();
        }

        // Check size limits
        if (this.data.size >= this.maxSize) {
          this.evictLeastRecentlyUsed();
        }

        const item = {
          value,
          timestamp: Date.now(),
          ttl: ttl,
          accessCount: 0
        };

        this.data.set(key, item);
      },

      get(key) {
        const item = this.data.get(key);

        if (!item) {
          this.missCount++;
          return undefined;
        }

        // Check TTL
        if (item.ttl > 0 && Date.now() - item.timestamp > item.ttl) {
          this.data.delete(key);
          this.missCount++;
          return undefined;
        }

        item.accessCount++;
        item.timestamp = Date.now(); // Update access time
        this.hitCount++;
        return item.value;
      },

      has(key) {
        return this.data.has(key) && this.get(key) !== undefined;
      },

      delete(key) {
        return this.data.delete(key);
      },

      clear() {
        this.data.clear();
      },

      getMemorySize() {
        let size = 0;
        for (const [key, item] of this.data) {
          size += this.getItemSize(key) + this.getItemSize(item.value);
        }
        return size;
      },

      getItemSize(item) {
        return JSON.stringify(item).length * 2; // Approximate size in bytes
      },

      evictLeastRecentlyUsed() {
        let oldestKey = null;
        let oldestTime = Infinity;

        for (const [key, item] of this.data) {
          if (item.timestamp < oldestTime) {
            oldestTime = item.timestamp;
            oldestKey = key;
          }
        }

        if (oldestKey) {
          this.data.delete(oldestKey);
        }
      },

      getStats() {
        return {
          size: this.data.size,
          memoryUsage: this.formatBytes(this.getMemorySize()),
          hitRate: this.hitCount + this.missCount > 0 ?
            (this.hitCount / (this.hitCount + this.missCount) * 100).toFixed(2) + '%' : '0%',
          hits: this.hitCount,
          misses: this.missCount
        };
      },

      formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
      }
    };

    // Set up automatic cleanup
    if (cache.cleanupInterval > 0) {
      setInterval(() => {
        const now = Date.now();
        for (const [key, item] of cache.data) {
          if (item.ttl > 0 && now - item.timestamp > item.ttl) {
            cache.data.delete(key);
          }
        }
      }, cache.cleanupInterval);
    }

    this.caches.set(name, cache);
    return cache;
  }

  /**
   * Create a memory-efficient pool for expensive objects
   * @param {Function} factory - Function to create new objects
   * @param {Object} options - Pool options
   * @returns {Object} Pool object
   */
  createPool(factory, options = {}) {
    const pool = {
      items: [],
      maxSize: options.maxSize || 10,
      factory,
      createTimeout: options.createTimeout || 5000,

      async get() {
        // Return existing item if available
        if (pool.items.length > 0) {
          return pool.items.pop();
        }

        // Create new item
        return new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Pool item creation timeout'));
          }, pool.createTimeout);

          factory()
            .then(item => {
              clearTimeout(timeout);
              resolve(item);
            })
            .catch(reject);
        });
      },

      release(item) {
        if (pool.items.length < pool.maxSize) {
          // Reset item state if needed
          if (item.reset) {
            item.reset();
          }
          pool.items.push(item);
        }
      },

      clear() {
        pool.items = [];
      },

      size() {
        return pool.items.length;
      }
    };

    return pool;
  }

  /**
   * Create a memory-efficient event emitter
   * @returns {Object} Event emitter object
   */
  createEventEmitter() {
    const listeners = new Map();
    const maxListeners = 100;

    return {
      on(event, listener) {
        if (!listeners.has(event)) {
          listeners.set(event, []);
        }

        const eventListeners = listeners.get(event);
        if (eventListeners.length >= maxListeners) {
          console.warn(`Event listener limit reached for event: ${event}`);
          return false;
        }

        eventListeners.push(listener);
        return true;
      },

      emit(event, ...args) {
        const eventListeners = listeners.get(event);
        if (!eventListeners) return false;

        // Execute listeners in a new context to prevent memory leaks
        setTimeout(() => {
          for (const listener of [...eventListeners]) {
            try {
              listener(...args);
            } catch (error) {
              console.error(`Event listener error for ${event}:`, error);
            }
          }
        }, 0);

        return true;
      },

      off(event, listener) {
        const eventListeners = listeners.get(event);
        if (!eventListeners) return false;

        const index = eventListeners.indexOf(listener);
        if (index !== -1) {
          eventListeners.splice(index, 1);
          return true;
        }
        return false;
      },

      removeAllListeners(event) {
        if (event) {
          listeners.delete(event);
        } else {
          listeners.clear();
        }
      },

      listenerCount(event) {
        const eventListeners = listeners.get(event);
        return eventListeners ? eventListeners.length : 0;
      }
    };
  }

  /**
   * Optimize array operations for memory usage
   * @param {Array} array - Array to optimize
   * @returns {Array} Optimized array
   */
  optimizeArray(array) {
    // Remove undefined/null values
    const optimized = array.filter(item => item != null);

    // If array is large, consider typed arrays if possible
    if (optimized.length > 1000) {
      const allNumbers = optimized.every(item => typeof item === 'number');
      if (allNumbers) {
        return new Float64Array(optimized);
      }
    }

    return optimized;
  }

  /**
   * Create a memory-efficient string builder
   * @returns {Object} String builder object
   */
  createStringBuilder() {
    const chunks = [];
    let totalLength = 0;

    return {
      append(str) {
        if (typeof str !== 'string') {
          str = String(str);
        }
        chunks.push(str);
        totalLength += str.length;
        return this;
      },

      appendLine(str = '') {
        chunks.push(str + '\\n');
        totalLength += str.length + 1;
        return this;
      },

      toString() {
        return chunks.join('');
      },

      clear() {
        chunks.length = 0;
        totalLength = 0;
        return this;
      },

      get length() {
        return totalLength;
      }
    };
  }

  /**
   * Get memory usage statistics for all caches
   * @returns {Object} Cache statistics
   */
  getCacheStats() {
    const stats = {};
    for (const [name, cache] of this.caches) {
      stats[name] = cache.getStats();
    }
    return stats;
  }

  /**
   * Perform memory cleanup
   * @returns {Object} Cleanup results
   */
  cleanup() {
    const results = {
      cachesCleared: 0,
      memoryFreed: 0,
      before: this.monitor.getMemoryUsage(),
      after: null
    };

    // Clear caches
    for (const [name, cache] of this.caches) {
      const beforeSize = cache.getMemorySize();
      cache.clear();
      results.cachesCleared++;
      results.memoryFreed += beforeSize;
    }

    // Force garbage collection if available
    const gcTriggered = this.monitor.forceGarbageCollection();

    results.after = this.monitor.getMemoryUsage();
    results.gcTriggered = gcTriggered;

    return results;
  }
}

// Enable garbage collection if available
if (global.gc) {
  // Expose gc for testing
  module.exports.enableGC = true;
} else {
  module.exports.enableGC = false;
}

// Export memory utilities
module.exports = {
  MemoryMonitor,
  MemoryOptimizer
};