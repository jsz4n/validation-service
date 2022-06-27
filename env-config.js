export const CRON_VALIDATION_ENABLE = process.env.CRON_VALIDATION_ENABLE;
export const VALIDATION_URI = process.env.VALIDATION_URI;
export const VALIDATION_JOB_OPERATION = process.env.VALIDATION_JOB_OPERATION;
export const VALIDATION_TASK_OPERATION = process.env.VALIDATION_TASK_OPERATION;
export const CRON_PATTERN_VALIDATION_JOB = process.env.CRON_PATTERN_VALIDATION_JOB || '0 0 0 * * *'; // every day at midnight
