const path = require('path');

module.exports = {
  port: process.env.PORT || 3000,
  jwtSecret: process.env.JWT_SECRET || 'hotel-inspection-secret-change-in-production',
  jwtExpiresIn: '24h',
  dbPath: process.env.DB_PATH || path.join(__dirname, '../../database/hotel_inspection.db'),
  uploadDir: process.env.UPLOAD_DIR || path.join(__dirname, '../uploads/photos'),
  maxPhotoSize: 10 * 1024 * 1024,
  maxPhotosPerInspection: 10,
  taskGenerationIntervalMinutes: 5,
};
