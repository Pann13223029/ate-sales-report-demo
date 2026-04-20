import test from 'node:test';
import assert from 'node:assert/strict';

import { buildWebhookUrl } from './telegram-webhook.js';

test('buildWebhookUrl appends telegram webhook path to bare origin', () => {
  assert.equal(
    buildWebhookUrl('https://example.com'),
    'https://example.com/api/telegram/webhook'
  );
});

test('buildWebhookUrl appends telegram webhook path to existing base path', () => {
  assert.equal(
    buildWebhookUrl('https://example.com/app'),
    'https://example.com/app/api/telegram/webhook'
  );
});

test('buildWebhookUrl keeps explicit hosted webhook path intact', () => {
  assert.equal(
    buildWebhookUrl('https://example.com/app/api/telegram/webhook'),
    'https://example.com/app/api/telegram/webhook'
  );
});

test('buildWebhookUrl keeps explicit local webhook path intact', () => {
  assert.equal(
    buildWebhookUrl('https://example.com/app/telegram/webhook'),
    'https://example.com/app/telegram/webhook'
  );
});
