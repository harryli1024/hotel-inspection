const db = require('./db');

const Schedule = {
  findAll({ page = 1, limit = 20, status } = {}) {
    let where = 'WHERE 1=1';
    const params = [];

    if (status !== undefined && status !== '') {
      where += ' AND s.status = ?';
      params.push(status);
    }

    const total = db.prepare(
      `SELECT COUNT(*) as count FROM task_schedules s ${where}`
    ).get(...params).count;

    const offset = (page - 1) * limit;
    const rows = db.prepare(`
      SELECT s.*,
             c.name as checkpoint_name,
             a.name as area_name
      FROM task_schedules s
      LEFT JOIN checkpoints c ON s.checkpoint_id = c.id
      LEFT JOIN areas a ON c.area_id = a.id
      ${where}
      ORDER BY s.id DESC LIMIT ? OFFSET ?
    `).all(...params, limit, offset);

    return { rows, total, page, limit };
  },

  findById(id) {
    return db.prepare(`
      SELECT s.*,
             c.name as checkpoint_name,
             a.name as area_name
      FROM task_schedules s
      LEFT JOIN checkpoints c ON s.checkpoint_id = c.id
      LEFT JOIN areas a ON c.area_id = a.id
      WHERE s.id = ?
    `).get(id);
  },

  findActiveSchedules() {
    return db.prepare(
      'SELECT * FROM task_schedules WHERE status = 1'
    ).all();
  },

  create({ checkpointId, frequencyMinutes, startTime, endTime, activeDays, windowMinutes }) {
    const result = db.prepare(`
      INSERT INTO task_schedules
        (checkpoint_id, frequency_minutes, start_time, end_time, active_days, window_minutes)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(checkpointId, frequencyMinutes, startTime, endTime,
           activeDays || '1,2,3,4,5,6,7', windowMinutes || 30);
    return result.lastInsertRowid;
  },

  update(id, { checkpointId, frequencyMinutes, startTime, endTime, activeDays, windowMinutes }) {
    db.prepare(`
      UPDATE task_schedules SET
        checkpoint_id = ?,
        frequency_minutes = ?, start_time = ?, end_time = ?,
        active_days = ?, window_minutes = ?,
        updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `).run(checkpointId, frequencyMinutes, startTime, endTime,
           activeDays || '1,2,3,4,5,6,7', windowMinutes || 30, id);
  },

  toggleStatus(id, status) {
    db.prepare(
      "UPDATE task_schedules SET status = ?, updated_at = datetime('now', 'localtime') WHERE id = ?"
    ).run(status, id);
  },
};

module.exports = Schedule;
