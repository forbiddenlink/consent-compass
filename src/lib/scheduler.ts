import cron, { type ScheduledTask as CronScheduledTask } from 'node-cron';

export type ScheduledTask = {
  name: string;
  schedule: string;
  task: CronScheduledTask;
  lastRun?: Date;
  nextRun?: Date;
};

const scheduledTasks = new Map<string, ScheduledTask>();

export type SchedulerTaskOptions = {
  name: string;
  schedule: string; // cron expression
  handler: () => void | Promise<void>;
  runOnInit?: boolean;
  timezone?: string;
};

/**
 * Schedule a recurring task using cron syntax.
 *
 * Common patterns:
 * - "0 * * * *"     - Every hour
 * - "0 0 * * *"     - Daily at midnight
 * - "0 0 * * 0"     - Weekly on Sunday
 * - "0 0 1 * *"     - Monthly on the 1st
 * - "star/5 * * * *" - Every 5 minutes (replace star with asterisk)
 */
export function scheduleTask(options: SchedulerTaskOptions): ScheduledTask {
  const { name, schedule, handler, runOnInit = false, timezone } = options;

  // Validate cron expression
  if (!cron.validate(schedule)) {
    throw new Error(`Invalid cron expression: ${schedule}`);
  }

  // Stop existing task if it exists
  if (scheduledTasks.has(name)) {
    stopTask(name);
  }

  const wrappedHandler = async (): Promise<void> => {
    const taskInfo = scheduledTasks.get(name);
    if (taskInfo) {
      taskInfo.lastRun = new Date();
    }

    try {
      await handler();
    } catch (error) {
      console.error(`Scheduled task "${name}" failed:`, error);
    }
  };

  const task = cron.schedule(schedule, wrappedHandler, {
    timezone,
    runOnInit,
  } as Parameters<typeof cron.schedule>[2]);

  const scheduledTask: ScheduledTask = {
    name,
    schedule,
    task,
  };

  scheduledTasks.set(name, scheduledTask);

  return scheduledTask;
}

/**
 * Stop a scheduled task by name.
 */
export function stopTask(name: string): boolean {
  const taskInfo = scheduledTasks.get(name);
  if (!taskInfo) {
    return false;
  }

  taskInfo.task.stop();
  scheduledTasks.delete(name);
  return true;
}

/**
 * Stop all scheduled tasks.
 */
export function stopAllTasks(): void {
  for (const [name, taskInfo] of scheduledTasks) {
    taskInfo.task.stop();
    scheduledTasks.delete(name);
  }
}

/**
 * Get all active scheduled tasks.
 */
export function getActiveTasks(): ScheduledTask[] {
  return Array.from(scheduledTasks.values());
}

/**
 * Check if a task is scheduled.
 */
export function isTaskScheduled(name: string): boolean {
  return scheduledTasks.has(name);
}

// Pre-configured task schedules for consent scanning
export const SCAN_SCHEDULES = {
  // Rescan monitored URLs every 6 hours
  RESCAN_MONITORED: '0 */6 * * *',
  // Daily compliance report at 9 AM
  DAILY_REPORT: '0 9 * * *',
  // Weekly summary every Monday at 9 AM
  WEEKLY_SUMMARY: '0 9 * * 1',
  // Cleanup old scans monthly on the 1st at 3 AM
  MONTHLY_CLEANUP: '0 3 1 * *',
} as const;

export type ScanScheduleType = keyof typeof SCAN_SCHEDULES;

/**
 * Schedule a rescan job for monitored URLs.
 */
export function scheduleRescanJob(
  handler: () => void | Promise<void>,
  scheduleType: ScanScheduleType = 'RESCAN_MONITORED'
): ScheduledTask {
  return scheduleTask({
    name: `rescan-${scheduleType.toLowerCase()}`,
    schedule: SCAN_SCHEDULES[scheduleType],
    handler,
  });
}
