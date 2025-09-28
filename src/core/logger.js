const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const { format } = require('util');

/**
 * Logger utility with multiple transports and structured logging
 */
class Logger {
  /**
   * Create a new Logger instance
   * @param {Object} options - Logger options
   * @param {string} options.name - Logger name
   * @param {string} options.level - Minimum log level (error, warn, info, debug)
   * @param {boolean} options.enableConsole - Enable console logging
   * @param {boolean} options.enableFile - Enable file logging
   * @param {string} options.logDir - Directory for log files
   * @param {boolean} options.enableStructured - Enable structured logging
   * @param {boolean} options.enableColors - Enable colored output
   */
  constructor(options = {}) {
    this.name = options.name || 'default';
    this.level = options.level || 'info';
    this.enableConsole = options.enableConsole !== false;
    this.enableFile = options.enableFile || false;
    this.logDir = options.logDir || path.join(process.cwd(), 'logs');
    this.enableStructured = options.enableStructured || false;
    this.enableColors = options.enableColors !== false;

    // Log levels in order of severity
    this.levels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3,
      trace: 4
    };

    // Ensure log directory exists
    if (this.enableFile) {
      fs.ensureDirSync(this.logDir);
    }

    // Performance tracking
    this.performanceMetrics = new Map();
    this.errorCounts = new Map();
    this.requestCount = 0;

