import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildDailyStaleReminderMessage,
  dailyStaleReminderJobPayloadSchema,
  renderDailyStaleReminderText
} from './daily-reminder-service.js';

test('renderDailyStaleReminderText includes stale opportunities in priority order', () => {
  const payload = dailyStaleReminderJobPayloadSchema.parse({
    chat_id: '12345',
    owner_name: 'Alice',
    reminder_date_key: '2026-04-16',
    time_zone: 'Asia/Bangkok',
    opportunities: [
      {
        opportunity_id: 'OPP-000111',
        customer_raw: 'ACME',
        product_raw: 'MTO330',
        sales_stage: 'waiting_po',
        days_stale: 12
      },
      {
        opportunity_id: 'OPP-000222',
        customer_raw: 'Beta Grid',
        product_raw: 'TRAX280',
        sales_stage: 'quoted',
        days_stale: 7
      }
    ]
  });

  const text = renderDailyStaleReminderText(payload);

  assert.match(text, /Daily stale reminder for Alice/);
  assert.match(text, /OPP-000111 \| ACME \| MTO330 \| waiting_po \| 12 days stale/);
  assert.match(text, /OPP-000222 \| Beta Grid \| TRAX280 \| quoted \| 7 days stale/);
});

test('buildDailyStaleReminderMessage adds reminder action buttons for each opportunity', () => {
  const payload = dailyStaleReminderJobPayloadSchema.parse({
    chat_id: '12345',
    owner_name: 'Alice',
    reminder_date_key: '2026-04-16',
    time_zone: 'Asia/Bangkok',
    opportunities: [
      {
        opportunity_id: 'OPP-000111',
        customer_raw: 'ACME',
        product_raw: 'MTO330',
        sales_stage: 'waiting_po',
        days_stale: 12
      }
    ]
  });

  const message = buildDailyStaleReminderMessage(payload);

  assert.equal(message.chat_id, '12345');
  assert.equal(message.reply_markup.inline_keyboard.length, 1);
  assert.deepEqual(message.reply_markup.inline_keyboard[0], [
    {
      text: 'Update OPP-000111',
      callback_data: 'update:start:OPP-000111'
    },
    {
      text: 'Set Follow-up',
      callback_data: 'followup:start:OPP-000111'
    },
    {
      text: 'Close Lost',
      callback_data: 'closelost:start:OPP-000111'
    }
  ]);
});
