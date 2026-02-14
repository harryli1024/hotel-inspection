const express = require('express');
const path = require('path');
const fs = require('fs');
const auth = require('../middleware/auth');
const requireRole = require('../middleware/role');
const upload = require('../middleware/upload');
const { processAndSavePhoto } = require('../services/photoService');
const Inspection = require('../models/Inspection');
const Task = require('../models/Task');
const config = require('../config');

const router = express.Router();
router.use(auth);

// POST /api/inspections - Submit inspection (any staff can submit)
router.post('/', upload.array('photos', 10), async (req, res) => {
  try {
    const { taskId, items: itemsJson, photosMeta: photosMetaJson, gpsLat, gpsLng, gpsAccuracy, deviceInfo } = req.body;

    if (!taskId) {
      return res.status(400).json({ error: '缺少任务ID' });
    }

    // Parse items
    let items;
    try {
      items = JSON.parse(itemsJson);
    } catch {
      return res.status(400).json({ error: '检查项数据格式错误' });
    }

    // Parse photos metadata
    let photosMeta = [];
    if (photosMetaJson) {
      try {
        photosMeta = JSON.parse(photosMetaJson);
      } catch {
        return res.status(400).json({ error: '照片元数据格式错误' });
      }
    }

    // Verify at least 1 photo
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: '请至少拍摄一张照片' });
    }

    // Load task and validate
    const task = Task.findById(parseInt(taskId));
    if (!task) {
      return res.status(404).json({ error: '任务不存在' });
    }
    if (task.status === 'completed') {
      return res.status(400).json({ error: '该任务已被完成' });
    }
    if (task.status === 'overdue') {
      return res.status(400).json({ error: '该任务已超时，无法补交' });
    }

    // --- Global 15-minute anti-spam check (fail fast, before photo processing) ---
    const recentRecord = Inspection.findRecentForCheckpoint(task.checkpoint_id, 15);
    if (recentRecord) {
      const now0 = new Date();
      const lastTime = new Date(recentRecord.submitted_at);
      const waitMinutes = 15 - Math.floor((now0 - lastTime) / 60000);
      return res.status(400).json({
        error: `距上次检查不足15分钟，请稍后再试（还需等待约${waitMinutes}分钟）`,
      });
    }

    // --- Compliance status calculation ---
    const now = new Date();
    const windowStart = new Date(task.window_start);
    const windowEnd = new Date(task.window_end);
    let complianceStatus = 'on_time';

    // Past window_end: reject submission entirely
    if (now > windowEnd) {
      return res.status(400).json({ error: '已超出检查时间窗口，无法提交' });
    }
    if (now < windowStart) {
      complianceStatus = 'anomaly';
    }

    // Time drift check for photos
    for (let i = 0; i < req.files.length; i++) {
      const meta = photosMeta[i] || {};
      if (meta.takenAt) {
        const takenTime = new Date(meta.takenAt);
        const drift = Math.abs(now.getTime() - takenTime.getTime());
        if (drift > 5 * 60 * 1000) {
          return res.status(400).json({ error: '照片拍摄时间异常，请重新拍照' });
        }
      }
    }

    // Process and save photos
    const photos = [];
    const seenHashes = new Set();

    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];
      const meta = photosMeta[i] || {};

      const result = await processAndSavePhoto(file.buffer, meta);

      if (seenHashes.has(result.hash)) {
        return res.status(400).json({ error: '存在重复照片，请勿上传相同照片' });
      }
      seenHashes.add(result.hash);

      photos.push({
        filePath: result.filePath,
        originalName: file.originalname,
        fileSize: result.fileSize,
        watermarkInfo: meta.watermarkInfo || null,
        takenAt: meta.takenAt || now.toISOString(),
      });
    }

    // Create inspection record in transaction
    const recordId = Inspection.create({
      record: {
        inspectorId: req.user.userId,
        checkpointId: task.checkpoint_id,
        gpsLat: parseFloat(gpsLat) || null,
        gpsLng: parseFloat(gpsLng) || null,
        gpsAccuracy: parseFloat(gpsAccuracy) || null,
        deviceInfo,
      },
      items,
      photos,
      taskId: parseInt(taskId),
      complianceStatus,
    });

    const complianceMsg = {
      on_time: '提交成功',
      anomaly: '提交成功（已标记为异常）',
    };

    res.status(201).json({
      id: recordId,
      message: complianceMsg[complianceStatus],
      complianceStatus,
    });
  } catch (err) {
    if (err.message.includes('无法提交') || err.message.includes('已被完成')) {
      return res.status(400).json({ error: err.message });
    }
    console.error('Inspection submission error:', err);
    res.status(500).json({ error: '提交失败，请重试' });
  }
});

// GET /api/inspections - List records (admin)
router.get('/', requireRole('admin', 'super_admin'), (req, res) => {
  const { page, limit, startDate, endDate, inspectorId, checkpointId, areaId, complianceStatus, reviewStatus } = req.query;
  const result = Inspection.findAll({
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 20,
    startDate, endDate,
    inspectorId: inspectorId || undefined,
    checkpointId: checkpointId || undefined,
    areaId: areaId || undefined,
    complianceStatus: complianceStatus || undefined,
    reviewStatus: reviewStatus || undefined,
  });
  res.json(result);
});

// GET /api/inspections/anomaly-count - Anomaly stats
router.get('/anomaly-count', requireRole('admin', 'super_admin'), (req, res) => {
  const { startDate, endDate } = req.query;
  const today = new Date().toISOString().slice(0, 10);
  const result = Inspection.getAnomalyCount({
    startDate: startDate || today,
    endDate: endDate || today,
  });
  res.json(result);
});

// PUT /api/inspections/:id/review - Admin review (approve or punish)
router.put('/:id/review', requireRole('admin', 'super_admin'), (req, res) => {
  const { reviewStatus, reviewComment } = req.body;

  if (!reviewStatus || !['approved', 'punished'].includes(reviewStatus)) {
    return res.status(400).json({ error: '审核状态无效' });
  }

  const result = Inspection.review(req.params.id, {
    reviewStatus,
    reviewComment,
    reviewerId: req.user.userId,
  });

  if (!result) {
    return res.status(404).json({ error: '记录不存在' });
  }

  const msg = reviewStatus === 'approved' ? '已通过' : '已标记处罚';
  res.json({ message: msg });
});

// GET /api/inspections/:id - Record detail
router.get('/:id', (req, res) => {
  const record = Inspection.findById(req.params.id);
  if (!record) {
    return res.status(404).json({ error: '记录不存在' });
  }

  // Staff can only see own records
  if (req.user.role === 'staff' && record.inspector_id !== req.user.userId) {
    return res.status(403).json({ error: '权限不足' });
  }

  res.json(record);
});

// GET /api/inspections/photos/:dateDir/:filename - Serve photo (authenticated)
router.get('/photos/:dateDir/:filename', (req, res) => {
  const filePath = path.join(config.uploadDir, req.params.dateDir, req.params.filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: '照片不存在' });
  }
  res.sendFile(filePath);
});

module.exports = router;
