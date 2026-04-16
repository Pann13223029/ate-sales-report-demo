import { randomUUID } from 'node:crypto';

import type { Kysely } from 'kysely';

import type { Database, NewJob } from '../db/schema.js';
import { formatDateKeyInTimeZone } from '../domain/stale-status.js';
import { insertJobIfMissing } from '../repositories/job-repository.js';
import { enqueueDailyStaleReminderJobs, type EnqueueDailyStaleReminderJobsResult } from './daily-reminder-service.js';
import {
  maybeEnqueueOperationalSheetSync,
  type MaybeEnqueueOperationalSheetSyncResult
} from './operational-sheet-sync-service.js';

const DEFAULT_REMINDER_TIMEZONE = 'Asia/Bangkok';
const DEFAULT_REMINDER_HOUR = 8;
const DEFAULT_REMINDER_MINUTE = 30;
const DAILY_REMINDER_MARKER_JOB_TYPE = 'daily_reminder_schedule_marker';

export interface ReminderScheduleConfig {
  timeZone?: string;
  dailyHour?: number;
  dailyMinute?: number;
}

export interface MaybeEnqueueScheduledDailyRemindersResult {
  due: boolean;
  alreadyScheduled: boolean;
  reminderDateKey: string;
  localTime: string;
  enqueueResult?: EnqueueDailyStaleReminderJobsResult;
}

export interface MaybeEnqueueScheduledWorkResult {
  dailyReminders: MaybeEnqueueScheduledDailyRemindersResult;
  operationalSheetSync?: MaybeEnqueueOperationalSheetSyncResult | undefined;
}

export async function maybeEnqueueScheduledDailyReminders(
  db: Kysely<Database>,
  values: {
    now?: Date;
    schedule?: ReminderScheduleConfig;
  } = {}
): Promise<MaybeEnqueueScheduledDailyRemindersResult> {
  const now = values.now ?? new Date();
  const timeZone = values.schedule?.timeZone ?? DEFAULT_REMINDER_TIMEZONE;
  const dailyHour = values.schedule?.dailyHour ?? DEFAULT_REMINDER_HOUR;
  const dailyMinute = values.schedule?.dailyMinute ?? DEFAULT_REMINDER_MINUTE;
  const localClock = getLocalClock(now, timeZone);
  const reminderDateKey = formatDateKeyInTimeZone(now, timeZone);
  const localMinutes = localClock.hour * 60 + localClock.minute;
  const scheduledMinutes = dailyHour * 60 + dailyMinute;

  if (localMinutes < scheduledMinutes) {
    return {
      due: false,
      alreadyScheduled: false,
      reminderDateKey,
      localTime: `${padTwo(localClock.hour)}:${padTwo(localClock.minute)}`
    };
  }

  const markerInserted = await insertJobIfMissing(
    db,
    buildDailyReminderMarkerJob({
      reminderDateKey,
      timeZone,
      now
    })
  );

  if (!markerInserted) {
    return {
      due: true,
      alreadyScheduled: true,
      reminderDateKey,
      localTime: `${padTwo(localClock.hour)}:${padTwo(localClock.minute)}`
    };
  }

  const enqueueResult = await enqueueDailyStaleReminderJobs(db, {
    asOf: now,
    timeZone
  });

  return {
    due: true,
    alreadyScheduled: false,
    reminderDateKey,
    localTime: `${padTwo(localClock.hour)}:${padTwo(localClock.minute)}`,
    enqueueResult
  };
}

export async function maybeEnqueueScheduledWork(
  db: Kysely<Database>,
  values: {
    now?: Date;
    reminderSchedule?: ReminderScheduleConfig;
    operationalSheetSyncIntervalMinutes?: number | null | undefined;
  } = {}
): Promise<MaybeEnqueueScheduledWorkResult> {
  const dailyReminders = await maybeEnqueueScheduledDailyReminders(db, {
    ...(values.now ? { now: values.now } : {}),
    ...(values.reminderSchedule ? { schedule: values.reminderSchedule } : {})
  });

  const operationalSheetSync =
    values.operationalSheetSyncIntervalMinutes && values.operationalSheetSyncIntervalMinutes > 0
      ? await maybeEnqueueOperationalSheetSync(db, {
          ...(values.now ? { now: values.now } : {}),
          intervalMinutes: values.operationalSheetSyncIntervalMinutes
        })
      : undefined;

  if (operationalSheetSync) {
    return {
      dailyReminders,
      operationalSheetSync
    };
  }

  return {
    dailyReminders
  };
}

export function isDailyReminderScheduleDue(values: {
  now: Date;
  timeZone?: string;
  dailyHour?: number;
  dailyMinute?: number;
}): boolean {
  const timeZone = values.timeZone ?? DEFAULT_REMINDER_TIMEZONE;
  const dailyHour = values.dailyHour ?? DEFAULT_REMINDER_HOUR;
  const dailyMinute = values.dailyMinute ?? DEFAULT_REMINDER_MINUTE;
  const localClock = getLocalClock(values.now, timeZone);

  return localClock.hour * 60 + localClock.minute >= dailyHour * 60 + dailyMinute;
}

function buildDailyReminderMarkerJob(values: {
  reminderDateKey: string;
  timeZone: string;
  now: Date;
}): NewJob {
  return {
    job_id: randomUUID(),
    job_type: DAILY_REMINDER_MARKER_JOB_TYPE,
    status: 'succeeded',
    correlation_id: null,
    dedupe_key: `${DAILY_REMINDER_MARKER_JOB_TYPE}:${values.timeZone}:${values.reminderDateKey}`,
    payload: {
      reminder_date_key: values.reminderDateKey,
      time_zone: values.timeZone,
      scheduled_at: values.now.toISOString()
    },
    available_at: values.now,
    attempts: 0,
    max_attempts: 1,
    finished_at: values.now
  };
}

function getLocalClock(value: Date, timeZone: string): {
  hour: number;
  minute: number;
} {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hourCycle: 'h23',
    hour: '2-digit',
    minute: '2-digit'
  });
  const parts = formatter.formatToParts(value);
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? '0');

  return {
    hour,
    minute
  };
}

function padTwo(value: number): string {
  return value.toString().padStart(2, '0');
}
