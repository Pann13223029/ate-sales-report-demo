import type { Kysely } from 'kysely';
import { z } from 'zod';

import {
  batchClearSpreadsheetValues,
  batchUpdateSpreadsheet,
  batchUpdateSpreadsheetValues,
  getSpreadsheetMetadata
} from '../adapters/google/sheets-api.js';
import type { Database } from '../db/schema.js';
import { deriveOverdueDays } from '../domain/stale-status.js';
import { claimQueuedJob, markJobFailed, markJobSucceeded, requeueClaimedJob } from '../repositories/job-repository.js';
import {
  listWorkbookClosedOpportunities,
  listWorkbookOpenOpportunities,
  type WorkbookOpportunityListItem
} from '../repositories/opportunity-repository.js';
import { listOpenSheetSyncStatuses } from '../repositories/sync-incident-repository.js';
import {
  acquireWorkbookLease,
  markWorkbookState,
  releaseWorkbookLease
} from '../repositories/workbook-repository.js';

const WORKBOOK_JOB_PAYLOAD_SCHEMA = z.object({
  opportunity_id: z.string().min(1),
  source: z.string().min(1),
  occurred_at: z.string().datetime()
});

const WORKBOOK_JOB_LEASE_MS = 2 * 60 * 1000;
const WORKBOOK_LOCK_LEASE_MS = 2 * 60 * 1000;
const WORKBOOK_LOCK_RETRY_MS = 5 * 1000;

const OPERATIONAL_WORKBOOK_KEY = 'operational_workbook';
const EXECUTIVE_WORKBOOK_KEY = 'executive_workbook';

const OPERATIONAL_INSTRUCTIONS_TAB = 'Instructions';
const OPERATIONAL_DATA_TAB = 'Opportunities_Operational';
const EXECUTIVE_GUIDE_TAB = 'Guide';
const EXECUTIVE_MANAGEMENT_TAB = 'Opportunities_Management';
const EXECUTIVE_CLOSED_TAB = 'Closed_Opportunities';

const OPERATIONAL_HEADERS = [
  'Opportunity ID',
  'Sync Status',
  'Owner',
  'Customer',
  'Contact Person',
  'Contact Channel',
  'Product',
  'Product Segment',
  'Quantity',
  'Value EUR (000)',
  'Sales Stage',
  'Probability %',
  'Expected Close',
  'Expected Close Precision',
  'Next Follow-up Date',
  'Stale Status',
  'Competitor',
  'Stage Note',
  'Follow-up Note',
  'Lost Reason',
  'Lost Reason Note',
  'Win Note',
  'Reopen Note',
  'Register Date',
  'Last Activity Date',
  'Age Days',
  'Closed At',
  'Override Note'
] as const;

const MANAGEMENT_HEADERS = [
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
  'Probability %',
  'Expected Close',
  'Next Follow-up Date',
  'Stale Status',
  'Days Stale',
  'Competitor',
  'Current Note',
  'Register Date',
  'Last Activity Date',
  'Age Days'
] as const;

const CLOSED_HEADERS = [
  'Opportunity ID',
  'Closed Stage',
  'Closed At',
  'Owner',
  'Customer',
  'Contact Person',
  'Contact Channel',
  'Product',
  'Product Segment',
  'Quantity',
  'Value EUR (000)',
  'Probability %',
  'Expected Close',
  'Competitor',
  'Closure Summary',
  'Register Date',
  'Last Activity Date',
  'Age Days'
] as const;

export interface GoogleSheetsRuntimeConfig {
  serviceAccountJson: string;
  operationalWorkbookId: string;
  executiveWorkbookId: string;
}

export interface WorkbookJobResult {
  skipped: boolean;
  jobId: string;
  workbookKey?: string;
  rowCount?: number;
}

