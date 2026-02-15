const fs = require('fs');
const path = require('path');
const db = require('./db');
const config = require('../config');

const Area = {
  findAll({ status } = {}) {
    let sql = `
      SELECT a.*,
             (SELECT COUNT(*) FROM checkpoints WHERE area_id = a.id AND status = 1) as checkpoint_count
      FROM areas a
    `;
    const params = [];

    if (status !== undefined && status !== '') {
      sql += ' WHERE a.status = ?';
      params.push(status);
    }

    sql += ' ORDER BY a.id DESC';
    return db.prepare(sql).all(...params);
  },

  findAllActive() {
    return db.prepare(
      'SELECT id, name, floor, building FROM areas WHERE status = 1 ORDER BY building, floor, name'
    ).all();
  },

  findById(id) {
    const area = db.prepare('SELECT * FROM areas WHERE id = ?').get(id);
    if (!area) return null;

    area.checkpoints = db.prepare(
      'SELECT * FROM checkpoints WHERE area_id = ? ORDER BY sort_order'
    ).all(id);

    return area;
  },

  create({ name, floor, building, description }) {
    const result = db.prepare(
      'INSERT INTO areas (name, floor, building, description) VALUES (?, ?, ?, ?)'
    ).run(name, floor || null, building || null, description || null);
    const id = result.lastInsertRowid;
    const InspectItem = require('./InspectItem');
    InspectItem.linkDefaultsToArea(id);
    return id;
  },

  update(id, { name, floor, building, description }) {
    db.prepare(
      'UPDATE areas SET name = ?, floor = ?, building = ?, description = ? WHERE id = ?'
    ).run(name, floor || null, building || null, description || null, id);
  },

  toggleStatus(id, status) {
    db.prepare('UPDATE areas SET status = ? WHERE id = ?').run(status, id);
  },

  deleteWithCascade: db.transaction((id) => {
    // Get all checkpoint IDs for this area
    const cpIds = db.prepare('SELECT id FROM checkpoints WHERE area_id = ?').all(id).map(r => r.id);

    if (cpIds.length > 0) {
      const cpPlaceholders = cpIds.map(() => '?').join(',');

      // Get photo file paths before deletion
      const photos = db.prepare(`
        SELECT rp.file_path FROM record_photos rp
        JOIN inspection_records ir ON rp.record_id = ir.id
        WHERE ir.checkpoint_id IN (${cpPlaceholders})
      `).all(...cpIds);

      // Delete record_items and record_photos (via CASCADE from inspection_records)
      db.prepare(`DELETE FROM inspection_records WHERE checkpoint_id IN (${cpPlaceholders})`).run(...cpIds);

      // Delete tasks
      db.prepare(`DELETE FROM inspection_tasks WHERE checkpoint_id IN (${cpPlaceholders})`).run(...cpIds);

      // Delete schedules
      db.prepare(`DELETE FROM task_schedules WHERE checkpoint_id IN (${cpPlaceholders})`).run(...cpIds);

      // Delete checkpoints
      db.prepare(`DELETE FROM checkpoints WHERE area_id = ?`).run(id);

      // Delete photo files from disk (outside transaction is fine, best-effort)
      for (const photo of photos) {
        try {
          const fullPath = path.join(config.uploadDir, photo.file_path);
          if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
        } catch (err) { /* ignore */ }
      }
    }

    // Delete the area
    db.prepare('DELETE FROM areas WHERE id = ?').run(id);

    return { checkpointsDeleted: cpIds.length };
  }),
};

module.exports = Area;
