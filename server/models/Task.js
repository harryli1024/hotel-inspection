const fs = require('fs');
const path = require('path');
const db = require('./db');
const config = require('../config');
const INSPECT_ITEMS = require('../config/inspectItems');

const Task = {
  // Staff sees only pending tasks within their time window (not yet past window_end)
  findAvailable({ status, page = 1, limit = 50 } = {}) {
    let where = "WHERE t.due_time <= datetime('now', 'localtime') AND t.status = 'pending' AND t.window_end >= datetime('now', 'localtime')";
    const params = [];

    const total = db.prepare(
      `SELECT COUNT(*) as count FROM inspection_tasks t ${where}`
    ).get(...params).count;

    const offset = (page - 1) * limit;
    const rows = db.prepare(`
      SELECT t.*,
             c.name as checkpoint_name,
             a.name as area_name, a.floor, a.building
      FROM inspection_tasks t
      LEFT JOIN checkpoints c ON t.checkpoint_id = c.id
      LEFT JOIN areas a ON c.area_id = a.id
      ${where}
      ORDER BY t.due_time ASC LIMIT ? OFFSET ?
    `).all(...params, limit, offset);

    return { rows, total, page, limit };
  },

  findAll({ date, status, checkpointId, page = 1, limit = 20 } = {}) {
    let where = 'WHERE 1=1';
    const params = [];

    if (date) {
      where += ' AND date(t.due_time) = ?';
      params.push(date);
    }
    if (status) {
      where += " AND (CASE WHEN t.status = 'pending' AND t.window_end < datetime('now','localtime') THEN 'overdue' ELSE t.status END) = ?";
      params.push(status);
    }
    if (checkpointId) {
      where += ' AND t.checkpoint_id = ?';
      params.push(checkpointId);
    }

    const total = db.prepare(
      `SELECT COUNT(*) as count FROM inspection_tasks t ${where}`
    ).get(...params).count;

    const offset = (page - 1) * limit;
    const rows = db.prepare(`
      SELECT t.*,
             CASE WHEN t.status = 'pending' AND t.window_end < datetime('now','localtime') THEN 'overdue' ELSE t.status END as status,
             c.name as checkpoint_name,
             a.name as area_name, a.floor, a.building,
             ir.inspector_id,
             u.real_name as completed_by_name,
             CASE WHEN t.due_time > datetime('now', 'localtime') THEN 1 ELSE 0 END as is_future
      FROM inspection_tasks t
      LEFT JOIN checkpoints c ON t.checkpoint_id = c.id
      LEFT JOIN areas a ON c.area_id = a.id
      LEFT JOIN inspection_records ir ON ir.task_id = t.id
      LEFT JOIN users u ON ir.inspector_id = u.id
      ${where}
      ORDER BY t.due_time DESC LIMIT ? OFFSET ?
    `).all(...params, limit, offset);

    return { rows, total, page, limit };
  },

  // Staff grouped view: only pending tasks within their time window
  findGrouped({ status } = {}) {
    let where = "WHERE t.due_time <= datetime('now', 'localtime') AND t.window_end >= datetime('now', 'localtime')";
    const params = [];

    if (status) {
      where += ' AND t.status = ?';
      params.push(status);
    } else {
      where += " AND t.status = 'pending'";
    }

    const rows = db.prepare(`
      SELECT t.*,
             c.name as checkpoint_name, c.id as checkpoint_id,
             a.name as area_name, a.id as area_id, a.floor, a.building
      FROM inspection_tasks t
      LEFT JOIN checkpoints c ON t.checkpoint_id = c.id
      LEFT JOIN areas a ON c.area_id = a.id
      ${where}
      ORDER BY a.name ASC, c.name ASC, t.due_time ASC
    `).all(...params);

    // Group by area > checkpoint
    const areaMap = {};
    for (const row of rows) {
      const areaKey = row.area_id || 0;
      if (!areaMap[areaKey]) {
        areaMap[areaKey] = {
          areaId: row.area_id,
          areaName: row.area_name || '未分区',
          floor: row.floor,
          building: row.building,
          checkpoints: {},
        };
      }
      const cpKey = row.checkpoint_id || 0;
      if (!areaMap[areaKey].checkpoints[cpKey]) {
        areaMap[areaKey].checkpoints[cpKey] = {
          checkpointId: row.checkpoint_id,
          checkpointName: row.checkpoint_name || '未知检查点',
          tasks: [],
          completedCount: 0,
          totalCount: 0,
        };
      }
      const cp = areaMap[areaKey].checkpoints[cpKey];
      cp.tasks.push(row);
      cp.totalCount++;
      if (row.status === 'completed') cp.completedCount++;
    }

    const groups = Object.values(areaMap).map(area => ({
      ...area,
      checkpoints: Object.values(area.checkpoints),
    }));

    return { groups, totalTasks: rows.length };
  },

  // Admin grouped view: all tasks for a date, grouped by area > checkpoint
  findGroupedAdmin({ date, status } = {}) {
    let where = 'WHERE 1=1';
    const params = [];

    if (date) {
      where += ' AND date(t.due_time) = ?';
      params.push(date);
    }
    if (status) {
      where += " AND (CASE WHEN t.status = 'pending' AND t.window_end < datetime('now','localtime') THEN 'overdue' ELSE t.status END) = ?";
      params.push(status);
    }

    const rows = db.prepare(`
      SELECT t.*,
             CASE WHEN t.status = 'pending' AND t.window_end < datetime('now','localtime') THEN 'overdue' ELSE t.status END as status,
             c.name as checkpoint_name, c.id as checkpoint_id,
             a.name as area_name, a.id as area_id, a.floor, a.building,
             u.real_name as completed_by_name,
             CASE WHEN t.due_time > datetime('now', 'localtime') THEN 1 ELSE 0 END as is_future
      FROM inspection_tasks t
      LEFT JOIN checkpoints c ON t.checkpoint_id = c.id
      LEFT JOIN areas a ON c.area_id = a.id
      LEFT JOIN inspection_records ir ON ir.task_id = t.id
      LEFT JOIN users u ON ir.inspector_id = u.id
      ${where}
      ORDER BY a.name ASC, c.name ASC, t.due_time ASC
    `).all(...params);

    const areaMap = {};
    for (const row of rows) {
      const areaKey = row.area_id || 0;
      if (!areaMap[areaKey]) {
        areaMap[areaKey] = {
          areaId: row.area_id,
          areaName: row.area_name || '未分区',
          floor: row.floor,
          building: row.building,
          checkpoints: {},
        };
      }
      const cpKey = row.checkpoint_id || 0;
      if (!areaMap[areaKey].checkpoints[cpKey]) {
        areaMap[areaKey].checkpoints[cpKey] = {
          checkpointId: row.checkpoint_id,
          checkpointName: row.checkpoint_name || '未知检查点',
          tasks: [],
          completedCount: 0,
          overdueCount: 0,
          totalCount: 0,
        };
      }
      const cp = areaMap[areaKey].checkpoints[cpKey];
      cp.tasks.push(row);
      cp.totalCount++;
      if (row.status === 'completed') cp.completedCount++;
      if (row.status === 'overdue') cp.overdueCount++;
    }

    const groups = Object.values(areaMap).map(area => ({
      ...area,
      checkpoints: Object.values(area.checkpoints),
    }));

    return { groups, totalTasks: rows.length };
  },

  findById(id) {
    const task = db.prepare(`
      SELECT t.*,
             CASE WHEN t.status = 'pending' AND t.window_end < datetime('now','localtime') THEN 'overdue' ELSE t.status END as status,
             c.name as checkpoint_name,
             a.name as area_name, a.floor, a.building
      FROM inspection_tasks t
      LEFT JOIN checkpoints c ON t.checkpoint_id = c.id
      LEFT JOIN areas a ON c.area_id = a.id
      WHERE t.id = ?
    `).get(id);

    if (task) {
      task.inspectItems = INSPECT_ITEMS;
    }

    return task;
  },

  batchCreate: db.transaction((tasks) => {
    const stmt = db.prepare(`
      INSERT INTO inspection_tasks
        (schedule_id, checkpoint_id, due_time, window_start, window_end)
      VALUES (?, ?, ?, ?, ?)
    `);

    for (const t of tasks) {
      stmt.run(t.scheduleId, t.checkpointId, t.dueTime, t.windowStart, t.windowEnd);
    }
  }),

  existsForScheduleAndTime(scheduleId, dueTime) {
    const row = db.prepare(
      'SELECT 1 FROM inspection_tasks WHERE schedule_id = ? AND due_time = ?'
    ).get(scheduleId, dueTime);
    return !!row;
  },

  markCompleted(id) {
    db.prepare(
      "UPDATE inspection_tasks SET status = 'completed', completed_at = datetime('now', 'localtime') WHERE id = ?"
    ).run(id);
  },

  markOverdue() {
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
    return db.prepare(
      "UPDATE inspection_tasks SET status = 'overdue' WHERE status = 'pending' AND window_end < ?"
    ).run(now).changes;
  },

  getStats({ date, startDate, endDate } = {}) {
    let where = 'WHERE 1=1';
    const params = [];

    if (date) {
      where += ' AND date(due_time) = ?';
      params.push(date);
    } else if (startDate && endDate) {
      where += ' AND date(due_time) >= ? AND date(due_time) <= ?';
      params.push(startDate, endDate);
    }

    return db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'pending' AND window_end >= datetime('now','localtime') THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'overdue' OR (status = 'pending' AND window_end < datetime('now','localtime')) THEN 1 ELSE 0 END) as overdue
      FROM inspection_tasks
      ${where}
    `).get(...params);
  },

  deleteTask: db.transaction((id) => {
    // Get photo file paths
    const photos = db.prepare(`
      SELECT rp.file_path FROM record_photos rp
      JOIN inspection_records ir ON rp.record_id = ir.id
      WHERE ir.task_id = ?
    `).all(id);

    db.prepare('DELETE FROM inspection_records WHERE task_id = ?').run(id);
    db.prepare('DELETE FROM inspection_tasks WHERE id = ?').run(id);

    for (const photo of photos) {
      try {
        const fullPath = path.join(config.uploadDir, photo.file_path);
        if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
      } catch (err) { /* ignore */ }
    }
  }),

  deleteAllTasks: db.transaction(() => {
    const photos = db.prepare(`
      SELECT rp.file_path FROM record_photos rp
      JOIN inspection_records ir ON rp.record_id = ir.id
    `).all();

    db.prepare('DELETE FROM inspection_records').run();
    db.prepare('DELETE FROM inspection_tasks').run();

    for (const photo of photos) {
      try {
        const fullPath = path.join(config.uploadDir, photo.file_path);
        if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
      } catch (err) { /* ignore */ }
    }

    return photos.length;
  }),

  getDailyStats(days = 7) {
    return db.prepare(`
      SELECT date(due_time) as date,
             COUNT(*) as total,
             SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
             SUM(CASE WHEN status = 'overdue' OR (status = 'pending' AND window_end < datetime('now','localtime')) THEN 1 ELSE 0 END) as overdue
      FROM inspection_tasks
      WHERE date(due_time) >= date('now', 'localtime', ?)
      GROUP BY date(due_time)
      ORDER BY date(due_time)
    `).all(`-${days} days`);
  },
};

module.exports = Task;
