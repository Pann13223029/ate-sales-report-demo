import test from 'node:test';
import assert from 'node:assert/strict';

import type { WorkbookOpportunityListItem } from '../repositories/opportunity-repository.js';
import {
  buildClosedRows,
  buildExecutiveGuideRows,
  buildManagementRows,
  buildOperationalDataRows,
  buildWorkbookFreshnessRows
} from './workbook-sync-service.js';

const sampleOpenOpportunity: WorkbookOpportunityListItem = {
  opportunityId: 'OPP-000042',
  ownerUserId: 'user-1',
  ownerName: 'Alice',
  customerRaw: 'ACME Power',
  contactPerson: 'Narin',
  contactChannel: 'narin@example.com',
  productRaw: 'TRAX280',
  productSegmentCode: 'PT',
  quantity: 2,
  valueEurK: 25,
  salesStage: 'negotiation',
  probabilityPct: 75,
  expectedCloseDate: '2026-06-01',
  expectedClosePrecision: 'month',
  nextFollowUpDate: '2026-04-20',
  staleStatus: 'stale',
  competitorRaw: 'Megger Rival',
  stageNote: 'waiting technical review',
  followUpNote: 'call next week',
  lostReason: null,
  lostReasonNote: null,
  winNote: null,
  reopenNote: null,
  registerDate: '2026-04-01',
  lastActivityAt: new Date('2026-04-08T09:00:00.000Z'),
  closedAt: null
};

test('buildOperationalDataRows includes the operational headers and blank sync control cells', () => {
  const rows = buildOperationalDataRows([sampleOpenOpportunity], {
    asOf: new Date('2026-04-16T00:00:00.000Z')
  });

  assert.equal(rows[0]?.[0], 'Opportunity ID');
  assert.equal(rows[0]?.[1], 'Sync Status');
  assert.equal(rows[0]?.at(-1), 'Override Note');
  assert.equal(rows[1]?.[0], 'OPP-000042');
  assert.equal(rows[1]?.[1], '');
  assert.equal(rows[1]?.at(-1), '');
  assert.equal(rows[1]?.[12], '2026-06-01');
  assert.equal(rows[1]?.[13], 'month');
});

test('buildManagementRows derives current note and friendly month display', () => {
  const rows = buildManagementRows([sampleOpenOpportunity], new Date('2026-04-16T00:00:00.000Z'));
  const row = rows[0];

  assert.ok(row);
  assert.equal(row[0], 'OPP-000042');
  assert.equal(row[11], 'Jun 2026');
  assert.equal(row[14], 0);
  assert.equal(row[16], 'waiting technical review');
});

test('buildClosedRows prefers closure summary and keeps closed timestamp visible', () => {
  const rows = buildClosedRows(
    [
      {
        ...sampleOpenOpportunity,
        salesStage: 'closed_lost',
        probabilityPct: 0,
        lostReason: 'competitor',
        lostReasonNote: 'Switched after price review',
        stageNote: null,
        closedAt: new Date('2026-04-16T10:15:00.000Z')
      }
    ],
    new Date('2026-04-16T00:00:00.000Z')
  );
  const row = rows[0];

  assert.ok(row);
  assert.equal(row[1], 'closed_lost');
  assert.equal(row[14], 'competitor: Switched after price review');
  assert.match(String(row[2]), /2026-04-16 10:15:00Z/);
});

test('guide and freshness rows include workbook status metadata', () => {
  const refreshedAt = new Date('2026-04-16T01:30:00.000Z');
  const guideRows = buildExecutiveGuideRows({
    refreshedAt,
    status: 'Healthy'
  });
  const freshnessRows = buildWorkbookFreshnessRows({
    refreshedAt,
    status: 'Healthy'
  });

  assert.equal(guideRows[0]?.[0], 'Executive workbook');
  assert.equal(guideRows[3]?.[1], 'Healthy');
  assert.equal(freshnessRows[0]?.[0], 'Last Refreshed At');
  assert.equal(freshnessRows[1]?.[1], 'Healthy');
});
