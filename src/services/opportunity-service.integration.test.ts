import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';

import type { BusinessEventRow, JobRow, OpportunityCurrentRow } from '../db/schema.js';
import {
  createOpportunityFromCommand,
  updateOpportunityFromCommand
} from './opportunity-service.js';
import { OpportunityVersionConflictError } from '../use-cases/commit-business-event.js';
import { createIntegrationDatabase } from '../test/integration-database.js';

async function seedUser(
  db: Awaited<ReturnType<typeof createIntegrationDatabase>>['db'],
  values: {
    userId?: string;
    ownerName: string;
    role?: 'rep' | 'executive' | 'admin';
    email?: string;
    telegramUserId?: number;
  }
): Promise<string> {
  const userId = values.userId ?? randomUUID();

  await db
    .withSchema('core')
    .insertInto('users')
    .values({
      user_id: userId,
      owner_name: values.ownerName,
      role: values.role ?? 'rep',
      email: values.email ?? `${values.ownerName.toLowerCase().replace(/\s+/g, '.')}@example.com`,
      telegram_user_id: values.telegramUserId ?? null,
      active: true
    })
    .executeTakeFirstOrThrow();

  return userId;
}

async function seedCatalogProduct(
  db: Awaited<ReturnType<typeof createIntegrationDatabase>>['db'],
  values: {
    canonicalName: string;
    productNormalized: string;
    segmentCode: 'CI' | 'GET' | 'LVI' | 'MRM' | 'PDIX' | 'PP' | 'PT';
  }
): Promise<void> {
  await db
    .withSchema('core')
    .insertInto('product_catalog')
    .values({
      product_id: randomUUID(),
      canonical_name: values.canonicalName,
      product_normalized: values.productNormalized,
      segment_code: values.segmentCode,
      active: true
    })
    .executeTakeFirstOrThrow();
}

async function loadProjection(
  db: Awaited<ReturnType<typeof createIntegrationDatabase>>['db'],
  opportunityId: string
): Promise<OpportunityCurrentRow> {
  const row = await db
    .withSchema('projections')
    .selectFrom('opportunities_current')
    .selectAll()
    .where('opportunity_id', '=', opportunityId)
    .executeTakeFirst();

  assert.ok(row, `Expected projection row for ${opportunityId}`);
  return row;
}

async function loadEvents(
  db: Awaited<ReturnType<typeof createIntegrationDatabase>>['db'],
  opportunityId: string
): Promise<BusinessEventRow[]> {
  return db
    .withSchema('events')
    .selectFrom('business_events')
    .selectAll()
    .where('opportunity_id', '=', opportunityId)
    .orderBy('result_version', 'asc')
    .execute();
}

async function loadJobs(
  db: Awaited<ReturnType<typeof createIntegrationDatabase>>['db'],
  opportunityId: string
): Promise<JobRow[]> {
  const rows = await db
    .withSchema('ops')
    .selectFrom('jobs')
    .selectAll()
    .orderBy('created_at', 'asc')
    .execute();

  return rows.filter((row) => {
    const payload = row.payload as { opportunity_id?: string } | null;
    return payload?.opportunity_id === opportunityId;
  });
}

test('createOpportunityFromCommand persists event, projection, and downstream jobs', async () => {
  const integrationDb = await createIntegrationDatabase();

  try {
    const actorUserId = await seedUser(integrationDb.db, {
      ownerName: 'Alice Rep',
      telegramUserId: 12345
    });

    await seedCatalogProduct(integrationDb.db, {
      canonicalName: 'TRAX280',
      productNormalized: 'trax280',
      segmentCode: 'PT'
    });

    const created = await createOpportunityFromCommand(integrationDb.db, {
      actorUserId,
      customer: 'ACME Power',
      contactPerson: 'Narin',
      contactChannel: 'narin@example.com',
      product: 'TRAX280',
      quantity: 2,
      valueEurK: 25,
      salesStage: 'quoted',
      expectedCloseDate: '2026-06-15',
      expectedClosePrecision: 'day',
      source: 'telegram',
      occurredAt: new Date('2026-04-21T09:00:00.000Z')
    });

    assert.equal(created.opportunityId, 'OPP-000001');
    assert.equal(created.version, 1);

    const projection = await loadProjection(integrationDb.db, created.opportunityId);
    const events = await loadEvents(integrationDb.db, created.opportunityId);
    const jobs = await loadJobs(integrationDb.db, created.opportunityId);

    assert.equal(projection.current_version, 1);
    assert.equal(projection.owner_user_id, actorUserId);
    assert.equal(projection.product_segment_code, 'PT');
    assert.equal(projection.segment_source, 'catalog');
    assert.equal(projection.sales_stage, 'quoted');
    assert.equal(Number(projection.value_eur_k), 25);
    assert.equal(projection.stale_status, 'fresh');
    assert.equal(events.length, 1);
    assert.equal(events[0]?.event_type, 'opportunity_created');
    assert.deepEqual(
      jobs.map((job) => job.job_type).sort(),
      ['refresh_executive_workbook', 'sync_operational_sheet']
    );
  } finally {
    await integrationDb.destroy();
  }
});

