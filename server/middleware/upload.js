const multer = require('multer');
const config = require('../config');

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: config.maxPhotoSize,
    files: config.maxPhotosPerInspection,
  },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      cb(new Error('只允许上传图片文件'));
      return;
    }
    cb(null, true);
  },
});

module.exports = upload;
