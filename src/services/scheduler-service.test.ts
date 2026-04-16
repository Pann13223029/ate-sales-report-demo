import test from 'node:test';
import assert from 'node:assert/strict';

import { isDailyReminderScheduleDue } from './scheduler-service.js';

test('isDailyReminderScheduleDue is false before 08:30 Bangkok', () => {
  const due = isDailyReminderScheduleDue({
    now: new Date('2026-04-16T01:29:00.000Z'),
    timeZone: 'Asia/Bangkok',
    dailyHour: 8,
    dailyMinute: 30
  });

  assert.equal(due, false);
});

test('isDailyReminderScheduleDue becomes true at 08:30 Bangkok', () => {
  const due = isDailyReminderScheduleDue({
    now: new Date('2026-04-16T01:30:00.000Z'),
    timeZone: 'Asia/Bangkok',
    dailyHour: 8,
    dailyMinute: 30
  });

  assert.equal(due, true);
});