test('updateOpportunityFromCommand closes an opportunity and increments versioned state', async () => {
  const integrationDb = await createIntegrationDatabase();

  try {
    const actorUserId = await seedUser(integrationDb.db, {
      ownerName: 'Alice Rep',
      telegramUserId: 12345
    });

    await seedCatalogProduct(integrationDb.db, {
      canonicalName: 'TRAX280',
      productNormalized: 'trax280',
      segmentCode: 'PT'
    });

    const created = await createOpportunityFromCommand(integrationDb.db, {
      actorUserId,
      customer: 'ACME Power',
      contactPerson: 'Narin',
      contactChannel: 'narin@example.com',
      product: 'TRAX280',
      quantity: 2,
      valueEurK: 25,
      salesStage: 'quoted',
      expectedCloseDate: '2026-06-15',
      expectedClosePrecision: 'day',
      source: 'telegram',
      occurredAt: new Date('2026-04-21T09:00:00.000Z')
    });

    const updated = await updateOpportunityFromCommand(integrationDb.db, {
      opportunityId: created.opportunityId,
      baseVersion: 1,
      actorUserId,
      source: 'telegram',
      changes: {
        salesStage: 'closed_lost',
        lostReason: 'competitor',
        lostReasonNote: 'Switched after final price review'
      },
      occurredAt: new Date('2026-04-22T10:00:00.000Z')
    });

    const projection = await loadProjection(integrationDb.db, created.opportunityId);
    const events = await loadEvents(integrationDb.db, created.opportunityId);
    const jobs = await loadJobs(integrationDb.db, created.opportunityId);

    assert.equal(updated.version, 2);
    assert.equal(updated.eventType, 'opportunity_closed_lost');
    assert.equal(projection.current_version, 2);
    assert.equal(projection.sales_stage, 'closed_lost');
    assert.equal(projection.lost_reason, 'competitor');
    assert.equal(new Date(projection.closed_at as Date | string).toISOString(), '2026-04-22T10:00:00.000Z');
    assert.equal(projection.stale_status, 'fresh');
    assert.equal(events.length, 2);
    assert.equal(events[1]?.event_type, 'opportunity_closed_lost');
    assert.equal(jobs.length, 4);
  } finally {
    await integrationDb.destroy();
  }
});

test('updateOpportunityFromCommand writes manager_sheet_correction for sheet-originated edits', async () => {
  const integrationDb = await createIntegrationDatabase();

  try {
    const repUserId = await seedUser(integrationDb.db, {
      ownerName: 'Alice Rep',
      telegramUserId: 12345
    });
    const managerUserId = await seedUser(integrationDb.db, {
      ownerName: 'Boss',
      role: 'admin',
      email: 'boss@example.com'
    });

    await seedCatalogProduct(integrationDb.db, {
      canonicalName: 'TRAX280',
      productNormalized: 'trax280',
      segmentCode: 'PT'
    });

    const created = await createOpportunityFromCommand(integrationDb.db, {
      actorUserId: repUserId,
      customer: 'ACME Power',
      contactPerson: 'Narin',
      contactChannel: 'narin@example.com',
      product: 'TRAX280',
      quantity: 2,
      valueEurK: 25,
      salesStage: 'quoted',
      expectedCloseDate: '2026-06-15',
      expectedClosePrecision: 'day',
      source: 'telegram',
      occurredAt: new Date('2026-04-21T09:00:00.000Z')
    });

    const updated = await updateOpportunityFromCommand(integrationDb.db, {
      opportunityId: created.opportunityId,
      baseVersion: 1,
      actorUserId: managerUserId,
      source: 'sheet',
      changes: {
        valueEurK: 40,
        followUpNote: 'Manager corrected forecast after review'
      },
      changeExplanation: 'Updated manager forecast'
    });

    const projection = await loadProjection(integrationDb.db, created.opportunityId);
    const events = await loadEvents(integrationDb.db, created.opportunityId);

    assert.equal(updated.eventType, 'manager_sheet_correction');
    assert.equal(Number(projection.value_eur_k), 40);
    assert.equal(projection.follow_up_note, 'Manager corrected forecast after review');
    assert.equal(projection.updated_by_user_id, managerUserId);
    assert.equal(events[1]?.event_type, 'manager_sheet_correction');
  } finally {
    await integrationDb.destroy();
  }
});

test('updateOpportunityFromCommand rejects stale base versions without mutating state', async () => {
  const integrationDb = await createIntegrationDatabase();

  try {
    const actorUserId = await seedUser(integrationDb.db, {
      ownerName: 'Alice Rep',
      telegramUserId: 12345
    });

    await seedCatalogProduct(integrationDb.db, {
      canonicalName: 'TRAX280',
      productNormalized: 'trax280',
      segmentCode: 'PT'
    });

    const created = await createOpportunityFromCommand(integrationDb.db, {
      actorUserId,
      customer: 'ACME Power',
      contactPerson: 'Narin',
      contactChannel: 'narin@example.com',
      product: 'TRAX280',
      quantity: 2,
      valueEurK: 25,
      salesStage: 'quoted',
      expectedCloseDate: '2026-06-15',
      expectedClosePrecision: 'day',
      source: 'telegram',
      occurredAt: new Date('2026-04-21T09:00:00.000Z')
    });

    await updateOpportunityFromCommand(integrationDb.db, {
      opportunityId: created.opportunityId,
      baseVersion: 1,
      actorUserId,
      source: 'telegram',
      changes: {
        followUpNote: 'First valid update'
      }
    });

    await assert.rejects(
      () =>
        updateOpportunityFromCommand(integrationDb.db, {
          opportunityId: created.opportunityId,
          baseVersion: 1,
          actorUserId,
          source: 'telegram',
          changes: {
            followUpNote: 'Stale update should not land'
          }
        }),
      OpportunityVersionConflictError
    );

    const projection = await loadProjection(integrationDb.db, created.opportunityId);
    const events = await loadEvents(integrationDb.db, created.opportunityId);

    assert.equal(projection.current_version, 2);
    assert.equal(projection.follow_up_note, 'First valid update');
    assert.equal(events.length, 2);
  } finally {
    await integrationDb.destroy();
  }
});
