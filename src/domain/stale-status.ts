import type { StaleStatus } from '../db/schema.js';

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const DATE_KEY_FORMATTER_CACHE = new Map<string, Intl.DateTimeFormat>();

export function deriveStaleStatus(params: {
  asOf: Date;
  nextFollowUpDate: string | null;
  lastActivityAt: Date;
}): StaleStatus {
  const asOfDate = startOfUtcDay(params.asOf);
  const dueDate = deriveDueDate(params);
  const diffDays = differenceInCalendarDays(dueDate, asOfDate);

  if (diffDays >= 3) {
    return 'fresh';
  }

  if (diffDays >= 0) {
    return 'due_soon';
  }

  if (diffDays >= -6) {
    return 'overdue';
  }

  return 'stale';
}

export function deriveDueDate(params: {
  nextFollowUpDate: string | null;
  lastActivityAt: Date;
}): Date {
  return params.nextFollowUpDate
    ? parseDateOnly(params.nextFollowUpDate)
    : addDays(startOfUtcDay(params.lastActivityAt), 7);
}

export function deriveOverdueDays(params: {
  asOf: Date;
  nextFollowUpDate: string | null;
  lastActivityAt: Date;
}): number {
  const asOfDate = startOfUtcDay(params.asOf);
  const dueDate = deriveDueDate(params);
  const overdueDays = differenceInCalendarDays(asOfDate, dueDate);

  return overdueDays > 0 ? overdueDays : 0;
}

export function formatDateKeyInTimeZone(value: Date, timeZone: string): string {
  let formatter = DATE_KEY_FORMATTER_CACHE.get(timeZone);

  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    DATE_KEY_FORMATTER_CACHE.set(timeZone, formatter);
  }

  return formatter.format(value);
}

export function parseDateOnly(value: string): Date {
  const parsed = new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid ISO date value: ${value}`);
  }

  return parsed;
}

function startOfUtcDay(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function differenceInCalendarDays(target: Date, source: Date): number {
  return Math.floor((target.getTime() - source.getTime()) / DAY_IN_MS);
}

function addDays(value: Date, days: number): Date {
  return new Date(value.getTime() + days * DAY_IN_MS);
}
