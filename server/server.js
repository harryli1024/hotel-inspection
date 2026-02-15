const fs = require('fs');
const path = require('path');
const config = require('./config');

// Ensure upload directory exists
fs.mkdirSync(config.uploadDir, { recursive: true });

// Initialize database (runs schema + seed)
require('./models/db');

// Start task scheduler
const { startScheduler } = require('./services/taskScheduler');
startScheduler();

// Start server (HTTPS if certs exist, otherwise HTTP)
const app = require('./app');
const certDir = path.join(__dirname, '../certs');
const keyPath = path.join(certDir, 'key.pem');
const certPath = path.join(certDir, 'cert.pem');

if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
  const https = require('https');
  const options = { key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) };
  https.createServer(options, app).listen(config.port, () => {
    console.log(`酒店巡检系统已启动 (HTTPS): https://localhost:${config.port}`);
  });
} else {
  app.listen(config.port, () => {
    console.log(`酒店巡检系统已启动 (HTTP): http://localhost:${config.port}`);
  });
}
