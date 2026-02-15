const db = require('./db');

const Inspection = {
  findRecentForCheckpoint(checkpointId, cooldownMinutes) {
    cooldownMinutes = cooldownMinutes || 15;
    return db.prepare(`
      SELECT ir.id, ir.submitted_at, ir.inspector_id,
             u.real_name as inspector_name
      FROM inspection_records ir
      LEFT JOIN users u ON ir.inspector_id = u.id
      WHERE ir.checkpoint_id = ?
        AND ir.submitted_at >= datetime('now', 'localtime', ?)
      ORDER BY ir.submitted_at DESC LIMIT 1
    `).get(checkpointId, `-${cooldownMinutes} minutes`);
  },

  create: db.transaction(({ record, items, photos, taskId, complianceStatus }) => {
    const task = db.prepare(
      "SELECT * FROM inspection_tasks WHERE id = ? AND status = 'pending'"
    ).get(taskId);
    if (!task) throw new Error('任务已完成或已超时，无法提交');

    const recordResult = db.prepare(`
      INSERT INTO inspection_records
        (task_id, inspector_id, checkpoint_id, compliance_status, gps_lat, gps_lng, gps_accuracy, device_info)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      taskId, record.inspectorId, record.checkpointId,
      complianceStatus || 'on_time',
      record.gpsLat || null, record.gpsLng || null, record.gpsAccuracy || null,
      record.deviceInfo || null
    );

    const recordId = recordResult.lastInsertRowid;

    const insertItem = db.prepare(`
      INSERT INTO record_items (record_id, item_key, item_name, input_type, value)
      VALUES (?, ?, ?, ?, ?)
    `);
    for (const item of items) {
      insertItem.run(recordId, item.itemKey, item.itemName, item.inputType, item.value || null);
    }

    const insertPhoto = db.prepare(`
      INSERT INTO record_photos (record_id, file_path, original_name, file_size, watermark_info, taken_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    for (const photo of photos) {
      insertPhoto.run(
        recordId, photo.filePath, photo.originalName || null, photo.fileSize || null,
        photo.watermarkInfo ? JSON.stringify(photo.watermarkInfo) : null,
        photo.takenAt
      );
    }

    db.prepare(
      "UPDATE inspection_tasks SET status = 'completed', completed_at = datetime('now', 'localtime') WHERE id = ?"
    ).run(taskId);

    return recordId;
  }),

  findAll({ page = 1, limit = 20, startDate, endDate, inspectorId, checkpointId, areaId, complianceStatus, reviewStatus } = {}) {
    let where = 'WHERE 1=1';
    const params = [];

    if (startDate) { where += ' AND date(ir.submitted_at) >= ?'; params.push(startDate); }
    if (endDate) { where += ' AND date(ir.submitted_at) <= ?'; params.push(endDate); }
    if (inspectorId) { where += ' AND ir.inspector_id = ?'; params.push(inspectorId); }
    if (checkpointId) { where += ' AND ir.checkpoint_id = ?'; params.push(checkpointId); }
    if (areaId) { where += ' AND c.area_id = ?'; params.push(areaId); }
    if (complianceStatus) { where += ' AND ir.compliance_status = ?'; params.push(complianceStatus); }
    if (reviewStatus) { where += ' AND ir.review_status = ?'; params.push(reviewStatus); }

    const total = db.prepare(`
      SELECT COUNT(*) as count
      FROM inspection_records ir
      LEFT JOIN checkpoints c ON ir.checkpoint_id = c.id
      ${where}
    `).get(...params).count;

    const offset = (page - 1) * limit;
    const rows = db.prepare(`
      SELECT ir.*,
             u.real_name as inspector_name,
             c.name as checkpoint_name,
             a.name as area_name, a.floor, a.building,
             (SELECT COUNT(*) FROM record_photos WHERE record_id = ir.id) as photo_count,
             rv.real_name as reviewer_name
      FROM inspection_records ir
      LEFT JOIN users u ON ir.inspector_id = u.id
      LEFT JOIN checkpoints c ON ir.checkpoint_id = c.id
      LEFT JOIN areas a ON c.area_id = a.id
      LEFT JOIN users rv ON ir.reviewer_id = rv.id
      ${where}
      ORDER BY ir.submitted_at DESC LIMIT ? OFFSET ?
    `).all(...params, limit, offset);

    return { rows, total, page, limit };
  },

  findById(id) {
    const record = db.prepare(`
      SELECT ir.*,
             u.real_name as inspector_name,
             c.name as checkpoint_name,
             a.name as area_name, a.floor, a.building,
             it.window_start as task_window_start,
             it.window_end as task_window_end,
             it.due_time as task_due_time,
             rv.real_name as reviewer_name
      FROM inspection_records ir
      LEFT JOIN users u ON ir.inspector_id = u.id
      LEFT JOIN checkpoints c ON ir.checkpoint_id = c.id
      LEFT JOIN areas a ON c.area_id = a.id
      LEFT JOIN inspection_tasks it ON ir.task_id = it.id
      LEFT JOIN users rv ON ir.reviewer_id = rv.id
      WHERE ir.id = ?
    `).get(id);

    if (!record) return null;

    record.items = db.prepare(
      'SELECT * FROM record_items WHERE record_id = ? ORDER BY id'
    ).all(id);

    record.photos = db.prepare(
      'SELECT * FROM record_photos WHERE record_id = ? ORDER BY id'
    ).all(id);

    return record;
  },

  review(id, { reviewStatus, reviewComment, reviewerId }) {
    const record = db.prepare('SELECT id, review_status FROM inspection_records WHERE id = ?').get(id);
    if (!record) return null;

    // Prevent double-review: only allow reviewing records that haven't been reviewed yet
    if (record.review_status && record.review_status !== 'pending') {
      return { alreadyReviewed: true, currentStatus: record.review_status };
    }

    const result = db.prepare(`
      UPDATE inspection_records
      SET review_status = ?, review_comment = ?, reviewer_id = ?, reviewed_at = datetime('now', 'localtime')
      WHERE id = ? AND (review_status IS NULL OR review_status = 'pending')
    `).run(reviewStatus, reviewComment || null, reviewerId, id);

    // If no rows changed, another admin reviewed it between our SELECT and UPDATE
    if (result.changes === 0) {
      return { alreadyReviewed: true };
    }

    return true;
  },

  getAnomalyCount({ startDate, endDate } = {}) {
    let where = 'WHERE 1=1';
    const params = [];

    if (startDate) { where += ' AND date(ir.submitted_at) >= ?'; params.push(startDate); }
    if (endDate) { where += ' AND date(ir.submitted_at) <= ?'; params.push(endDate); }

    const itemAnomaly = db.prepare(`
      SELECT COUNT(DISTINCT ir.id) as count
      FROM inspection_records ir
      JOIN record_items ri ON ri.record_id = ir.id
      ${where}
      AND (ri.value = '脏污' OR ri.value = '缺少' OR ri.value = '损坏')
    `).get(...params).count;

    const complianceAnomaly = db.prepare(`
      SELECT COUNT(*) as count
      FROM inspection_records ir
      ${where}
      AND ir.compliance_status = 'anomaly'
    `).get(...params).count;

    return { itemAnomaly, complianceAnomaly, total: itemAnomaly + complianceAnomaly };
  },

  getExportData({ startDate, endDate, inspectorId, checkpointId, areaId } = {}) {
    let where = 'WHERE 1=1';
    const params = [];

    if (startDate) { where += ' AND date(ir.submitted_at) >= ?'; params.push(startDate); }
    if (endDate) { where += ' AND date(ir.submitted_at) <= ?'; params.push(endDate); }
    if (inspectorId) { where += ' AND ir.inspector_id = ?'; params.push(inspectorId); }
    if (checkpointId) { where += ' AND ir.checkpoint_id = ?'; params.push(checkpointId); }
    if (areaId) { where += ' AND c.area_id = ?'; params.push(areaId); }

    const records = db.prepare(`
      SELECT ir.id, ir.submitted_at, ir.compliance_status, ir.gps_lat, ir.gps_lng,
             u.real_name as inspector_name,
             c.name as checkpoint_name,
             a.name as area_name, a.floor, a.building,
             (SELECT COUNT(*) FROM record_photos WHERE record_id = ir.id) as photo_count
      FROM inspection_records ir
      LEFT JOIN users u ON ir.inspector_id = u.id
      LEFT JOIN checkpoints c ON ir.checkpoint_id = c.id
      LEFT JOIN areas a ON c.area_id = a.id
      ${where}
      ORDER BY ir.submitted_at DESC
    `).all(...params);

    const getItems = db.prepare('SELECT item_name, value FROM record_items WHERE record_id = ?');
    for (const record of records) {
      record.items = getItems.all(record.id);
    }

    return records;
  },
};

module.exports = Inspection;
