const express = require('express');
const auth = require('../middleware/auth');
const requireRole = require('../middleware/role');
const InspectItem = require('../models/InspectItem');

const router = express.Router();
router.use(auth);
router.use(requireRole('admin', 'super_admin'));

// GET /api/inspect-items - List all global items
router.get('/', (req, res) => {
  res.json(InspectItem.findAll());
});

// POST /api/inspect-items - Create custom item
router.post('/', (req, res) => {
  const { itemKey, itemName, inputType, options, required } = req.body;
  if (!itemKey || !itemName || !inputType) {
    return res.status(400).json({ error: '请填写完整信息' });
  }
  if (inputType === 'radio' && (!options || !Array.isArray(options) || options.length < 2)) {
    return res.status(400).json({ error: '单选项至少需要2个选项' });
  }
  try {
    const id = InspectItem.create({ itemKey, itemName, inputType, options, required });
    res.status(201).json({ id, message: '创建成功' });
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(400).json({ error: '检查项标识已存在' });
    }
    throw err;
  }
});

// PUT /api/inspect-items/:id - Update item
router.put('/:id', (req, res) => {
  const item = InspectItem.findById(req.params.id);
  if (!item) return res.status(404).json({ error: '检查项不存在' });
  const { itemName, inputType, options, required } = req.body;
  if (!itemName || !inputType) {
    return res.status(400).json({ error: '请填写完整信息' });
  }
  InspectItem.update(req.params.id, { itemName, inputType, options, required });
  res.json({ message: '更新成功' });
});

// DELETE /api/inspect-items/:id - Delete item (super_admin only)
router.delete('/:id', requireRole('super_admin'), (req, res) => {
  const item = InspectItem.findById(req.params.id);
  if (!item) return res.status(404).json({ error: '检查项不存在' });
  InspectItem.delete(parseInt(req.params.id));
  res.json({ message: '已删除' });
});

module.exports = router;