export async function syncOperationalWorkbookJob(
  db: Kysely<Database>,
  values: {
    jobId: string;
    googleSheets: GoogleSheetsRuntimeConfig;
  }
): Promise<WorkbookJobResult> {
  return runWorkbookJob(db, {
    jobId: values.jobId,
    workbookKey: OPERATIONAL_WORKBOOK_KEY,
    spreadsheetId: values.googleSheets.operationalWorkbookId,
    serviceAccountJson: values.googleSheets.serviceAccountJson,
    buildWorkbook: async (refreshedAt) => {
      const [openOpportunities, syncStatuses] = await Promise.all([
        listWorkbookOpenOpportunities(db),
        listOpenSheetSyncStatuses(db)
      ]);

      return {
        clearRanges: [
          sheetRange(OPERATIONAL_INSTRUCTIONS_TAB),
          sheetRange(OPERATIONAL_DATA_TAB)
        ],
        valueUpdates: [
          {
            range: startCell(OPERATIONAL_INSTRUCTIONS_TAB),
            values: buildOperationalInstructionsRows()
          },
          {
            range: startCell(OPERATIONAL_DATA_TAB),
            values: buildOperationalDataRows(openOpportunities, {
              asOf: refreshedAt,
              syncStatuses
            })
          }
        ],
        ensureSheets: [
          { title: OPERATIONAL_INSTRUCTIONS_TAB, frozenRowCount: 0 },
          { title: OPERATIONAL_DATA_TAB, frozenRowCount: 1 }
        ],
        rowCount: openOpportunities.length
      };
    }
  });
}

export async function refreshExecutiveWorkbookJob(
  db: Kysely<Database>,
  values: {
    jobId: string;
    googleSheets: GoogleSheetsRuntimeConfig;
  }
): Promise<WorkbookJobResult> {
  return runWorkbookJob(db, {
    jobId: values.jobId,
    workbookKey: EXECUTIVE_WORKBOOK_KEY,
    spreadsheetId: values.googleSheets.executiveWorkbookId,
    serviceAccountJson: values.googleSheets.serviceAccountJson,
    buildWorkbook: async (refreshedAt) => {
      const [openOpportunities, closedOpportunities] = await Promise.all([
        listWorkbookOpenOpportunities(db),
        listWorkbookClosedOpportunities(db)
      ]);

      const freshnessLine = buildWorkbookFreshnessRows({
        refreshedAt,
        status: 'Healthy'
      });

      return {
        clearRanges: [
          sheetRange(EXECUTIVE_GUIDE_TAB),
          sheetRange(EXECUTIVE_MANAGEMENT_TAB),
          sheetRange(EXECUTIVE_CLOSED_TAB)
        ],
        valueUpdates: [
          {
            range: startCell(EXECUTIVE_GUIDE_TAB),
            values: buildExecutiveGuideRows({
              refreshedAt,
              status: 'Healthy'
            })
          },
          {
            range: startCell(EXECUTIVE_MANAGEMENT_TAB),
            values: [...freshnessLine, [], [...MANAGEMENT_HEADERS], ...buildManagementRows(openOpportunities)]
          },
          {
            range: startCell(EXECUTIVE_CLOSED_TAB),
            values: [...freshnessLine, [], [...CLOSED_HEADERS], ...buildClosedRows(closedOpportunities)]
          }
        ],
        ensureSheets: [
          { title: EXECUTIVE_GUIDE_TAB, frozenRowCount: 0 },
          { title: EXECUTIVE_MANAGEMENT_TAB, frozenRowCount: 3 },
          { title: EXECUTIVE_CLOSED_TAB, frozenRowCount: 3 }
        ],
        rowCount: openOpportunities.length + closedOpportunities.length
      };
    }
  });
}

interface RunWorkbookJobInput {
  jobId: string;
  workbookKey: string;
  spreadsheetId: string;
  serviceAccountJson: string;
  buildWorkbook: (refreshedAt: Date) => Promise<{
    clearRanges: string[];
    valueUpdates: {
      range: string;
      values: readonly (readonly unknown[])[];
    }[];
    ensureSheets: {
      title: string;
      frozenRowCount: number;
    }[];
    rowCount: number;
  }>;
}

