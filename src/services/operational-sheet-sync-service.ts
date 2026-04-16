import { randomUUID } from 'node:crypto';

import type { Kysely } from 'kysely';
import { z } from 'zod';

import { getSpreadsheetValues } from '../adapters/google/sheets-api.js';
import type { Database, JsonObject, NewJob, OpportunityCurrentRow, SalesStage, SegmentCode } from '../db/schema.js';
import { normalizeCustomerName, normalizeProductName, trimBusinessText } from '../domain/normalize.js';
import { claimQueuedJob, insertQueuedJobs, insertJobIfMissing, markJobFailed, markJobSucceeded, requeueClaimedJob } from '../repositories/job-repository.js';
import {
  getUserByOwnerName,
  listOpenOpportunityCurrentRows
} from '../repositories/opportunity-repository.js';
import {
  createOrUpdateSyncIncident,
  resolveSyncIncidentsForOpportunity
} from '../repositories/sync-incident-repository.js';
import {
  acquireWorkbookLease,
  markWorkbookState,
  releaseWorkbookLease
} from '../repositories/workbook-repository.js';
import {
  updateOpportunityFromCommand,
  type UpdateOpportunityCommand
} from './opportunity-service.js';

const SHEET_SYNC_MARKER_JOB_TYPE = 'operational_sheet_sync_marker';
const RECONCILE_OPERATIONAL_SHEET_JOB_TYPE = 'reconcile_operational_sheet';
const OPERATIONAL_WORKBOOK_KEY = 'operational_workbook';
const OPERATIONAL_DATA_TAB = 'Opportunities_Operational';
const OPERATIONAL_SHEET_JOB_LEASE_MS = 2 * 60 * 1000;
const OPERATIONAL_WORKBOOK_LOCK_LEASE_MS = 2 * 60 * 1000;
const OPERATIONAL_WORKBOOK_LOCK_RETRY_MS = 5 * 1000;

const reconcileOperationalSheetJobPayloadSchema = z.object({
  scheduled_bucket: z.string().min(1),
  scheduled_at: z.string().datetime()
});

export interface OperationalSheetSyncConfig {
  serviceAccountJson: string;
  operationalWorkbookId: string;
  sheetSyncActorUserId: string;
}

export interface MaybeEnqueueOperationalSheetSyncResult {
  due: boolean;
  alreadyScheduled: boolean;
  bucketKey: string;
  queuedJobId?: string;
}

export interface ReconcileOperationalSheetJobResult {
  skipped: boolean;
  jobId: string;
  processedRows?: number;
  updatedRows?: number;
  quarantinedRows?: number;
}

interface OperationalSheetRow {
  opportunityId: string;
  ownerName: string;
  customer: string;
  contactPerson: string;
  contactChannel: string;
  product: string;
  productSegmentCode: string;
  quantity: string;
  valueEurK: string;
  salesStage: string;
  expectedCloseDate: string;
  expectedClosePrecision: string;
  nextFollowUpDate: string;
  competitorRaw: string;
  stageNote: string;
  followUpNote: string;
  lostReason: string;
  lostReasonNote: string;
  winNote: string;
  reopenNote: string;
  overrideNote: string;
  rawValues: Record<string, string>;
}

export async function maybeEnqueueOperationalSheetSync(
  db: Kysely<Database>,
  values: {
    now?: Date;
    intervalMinutes: number;
  }
): Promise<MaybeEnqueueOperationalSheetSyncResult> {
  const now = values.now ?? new Date();
  const bucketKey = operationalSheetBucketKey(now, values.intervalMinutes);

  const markerInserted = await insertJobIfMissing(
    db,
    buildOperationalSheetMarkerJob({
      now,
      bucketKey
    })
  );

  if (!markerInserted) {
    return {
      due: true,
      alreadyScheduled: true,
      bucketKey
    };
  }

  const jobId = randomUUID();
  const correlationId = randomUUID();

  await insertQueuedJobs(db, [
    {
      job_id: jobId,
      job_type: RECONCILE_OPERATIONAL_SHEET_JOB_TYPE,
      status: 'queued',
      correlation_id: correlationId,
      dedupe_key: `${RECONCILE_OPERATIONAL_SHEET_JOB_TYPE}:${bucketKey}`,
      payload: {
        scheduled_bucket: bucketKey,
        scheduled_at: now.toISOString()
      },
      available_at: now,
      attempts: 0,
      max_attempts: 10
    }
  ]);

  return {
    due: true,
    alreadyScheduled: false,
    bucketKey,
    queuedJobId: jobId
  };
}

