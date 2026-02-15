const express = require('express');
const auth = require('../middleware/auth');
const requireRole = require('../middleware/role');
const Area = require('../models/Area');
const Checkpoint = require('../models/Checkpoint');
const InspectItem = require('../models/InspectItem');

const router = express.Router();
router.use(auth);

// GET /api/areas - List areas
router.get('/', (req, res) => {
  const { status } = req.query;
  const result = Area.findAll({
    status: status !== undefined && status !== '' ? parseInt(status) : undefined,
  });
  res.json(result);
});

// GET /api/areas/active - Active areas for dropdowns
router.get('/active', (req, res) => {
  res.json(Area.findAllActive());
});

// GET /api/areas/:id - Get area with checkpoints
router.get('/:id', (req, res) => {
  const area = Area.findById(req.params.id);
  if (!area) {
    return res.status(404).json({ error: '区域不存在' });
  }
  res.json(area);
});

// POST /api/areas - Create area
router.post('/', requireRole('admin', 'super_admin'), (req, res) => {
  const { name, floor, building, description } = req.body;
  if (!name) {
    return res.status(400).json({ error: '请输入区域名称' });
  }
  const id = Area.create({ name, floor, building, description });
  res.status(201).json({ id, message: '创建成功' });
});

// PUT /api/areas/:id - Update area
router.put('/:id', requireRole('admin', 'super_admin'), (req, res) => {
  const area = Area.findById(req.params.id);
  if (!area) {
    return res.status(404).json({ error: '区域不存在' });
  }
  const { name, floor, building, description } = req.body;
  if (!name) {
    return res.status(400).json({ error: '请输入区域名称' });
  }
  Area.update(req.params.id, { name, floor, building, description });
  res.json({ message: '更新成功' });
});

// PUT /api/areas/:id/status - Toggle status
router.put('/:id/status', requireRole('admin', 'super_admin'), (req, res) => {
  const area = Area.findById(req.params.id);
  if (!area) {
    return res.status(404).json({ error: '区域不存在' });
  }
  const newStatus = area.status === 1 ? 0 : 1;
  Area.toggleStatus(req.params.id, newStatus);
  res.json({ message: newStatus === 1 ? '已启用' : '已停用', status: newStatus });
});

// DELETE /api/areas/:id - Hard delete (super_admin only)
router.delete('/:id', requireRole('super_admin'), (req, res) => {
  const area = Area.findById(req.params.id);
  if (!area) {
    return res.status(404).json({ error: '区域不存在' });
  }
  const result = Area.deleteWithCascade(parseInt(req.params.id));
  res.json({ message: `已删除区域"${area.name}"及其${result.checkpointsDeleted}个检查点和所有相关数据` });
});

// --- Checkpoint routes nested under areas ---

// GET /api/areas/:areaId/checkpoints
router.get('/:areaId/checkpoints', (req, res) => {
  res.json(Checkpoint.findByAreaId(req.params.areaId));
});

// POST /api/areas/:areaId/checkpoints
router.post('/:areaId/checkpoints', requireRole('admin', 'super_admin'), (req, res) => {
  const area = Area.findById(req.params.areaId);
  if (!area) {
    return res.status(404).json({ error: '区域不存在' });
  }
  const { name, description, sortOrder } = req.body;
  if (!name) {
    return res.status(400).json({ error: '请输入检查点名称' });
  }
  const id = Checkpoint.create({ areaId: req.params.areaId, name, description, sortOrder });
  res.status(201).json({ id, message: '创建成功' });
});

// DELETE /api/areas/:areaId/checkpoints/:cpId - Hard delete checkpoint (super_admin only)
router.delete('/:areaId/checkpoints/:cpId', requireRole('super_admin'), (req, res) => {
  const cp = Checkpoint.findById(req.params.cpId);
  if (!cp) {
    return res.status(404).json({ error: '检查点不存在' });
  }
  Checkpoint.deleteWithCascade(parseInt(req.params.cpId));
  res.json({ message: `已删除检查点"${cp.name}"及所有相关数据` });
});

// PUT /api/areas/:areaId/checkpoints/reorder
router.put('/:areaId/checkpoints/reorder', requireRole('admin', 'super_admin'), (req, res) => {
  const { orderedIds } = req.body;
  if (!orderedIds || !Array.isArray(orderedIds)) {
    return res.status(400).json({ error: '参数错误' });
  }
  Checkpoint.reorder(req.params.areaId, orderedIds);
  res.json({ message: '排序已更新' });
});

// --- Inspect items routes nested under areas ---

// GET /api/areas/:areaId/inspect-items - All items with enabled status for this area
router.get('/:areaId/inspect-items', (req, res) => {
  const area = Area.findById(req.params.areaId);
  if (!area) return res.status(404).json({ error: '区域不存在' });
  res.json(InspectItem.findAllWithAreaStatus(req.params.areaId));
});

// PUT /api/areas/:areaId/inspect-items - Save enabled items
router.put('/:areaId/inspect-items', requireRole('admin', 'super_admin'), (req, res) => {
  const area = Area.findById(req.params.areaId);
  if (!area) return res.status(404).json({ error: '区域不存在' });
  const { itemIds } = req.body;
  if (!Array.isArray(itemIds)) {
    return res.status(400).json({ error: '参数错误' });
  }
  InspectItem.setAreaItems(parseInt(req.params.areaId), itemIds.map(Number));
  res.json({ message: '保存成功' });
});

module.exports = router;
