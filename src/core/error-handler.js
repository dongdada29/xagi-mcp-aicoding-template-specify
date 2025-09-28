const Logger = require('./logger');

/**
 * Base application error class
 */
class ApplicationError extends Error {
  /**
   * Create a new ApplicationError
   * @param {string} message - Error message
   * @param {string} code - Error code
   * @param {Object} context - Error context
   * @param {Error} cause - Original error that caused this error
   */
  constructor(message, code = 'UNKNOWN_ERROR', context = {}, cause = null) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.context = context;
    this.cause = cause;
    this.timestamp = new Date().toISOString();
    this.isApplicationError = true;

    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Convert error to JSON
   * @returns {Object} JSON representation
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      context: this.context,
      timestamp: this.timestamp,
      stack: this.stack,
      cause: this.cause ? {
        name: this.cause.name,
        message: this.cause.message,
        stack: this.cause.stack
      } : null
    };
  }

  /**
   * Get user-friendly message
   * @returns {string} User-friendly message
   */
  getUserMessage() {
    return this.message;
  }
}

/**
 * ValidationError for validation failures
 */
class ValidationError extends ApplicationError {
  constructor(message, context = {}, cause = null) {
    super(message, 'VALIDATION_ERROR', context, cause);
    this.name = 'ValidationError';
  }

  getUserMessage() {
    return `Validation failed: ${this.message}`;
  }
}

/**
 * ConfigurationError for configuration issues
 */
class ConfigurationError extends ApplicationError {
  constructor(message, context = {}, cause = null) {
    super(message, 'CONFIGURATION_ERROR', context, cause);
    this.name = 'ConfigurationError';
  }

  getUserMessage() {
    return `Configuration error: ${this.message}`;
  }
}

/**
 * NetworkError for network-related issues
 */
class NetworkError extends ApplicationError {
  constructor(message, context = {}, cause = null) {
    super(message, 'NETWORK_ERROR', context, cause);
    this.name = 'NetworkError';
  }

  getUserMessage() {
    return `Network error: ${this.message}`;
  }
}

/**
 * FileSystemError for file system operations
 */
class FileSystemError extends ApplicationError {
  constructor(message, context = {}, cause = null) {
    super(message, 'FILE_SYSTEM_ERROR', context, cause);
    this.name = 'FileSystemError';
  }

  getUserMessage() {
    return `File system error: ${this.message}`;
  }
}

/**
 * ServiceError for service-related issues
 */
class ServiceError extends ApplicationError {
  constructor(message, context = {}, cause = null) {
    super(message, 'SERVICE_ERROR', context, cause);
    this.name = 'ServiceError';
  }

  getUserMessage() {
    return `Service error: ${this.message}`;
  }
}

/**
 * SecurityError for security-related issues
 */
class SecurityError extends ApplicationError {
  constructor(message, context = {}, cause = null) {
    super(message, 'SECURITY_ERROR', context, cause);
    this.name = 'SecurityError';
  }

  getUserMessage() {
    return `Security error: ${this.message}`;
  }
}

/**
 * Centralized error handler
 */
class ErrorHandler {
  /**
   * Create a new ErrorHandler
   * @param {Object} options - Handler options
   * @param {Logger} options.logger - Logger instance
   * @param {boolean} options.enableUnhandled - Enable unhandled exception handling
   * @param {boolean} options.enableRejection - Enable unhandled promise rejection handling
   */
  constructor(options = {}) {
    this.logger = options.logger || Logger.create('ErrorHandler');
    this.enableUnhandled = options.enableUnhandled !== false;
    this.enableRejection = options.enableRejection !== false;

    // Error tracking
    this.errorStats = new Map();
    this.recentErrors = [];
    this.maxRecentErrors = 100;

    // Initialize global error handlers
    this.initializeGlobalHandlers();
  }

  /**
   * Initialize global error handlers
   * @private
   */
  initializeGlobalHandlers() {
    if (this.enableUnhandled) {
      process.on('uncaughtException', (error) => {
        this.handleUncaughtException(error);
      });
    }

    if (this.enableRejection) {
      process.on('unhandledRejection', (reason, promise) => {
        this.handleUnhandledRejection(reason, promise);
      });
    }
  }

  /**
   * Handle uncaught exception
   * @param {Error} error - Uncaught error
   * @private
   */
  handleUncaughtException(error) {
    this.logger.error('Uncaught Exception', {
      error: this.normalizeError(error),
      fatal: true
    });

    // Track error statistics
    this.trackError('uncaught_exception', error);

    // Exit process after logging
    process.exit(1);
  }

  /**
   * Handle unhandled promise rejection
   * @param {*} reason - Rejection reason
   * @param {Promise} promise - Rejected promise
   * @private
   */
  handleUnhandledRejection(reason, promise) {
    const error = reason instanceof Error ? reason : new Error(String(reason));

    this.logger.error('Unhandled Promise Rejection', {
      error: this.normalizeError(error),
      promise: {
        stack: promise.stack
      }
    });

    // Track error statistics
    this.trackError('unhandled_rejection', error);
  }

