const Schedule = require('../models/Schedule');
const Task = require('../models/Task');

function parseTimeToMinutes(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

function formatLocalDateTime(date) {
  const y = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  return `${y}-${mo}-${d} ${h}:${mi}:${s}`;
}

/**
 * Generate tasks for a date range.
 * @param {string} [startDate] - Start date string 'YYYY-MM-DD', defaults to today
 * @param {string} [endDate] - End date string 'YYYY-MM-DD', defaults to startDate + 6 days
 * @returns {number} Number of tasks created
 */
function generateTasks(startDate, endDate) {
  const schedules = Schedule.findActiveSchedules();
  const tasksToCreate = [];

  // Parse start date (default: today)
  const start = startDate ? new Date(startDate + 'T00:00:00') : new Date();
  start.setHours(0, 0, 0, 0);

  // Parse end date (default: start + 6 days = 7 days total)
  let end;
  if (endDate) {
    end = new Date(endDate + 'T00:00:00');
    end.setHours(0, 0, 0, 0);
  } else {
    end = new Date(start);
    end.setDate(end.getDate() + 6);
  }

  // Iterate each day in range
  const current = new Date(start);
  while (current <= end) {
    // JS getDay(): 0=Sunday, we need 1=Monday...7=Sunday
    let dayOfWeek = current.getDay();
    if (dayOfWeek === 0) dayOfWeek = 7;

    for (const schedule of schedules) {
      const activeDays = schedule.active_days.split(',').map(Number);
      if (!activeDays.includes(dayOfWeek)) continue;

      const startMinutes = parseTimeToMinutes(schedule.start_time);
      const endMinutes = parseTimeToMinutes(schedule.end_time);

      for (let m = startMinutes; m <= endMinutes; m += schedule.frequency_minutes) {
        const dueTime = new Date(current);
        dueTime.setHours(Math.floor(m / 60), m % 60, 0, 0);

        const windowStart = new Date(dueTime.getTime() - schedule.window_minutes * 60000);
        const windowEnd = new Date(dueTime.getTime() + schedule.window_minutes * 60000);

        const dueTimeStr = formatLocalDateTime(dueTime);

        // Skip if task already exists (dedup)
        if (Task.existsForScheduleAndTime(schedule.id, dueTimeStr)) continue;

        tasksToCreate.push({
          scheduleId: schedule.id,
          checkpointId: schedule.checkpoint_id,
          dueTime: dueTimeStr,
          windowStart: formatLocalDateTime(windowStart),
          windowEnd: formatLocalDateTime(windowEnd),
        });
      }
    }

    current.setDate(current.getDate() + 1);
  }

  if (tasksToCreate.length > 0) {
    Task.batchCreate(tasksToCreate);
  }

  return tasksToCreate.length;
}

module.exports = { generateTasks };