export async function reconcileOperationalSheetJob(
  db: Kysely<Database>,
  values: {
    jobId: string;
    config: OperationalSheetSyncConfig;
  }
): Promise<ReconcileOperationalSheetJobResult> {
  const now = new Date();
  const claimedJob = await claimQueuedJob(db, {
    jobId: values.jobId,
    now,
    leaseDurationMs: OPERATIONAL_SHEET_JOB_LEASE_MS
  });

  if (!claimedJob) {
    return {
      skipped: true,
      jobId: values.jobId
    };
  }

  reconcileOperationalSheetJobPayloadSchema.parse(claimedJob.payload);

  const lease = await acquireWorkbookLease(db, {
    workbookKey: OPERATIONAL_WORKBOOK_KEY,
    jobId: values.jobId,
    now,
    leaseDurationMs: OPERATIONAL_WORKBOOK_LOCK_LEASE_MS
  });

  if (!lease) {
    await requeueClaimedJob(db, {
      jobId: values.jobId,
      availableAt: new Date(now.getTime() + OPERATIONAL_WORKBOOK_LOCK_RETRY_MS),
      lastError: 'operational_workbook is currently locked'
    });

    return {
      skipped: true,
      jobId: values.jobId
    };
  }

  try {
    const [sheetValues, currentRows] = await Promise.all([
      getSpreadsheetValues(
        values.config.serviceAccountJson,
        values.config.operationalWorkbookId,
        `${OPERATIONAL_DATA_TAB}!A1:AZ`
      ),
      listOpenOpportunityCurrentRows(db)
    ]);

    const parsedRows = parseOperationalSheetRows(sheetValues);
    const currentByOpportunity = new Map(currentRows.map((row) => [row.opportunity_id, row]));

    let updatedRows = 0;
    let quarantinedRows = 0;

    for (const row of parsedRows) {
      const current = currentByOpportunity.get(row.opportunityId);

      if (!current) {
        quarantinedRows += 1;
        await recordSheetIncident(db, {
          opportunityId: row.opportunityId,
          issueType: 'quarantined',
          summary: `Operational sheet row references unknown or closed opportunity ${row.opportunityId}`,
          at: now,
          latestContext: {
            row: row.rawValues
          }
        });
        continue;
      }

      try {
        const command = await buildSheetUpdateCommand(db, {
          actorUserId: values.config.sheetSyncActorUserId,
          current,
          row,
          occurredAt: now
        });

        if (!command) {
          await resolveSyncIncidentsForOpportunity(db, {
            opportunityId: row.opportunityId,
            source: 'sheet',
            resolvedAt: now
          });
          continue;
        }

        await updateOpportunityFromCommand(db, command);
        await resolveSyncIncidentsForOpportunity(db, {
          opportunityId: row.opportunityId,
          source: 'sheet',
          resolvedAt: now
        });
        updatedRows += 1;
      } catch (error) {
        quarantinedRows += 1;
        const message = error instanceof Error ? error.message : String(error);

        await recordSheetIncident(db, {
          opportunityId: row.opportunityId,
          issueType: isConflictError(message) ? 'conflict' : 'quarantined',
          summary: message,
          at: now,
          latestContext: {
            row: row.rawValues
          }
        });

        await queueOperationalWorkbookRefresh(db, {
          opportunityId: row.opportunityId,
          occurredAt: now
        });
      }
    }

    await db.transaction().execute(async (trx) => {
      await markWorkbookState(trx, {
        workbookKey: OPERATIONAL_WORKBOOK_KEY,
        status: 'healthy',
        at: now,
        lastError: null
      });
      await markJobSucceeded(trx, {
        jobId: values.jobId,
        finishedAt: now
      });
    });

    return {
      skipped: false,
      jobId: values.jobId,
      processedRows: parsedRows.length,
      updatedRows,
      quarantinedRows
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const dead = claimedJob.attempts >= claimedJob.max_attempts;
    const finishedAt = new Date();

    await db.transaction().execute(async (trx) => {
      await markWorkbookState(trx, {
        workbookKey: OPERATIONAL_WORKBOOK_KEY,
        status: 'failed',
        at: finishedAt,
        lastError: errorMessage
      });
      await markJobFailed(trx, {
        jobId: values.jobId,
        errorMessage,
        dead,
        finishedAt
      });
    });

    throw error;
  } finally {
    await releaseWorkbookLease(db, lease);
  }
}

async function buildSheetUpdateCommand(
  db: Kysely<Database>,
  values: {
    actorUserId: string;
    current: OpportunityCurrentRow;
    row: OperationalSheetRow;
    occurredAt: Date;
  }
) {
  const changes: UpdateOpportunityCommand['changes'] = {};
  const currentOwnerName = values.current.owner_name;

  if (normalizeExact(values.row.ownerName) !== currentOwnerName) {
    const owner = await getUserByOwnerName(db, values.row.ownerName);

    if (!owner) {
      throw new Error(`Unknown owner in sheet: ${values.row.ownerName}`);
    }

    changes.ownerUserId = owner.user_id;
  }

  applyStringChange(changes, 'customer', values.row.customer, values.current.customer_raw);
  applyStringChange(changes, 'contactPerson', values.row.contactPerson, values.current.contact_person);
  applyStringChange(changes, 'contactChannel', values.row.contactChannel, values.current.contact_channel);

  const nextProduct = normalizeExact(values.row.product);
  const currentProduct = values.current.product_raw;

  if (nextProduct !== currentProduct) {
    changes.product = nextProduct;
  }

  const nextSegmentCode = normalizeExact(values.row.productSegmentCode);
  if (nextSegmentCode !== values.current.product_segment_code) {
    if (values.current.segment_source === 'catalog' && nextProduct === currentProduct) {
      throw new Error('Catalog-mapped product segment cannot be edited directly in sheet');
    }

    changes.productSegmentCode = parseSegmentCode(nextSegmentCode);
  }

  applyNumericChange(changes, 'quantity', values.row.quantity, values.current.quantity, true);
  applyNumericChange(changes, 'valueEurK', values.row.valueEurK, Number(values.current.value_eur_k), false);
  applyEnumStringChange(changes, 'salesStage', values.row.salesStage, values.current.sales_stage);

  const nextExpectedCloseDate = normalizeExact(values.row.expectedCloseDate);
  if (nextExpectedCloseDate !== values.current.expected_close_date) {
    if (!nextExpectedCloseDate) {
      throw new Error('Expected Close cannot be blank');
    }

    changes.expectedCloseDate = nextExpectedCloseDate;
  }

  const nextExpectedClosePrecision = normalizeExact(values.row.expectedClosePrecision) as
    | 'day'
    | 'month'
    | '';
  if (nextExpectedClosePrecision !== values.current.expected_close_precision) {
    if (!nextExpectedClosePrecision) {
      throw new Error('Expected Close Precision cannot be blank');
    }

    changes.expectedClosePrecision = parseExpectedClosePrecision(nextExpectedClosePrecision);
  }

  applyNullableDateChange(
    changes,
    'nextFollowUpDate',
    values.row.nextFollowUpDate,
    values.current.next_follow_up_date
  );
  applyNullableTextChange(changes, 'competitorRaw', values.row.competitorRaw, values.current.competitor_raw);
  applyNullableTextChange(changes, 'stageNote', values.row.stageNote, values.current.stage_note);
  applyNullableTextChange(changes, 'followUpNote', values.row.followUpNote, values.current.follow_up_note);
  applyNullableTextChange(changes, 'lostReason', values.row.lostReason, values.current.lost_reason);
  applyNullableTextChange(changes, 'lostReasonNote', values.row.lostReasonNote, values.current.lost_reason_note);
  applyNullableTextChange(changes, 'winNote', values.row.winNote, values.current.win_note);
  applyNullableTextChange(changes, 'reopenNote', values.row.reopenNote, values.current.reopen_note);

  if (Object.keys(changes).length === 0) {
    return null;
  }

  const overrideNote = normalizeOptionalText(values.row.overrideNote);
  const command: UpdateOpportunityCommand = {
    opportunityId: values.current.opportunity_id,
    baseVersion: values.current.current_version,
    actorUserId: values.actorUserId,
    source: 'sheet' as const,
    occurredAt: values.occurredAt,
    changes
  };

  if (overrideNote) {
    command.changeExplanation = overrideNote;
    command.overrideNote = overrideNote;
  }

  return command;
}

function parseOperationalSheetRows(rows: readonly (readonly string[])[]): OperationalSheetRow[] {
  const header = rows[0];

  if (!header) {
    return [];
  }

  const indexes = indexOperationalHeaderRow(header);
  const parsedRows: OperationalSheetRow[] = [];

  for (const row of rows.slice(1)) {
    const opportunityId = normalizeExact(getRowValue(row, indexes, 'Opportunity ID'));

    if (!opportunityId) {
      continue;
    }

    const rawValues = Object.fromEntries(
      header.map((title, index) => [title, normalizeExact(row[index] ?? '')])
    );

    parsedRows.push({
      opportunityId,
      ownerName: normalizeExact(getRowValue(row, indexes, 'Owner')),
      customer: normalizeExact(getRowValue(row, indexes, 'Customer')),
      contactPerson: normalizeExact(getRowValue(row, indexes, 'Contact Person')),
      contactChannel: normalizeExact(getRowValue(row, indexes, 'Contact Channel')),
      product: normalizeExact(getRowValue(row, indexes, 'Product')),
      productSegmentCode: normalizeExact(getRowValue(row, indexes, 'Product Segment')),
      quantity: normalizeExact(getRowValue(row, indexes, 'Quantity')),
      valueEurK: normalizeExact(getRowValue(row, indexes, 'Value EUR (000)')),
      salesStage: normalizeExact(getRowValue(row, indexes, 'Sales Stage')),
      expectedCloseDate: normalizeExact(getRowValue(row, indexes, 'Expected Close')),
      expectedClosePrecision: normalizeExact(getRowValue(row, indexes, 'Expected Close Precision')),
      nextFollowUpDate: normalizeExact(getRowValue(row, indexes, 'Next Follow-up Date')),
      competitorRaw: normalizeExact(getRowValue(row, indexes, 'Competitor')),
      stageNote: normalizeExact(getRowValue(row, indexes, 'Stage Note')),
      followUpNote: normalizeExact(getRowValue(row, indexes, 'Follow-up Note')),
      lostReason: normalizeExact(getRowValue(row, indexes, 'Lost Reason')),
      lostReasonNote: normalizeExact(getRowValue(row, indexes, 'Lost Reason Note')),
      winNote: normalizeExact(getRowValue(row, indexes, 'Win Note')),
      reopenNote: normalizeExact(getRowValue(row, indexes, 'Reopen Note')),
      overrideNote: normalizeExact(getRowValue(row, indexes, 'Override Note')),
      rawValues
    });
  }

  return parsedRows;
}

function indexOperationalHeaderRow(header: readonly string[]): Map<string, number> {
  const requiredHeaders = [
    'Opportunity ID',
    'Owner',
    'Customer',
    'Contact Person',
    'Contact Channel',
    'Product',
    'Product Segment',
    'Quantity',
    'Value EUR (000)',
    'Sales Stage',
    'Expected Close',
    'Expected Close Precision',
    'Next Follow-up Date',
    'Competitor',
    'Stage Note',
    'Follow-up Note',
    'Lost Reason',
    'Lost Reason Note',
    'Win Note',
    'Reopen Note',
    'Override Note'
  ] as const;
  const map = new Map<string, number>();

  for (const [index, title] of header.entries()) {
    map.set(title, index);
  }

  for (const required of requiredHeaders) {
    if (!map.has(required)) {
      throw new Error(`Operational sheet is missing required header: ${required}`);
    }
  }

  return map;
}

function getRowValue(
  row: readonly string[],
  indexes: ReadonlyMap<string, number>,
  title: string
): string {
  const index = indexes.get(title);

  if (index === undefined) {
    return '';
  }

  return row[index] ?? '';
}

function applyStringChange(
  changes: Record<string, unknown>,
  fieldName: 'customer' | 'contactPerson' | 'contactChannel' | 'product',
  sheetValue: string,
  currentValue: string
): void {
  if (normalizeExact(sheetValue) !== currentValue) {
    changes[fieldName] = trimBusinessText(sheetValue);
  }
}

function applyNumericChange(
  changes: Record<string, unknown>,
  fieldName: 'quantity' | 'valueEurK',
  sheetValue: string,
  currentValue: number,
  requireInteger: boolean
): void {
  const trimmed = normalizeExact(sheetValue);

  if (!trimmed) {
    throw new Error(`${fieldName} cannot be blank`);
  }

  const parsed = Number(trimmed);

  if (!Number.isFinite(parsed) || parsed <= 0 || (requireInteger && !Number.isInteger(parsed))) {
    throw new Error(`Invalid ${fieldName} in sheet: ${sheetValue}`);
  }

  if (parsed !== currentValue) {
    changes[fieldName] = parsed;
  }
}

function applyEnumStringChange(
  changes: Record<string, unknown>,
  fieldName: 'salesStage',
  sheetValue: string,
  currentValue: string
): void {
  const trimmed = normalizeExact(sheetValue);

  if (!trimmed) {
    throw new Error(`${fieldName} cannot be blank`);
  }

  if (trimmed !== currentValue) {
    changes[fieldName] = parseSalesStage(trimmed);
  }
}

function applyNullableTextChange(
  changes: Record<string, unknown>,
  fieldName:
    | 'competitorRaw'
    | 'stageNote'
    | 'followUpNote'
    | 'lostReason'
    | 'lostReasonNote'
    | 'winNote'
    | 'reopenNote',
  sheetValue: string,
  currentValue: string | null
): void {
  const normalized = normalizeOptionalText(sheetValue);

  if (normalized !== currentValue) {
    changes[fieldName] = normalized;
  }
}

function applyNullableDateChange(
  changes: Record<string, unknown>,
  fieldName: 'nextFollowUpDate',
  sheetValue: string,
  currentValue: string | null
): void {
  const normalized = normalizeOptionalText(sheetValue);

  if (normalized !== currentValue) {
    changes[fieldName] = normalized;
  }
}

async function recordSheetIncident(
  db: Kysely<Database>,
  values: {
    opportunityId?: string | null | undefined;
    issueType: 'conflict' | 'quarantined';
    summary: string;
    at: Date;
    latestContext?: JsonObject | undefined;
  }
): Promise<void> {
  await createOrUpdateSyncIncident(db, {
    opportunityId: values.opportunityId ?? null,
    issueType: values.issueType,
    source: 'sheet',
    summary: values.summary,
    latestContext: values.latestContext,
    at: values.at,
    currentStatus: values.issueType === 'conflict' ? 'open' : 'open'
  });
}

async function queueOperationalWorkbookRefresh(
  db: Kysely<Database>,
  values: {
    opportunityId: string;
    occurredAt: Date;
  }
): Promise<void> {
  const correlationId = randomUUID();

  await insertQueuedJobs(db, [
    {
      job_id: randomUUID(),
      job_type: 'sync_operational_sheet',
      status: 'queued',
      correlation_id: correlationId,
      dedupe_key: `sync_operational_sheet:reconcile:${values.opportunityId}:${values.occurredAt.toISOString()}`,
      payload: {
        opportunity_id: values.opportunityId,
        source: 'sheet',
        occurred_at: values.occurredAt.toISOString()
      },
      available_at: values.occurredAt,
      attempts: 0,
      max_attempts: 10
    }
  ]);
}

function buildOperationalSheetMarkerJob(values: {
  now: Date;
  bucketKey: string;
}): NewJob {
  return {
    job_id: randomUUID(),
    job_type: SHEET_SYNC_MARKER_JOB_TYPE,
    status: 'succeeded',
    correlation_id: null,
    dedupe_key: `${SHEET_SYNC_MARKER_JOB_TYPE}:${values.bucketKey}`,
    payload: {
      scheduled_bucket: values.bucketKey,
      scheduled_at: values.now.toISOString()
    },
    available_at: values.now,
    attempts: 0,
    max_attempts: 1,
    finished_at: values.now
  };
}

function operationalSheetBucketKey(now: Date, intervalMinutes: number): string {
  const intervalMs = intervalMinutes * 60 * 1000;
  const bucketStartMs = Math.floor(now.getTime() / intervalMs) * intervalMs;
  return new Date(bucketStartMs).toISOString();
}

function parseSalesStage(value: string): SalesStage {
  const allowed: readonly SalesStage[] = [
    'identified',
    'qualified',
    'quoted',
    'negotiation',
    'waiting_po',
    'closed_won',
    'closed_lost'
  ];

  if ((allowed as readonly string[]).includes(value)) {
    return value as SalesStage;
  }

  throw new Error(`Invalid sales stage in sheet: ${value}`);
}

function parseSegmentCode(value: string): SegmentCode {
  const allowed: readonly SegmentCode[] = ['CI', 'GET', 'LVI', 'MRM', 'PDIX', 'PP', 'PT'];

  if ((allowed as readonly string[]).includes(value)) {
    return value as SegmentCode;
  }

  throw new Error(`Invalid product segment in sheet: ${value}`);
}

function parseExpectedClosePrecision(value: string): 'day' | 'month' {
  if (value === 'day' || value === 'month') {
    return value;
  }

  throw new Error(`Invalid expected close precision in sheet: ${value}`);
}

function normalizeExact(value: string): string {
  return value.trim();
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}

function isConflictError(message: string): boolean {
  return message.includes('version') || message.includes('expects');
}
