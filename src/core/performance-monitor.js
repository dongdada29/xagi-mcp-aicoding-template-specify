const Logger = require('./logger');

/**
 * Performance monitoring system
 */
class PerformanceMonitor {
  /**
   * Create a new PerformanceMonitor
   * @param {Object} options - Monitor options
   * @param {Logger} options.logger - Logger instance
   * @param {number} options.slowThreshold - Slow operation threshold in ms
   * @param {number} options.criticalThreshold - Critical operation threshold in ms
   * @param {number} options.maxMetrics - Maximum metrics to keep
   */
  constructor(options = {}) {
    this.logger = options.logger || Logger.create('PerformanceMonitor');
    this.slowThreshold = options.slowThreshold || 1000; // 1 second
    this.criticalThreshold = options.criticalThreshold || 5000; // 5 seconds
    this.maxMetrics = options.maxMetrics || 1000;

    // Performance metrics
    this.metrics = new Map();
    this.histograms = new Map();
    this.counters = new Map();
    this.gauges = new Map();

    // Performance tracking
    this.activeOperations = new Map();
    this.performanceHistory = [];
  }

  /**
   * Start tracking an operation
   * @param {string} operation - Operation name
   * @param {Object} context - Operation context
   * @returns {string} Operation ID
   */
  startOperation(operation, context = {}) {
    const operationId = this.generateOperationId();
    const startTime = process.hrtime();
    const startTimeStamp = new Date().toISOString();

    this.activeOperations.set(operationId, {
      operation,
      startTime,
      startTimeStamp,
      context
    });

    return operationId;
  }

  /**
   * End tracking an operation
   * @param {string} operationId - Operation ID
   * @param {Object} result - Operation result
   * @returns {Object} Performance data
   */
  endOperation(operationId, result = {}) {
    const operation = this.activeOperations.get(operationId);
    if (!operation) {
      this.logger.warn(`Operation not found: ${operationId}`);
      return null;
    }

    const [seconds, nanoseconds] = process.hrtime(operation.startTime);
    const duration = seconds * 1000 + nanoseconds / 1000000; // Convert to milliseconds

    const performanceData = {
      operationId,
      operation: operation.operation,
      duration: Math.round(duration * 100) / 100,
      startTimeStamp: operation.startTimeStamp,
      endTimeStamp: new Date().toISOString(),
      context: operation.context,
      result
    };

    // Record metric
    this.recordMetric(operation.operation, duration);

    // Log slow operations
    if (duration > this.criticalThreshold) {
      this.logger.error('Critical slow operation detected', performanceData);
    } else if (duration > this.slowThreshold) {
      this.logger.warn('Slow operation detected', performanceData);
    }

    // Add to performance history
    this.addToHistory(performanceData);

    this.activeOperations.delete(operationId);

    return performanceData;
  }

  /**
   * Record a metric
   * @param {string} name - Metric name
   * @param {number} value - Metric value
   */
  recordMetric(name, value) {
    // Update counter
    const counter = this.counters.get(name) || 0;
    this.counters.set(name, counter + 1);

    // Update histogram
    const histogram = this.histograms.get(name) || [];
    histogram.push(value);
    this.histograms.set(name, histogram);

    // Keep only recent values
    if (histogram.length > this.maxMetrics) {
      histogram.shift();
    }

    // Update gauge (current value)
    this.gauges.set(name, value);
  }

  /**
   * Get metric statistics
   * @param {string} name - Metric name
   * @returns {Object} Statistics
   */
  getMetricStats(name) {
    const histogram = this.histograms.get(name) || [];
    const counter = this.counters.get(name) || 0;
    const gauge = this.gauges.get(name) || 0;

    if (histogram.length === 0) {
      return {
        name,
        count: 0,
        min: 0,
        max: 0,
        avg: 0,
        p50: 0,
        p95: 0,
        p99: 0
      };
    }

    const sorted = [...histogram].sort((a, b) => a - b);
    const sum = sorted.reduce((acc, val) => acc + val, 0);

    return {
      name,
      count: counter,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      avg: sum / sorted.length,
      p50: this.percentile(sorted, 50),
      p95: this.percentile(sorted, 95),
      p99: this.percentile(sorted, 99),
      current: gauge
    };
  }

