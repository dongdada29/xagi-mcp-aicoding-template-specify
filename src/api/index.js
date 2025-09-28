const express = require('express');
const cors = require('cors');
const chalk = require('chalk');

// Import route handlers
const templatesRouter = require('./templates');
const projectsRouter = require('./projects');
const cacheRouter = require('./cache');
const registriesRouter = require('./registries');

// Create Express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${chalk.gray(new Date().toISOString())} ${chalk.cyan(req.method)} ${chalk.blue(req.path)} ${res.statusCode} ${chalk.yellow(duration + 'ms')}`);
  });

  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: require('../../package.json').version
  });
});

// API routes
app.use('/templates', templatesRouter);
app.use('/projects', projectsRouter);
app.use('/cache', cacheRouter);
app.use('/registries', registriesRouter);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(chalk.red('API Error:'), err);

  res.status(err.status || 500).json({
    error: err.name || 'Internal Server Error',
    message: err.message || 'An unexpected error occurred'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Endpoint ${req.method} ${req.path} not found`
  });
});

// Start server function
function startServer(port = 3000) {
  return new Promise((resolve, reject) => {
    const server = app.listen(port, (err) => {
      if (err) {
        reject(err);
      } else {
        console.log(chalk.green(`🚀 API server running on port ${port}`));
        console.log(chalk.blue(`📊 Health check: http://localhost:${port}/health`));
        resolve(server);
      }
    });

    // Handle server errors
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(chalk.red(`Port ${port} is already in use`));
      } else {
        console.error(chalk.red('Server error:'), err);
      }
      reject(err);
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
