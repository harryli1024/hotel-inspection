const sharp = require('sharp');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const config = require('../config');

async function processAndSavePhoto(buffer, metadata) {
  // Generate hash for duplicate detection
  const hash = crypto.createHash('sha256').update(buffer).digest('hex');

  // Process with sharp: auto-rotate, resize, strip EXIF, compress
  const processed = await sharp(buffer)
    .rotate()
    .resize(1920, 1920, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();

  // Generate unique filename: YYYYMMDD/uuid.jpg
  const dateDir = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const dir = path.join(config.uploadDir, dateDir);
  fs.mkdirSync(dir, { recursive: true });

  const filename = `${crypto.randomUUID()}.jpg`;
  const filePath = path.join(dateDir, filename);
  const fullPath = path.join(config.uploadDir, filePath);

  fs.writeFileSync(fullPath, processed);

  return {
    filePath,
    fileSize: processed.length,
    hash,
  };
}

module.exports = { processAndSavePhoto };
