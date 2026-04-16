import test from 'node:test';
import assert from 'node:assert/strict';

import { renderProcessWebhookReplies } from './telegram-reply-service.js';

test('renderProcessWebhookReplies returns confirm buttons for ready new-opportunity drafts', () => {
  const [message] = renderProcessWebhookReplies({
    outcome: 'draft_ready_for_confirmation',
    chatId: '12345',
    replyToMessageId: 99,
    ownerName: 'Narin',
    draftPayload: {
      actor_user_id: '11111111-1111-1111-1111-111111111111',
      draft_origin: {
        update_id: 1,
        update_kind: 'message'
      },
      parser_version: 'heuristic_v1',
      candidate: {
        customer: 'ACME Power',
        contactPerson: 'Narin',
        contactChannel: 'narin@example.com',
        product: 'TRAX280',
        quantity: 2,
        valueEurK: 25,
        salesStage: 'quoted',
        expectedCloseDate: '2026-06-15',
        expectedClosePrecision: 'day'
      },
      missing_required: [],
      parse_notes: [],
      last_input: {
        recorded_at: '2026-04-16T09:00:00.000Z',
        update_id: 1,
        update_kind: 'message',
        chat_id: '12345',
        message_id: 99,
        text: 'customer: ACME Power'
      },
      timeline: [
        {
          recorded_at: '2026-04-16T09:00:00.000Z',
          update_id: 1,
          update_kind: 'message',
          chat_id: '12345',
          message_id: 99,
          text: 'customer: ACME Power'
        }
      ]
    }
  });

  assert.ok(message);
  assert.match(message.text, /Please review the draft/);
  assert.equal(message.replyToMessageId, 99);
  assert.deepEqual(message.inlineKeyboard, [
    [
      { text: 'Confirm', callback_data: 'draft:confirm' },
      { text: 'Cancel', callback_data: 'draft:cancel' }
    ]
  ]);
});

test('renderProcessWebhookReplies returns update buttons for /mydeals', () => {
  const [message] = renderProcessWebhookReplies({
    outcome: 'my_deals_listed',
    chatId: '12345',
    replyToMessageId: null,
    openDeals: [
      {
        opportunityId: 'OPP-000123',
        customerRaw: 'ACME Power',
        productRaw: 'TRAX280',
        salesStage: 'negotiation',
        staleStatus: 'overdue',
        expectedCloseDate: '2026-06-15',
        valueEurK: 25
      }
    ]
  });

  assert.ok(message);
  assert.match(message.text, /My Open Deals/);
  assert.deepEqual(message.inlineKeyboard, [
    [
      {
        text: 'Update OPP-000123',
        callback_data: 'update:start:OPP-000123'
      },
      {
        text: 'Set Follow-up',
        callback_data: 'followup:start:OPP-000123'
      },
      {
        text: 'Close Lost',
        callback_data: 'closelost:start:OPP-000123'
      }
    ]
  ]);
});

test('renderProcessWebhookReplies returns confirm update buttons for update drafts', () => {
  const [message] = renderProcessWebhookReplies({
    outcome: 'update_draft_ready_for_confirmation',
    chatId: '12345',
    replyToMessageId: null,
    draftPayload: {
      actor_user_id: '11111111-1111-1111-1111-111111111111',
      opportunity_id: 'OPP-000123',
      base_version: 3,
      action_kind: 'generic_update',
      current_summary: {
        opportunityId: 'OPP-000123',
        customer: 'ACME Power',
        product: 'TRAX280',
        salesStage: 'quoted',
        valueEurK: 25
      },
      parser_version: 'heuristic_v1',
      changes: {
        salesStage: 'negotiation',
        stageNote: 'budget approved'
      },
      parse_notes: [],
      last_input: {
        recorded_at: '2026-04-16T09:05:00.000Z',
        update_id: 2,
        update_kind: 'message',
        chat_id: '12345',
        message_id: 100,
        text: 'stage: negotiation'
      },
      timeline: [
        {
          recorded_at: '2026-04-16T09:05:00.000Z',
          update_id: 2,
          update_kind: 'message',
          chat_id: '12345',
          message_id: 100,
          text: 'stage: negotiation'
        }
      ]
    }
  });

  assert.ok(message);
  assert.match(message.text, /Please review the update/);
  assert.deepEqual(message.inlineKeyboard, [
    [
      { text: 'Confirm Update', callback_data: 'update:confirm' },
      { text: 'Cancel', callback_data: 'draft:cancel' }
    ]
  ]);
});

test('renderProcessWebhookReplies shows follow-up guidance for follow-up action drafts', () => {
  const [message] = renderProcessWebhookReplies({
    outcome: 'update_draft_message_recorded',
    chatId: '12345',
    replyToMessageId: null,
    draftPayload: {
      actor_user_id: '11111111-1111-1111-1111-111111111111',
      opportunity_id: 'OPP-000123',
      base_version: 3,
      action_kind: 'set_follow_up',
      current_summary: {
        opportunityId: 'OPP-000123',
        customer: 'ACME Power',
        product: 'TRAX280',
        salesStage: 'quoted',
        valueEurK: 25
      },
      parser_version: 'heuristic_v1',
      changes: {},
      parse_notes: [],
      last_input: {
        recorded_at: '2026-04-16T09:05:00.000Z',
        update_id: 2,
        update_kind: 'callback_query',
        chat_id: '12345',
        message_id: 100,
        text: null
      },
      timeline: [
        {
          recorded_at: '2026-04-16T09:05:00.000Z',
          update_id: 2,
          update_kind: 'callback_query',
          chat_id: '12345',
          message_id: 100,
          text: null
        }
      ]
    }
  });

  assert.ok(message);
  assert.match(message.text, /Set follow-up in progress/);
  assert.match(message.text, /Missing required:/);
  assert.match(message.text, /Next Follow-up Date/);
  assert.deepEqual(message.inlineKeyboard, [
    [
      { text: 'Confirm Follow-up', callback_data: 'update:confirm' },
      { text: 'Cancel', callback_data: 'draft:cancel' }
    ]
  ]);
});
