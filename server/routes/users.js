const express = require('express');
const bcrypt = require('bcryptjs');
const auth = require('../middleware/auth');
const requireRole = require('../middleware/role');
const User = require('../models/User');

const router = express.Router();

// All routes require authentication
router.use(auth);

// GET /api/users - List users (admin+)
router.get('/', requireRole('admin', 'super_admin'), (req, res) => {
  const { page, limit, role, status, keyword } = req.query;
  const filters = {
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 20,
    role: role || undefined,
    status: status !== undefined && status !== '' ? parseInt(status) : undefined,
    keyword: keyword || undefined,
  };

  // Admins can only see staff
  if (req.user.role === 'admin') {
    filters.role = 'staff';
  }

  const result = User.findAll(filters);
  res.json(result);
});

// GET /api/users/me/stats - Personal statistics (staff)
router.get('/me/stats', (req, res) => {
  const stats = User.getStaffStats(req.user.userId);
  const recentRecords = User.getRecentRecords(req.user.userId);
  res.json({ stats, recentRecords });
});

// GET /api/users/:id - Get user detail
router.get('/:id', requireRole('admin', 'super_admin'), (req, res) => {
  const user = User.findById(req.params.id);
  if (!user) {
    return res.status(404).json({ error: '用户不存在' });
  }
  res.json(user);
});

// POST /api/users - Create user
router.post('/', requireRole('admin', 'super_admin'), (req, res) => {
  const { username, password, role, realName, phone } = req.body;

  if (!username || !password || !role || !realName) {
    return res.status(400).json({ error: '请填写所有必填字段' });
  }

  // Admin can only create staff
  if (req.user.role === 'admin' && role !== 'staff') {
    return res.status(403).json({ error: '管理员只能创建接待员账号' });
  }

  // Check username uniqueness
  if (User.findByUsername(username)) {
    return res.status(400).json({ error: '用户名已存在' });
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const id = User.create({ username, passwordHash, role, realName, phone });
  res.status(201).json({ id, message: '创建成功' });
});

// PUT /api/users/:id - Update user
router.put('/:id', requireRole('admin', 'super_admin'), (req, res) => {
  const user = User.findById(req.params.id);
  if (!user) {
    return res.status(404).json({ error: '用户不存在' });
  }

  // Admin can only update staff
  if (req.user.role === 'admin' && user.role !== 'staff') {
    return res.status(403).json({ error: '权限不足' });
  }

  const { realName, phone, role } = req.body;

  // Admin cannot promote to admin/super_admin
  if (req.user.role === 'admin' && role && role !== 'staff') {
    return res.status(403).json({ error: '权限不足' });
  }

  User.update(req.params.id, { realName, phone, role });
  res.json({ message: '更新成功' });
});

// PUT /api/users/:id/password - Reset password
router.put('/:id/password', (req, res) => {
  const targetId = parseInt(req.params.id);
  const { password } = req.body;

  if (!password || password.length < 6) {
    return res.status(400).json({ error: '密码至少6位' });
  }

  // Staff can only change own password
  if (req.user.role === 'staff' && req.user.userId !== targetId) {
    return res.status(403).json({ error: '权限不足' });
  }

  const user = User.findById(targetId);
  if (!user) {
    return res.status(404).json({ error: '用户不存在' });
  }

  // Admin can only reset staff password
  if (req.user.role === 'admin' && user.role !== 'staff') {
    return res.status(403).json({ error: '权限不足' });
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  User.updatePassword(targetId, passwordHash);
  res.json({ message: '密码修改成功' });
});

// PUT /api/users/:id/status - Toggle user status
router.put('/:id/status', requireRole('admin', 'super_admin'), (req, res) => {
  const user = User.findById(req.params.id);
  if (!user) {
    return res.status(404).json({ error: '用户不存在' });
  }

  // Cannot disable yourself
  if (req.user.userId === user.id) {
    return res.status(400).json({ error: '不能停用自己的账号' });
  }

  // Admin can only toggle staff
  if (req.user.role === 'admin' && user.role !== 'staff') {
    return res.status(403).json({ error: '权限不足' });
  }

  const newStatus = user.status === 1 ? 0 : 1;
  User.toggleStatus(user.id, newStatus);
  res.json({ message: newStatus === 1 ? '已启用' : '已停用', status: newStatus });
});

module.exports = router;
