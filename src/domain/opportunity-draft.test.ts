import test from 'node:test';
import assert from 'node:assert/strict';

import {
  deriveMissingRequiredDraftFields,
  parseOpportunityDraftText
} from './opportunity-draft.js';

test('parseOpportunityDraftText extracts labeled fields and month precision close date', () => {
  const result = parseOpportunityDraftText([
    'customer: ACME Power',
    'contact: Narin',
    'product: TRAX280',
    'qty: 2',
    'value: 25',
    'stage: negotiation',
    'expected close: Jun 2026',
    'stage note: waiting technical review',
    'email: narin@example.com'
  ].join('\n'));

  assert.deepEqual(result.patch, {
    customer: 'ACME Power',
    contactPerson: 'Narin',
    product: 'TRAX280',
    quantity: 2,
    valueEurK: 25,
    salesStage: 'negotiation',
    expectedCloseDate: '2026-06-01',
    expectedClosePrecision: 'month',
    stageNote: 'waiting technical review',
    contactChannel: 'narin@example.com'
  });
  assert.deepEqual(result.parseNotes, []);
});

test('parseOpportunityDraftText infers phone contact channel and scaled EUR values', () => {
  const result = parseOpportunityDraftText([
    'customer: Beta Grid',
    'contact: Somchai',
    'product: MTO330',
    'quantity: 1',
    'value eur (000): 12.5k',
    'stage: quoted',
    'expected close: 15/06/2026',
    'phone: +66 81 234 5678'
  ].join('\n'));

  assert.equal(result.patch.contactChannel, '+66 81 234 5678');
  assert.equal(result.patch.valueEurK, 12.5);
  assert.equal(result.patch.expectedCloseDate, '2026-06-15');
  assert.equal(result.patch.expectedClosePrecision, 'day');
});

test('deriveMissingRequiredDraftFields adds stage-specific and manual-segment requirements', () => {
  const missing = deriveMissingRequiredDraftFields(
    {
      customer: 'ACME',
      contactPerson: 'Narin',
      contactChannel: 'narin@example.com',
      product: 'Unknown Product',
      quantity: 1,
      valueEurK: 10,
      salesStage: 'waiting_po',
      expectedCloseDate: '2026-06-01',
      expectedClosePrecision: 'month'
    },
    {
      requiresManualSegment: true
    }
  );

  assert.deepEqual(
    missing.sort(),
    ['productSegmentCode', 'stageNote'].sort()
  );
});
