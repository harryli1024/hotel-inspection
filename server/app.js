const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Security headers
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

// CORS
app.use(cors());

// Body parsing
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Static files
app.use(express.static(path.join(__dirname, '../public')));

// API routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/areas', require('./routes/areas'));
app.use('/api/checkpoints', require('./routes/checkpoints'));
app.use('/api/schedules', require('./routes/schedules'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/inspections', require('./routes/inspections'));
app.use('/api/export', require('./routes/export'));

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