async function runWorkbookJob(
  db: Kysely<Database>,
  input: RunWorkbookJobInput
): Promise<WorkbookJobResult> {
  const now = new Date();
  const claimedJob = await claimQueuedJob(db, {
    jobId: input.jobId,
    now,
    leaseDurationMs: WORKBOOK_JOB_LEASE_MS
  });

  if (!claimedJob) {
    return {
      skipped: true,
      jobId: input.jobId
    };
  }

  WORKBOOK_JOB_PAYLOAD_SCHEMA.parse(claimedJob.payload);

  const lease = await acquireWorkbookLease(db, {
    workbookKey: input.workbookKey,
    jobId: input.jobId,
    now,
    leaseDurationMs: WORKBOOK_LOCK_LEASE_MS
  });

  if (!lease) {
    await requeueClaimedJob(db, {
      jobId: input.jobId,
      availableAt: new Date(now.getTime() + WORKBOOK_LOCK_RETRY_MS),
      lastError: `${input.workbookKey} is currently locked`
    });

    return {
      skipped: true,
      jobId: input.jobId,
      workbookKey: input.workbookKey
    };
  }

  try {
    const workbook = await input.buildWorkbook(now);
    await ensureWorkbookStructure(input.serviceAccountJson, input.spreadsheetId, workbook.ensureSheets);
    await batchClearSpreadsheetValues(input.serviceAccountJson, input.spreadsheetId, workbook.clearRanges);
    await batchUpdateSpreadsheetValues(
      input.serviceAccountJson,
      input.spreadsheetId,
      workbook.valueUpdates
    );

    await db.transaction().execute(async (trx) => {
      await markWorkbookState(trx, {
        workbookKey: input.workbookKey,
        status: 'healthy',
        at: now,
        lastError: null
      });
      await markJobSucceeded(trx, {
        jobId: input.jobId,
        finishedAt: now
      });
    });

    return {
      skipped: false,
      jobId: input.jobId,
      workbookKey: input.workbookKey,
      rowCount: workbook.rowCount
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const dead = claimedJob.attempts >= claimedJob.max_attempts;
    const finishedAt = new Date();

    await db.transaction().execute(async (trx) => {
      await markWorkbookState(trx, {
        workbookKey: input.workbookKey,
        status: 'failed',
        at: finishedAt,
        lastError: errorMessage
      });
      await markJobFailed(trx, {
        jobId: input.jobId,
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

async function ensureWorkbookStructure(
  serviceAccountJson: string,
  spreadsheetId: string,
  requiredSheets: readonly {
    title: string;
    frozenRowCount: number;
  }[]
): Promise<void> {
  let metadata = await getSpreadsheetMetadata(serviceAccountJson, spreadsheetId);
  const existingByTitle = new Map(metadata.sheets.map((sheet) => [sheet.title, sheet]));
  const addRequests = requiredSheets
    .filter((sheet) => !existingByTitle.has(sheet.title))
    .map((sheet) => ({
      addSheet: {
        properties: {
          title: sheet.title
        }
      }
    }));

  if (addRequests.length > 0) {
    await batchUpdateSpreadsheet(serviceAccountJson, spreadsheetId, addRequests);
    metadata = await getSpreadsheetMetadata(serviceAccountJson, spreadsheetId);
  }

  const nextByTitle = new Map(metadata.sheets.map((sheet) => [sheet.title, sheet]));
  const propertyRequests = requiredSheets
    .map((sheet): Record<string, unknown> | null => {
      const existing = nextByTitle.get(sheet.title);

      if (!existing || existing.frozenRowCount === sheet.frozenRowCount) {
        return null;
      }

      return {
        updateSheetProperties: {
          properties: {
            sheetId: existing.sheetId,
            gridProperties: {
              frozenRowCount: sheet.frozenRowCount
            }
          },
          fields: 'gridProperties.frozenRowCount'
        }
      };
    })
    .filter((request) => request !== null);

  if (propertyRequests.length > 0) {
    await batchUpdateSpreadsheet(serviceAccountJson, spreadsheetId, propertyRequests);
  }
}

export function buildOperationalInstructionsRows(): string[][] {
  return [
    ['Operational workbook'],
    [],
    ['Purpose', 'Manager correction surface for open opportunities only'],
    ['Editors', 'You + Head of Sales'],
    ['Rule', 'Only single-row edits are supported in v1'],
    ['Legend', 'White columns editable, gray/system columns should stay locked'],
    ['Conflict handling', 'Bulk or unsupported edits may be quarantined and reverted'],
    ['Sync status', 'Blank means healthy; non-blank means attention needed'],
    ['Reminder', 'Use Telegram/app flows for reopen actions; this workbook is for live open-row corrections']
  ];
}

export function buildExecutiveGuideRows(values: {
  refreshedAt: Date;
  status: 'Healthy' | 'Delayed' | 'Failed';
}): string[][] {
  return [
    ['Executive workbook'],
    [],
    ['Last Refreshed At', formatBangkokTimestamp(values.refreshedAt)],
    ['Refresh Status', values.status],
    [],
    ['Tabs', 'Purpose'],
    [EXECUTIVE_MANAGEMENT_TAB, 'Open opportunities only'],
    [EXECUTIVE_CLOSED_TAB, 'Closed won/lost opportunities only'],
    [],
    ['Refresh cadence', 'Every 5 minutes from Postgres'],
    ['Corrections', 'Use the Operational workbook or Telegram workflow, not this workbook']
  ];
}

export function buildWorkbookFreshnessRows(values: {
  refreshedAt: Date;
  status: 'Healthy' | 'Delayed' | 'Failed';
}): string[][] {
  return [
    ['Last Refreshed At', formatBangkokTimestamp(values.refreshedAt)],
    ['Refresh Status', values.status]
  ];
}

export function buildOperationalDataRows(
  opportunities: readonly WorkbookOpportunityListItem[],
  values: {
    asOf?: Date | undefined;
    syncStatuses?: ReadonlyMap<string, string> | undefined;
  } = {}
): (string | number)[][] {
  const asOf = values.asOf ?? new Date();
  const syncStatuses = values.syncStatuses ?? new Map<string, string>();

  return [
    [...OPERATIONAL_HEADERS],
    ...opportunities.map((opportunity) => [
      opportunity.opportunityId,
      syncStatuses.get(opportunity.opportunityId) ?? '',
      opportunity.ownerName,
      opportunity.customerRaw,
      opportunity.contactPerson,
      opportunity.contactChannel,
      opportunity.productRaw,
      opportunity.productSegmentCode,
      opportunity.quantity,
      opportunity.valueEurK,
      opportunity.salesStage,
      opportunity.probabilityPct,
      opportunity.expectedCloseDate,
      opportunity.expectedClosePrecision,
      opportunity.nextFollowUpDate ?? '',
      opportunity.staleStatus,
      opportunity.competitorRaw ?? '',
      opportunity.stageNote ?? '',
      opportunity.followUpNote ?? '',
      opportunity.lostReason ?? '',
      opportunity.lostReasonNote ?? '',
      opportunity.winNote ?? '',
      opportunity.reopenNote ?? '',
      opportunity.registerDate,
      formatIsoDateTime(opportunity.lastActivityAt),
      calculateAgeDays(opportunity.registerDate, asOf),
      opportunity.closedAt ? formatIsoDateTime(opportunity.closedAt) : '',
      ''
    ])
  ];
}

export function buildManagementRows(
  opportunities: readonly WorkbookOpportunityListItem[],
  asOf: Date = new Date()
): (string | number)[][] {
  return opportunities.map((opportunity) => [
    opportunity.opportunityId,
    opportunity.ownerName,
    opportunity.customerRaw,
    opportunity.contactPerson,
    opportunity.contactChannel,
    opportunity.productRaw,
    opportunity.productSegmentCode,
    opportunity.quantity,
    opportunity.valueEurK,
    opportunity.salesStage,
    opportunity.probabilityPct,
    formatExpectedCloseForDisplay(opportunity.expectedCloseDate, opportunity.expectedClosePrecision),
    opportunity.nextFollowUpDate ?? '',
    opportunity.staleStatus,
    deriveOverdueDays({
      asOf,
      nextFollowUpDate: opportunity.nextFollowUpDate,
      lastActivityAt: opportunity.lastActivityAt
    }),
    opportunity.competitorRaw ?? '',
    deriveCurrentNote(opportunity),
    opportunity.registerDate,
    formatIsoDateTime(opportunity.lastActivityAt),
    calculateAgeDays(opportunity.registerDate, asOf)
  ]);
}

export function buildClosedRows(
  opportunities: readonly WorkbookOpportunityListItem[],
  asOf: Date = new Date()
): (string | number)[][] {
  return opportunities.map((opportunity) => [
    opportunity.opportunityId,
    opportunity.salesStage,
    opportunity.closedAt ? formatIsoDateTime(opportunity.closedAt) : '',
    opportunity.ownerName,
    opportunity.customerRaw,
    opportunity.contactPerson,
    opportunity.contactChannel,
    opportunity.productRaw,
    opportunity.productSegmentCode,
    opportunity.quantity,
    opportunity.valueEurK,
    opportunity.probabilityPct,
    formatExpectedCloseForDisplay(opportunity.expectedCloseDate, opportunity.expectedClosePrecision),
    opportunity.competitorRaw ?? '',
    deriveClosureSummary(opportunity),
    opportunity.registerDate,
    formatIsoDateTime(opportunity.lastActivityAt),
    calculateAgeDays(opportunity.registerDate, asOf)
  ]);
}

function deriveCurrentNote(opportunity: WorkbookOpportunityListItem): string {
  if (opportunity.winNote) {
    return opportunity.winNote;
  }

  if (opportunity.lostReason && opportunity.lostReasonNote) {
    return `${opportunity.lostReason}: ${opportunity.lostReasonNote}`;
  }

  if (opportunity.lostReason) {
    return opportunity.lostReason;
  }

  if (opportunity.reopenNote) {
    return opportunity.reopenNote;
  }

  if (opportunity.stageNote) {
    return opportunity.stageNote;
  }

  return opportunity.followUpNote ?? '';
}

function deriveClosureSummary(opportunity: WorkbookOpportunityListItem): string {
  if (opportunity.salesStage === 'closed_won') {
    return opportunity.winNote ?? '';
  }

  if (opportunity.lostReason && opportunity.lostReasonNote) {
    return `${opportunity.lostReason}: ${opportunity.lostReasonNote}`;
  }

  return opportunity.lostReason ?? '';
}

function calculateAgeDays(registerDate: string, asOf: Date): number {
  const registerAt = new Date(`${registerDate}T00:00:00.000Z`);
  return Math.max(0, Math.floor((asOf.getTime() - registerAt.getTime()) / (24 * 60 * 60 * 1000)));
}

function formatExpectedCloseForDisplay(date: string, precision: 'day' | 'month'): string {
  if (precision === 'month') {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC'
    }).format(new Date(`${date}T00:00:00.000Z`));
  }

  return date;
}

function formatBangkokTimestamp(value: Date): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  return `${formatter.format(value)} Asia/Bangkok`;
}

function formatIsoDateTime(value: Date): string {
  return value.toISOString().replace('T', ' ').replace('.000Z', 'Z');
}

function sheetRange(title: string): string {
  return `${quoteSheetTitle(title)}!A:AZ`;
}

function startCell(title: string): string {
  return `${quoteSheetTitle(title)}!A1`;
}

function quoteSheetTitle(title: string): string {
  return `'${title.replace(/'/g, "''")}'`;
}
