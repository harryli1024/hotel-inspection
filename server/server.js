const fs = require('fs');
const config = require('./config');

// Ensure upload directory exists
fs.mkdirSync(config.uploadDir, { recursive: true });

// Initialize database (runs schema + seed)
require('./models/db');

// Start task scheduler
const { startScheduler } = require('./services/taskScheduler');
startScheduler();

// Start server
const app = require('./app');
app.listen(config.port, () => {
  console.log(`酒店巡检系统已启动: http://localhost:${config.port}`);
});
