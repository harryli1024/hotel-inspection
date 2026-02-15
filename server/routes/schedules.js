const express = require('express');
const auth = require('../middleware/auth');
const requireRole = require('../middleware/role');
const Schedule = require('../models/Schedule');
const { generateTasks } = require('../services/taskGenerator');

const router = express.Router();
router.use(auth);
router.use(requireRole('admin', 'super_admin'));

// GET /api/schedules
router.get('/', (req, res) => {
  const { page, limit, status } = req.query;
  const result = Schedule.findAll({
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 20,
    status: status !== undefined && status !== '' ? parseInt(status) : undefined,
  });
  res.json(result);
});

// GET /api/schedules/:id
router.get('/:id', (req, res) => {
  const schedule = Schedule.findById(req.params.id);
  if (!schedule) {
    return res.status(404).json({ error: '排班不存在' });
  }
  res.json(schedule);
});

// POST /api/schedules
router.post('/', (req, res) => {
  const { checkpointId, frequencyMinutes, startTime, endTime, activeDays, windowMinutes } = req.body;

  if (!checkpointId || !frequencyMinutes || !startTime || !endTime) {
    return res.status(400).json({ error: '请填写所有必填字段' });
  }

  const id = Schedule.create({ checkpointId, frequencyMinutes, startTime, endTime, activeDays, windowMinutes });
  res.status(201).json({ id, message: '创建成功' });
});

// PUT /api/schedules/:id
router.put('/:id', (req, res) => {
  const schedule = Schedule.findById(req.params.id);
  if (!schedule) {
    return res.status(404).json({ error: '排班不存在' });
  }

  const { checkpointId, frequencyMinutes, startTime, endTime, activeDays, windowMinutes } = req.body;
  Schedule.update(req.params.id, { checkpointId, frequencyMinutes, startTime, endTime, activeDays, windowMinutes });
  res.json({ message: '更新成功' });
});

// PUT /api/schedules/:id/status
router.put('/:id/status', (req, res) => {
  const schedule = Schedule.findById(req.params.id);
  if (!schedule) {
    return res.status(404).json({ error: '排班不存在' });
  }
  const newStatus = schedule.status === 1 ? 0 : 1;
  Schedule.toggleStatus(req.params.id, newStatus);
  res.json({ message: newStatus === 1 ? '已启用' : '已停用', status: newStatus });
});

// POST /api/schedules/generate - Manual trigger: generate tasks for date range
let _generating = false;
router.post('/generate', (req, res) => {
  if (_generating) {
    return res.status(409).json({ error: '任务正在生成中，请勿重复操作' });
  }
  _generating = true;
  try {
    const { startDate, endDate } = req.body;
    const count = generateTasks(startDate || undefined, endDate || undefined);
    const rangeMsg = startDate && endDate ? `${startDate} ~ ${endDate}` : '未来7天';
    res.json({ message: count > 0 ? `已生成 ${count} 个任务（${rangeMsg}）` : '无新任务需要生成（可能已全部生成）', count });
  } catch (err) {
    res.status(500).json({ error: '任务生成失败: ' + err.message });
  } finally {
    _generating = false;
  }
});

module.exports = router;
