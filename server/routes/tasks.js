const express = require('express');
const auth = require('../middleware/auth');
const requireRole = require('../middleware/role');
const Task = require('../models/Task');

const router = express.Router();
router.use(auth);

// GET /api/tasks/my - Activated tasks for staff (due_time <= now, not completed)
router.get('/my', (req, res) => {
  const { status, page, limit } = req.query;
  const result = Task.findAvailable({
    status: status || undefined,
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 50,
  });
  res.json(result);
});

// GET /api/tasks/grouped - Staff tasks grouped by area/checkpoint
router.get('/grouped', (req, res) => {
  const { status } = req.query;
  const result = Task.findGrouped({ status: status || undefined });
  res.json(result);
});

// GET /api/tasks/admin-grouped - Admin tasks grouped by area/checkpoint (all tasks for date)
router.get('/admin-grouped', requireRole('admin', 'super_admin'), (req, res) => {
  const { date, status } = req.query;
  const result = Task.findGroupedAdmin({
    date: date || undefined,
    status: status || undefined,
  });
  res.json(result);
});

// GET /api/tasks/stats - Dashboard statistics
router.get('/stats', requireRole('admin', 'super_admin'), (req, res) => {
  const { date, startDate, endDate } = req.query;
  const today = new Date().toISOString().slice(0, 10);
  const stats = Task.getStats({ date: date || today, startDate, endDate });
  const dailyStats = Task.getDailyStats(7);
  res.json({ today: stats, dailyStats });
});

// GET /api/tasks - Admin: all tasks
router.get('/', requireRole('admin', 'super_admin'), (req, res) => {
  const { date, status, checkpointId, page, limit } = req.query;
  const result = Task.findAll({
    date: date || undefined,
    status: status || undefined,
    checkpointId: checkpointId || undefined,
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 20,
  });
  res.json(result);
});

// DELETE /api/tasks/all - Delete all tasks (super_admin only)
router.delete('/all', requireRole('super_admin'), (req, res) => {
  Task.deleteAllTasks();
  res.json({ message: '已删除全部任务及相关记录' });
});

// DELETE /api/tasks/:id - Delete single task (super_admin only)
router.delete('/:id', requireRole('super_admin'), (req, res) => {
  const task = Task.findById(req.params.id);
  if (!task) {
    return res.status(404).json({ error: '任务不存在' });
  }
  Task.deleteTask(parseInt(req.params.id));
  res.json({ message: '已删除任务' });
});

// GET /api/tasks/:id - Task detail with fixed inspect items
router.get('/:id', (req, res) => {
  const task = Task.findById(req.params.id);
  if (!task) {
    return res.status(404).json({ error: '任务不存在' });
  }
  res.json(task);
});

module.exports = router;
