const db = require('./db');

const User = {
  findByUsername(username) {
    return db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  },

  findById(id) {
    return db.prepare(
      'SELECT id, username, role, real_name, phone, status, created_at, updated_at FROM users WHERE id = ?'
    ).get(id);
  },

  findAll({ page = 1, limit = 20, role, status, keyword } = {}) {
    let where = 'WHERE 1=1';
    const params = [];

    if (role) {
      where += ' AND role = ?';
      params.push(role);
    }
    if (status !== undefined && status !== '') {
      where += ' AND status = ?';
      params.push(status);
    }
    if (keyword) {
      where += ' AND (username LIKE ? OR real_name LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`);
    }

    const total = db.prepare(`SELECT COUNT(*) as count FROM users ${where}`).get(...params).count;
    const offset = (page - 1) * limit;
    const rows = db.prepare(
      `SELECT id, username, role, real_name, phone, status, created_at, updated_at
       FROM users ${where} ORDER BY id DESC LIMIT ? OFFSET ?`
    ).all(...params, limit, offset);

    return { rows, total, page, limit };
  },

  create({ username, passwordHash, role, realName, phone }) {
    const result = db.prepare(
      'INSERT INTO users (username, password_hash, role, real_name, phone) VALUES (?, ?, ?, ?, ?)'
    ).run(username, passwordHash, role, realName, phone || null);
    return result.lastInsertRowid;
  },

  update(id, { realName, phone, role }) {
    const fields = [];
    const params = [];

    if (realName !== undefined) { fields.push('real_name = ?'); params.push(realName); }
    if (phone !== undefined) { fields.push('phone = ?'); params.push(phone); }
    if (role !== undefined) { fields.push('role = ?'); params.push(role); }

    if (fields.length === 0) return;

    fields.push("updated_at = datetime('now', 'localtime')");
    params.push(id);
    db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...params);
  },

  updatePassword(id, passwordHash) {
    db.prepare(
      "UPDATE users SET password_hash = ?, updated_at = datetime('now', 'localtime') WHERE id = ?"
    ).run(passwordHash, id);
  },

  toggleStatus(id, status) {
    db.prepare(
      "UPDATE users SET status = ?, updated_at = datetime('now', 'localtime') WHERE id = ?"
    ).run(status, id);
  },

  getRecordCount(userId) {
    return db.prepare(
      'SELECT COUNT(*) as count FROM inspection_records WHERE inspector_id = ?'
    ).get(userId).count;
  },

  deleteUser: db.transaction((id) => {
    // Nullify references in inspection_records so records are preserved
    db.prepare('UPDATE inspection_records SET inspector_id = NULL WHERE inspector_id = ?').run(id);
    db.prepare('UPDATE inspection_records SET reviewer_id = NULL WHERE reviewer_id = ?').run(id);
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
  }),

  getStaffStats(userId) {
    const today = new Date().toISOString().slice(0, 10);
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    const monthStart = today.slice(0, 7) + '-01';

    // Stats based on inspection_records (who actually did the inspection)
    const todayCount = db.prepare(
      "SELECT COUNT(*) as count FROM inspection_records WHERE inspector_id = ? AND date(submitted_at) = ?"
    ).get(userId, today).count;

    const weekCount = db.prepare(
      "SELECT COUNT(*) as count FROM inspection_records WHERE inspector_id = ? AND date(submitted_at) >= ?"
    ).get(userId, weekAgo).count;

    const monthCount = db.prepare(
      "SELECT COUNT(*) as count FROM inspection_records WHERE inspector_id = ? AND date(submitted_at) >= ?"
    ).get(userId, monthStart).count;

    const totalCompleted = db.prepare(
      "SELECT COUNT(*) as count FROM inspection_records WHERE inspector_id = ?"
    ).get(userId).count;

    const onTimeCount = db.prepare(
      "SELECT COUNT(*) as count FROM inspection_records WHERE inspector_id = ? AND compliance_status = 'on_time'"
    ).get(userId).count;

    // Today's total tasks (shared across all staff)
    const todayTotal = db.prepare(
      "SELECT COUNT(*) as count FROM inspection_tasks WHERE date(due_time) = ?"
    ).get(today).count;

    return {
      today: { total: todayTotal, completed: todayCount },
      week: { completed: weekCount },
      month: { completed: monthCount },
      totalCompleted,
      onTimeRate: totalCompleted > 0 ? Math.round((onTimeCount / totalCompleted) * 100) : 100,
    };
  },

  getRecentRecords(userId, limit = 10) {
    return db.prepare(`
      SELECT ir.id, ir.submitted_at, ir.checkpoint_id,
             c.name as checkpoint_name, a.name as area_name
      FROM inspection_records ir
      JOIN checkpoints c ON ir.checkpoint_id = c.id
      JOIN areas a ON c.area_id = a.id
      WHERE ir.inspector_id = ?
      ORDER BY ir.submitted_at DESC LIMIT ?
    `).all(userId, limit);
  },
};

module.exports = User;
