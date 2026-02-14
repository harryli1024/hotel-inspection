const express = require('express');
const auth = require('../middleware/auth');
const requireRole = require('../middleware/role');
const Checkpoint = require('../models/Checkpoint');

const router = express.Router();
router.use(auth);

// GET /api/checkpoints/active - Active checkpoints for dropdowns
router.get('/active', (req, res) => {
  res.json(Checkpoint.findAllActive());
});

// GET /api/checkpoints/:id
router.get('/:id', (req, res) => {
  const checkpoint = Checkpoint.findById(req.params.id);
  if (!checkpoint) {
    return res.status(404).json({ error: '检查点不存在' });
  }
  res.json(checkpoint);
});

// PUT /api/checkpoints/:id
router.put('/:id', requireRole('admin', 'super_admin'), (req, res) => {
  const checkpoint = Checkpoint.findById(req.params.id);
  if (!checkpoint) {
    return res.status(404).json({ error: '检查点不存在' });
  }
  const { name, description } = req.body;
  if (!name) {
    return res.status(400).json({ error: '请输入检查点名称' });
  }
  Checkpoint.update(req.params.id, { name, description });
  res.json({ message: '更新成功' });
});

// PUT /api/checkpoints/:id/status
router.put('/:id/status', requireRole('admin', 'super_admin'), (req, res) => {
  const checkpoint = Checkpoint.findById(req.params.id);
  if (!checkpoint) {
    return res.status(404).json({ error: '检查点不存在' });
  }
  const newStatus = checkpoint.status === 1 ? 0 : 1;
  Checkpoint.toggleStatus(req.params.id, newStatus);
  res.json({ message: newStatus === 1 ? '已启用' : '已停用', status: newStatus });
});

module.exports = router;
