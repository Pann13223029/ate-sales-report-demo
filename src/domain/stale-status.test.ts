import test from 'node:test';
import assert from 'node:assert/strict';

import {
  deriveDueDate,
  deriveOverdueDays,
  deriveStaleStatus,
  formatDateKeyInTimeZone
} from './stale-status.js';

test('deriveDueDate prefers next follow-up date when present', () => {
  const dueDate = deriveDueDate({
    nextFollowUpDate: '2026-04-20',
    lastActivityAt: new Date('2026-04-01T09:00:00.000Z')
  });

  assert.equal(dueDate.toISOString(), '2026-04-20T00:00:00.000Z');
});

test('deriveDueDate falls back to 7 days after last activity', () => {
  const dueDate = deriveDueDate({
    nextFollowUpDate: null,
    lastActivityAt: new Date('2026-04-01T09:00:00.000Z')
  });

  assert.equal(dueDate.toISOString(), '2026-04-08T00:00:00.000Z');
});

test('deriveOverdueDays returns zero before due date and positive days after', () => {
  assert.equal(
    deriveOverdueDays({
      asOf: new Date('2026-04-07T10:00:00.000Z'),
      nextFollowUpDate: '2026-04-10',
      lastActivityAt: new Date('2026-04-01T09:00:00.000Z')
    }),
    0
  );

  assert.equal(
    deriveOverdueDays({
      asOf: new Date('2026-04-18T10:00:00.000Z'),
      nextFollowUpDate: '2026-04-10',
      lastActivityAt: new Date('2026-04-01T09:00:00.000Z')
    }),
    8
  );
});

test('deriveStaleStatus still classifies stale after 7 overdue days', () => {
  const status = deriveStaleStatus({
    asOf: new Date('2026-04-18T10:00:00.000Z'),
    nextFollowUpDate: '2026-04-10',
    lastActivityAt: new Date('2026-04-01T09:00:00.000Z')
  });

  assert.equal(status, 'stale');
});

test('formatDateKeyInTimeZone respects Bangkok calendar date', () => {
  const key = formatDateKeyInTimeZone(new Date('2026-04-15T18:30:00.000Z'), 'Asia/Bangkok');

  assert.equal(key, '2026-04-16');
});
