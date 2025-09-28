const express = require('express');
const cors = require('cors');
const chalk = require('chalk');

// Import core components
const Logger = require('../core/logger');
const { ErrorHandler } = require('../core/error-handler');
const RequestTracer = require('../core/request-tracer');
const PerformanceMonitor = require('../core/performance-monitor');

// Import route handlers
const templatesRouter = require('./templates');
const projectsRouter = require('./projects');
const cacheRouter = require('./cache');
const registriesRouter = require('./registries');

// Create Express app
const app = express();

// Initialize core components
const logger = Logger.create('APIServer', { enableFile: true, logDir: './logs' });
const errorHandler = new ErrorHandler({ logger });
const requestTracer = new RequestTracer({ logger });
const performanceMonitor = new PerformanceMonitor({ logger });

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request tracing and performance monitoring middleware
app.use(requestTracer.createMiddleware());
app.use(performanceMonitor.createMiddleware());

// Enhanced request logging middleware
app.use((req, res, next) => {
  logger.info('Incoming request', {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    requestId: req.requestId,
    correlationId: req.correlationId
  });
  next();
});

// Enhanced health check endpoint
app.get('/health', async (req, res) => {
  try {
    const healthReport = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: require('../../package.json').version,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      performance: performanceMonitor.getSummary(),
      logger: logger.getStats(),
      errorHandler: errorHandler.getStats(),
      activeRequests: requestTracer.getActiveRequests()
    };

    res.json(healthReport);
  } catch (error) {
    logger.error('Health check failed', { error });
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// Performance metrics endpoint
app.get('/metrics', (req, res) => {
  const metrics = performanceMonitor.getReport();
  res.json(metrics);
});

// Error statistics endpoint
app.get('/errors', (req, res) => {
  const errorStats = errorHandler.getStats();
  res.json(errorStats);
});

// API routes
app.use('/templates', templatesRouter);
app.use('/projects', projectsRouter);
app.use('/cache', cacheRouter);
app.use('/registries', registriesRouter);

// Enhanced error handling middleware
app.use(errorHandler.createMiddleware());

// Enhanced 404 handler
app.use((req, res) => {
  const error = new Error(`Endpoint ${req.method} ${req.path} not found`);
  logger.error('Endpoint not found', {
    error: errorHandler.normalizeError(error),
    method: req.method,
    url: req.url,
    requestId: req.requestId,
    correlationId: req.correlationId
  });

  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Endpoint ${req.method} ${req.path} not found`
    },
    requestId: req.requestId
  });
});

// Start server function with graceful shutdown
function startServer(port = 3000) {
  return new Promise((resolve, reject) => {
    const server = app.listen(port, (err) => {
      if (err) {
        logger.error('Failed to start server', { error: err.message, port });
        reject(err);
      } else {
        logger.info('API server started', {
          port,
          healthCheck: `http://localhost:${port}/health`,
          metrics: `http://localhost:${port}/metrics`
        });
        console.log(chalk.green(`🚀 API server running on port ${port}`));
        console.log(chalk.blue(`📊 Health check: http://localhost:${port}/health`));
        console.log(chalk.blue(`📈 Metrics: http://localhost:${port}/metrics`));
        resolve(server);
      }
    });

    // Handle server errors
    server.on('error', (err) => {
      logger.error('Server error', { error: err.message, code: err.code });
      if (err.code === 'EADDRINUSE') {
        console.error(chalk.red(`Port ${port} is already in use`));
      } else {
        console.error(chalk.red('Server error:'), err);
      }
      reject(err);
    });

    // Handle graceful shutdown
    const gracefulShutdown = (signal) => {
      logger.info('Received shutdown signal', { signal });

      server.close(() => {
        logger.info('Server closed gracefully');
        process.exit(0);
      });

      // Force shutdown after timeout
      setTimeout(() => {
        logger.error('Forcing shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    // Register shutdown handlers
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception', { error: error.message, stack: error.stack });
      gracefulShutdown('uncaughtException');
    });

    // Handle unhandled rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled promise rejection', {
        reason: reason instanceof Error ? reason.message : reason,
        promise: promise.toString()
      });
      gracefulShutdown('unhandledRejection');
    });
  });
}

// Export app and server function
module.exports = {
  app,
  startServer
};

// If this file is run directly, start the server
if (require.main === module) {
  const port = process.env.PORT || 3000;
  startServer(port).catch(console.error);
}
