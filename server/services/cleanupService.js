const fs = require('fs');
const path = require('path');
const db = require('../models/db');
const config = require('../config');

/**
 * Delete completed tasks older than `days` days,
 * along with their inspection_records, record_items, record_photos,
 * and actual photo files from disk.
 */
function cleanupOldTasks(days) {
  days = days || 3;
  const cutoff = `-${days} days`;

  // Find photo file paths to delete from disk
  const photos = db.prepare(`
    SELECT rp.file_path
    FROM record_photos rp
    JOIN inspection_records ir ON rp.record_id = ir.id
    JOIN inspection_tasks it ON ir.task_id = it.id
    WHERE it.status = 'completed'
      AND it.completed_at <= datetime('now', 'localtime', ?)
  `).all(cutoff);

  // Delete from DB in a transaction (CASCADE handles record_items + record_photos)
  const deleteInDB = db.transaction(() => {
    // Get task IDs to delete
    const taskIds = db.prepare(`
      SELECT id FROM inspection_tasks
      WHERE status = 'completed'
        AND completed_at <= datetime('now', 'localtime', ?)
    `).all(cutoff).map(r => r.id);

    if (taskIds.length === 0) return 0;

    // Delete inspection_records (CASCADE deletes record_items + record_photos)
    const deleteRecords = db.prepare('DELETE FROM inspection_records WHERE task_id = ?');
    for (const id of taskIds) {
      deleteRecords.run(id);
    }

    // Delete the tasks themselves
    const deleteTasks = db.prepare('DELETE FROM inspection_tasks WHERE id = ?');
    for (const id of taskIds) {
      deleteTasks.run(id);
    }

    return taskIds.length;
  });

  const deletedCount = deleteInDB();

  // Remove photo files from disk
  let filesDeleted = 0;
  for (const photo of photos) {
    try {
      const fullPath = path.join(config.uploadDir, photo.file_path);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
        filesDeleted++;
      }
    } catch (err) {
      console.error(`[Cleanup] Failed to delete file ${photo.file_path}:`, err.message);
    }
  }

  return { deletedCount, filesDeleted };
}

module.exports = { cleanupOldTasks };