  /**
   * Calculate percentile
   * @param {Array} values - Sorted values
   * @param {number} p - Percentile (0-100)
   * @returns {number} Percentile value
   * @private
   */
  percentile(values, p) {
    const index = Math.ceil((p / 100) * values.length) - 1;
    return values[Math.max(0, Math.min(index, values.length - 1))];
  }

  /**
   * Add to performance history
   * @param {Object} performanceData - Performance data
   * @private
   */
  addToHistory(performanceData) {
    this.performanceHistory.push(performanceData);

    // Keep only recent history
    if (this.performanceHistory.length > this.maxMetrics) {
      this.performanceHistory.shift();
    }
  }

  /**
   * Get all metrics
   * @returns {Array} All metrics
   */
  getAllMetrics() {
    const metricNames = new Set([
      ...this.histograms.keys(),
      ...this.counters.keys(),
      ...this.gauges.keys()
    ]);

    return Array.from(metricNames).map(name => this.getMetricStats(name));
  }

  /**
   * Get performance summary
   * @returns {Object} Performance summary
   */
  getSummary() {
    const metrics = this.getAllMetrics();
    const slowOperations = this.performanceHistory.filter(
      p => p.duration > this.slowThreshold
    );
    const criticalOperations = this.performanceHistory.filter(
      p => p.duration > this.criticalThreshold
    );

    return {
      totalOperations: this.performanceHistory.length,
      activeOperations: this.activeOperations.size,
      metricsCount: metrics.length,
      slowOperations: slowOperations.length,
      criticalOperations: criticalOperations.length,
      averageResponseTime: metrics.length > 0
        ? metrics.reduce((sum, m) => sum + m.avg, 0) / metrics.length
        : 0,
      metrics: metrics
    };
  }

  /**
   * Get performance report
   * @returns {Object} Performance report
   */
  getReport() {
    const summary = this.getSummary();
    const topSlowest = this.performanceHistory
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10);

    return {
      generatedAt: new Date().toISOString(),
      summary,
      topSlowestOperations: topSlowest,
      slowThreshold: this.slowThreshold,
      criticalThreshold: this.criticalThreshold
    };
  }

  /**
   * Create performance monitoring middleware for Express
   * @returns {Function} Express middleware
   */
  createMiddleware() {
    return (req, res, next) => {
      const operationId = this.startOperation('http_request', {
        method: req.method,
        url: req.url,
        ip: req.ip
      });

      // Override res.end to track request completion
      const originalEnd = res.end;
      res.end = function(chunk, encoding) {
        const performanceData = this.endOperation(operationId, {
          statusCode: res.statusCode
        });

        // Add performance headers
        if (performanceData) {
          res.setHeader('X-Response-Time', `${performanceData.duration}ms`);
        }

        originalEnd.call(res, chunk, encoding);
      }.bind(this);

      next();
    };
  }

  /**
   * Wrap function with performance monitoring
   * @param {Function} fn - Function to wrap
   * @param {string} operationName - Operation name
   * @returns {Function} Wrapped function
   */
  wrap(fn, operationName) {
    return async (...args) => {
      const operationId = this.startOperation(operationName);

      try {
        const result = await fn(...args);
        this.endOperation(operationId, { success: true });
        return result;
      } catch (error) {
        this.endOperation(operationId, { success: false, error: error.message });
        throw error;
      }
    };
  }

  /**
   * Generate operation ID
   * @returns {string} Operation ID
   * @private
   */
  generateOperationId() {
    return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Clear all metrics
   */
  clear() {
    this.metrics.clear();
    this.histograms.clear();
    this.counters.clear();
    this.gauges.clear();
    this.activeOperations.clear();
    this.performanceHistory = [];
  }
}

module.exports = PerformanceMonitor;