  /**
   * Handle error with context
   * @param {Error} error - Error to handle
   * @param {Object} context - Error context
   * @param {Object} options - Handling options
   * @returns {Object} Error handling result
   */
  handleError(error, context = {}, options = {}) {
    const normalizedError = this.normalizeError(error);
    const errorContext = {
      ...context,
      handled: true,
      timestamp: new Date().toISOString()
    };

    // Log error
    this.logger.error(normalizedError.message, {
      error: normalizedError,
      context: errorContext,
      severity: options.severity || 'error'
    });

    // Track error statistics
    this.trackError(normalizedError.code || 'unknown', normalizedError);

    // Add to recent errors
    this.addToRecentErrors(normalizedError, errorContext);

    // Determine if error should be thrown
    if (options.rethrow !== false) {
      throw error;
    }

    return {
      success: false,
      error: normalizedError,
      context: errorContext
    };
  }

  /**
   * Normalize error to standard format
   * @param {Error} error - Error to normalize
   * @returns {Object} Normalized error
   */
  normalizeError(error) {
    if (error instanceof ApplicationError) {
      return error.toJSON();
    }

    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        code: error.code || 'GENERIC_ERROR',
        stack: error.stack,
        timestamp: new Date().toISOString()
      };
    }

    return {
      name: 'UnknownError',
      message: String(error),
      code: 'UNKNOWN_ERROR',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Track error statistics
   * @param {string} code - Error code
   * @param {Error} error - Error instance
   * @private
   */
  trackError(code, error) {
    const stats = this.errorStats.get(code) || {
      count: 0,
      lastSeen: null,
      firstSeen: null
    };

    stats.count++;
    stats.lastSeen = new Date().toISOString();
    if (!stats.firstSeen) {
      stats.firstSeen = new Date().toISOString();
    }

    this.errorStats.set(code, stats);
  }

  /**
   * Add error to recent errors
   * @param {Object} error - Normalized error
   * @param {Object} context - Error context
   * @private
   */
  addToRecentErrors(error, context) {
    this.recentErrors.push({
      error,
      context,
      timestamp: new Date().toISOString()
    });

    // Keep only recent errors
    if (this.recentErrors.length > this.maxRecentErrors) {
      this.recentErrors.shift();
    }
  }

  /**
   * Wrap function with error handling
   * @param {Function} fn - Function to wrap
   * @param {Object} context - Error context
   * @returns {Function} Wrapped function
   */
  wrap(fn, context = {}) {
    return async (...args) => {
      try {
        return await fn(...args);
      } catch (error) {
        return this.handleError(error, context, { rethrow: false });
      }
    };
  }

  /**
   * Create error handler middleware for Express
   * @returns {Function} Express middleware
   */
  createMiddleware() {
    return (error, req, res, next) => {
      const normalizedError = this.normalizeError(error);
      const context = {
        url: req.url,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        requestId: req.requestId
      };

      this.logger.error('API Error', {
        error: normalizedError,
        context
      });

      // Track error
      this.trackError(normalizedError.code, normalizedError);

      // Send error response
      res.status(this.getHttpStatusCode(normalizedError)).json({
        success: false,
        error: {
          code: normalizedError.code,
          message: normalizedError.message,
          timestamp: normalizedError.timestamp
        },
        requestId: req.requestId
      });
    };
  }

  /**
   * Get HTTP status code for error
   * @param {Object} error - Normalized error
   * @returns {number} HTTP status code
   * @private
   */
  getHttpStatusCode(error) {
    const statusCodeMap = {
      'VALIDATION_ERROR': 400,
      'CONFIGURATION_ERROR': 400,
      'NETWORK_ERROR': 503,
      'FILE_SYSTEM_ERROR': 500,
      'SERVICE_ERROR': 500,
      'SECURITY_ERROR': 403,
      'NOT_FOUND': 404,
      'UNAUTHORIZED': 401,
      'FORBIDDEN': 403
    };

    return statusCodeMap[error.code] || 500;
  }

  /**
   * Get error statistics
   * @returns {Object} Error statistics
   */
  getStats() {
    return {
      totalErrors: Array.from(this.errorStats.values()).reduce((sum, stat) => sum + stat.count, 0),
      errorTypes: Object.fromEntries(this.errorStats),
      recentErrors: this.recentErrors,
      errorCount: this.recentErrors.length
    };
  }

  /**
   * Clear error statistics
   */
  clearStats() {
    this.errorStats.clear();
    this.recentErrors = [];
  }
}

module.exports = {
  ErrorHandler,
  ApplicationError,
  ValidationError,
  ConfigurationError,
  NetworkError,
  FileSystemError,
  ServiceError,
  SecurityError
};