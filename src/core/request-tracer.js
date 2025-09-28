const crypto = require('crypto');

/**
 * Request tracer for correlation IDs and request tracking
 */
class RequestTracer {
  /**
   * Create a new RequestTracer
   * @param {Object} options - Tracer options
   * @param {Logger} options.logger - Logger instance
   */
  constructor(options = {}) {
    this.logger = options.logger;
    this.activeRequests = new Map();
    this.requestCount = 0;
  }

  /**
   * Generate unique request ID
   * @returns {string} Request ID
   */
  generateRequestId() {
    const timestamp = Date.now();
    const random = crypto.randomBytes(4).toString('hex');
    return `req_${timestamp}_${random}`;
  }

  /**
   * Generate correlation ID
   * @returns {string} Correlation ID
   */
  generateCorrelationId() {
    return crypto.randomUUID();
  }

  /**
   * Start tracing a request
   * @param {Object} request - Request object
   * @returns {Object} Tracing context
   */
  startTrace(request) {
    const requestId = this.generateRequestId();
    const correlationId = request.headers['x-correlation-id'] || this.generateCorrelationId();
    const startTime = process.hrtime();
    const startTimeStamp = new Date().toISOString();

    const traceContext = {
      requestId,
      correlationId,
      startTime,
      startTimeStamp,
      request: {
        method: request.method,
        url: request.url,
        ip: request.ip,
        userAgent: request.headers['user-agent']
      }
    };

    this.activeRequests.set(requestId, traceContext);
    this.requestCount++;

    return traceContext;
  }

  /**
   * End tracing a request
   * @param {string} requestId - Request ID
   * @param {Object} response - Response object
   * @returns {Object} Trace result
   */
  endTrace(requestId, response) {
    const traceContext = this.activeRequests.get(requestId);
    if (!traceContext) {
      return null;
    }

    const [seconds, nanoseconds] = process.hrtime(traceContext.startTime);
    const duration = seconds * 1000 + nanoseconds / 1000000; // Convert to milliseconds

    const traceResult = {
      ...traceContext,
      duration: Math.round(duration * 100) / 100,
      response: {
        statusCode: response.statusCode,
        headers: response.getHeaders()
      },
      endTimeStamp: new Date().toISOString()
    };

    this.activeRequests.delete(requestId);

    return traceResult;
  }

  /**
   * Get active requests
   * @returns {Array} Active requests
   */
  getActiveRequests() {
    return Array.from(this.activeRequests.values()).map(trace => ({
      requestId: trace.requestId,
      correlationId: trace.correlationId,
      startTimeStamp: trace.startTimeStamp,
      request: trace.request
    }));
  }

  /**
   * Create Express middleware for request tracing
   * @returns {Function} Express middleware
   */
  createMiddleware() {
    return (req, res, next) => {
      const traceContext = this.startTrace(req);

      // Add tracing context to request
      req.requestId = traceContext.requestId;
      req.correlationId = traceContext.correlationId;
      req.traceContext = traceContext;

      // Add correlation ID to response headers
      res.setHeader('X-Request-ID', traceContext.requestId);
      res.setHeader('X-Correlation-ID', traceContext.correlationId);

      // Log request start
      if (this.logger) {
        this.logger.info('Request started', {
          requestId: traceContext.requestId,
          correlationId: traceContext.correlationId,
          method: req.method,
          url: req.url,
          ip: req.ip
        });
      }

      // Override res.end to log request completion
      const originalEnd = res.end;
      res.end = function(chunk, encoding) {
        const traceResult = this.endTrace(traceContext.requestId, res);

        if (this.logger && traceResult) {
          this.logger.info('Request completed', {
            requestId: traceResult.requestId,
            correlationId: traceResult.correlationId,
            method: req.method,
            url: req.url,
            statusCode: res.statusCode,
            duration: traceResult.duration
          });
        }

        originalEnd.call(res, chunk, encoding);
      }.bind(this);

      next();
    };
  }
}

module.exports = RequestTracer;