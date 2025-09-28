/**
 * Performance monitoring utilities for CLI
 */

const performance = require('perf_hooks').performance;

class PerformanceMonitor {
  constructor() {
    this.metrics = new Map();
    this.thresholds = {
      warning: 100, // 100ms
      critical: 200 // 200ms
    };
  }

  /**
   * Start measuring performance for an operation
   * @param {string} operation - Operation name
   * @returns {Function} Function to call when operation completes
   */
  measure(operation) {
    const startTime = performance.now();

    return () => {
      const endTime = performance.now();
      const duration = endTime - startTime;

      this.recordMetric(operation, duration);
      this.checkThreshold(operation, duration);

      return duration;
    };
  }

  /**
   * Record performance metric
   * @param {string} operation - Operation name
   * @param {number} duration - Duration in milliseconds
   */
  recordMetric(operation, duration) {
    if (!this.metrics.has(operation)) {
      this.metrics.set(operation, {
        count: 0,
        totalTime: 0,
        minTime: Infinity,
        maxTime: 0,
        avgTime: 0
      });
    }

    const metric = this.metrics.get(operation);
    metric.count++;
    metric.totalTime += duration;
    metric.minTime = Math.min(metric.minTime, duration);
    metric.maxTime = Math.max(metric.maxTime, duration);
    metric.avgTime = metric.totalTime / metric.count;
  }

  /**
   * Check if performance threshold is exceeded
   * @param {string} operation - Operation name
   * @param {number} duration - Duration in milliseconds
   */
  checkThreshold(operation, duration) {
    if (duration > this.thresholds.critical) {
      console.warn(`⚠️  Performance warning: ${operation} took ${duration.toFixed(2)}ms (exceeds ${this.thresholds.critical}ms threshold)`);
    } else if (duration > this.thresholds.warning) {
      console.warn(`⚠️  Performance note: ${operation} took ${duration.toFixed(2)}ms (exceeds ${this.thresholds.warning}ms threshold)`);
    }
  }

  /**
   * Get performance statistics
   * @returns {Object} Performance statistics
   */
  getStats() {
    const stats = {
      operations: {},
      summary: {
        totalOperations: 0,
        totalTime: 0,
        overallAvg: 0
      }
    };

    let totalOps = 0;
    let totalTime = 0;

    for (const [operation, metric] of this.metrics) {
      stats.operations[operation] = {
        ...metric,
        formattedAvg: `${metric.avgTime.toFixed(2)}ms`,
        formattedMin: `${metric.minTime.toFixed(2)}ms`,
        formattedMax: `${metric.maxTime.toFixed(2)}ms`
      };

      totalOps += metric.count;
      totalTime += metric.totalTime;
    }

    stats.summary.totalOperations = totalOps;
    stats.summary.totalTime = totalTime;
    stats.summary.overallAvg = totalOps > 0 ? totalTime / totalOps : 0;
    stats.summary.formattedOverallAvg = `${stats.summary.overallAvg.toFixed(2)}ms`;

    return stats;
  }

  /**
   * Reset all metrics
   */
  reset() {
    this.metrics.clear();
  }

  /**
   * Enable performance monitoring for CLI commands
   */
  static enableCLIMonitoring() {
    const monitor = new PerformanceMonitor();

    // Monitor process startup time
    const startupStart = performance.now();

    process.on('exit', () => {
      const startupTime = performance.now() - startupStart;
      monitor.recordMetric('cli_startup', startupTime);

      if (process.env.DEBUG_PERFORMANCE) {
        console.log('\n📊 Performance Statistics:');
        const stats = monitor.getStats();
        console.log(JSON.stringify(stats, null, 2));
      }
    });

    return monitor;
  }
}

// Performance optimization utilities
class PerformanceOptimizer {
  /**
   * Create a lazy loading wrapper for a module
   * @param {Function} loader - Function that loads the module
   * @returns {Object} Proxy object that loads module on first access
   */
  static lazyLoad(loader) {
    let cached = null;
    let loading = false;

    return new Proxy({}, {
      get(target, prop) {
        if (!cached && !loading) {
          loading = true;
          try {
            cached = loader();
          } finally {
            loading = false;
          }
        }
        return cached ? cached[prop] : undefined;
      },

      set(target, prop, value) {
        if (!cached && !loading) {
          loading = true;
          try {
            cached = loader();
          } finally {
            loading = false;
          }
        }
        if (cached) {
          cached[prop] = value;
        }
        return true;
      }
    });
  }

  /**
   * Create a memoized version of a function
   * @param {Function} fn - Function to memoize
   * @param {Function} keyGenerator - Function to generate cache keys
   * @returns {Function} Memoized function
   */
  static memoize(fn, keyGenerator = (...args) => JSON.stringify(args)) {
    const cache = new Map();

    return (...args) => {
      const key = keyGenerator(...args);

      if (cache.has(key)) {
        return cache.get(key);
      }

      const result = fn(...args);
      cache.set(key, result);

      // Limit cache size to prevent memory issues
      if (cache.size > 100) {
        const firstKey = cache.keys().next().value;
        cache.delete(firstKey);
      }

      return result;
    };
  }

  /**
   * Create a debounced version of a function
   * @param {Function} fn - Function to debounce
   * @param {number} delay - Delay in milliseconds
   * @returns {Function} Debounced function
   */
  static debounce(fn, delay) {
    let timeoutId;

    return (...args) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn(...args), delay);
    };
  }

  /**
   * Create a throttled version of a function
   * @param {Function} fn - Function to throttle
   * @param {number} limit - Limit in milliseconds
   * @returns {Function} Throttled function
   */
  static throttle(fn, limit) {
    let inThrottle;

    return (...args) => {
      if (!inThrottle) {
        fn(...args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  /**
   * Create an async queue for processing operations
   * @param {number} concurrency - Maximum concurrent operations
   * @returns {Object} Queue object
   */
  static createQueue(concurrency = 1) {
    let running = 0;
    const queue = [];

    const runNext = () => {
      if (running >= concurrency || queue.length === 0) {
        return;
      }

      running++;
      const { task, resolve, reject } = queue.shift();

      task()
        .then(resolve)
        .catch(reject)
        .finally(() => {
          running--;
          runNext();
        });
    };

    return {
      add: (task) => {
        return new Promise((resolve, reject) => {
          queue.push({ task, resolve, reject });
          runNext();
        });
      },

      get size() {
        return queue.length;
      },

      get running() {
        return running;
      }
    };
  }
}

// Export performance utilities
module.exports = {
  PerformanceMonitor,
  PerformanceOptimizer
};