    // Initialize transports
    this.initializeTransports();
  }

  /**
   * Initialize logging transports
   * @private
   */
  initializeTransports() {
    this.transports = [];

    if (this.enableConsole) {
      this.transports.push(this.consoleTransport.bind(this));
    }

    if (this.enableFile) {
      this.transports.push(this.fileTransport.bind(this));
    }
  }

  /**
   * Check if log level should be logged
   * @param {string} level - Log level
   * @returns {boolean}
   * @private
   */
  shouldLog(level) {
    return this.levels[level] <= this.levels[this.level];
  }

  /**
   * Create structured log entry
   * @param {string} level - Log level
   * @param {string} message - Log message
   * @param {Object} meta - Additional metadata
   * @returns {Object} Structured log entry
   * @private
   */
  createLogEntry(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const requestId = meta.requestId || this.generateRequestId();

    return {
      timestamp,
      level: level.toUpperCase(),
      logger: this.name,
      message,
      requestId,
      ...meta,
      pid: process.pid,
      version: process.env.npm_package_version || '1.0.0'
    };
  }

  /**
   * Generate request ID
   * @returns {string} Request ID
   * @private
   */
  generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Console transport
   * @param {Object} entry - Log entry
   * @private
   */
  consoleTransport(entry) {
    const { timestamp, level, message, requestId, ...meta } = entry;
    const prefix = chalk.gray(`[${timestamp}]`);
    const levelPrefix = chalk.gray(`[${requestId}]`);

    let formattedMessage;
    if (this.enableStructured) {
      formattedMessage = JSON.stringify(entry, null, 2);
    } else {
      formattedMessage = message;

      // Add metadata if present
      if (Object.keys(meta).length > 0) {
        formattedMessage += chalk.gray(` ${JSON.stringify(meta)}`);
      }
    }

    switch (level.toLowerCase()) {
      case 'error':
        console.error(prefix, levelPrefix, chalk.red('ERROR:'), formattedMessage);
        break;
      case 'warn':
        console.warn(prefix, levelPrefix, chalk.yellow('WARN:'), formattedMessage);
        break;
      case 'info':
        console.log(prefix, levelPrefix, chalk.blue('INFO:'), formattedMessage);
        break;
      case 'debug':
        console.log(prefix, levelPrefix, chalk.magenta('DEBUG:'), formattedMessage);
        break;
      case 'trace':
        console.log(prefix, levelPrefix, chalk.gray('TRACE:'), formattedMessage);
        break;
      default:
        console.log(prefix, levelPrefix, formattedMessage);
    }
  }

  /**
   * File transport
   * @param {Object} entry - Log entry
   * @private
   */
  fileTransport(entry) {
    const logFile = path.join(this.logDir, `${this.name}.log`);
    const errorLogFile = path.join(this.logDir, `${this.name}-error.log`);

    const logLine = JSON.stringify(entry) + '\n';

    // Write to main log file
    fs.appendFile(logFile, logLine).catch(err => {
      console.error('Failed to write to log file:', err);
    });

    // Write to error log file if it's an error
    if (entry.level === 'ERROR') {
      fs.appendFile(errorLogFile, logLine).catch(err => {
        console.error('Failed to write to error log file:', err);
      });
    }
  }

  /**
   * Log a message
   * @param {string} level - Log level
   * @param {string} message - Log message
   * @param {Object} meta - Additional metadata
   */
  log(level, message, meta = {}) {
    if (!this.shouldLog(level)) {
      return;
    }

    // Track error counts
    if (level === 'error') {
      const errorKey = meta.error?.code || meta.error?.name || 'UNKNOWN_ERROR';
      this.errorCounts.set(errorKey, (this.errorCounts.get(errorKey) || 0) + 1);
    }

    const entry = this.createLogEntry(level, message, meta);

    // Send to all transports
    for (const transport of this.transports) {
      try {
        transport(entry);
      } catch (error) {
        console.error('Transport error:', error);
      }
    }
  }

  /**
   * Log error with stack trace
   * @param {Error|string} error - Error object or message
   * @param {Object} meta - Additional metadata
   */
  error(error, meta = {}) {
    const errorMessage = error instanceof Error ? error.message : error;
    const errorStack = error instanceof Error ? error.stack : undefined;

    this.log('error', errorMessage, {
      ...meta,
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: errorStack,
        code: error.code
      } : { message: error }
    });
  }

  /**
   * Log warning
   * @param {string} message - Warning message
   * @param {Object} meta - Additional metadata
   */
  warn(message, meta = {}) {
    this.log('warn', message, meta);
  }

  /**
   * Log info
   * @param {string} message - Info message
   * @param {Object} meta - Additional metadata
   */
  info(message, meta = {}) {
    this.log('info', message, meta);
  }

  /**
   * Log debug
   * @param {string} message - Debug message
   * @param {Object} meta - Additional metadata
   */
  debug(message, meta = {}) {
    this.log('debug', message, meta);
  }

  /**
   * Log trace
   * @param {string} message - Trace message
   * @param {Object} meta - Additional metadata
   */
  trace(message, meta = {}) {
    this.log('trace', message, meta);
  }

  /**
   * Start performance measurement
   * @param {string} name - Measurement name
   * @param {Object} meta - Additional metadata
   */
  startTimer(name, meta = {}) {
    const startTime = process.hrtime();
    this.performanceMetrics.set(name, {
      startTime,
      meta,
      startTimestamp: new Date().toISOString()
    });
  }

  /**
   * End performance measurement and log result
   * @param {string} name - Measurement name
   * @param {Object} meta - Additional metadata
   */
  endTimer(name, meta = {}) {
    const metric = this.performanceMetrics.get(name);
    if (!metric) {
      this.warn(`Timer '${name}' not found`);
      return;
    }

    const [seconds, nanoseconds] = process.hrtime(metric.startTime);
    const duration = seconds * 1000 + nanoseconds / 1000000; // Convert to milliseconds

    this.info(`Timer '${name}' completed`, {
      duration: Math.round(duration * 100) / 100,
      unit: 'ms',
      ...metric.meta,
      ...meta
    });

    this.performanceMetrics.delete(name);
    return duration;
  }

  /**
   * Create child logger with additional context
   * @param {Object} context - Additional context
   * @returns {Logger} Child logger
   */
  child(context) {
    const childLogger = new Logger({
      name: this.name,
      level: this.level,
      enableConsole: this.enableConsole,
      enableFile: this.enableFile,
      logDir: this.logDir,
      enableStructured: this.enableStructured,
      enableColors: this.enableColors
    });

    // Override log method to include context
    childLogger.log = (level, message, meta = {}) => {
      return Logger.prototype.log.call(childLogger, level, message, {
        ...context,
        ...meta
      });
    };

    return childLogger;
  }

  /**
   * Get logger statistics
   * @returns {Object} Statistics
   */
  getStats() {
    return {
      name: this.name,
      level: this.level,
      transports: this.transports.length,
      performanceMetrics: this.performanceMetrics.size,
      errorCounts: Object.fromEntries(this.errorCounts),
      requestCount: this.requestCount
    };
  }

  /**
   * Create logger with context
   * @param {string} name - Logger name
   * @param {Object} context - Context
   * @returns {Logger} Logger instance
   */
  static create(name, context = {}) {
    const logger = new Logger({ name });
    return context ? logger.child(context) : logger;
  }
}

module.exports = Logger;