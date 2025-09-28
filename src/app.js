/**
 * Express application for API endpoints
 * This will be expanded when implementing the actual endpoints
 */
const express = require('express');
const app = express();

// Middleware
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Templates endpoint - not implemented yet
app.get('/templates', (req, res) => {
  res.status(501).json({
    error: 'Not Implemented',
    message: 'GET /templates endpoint is not yet implemented'
  });
});

// Handle 404
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Endpoint ${req.method} ${req.path} not found`
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message
  });
});

module.exports = app;
