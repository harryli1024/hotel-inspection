const fs = require('fs');
const path = require('path');
const db = require('./db');
const config = require('../config');

const Checkpoint = {
  findByAreaId(areaId) {
    return db.prepare(
      'SELECT * FROM checkpoints WHERE area_id = ? ORDER BY sort_order'
    ).all(areaId);
  },

  findById(id) {
    return db.prepare(`
      SELECT c.*, a.name as area_name, a.floor, a.building
      FROM checkpoints c
      JOIN areas a ON c.area_id = a.id
      WHERE c.id = ?
    `).get(id);
  },

  findAllActive() {
    return db.prepare(`
      SELECT c.id, c.name, c.area_id, a.name as area_name, a.floor, a.building
      FROM checkpoints c
      JOIN areas a ON c.area_id = a.id
      WHERE c.status = 1 AND a.status = 1
      ORDER BY a.building, a.floor, a.name, c.sort_order
    `).all();
  },

  create({ areaId, name, description, sortOrder }) {
    const maxOrder = db.prepare(
      'SELECT MAX(sort_order) as max_order FROM checkpoints WHERE area_id = ?'
    ).get(areaId);

    const result = db.prepare(
      'INSERT INTO checkpoints (area_id, name, description, sort_order) VALUES (?, ?, ?, ?)'
    ).run(areaId, name, description || null, sortOrder !== undefined ? sortOrder : (maxOrder.max_order || 0) + 1);
    return result.lastInsertRowid;
  },

  update(id, { name, description }) {
    db.prepare(
      'UPDATE checkpoints SET name = ?, description = ? WHERE id = ?'
    ).run(name, description || null, id);
  },

  toggleStatus(id, status) {
    db.prepare('UPDATE checkpoints SET status = ? WHERE id = ?').run(status, id);
  },

  reorder(areaId, orderedIds) {
    const stmt = db.prepare('UPDATE checkpoints SET sort_order = ? WHERE id = ? AND area_id = ?');
    const updateAll = db.transaction((ids) => {
      ids.forEach((id, index) => {
        stmt.run(index, id, areaId);
      });
    });
    updateAll(orderedIds);
  },

  deleteWithCascade: db.transaction((id) => {
    // Get photo file paths before deletion
    const photos = db.prepare(`
      SELECT rp.file_path FROM record_photos rp
      JOIN inspection_records ir ON rp.record_id = ir.id
      WHERE ir.checkpoint_id = ?
    `).all(id);

    // Delete records (CASCADE deletes record_items + record_photos)
    db.prepare('DELETE FROM inspection_records WHERE checkpoint_id = ?').run(id);

    // Delete tasks
    db.prepare('DELETE FROM inspection_tasks WHERE checkpoint_id = ?').run(id);

    // Delete schedules
    db.prepare('DELETE FROM task_schedules WHERE checkpoint_id = ?').run(id);

    // Delete checkpoint
    db.prepare('DELETE FROM checkpoints WHERE id = ?').run(id);

    // Delete photo files
    for (const photo of photos) {
      try {
        const fullPath = path.join(config.uploadDir, photo.file_path);
        if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
      } catch (err) { /* ignore */ }
    }
  }),
};

module.exports = Checkpoint;
