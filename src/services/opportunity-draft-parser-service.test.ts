import test from 'node:test';
import assert from 'node:assert/strict';

import { parseOpportunityDraftInput } from './opportunity-draft-parser-service.js';

test('parseOpportunityDraftInput falls back to heuristic parser when no Gemini key is configured', async () => {
  const result = await parseOpportunityDraftInput(
    [
      'customer: ACME Power',
      'contact: Narin',
      'product: TRAX280',
      'qty: 2',
      'value: 25',
      'stage: quoted',
      'expected close: 2026-06-15'
    ].join('\n'),
    {
      geminiApiKey: null,
      geminiModel: 'gemini-2.5-flash'
    }
  );

  assert.equal(result.parserVersion, 'heuristic_v1');
  assert.equal(result.multipleOpportunitiesDetected, false);
  assert.equal(result.patch.customer, 'ACME Power');
  assert.equal(result.patch.expectedCloseDate, '2026-06-15');
});
