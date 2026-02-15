const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Security headers
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

// Gzip compression
app.use(compression({
  threshold: 1024,
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  },
}));

// CORS
app.use(cors());

// Body parsing
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Static files with cache headers
app.use(express.static(path.join(__dirname, '../public'), {
  maxAge: '7d',
  etag: true,
  lastModified: true,
  setHeaders(res, filePath) {
    // HTML files: no cache (always get latest)
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
    // CSS/JS: cache with revalidation
    else if (filePath.endsWith('.css') || filePath.endsWith('.js')) {
      res.setHeader('Cache-Control', 'public, max-age=86400, must-revalidate');
    }
  },
}));

// API routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/areas', require('./routes/areas'));
app.use('/api/checkpoints', require('./routes/checkpoints'));
app.use('/api/schedules', require('./routes/schedules'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/inspections', require('./routes/inspections'));
app.use('/api/export', require('./routes/export'));
app.use('/api/inspect-items', require('./routes/inspectItems'));

// Serve mobile fallback
app.get('/mobile', (req, res) => {
  res.redirect('/');
});

// Serve admin fallback
app.get('/admin', (req, res) => {
  res.redirect('/');
});

// Global error handler
app.use(errorHandler);

module.exports = app;
