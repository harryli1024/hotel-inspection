const cron = require('node-cron');
const Task = require('../models/Task');
const { cleanupOldTasks } = require('./cleanupService');

function startScheduler() {
  // Run every 5 minutes — mark overdue tasks
  cron.schedule('*/5 * * * *', () => {
    try {
      const count = Task.markOverdue();
      if (count > 0) {
        console.log(`[TaskScheduler] Marked ${count} tasks as overdue`);
      }
    } catch (err) {
      console.error('[TaskScheduler] Error:', err.message);
    }
  });

  // Run daily at 3:00 AM — cleanup completed tasks older than 3 days
  cron.schedule('0 3 * * *', () => {
    try {
      const result = cleanupOldTasks(3);
      if (result.deletedCount > 0) {
        console.log(`[Cleanup] Deleted ${result.deletedCount} old tasks, ${result.filesDeleted} photo files`);
      }
    } catch (err) {
      console.error('[Cleanup] Error:', err.message);
    }
  });

  // Initial overdue check on startup
  try {
    Task.markOverdue();
    console.log('Task scheduler started (overdue check every 5min, cleanup daily at 3AM)');
  } catch (err) {
    console.error('[TaskScheduler] Initial run error:', err.message);
  }
}

module.exports = { startScheduler };
