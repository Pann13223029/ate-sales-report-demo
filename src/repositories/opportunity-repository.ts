import { sql, type Kysely, type Transaction } from 'kysely';

import type {
  Database,
  OpportunityCurrentRow,
  SalesStage,
  SegmentCode,
  StaleStatus,
  UserRow
} from '../db/schema.js';
import { deriveOverdueDays, deriveStaleStatus, formatDateKeyInTimeZone } from '../domain/stale-status.js';

export interface ProductCatalogMatch {
  productId: string;
  canonicalName: string;
  productNormalized: string;
  segmentCode: SegmentCode;
  matchedBy: 'catalog' | 'alias';
}

export interface OpenOpportunityListItem {
  opportunityId: string;
  customerRaw: string;
  productRaw: string;
  salesStage: SalesStage;
  staleStatus: StaleStatus;
  expectedCloseDate: string;
  valueEurK: number;
}

export interface StaleReminderListItem {
  opportunityId: string;
  ownerUserId: string;
  ownerName: string;
  telegramUserId: string;
  customerRaw: string;
  productRaw: string;
  salesStage: SalesStage;
  staleStatus: StaleStatus;
  nextFollowUpDate: string | null;
  lastActivityAt: Date;
  lastReminderSentAt: Date | null;
  staleCount: number;
}

export interface WorkbookOpportunityListItem {
  opportunityId: string;
  ownerUserId: string;
  ownerName: string;
  customerRaw: string;
  contactPerson: string;
  contactChannel: string;
  productRaw: string;
  productSegmentCode: SegmentCode;
  quantity: number;
  valueEurK: number;
  salesStage: SalesStage;
  probabilityPct: number;
  expectedCloseDate: string;
  expectedClosePrecision: 'day' | 'month';
  nextFollowUpDate: string | null;
  staleStatus: StaleStatus;
  competitorRaw: string | null;
  stageNote: string | null;
  followUpNote: string | null;
  lostReason: string | null;
  lostReasonNote: string | null;
  winNote: string | null;
  reopenNote: string | null;
  registerDate: string;
  lastActivityAt: Date;
  closedAt: Date | null;
}

export async function getUserById(
  db: Kysely<Database>,
  userId: string
): Promise<UserRow | undefined> {
  return db
    .withSchema('core')
    .selectFrom('users')
    .selectAll()
    .where('user_id', '=', userId)
    .where('active', '=', true)
    .executeTakeFirst();
}

export async function getUserByTelegramUserId(
  db: Kysely<Database>,
  telegramUserId: string
): Promise<UserRow | undefined> {
  return db
    .withSchema('core')
    .selectFrom('users')
    .selectAll()
    .where('telegram_user_id', '=', telegramUserId)
    .where('active', '=', true)
    .executeTakeFirst();
}

export async function getUserByOwnerName(
  db: Kysely<Database>,
  ownerName: string
): Promise<UserRow | undefined> {
  return db
    .withSchema('core')
    .selectFrom('users')
    .selectAll()
    .where('owner_name', '=', ownerName)
    .where('active', '=', true)
    .executeTakeFirst();
}

export async function getOpportunityCurrentById(
  db: Kysely<Database>,
  opportunityId: string
): Promise<OpportunityCurrentRow | undefined> {
  return db
    .withSchema('projections')
    .selectFrom('opportunities_current')
    .selectAll()
    .where('opportunity_id', '=', opportunityId)
    .executeTakeFirst();
}

export async function listOpenOpportunityCurrentRows(
  db: Kysely<Database>
): Promise<OpportunityCurrentRow[]> {
  return db
    .withSchema('projections')
    .selectFrom('opportunities_current')
    .selectAll()
    .where('sales_stage', 'not in', ['closed_won', 'closed_lost'])
    .execute();
}

export async function allocateNextOpportunityId(db: Kysely<Database>): Promise<string> {
  const result = await sql<{ next_id: string }>`
    select nextval('core.opportunity_number_seq')::text as next_id
  `.execute(db);

  const nextId = result.rows[0]?.next_id;

  if (!nextId) {
    throw new Error('Failed to allocate next opportunity sequence number');
  }

  return `OPP-${nextId.padStart(6, '0')}`;
}

export async function listOpenOpportunitiesByOwner(
  db: Kysely<Database>,
  values: {
    ownerUserId: string;
    limit: number;
  }
): Promise<OpenOpportunityListItem[]> {
  const rows = await db
    .withSchema('projections')
    .selectFrom('opportunities_current')
    .select([
      'opportunity_id as opportunityId',
      'customer_raw as customerRaw',
      'product_raw as productRaw',
      'sales_stage as salesStage',
      'stale_status as staleStatus',
      'expected_close_date as expectedCloseDate',
      'value_eur_k as valueEurK'
    ])
    .where('owner_user_id', '=', values.ownerUserId)
    .where('sales_stage', 'not in', ['closed_won', 'closed_lost'])
    .execute();

  return rows
    .map((row) => ({
      ...row,
      valueEurK: Number(row.valueEurK)
    }))
    .sort(compareOpenOpportunities)
    .slice(0, values.limit);
}

export async function refreshOpenOpportunityStaleStatuses(
  db: Kysely<Database> | Transaction<Database>,
  values: {
    asOf: Date;
  }
): Promise<number> {
  const rows = await db
    .withSchema('projections')
    .selectFrom('opportunities_current')
    .select(['opportunity_id', 'sales_stage', 'next_follow_up_date', 'last_activity_at', 'stale_status'])
    .where('sales_stage', 'not in', ['closed_won', 'closed_lost'])
    .execute();

  let updatedCount = 0;

  for (const row of rows) {
    const nextStatus = deriveStaleStatus({
      asOf: values.asOf,
      nextFollowUpDate: row.next_follow_up_date,
      lastActivityAt: row.last_activity_at
    });

    if (nextStatus === row.stale_status) {
      continue;
    }

    await db
      .withSchema('projections')
      .updateTable('opportunities_current')
      .set({
        stale_status: nextStatus
      })
      .where('opportunity_id', '=', row.opportunity_id)
      .executeTakeFirstOrThrow();

    updatedCount += 1;
  }

  return updatedCount;
}

export async function listDailyStaleReminderCandidates(
  db: Kysely<Database>,
  values: {
    asOf: Date;
    timeZone: string;
  }
): Promise<StaleReminderListItem[]> {
  const result = await sql<{
    opportunityId: string;
    ownerUserId: string;
    ownerName: string;
    telegramUserId: string;
    customerRaw: string;
    productRaw: string;
    salesStage: SalesStage;
    staleStatus: StaleStatus;
    nextFollowUpDate: string | null;
    lastActivityAt: Date;
    lastReminderSentAt: Date | null;
    staleCount: number;
  }>`
    select
      o.opportunity_id as "opportunityId",
      o.owner_user_id as "ownerUserId",
      o.owner_name as "ownerName",
      u.telegram_user_id::text as "telegramUserId",
      o.customer_raw as "customerRaw",
      o.product_raw as "productRaw",
      o.sales_stage as "salesStage",
      o.stale_status as "staleStatus",
      o.next_follow_up_date as "nextFollowUpDate",
      o.last_activity_at as "lastActivityAt",
      o.last_reminder_sent_at as "lastReminderSentAt",
      o.stale_count as "staleCount"
    from projections.opportunities_current o
    inner join core.users u
      on u.user_id = o.owner_user_id
    where o.sales_stage not in ('closed_won', 'closed_lost')
      and o.stale_status = 'stale'
      and u.active = true
      and u.telegram_user_id is not null
  `.execute(db);

  const reminderDateKey = formatDateKeyInTimeZone(values.asOf, values.timeZone);

  return result.rows
    .filter((row) => {
      if (!row.lastReminderSentAt) {
        return true;
      }

      return formatDateKeyInTimeZone(row.lastReminderSentAt, values.timeZone) !== reminderDateKey;
    })
    .sort((left, right) => compareReminderCandidates(left, right, values.asOf));
}

export async function markDailyReminderDelivered(
  db: Kysely<Database> | Transaction<Database>,
  values: {
    opportunityIds: readonly string[];
    sentAt: Date;
  }
): Promise<number> {
  if (values.opportunityIds.length === 0) {
    return 0;
  }

  const result = await db
    .withSchema('projections')
    .updateTable('opportunities_current')
    .set({
      last_reminder_sent_at: values.sentAt,
      stale_count: sql<number>`stale_count + 1`
    })
    .where('opportunity_id', 'in', [...values.opportunityIds])
    .executeTakeFirst();

  return Number(result.numUpdatedRows ?? 0);
}

export async function findProductCatalogMatch(
  db: Kysely<Database>,
  productNormalized: string
): Promise<ProductCatalogMatch | undefined> {
  const direct = await db
    .withSchema('core')
    .selectFrom('product_catalog as p')
    .select([
      'p.product_id as productId',
      'p.canonical_name as canonicalName',
      'p.product_normalized as productNormalized',
      'p.segment_code as segmentCode'
    ])
    .where('p.active', '=', true)
    .where('p.product_normalized', '=', productNormalized)
    .executeTakeFirst();

  if (direct) {
    return {
      ...direct,
      matchedBy: 'catalog'
    };
  }

  const alias = await db
    .withSchema('core')
    .selectFrom('product_aliases as a')
    .innerJoin('product_catalog as p', 'p.product_id', 'a.product_id')
    .select([
      'p.product_id as productId',
      'p.canonical_name as canonicalName',
      'p.product_normalized as productNormalized',
      'p.segment_code as segmentCode'
    ])
    .where('p.active', '=', true)
    .where('a.alias_normalized', '=', productNormalized)
    .executeTakeFirst();

  if (!alias) {
    return undefined;
  }

  return {
    ...alias,
    matchedBy: 'alias'
  };
}

export async function listWorkbookOpenOpportunities(
  db: Kysely<Database>
): Promise<WorkbookOpportunityListItem[]> {
  const rows = await db
    .withSchema('projections')
    .selectFrom('opportunities_current')
    .select([
      'opportunity_id as opportunityId',
      'owner_user_id as ownerUserId',
      'owner_name as ownerName',
      'customer_raw as customerRaw',
      'contact_person as contactPerson',
      'contact_channel as contactChannel',
      'product_raw as productRaw',
      'product_segment_code as productSegmentCode',
      'quantity',
      'value_eur_k as valueEurK',
      'sales_stage as salesStage',
      'probability_pct as probabilityPct',
      'expected_close_date as expectedCloseDate',
      'expected_close_precision as expectedClosePrecision',
      'next_follow_up_date as nextFollowUpDate',
      'stale_status as staleStatus',
      'competitor_raw as competitorRaw',
      'stage_note as stageNote',
      'follow_up_note as followUpNote',
      'lost_reason as lostReason',
      'lost_reason_note as lostReasonNote',
      'win_note as winNote',
      'reopen_note as reopenNote',
      'register_date as registerDate',
      'last_activity_at as lastActivityAt',
      'closed_at as closedAt'
    ])
    .where('sales_stage', 'not in', ['closed_won', 'closed_lost'])
    .execute();

  return rows
    .map((row) => ({
      ...row,
      valueEurK: Number(row.valueEurK)
    }))
    .sort(compareWorkbookOpenOpportunities);
}

export async function listWorkbookClosedOpportunities(
  db: Kysely<Database>
): Promise<WorkbookOpportunityListItem[]> {
  const rows = await db
    .withSchema('projections')
    .selectFrom('opportunities_current')
    .select([
      'opportunity_id as opportunityId',
      'owner_user_id as ownerUserId',
      'owner_name as ownerName',
      'customer_raw as customerRaw',
      'contact_person as contactPerson',
      'contact_channel as contactChannel',
      'product_raw as productRaw',
      'product_segment_code as productSegmentCode',
      'quantity',
      'value_eur_k as valueEurK',
      'sales_stage as salesStage',
      'probability_pct as probabilityPct',
      'expected_close_date as expectedCloseDate',
      'expected_close_precision as expectedClosePrecision',
      'next_follow_up_date as nextFollowUpDate',
      'stale_status as staleStatus',
      'competitor_raw as competitorRaw',
      'stage_note as stageNote',
      'follow_up_note as followUpNote',
      'lost_reason as lostReason',
      'lost_reason_note as lostReasonNote',
      'win_note as winNote',
      'reopen_note as reopenNote',
      'register_date as registerDate',
      'last_activity_at as lastActivityAt',
      'closed_at as closedAt'
    ])
    .where('sales_stage', 'in', ['closed_won', 'closed_lost'])
    .execute();

  return rows
    .map((row) => ({
      ...row,
      valueEurK: Number(row.valueEurK)
    }))
    .sort(compareWorkbookClosedOpportunities);
}

function compareOpenOpportunities(
  left: OpenOpportunityListItem,
  right: OpenOpportunityListItem
): number {
  const staleDifference = staleRank(right.staleStatus) - staleRank(left.staleStatus);

  if (staleDifference !== 0) {
    return staleDifference;
  }

  const stageDifference = stagePriority(right.salesStage) - stagePriority(left.salesStage);

  if (stageDifference !== 0) {
    return stageDifference;
  }

  const closeDateDifference = left.expectedCloseDate.localeCompare(right.expectedCloseDate);

  if (closeDateDifference !== 0) {
    return closeDateDifference;
  }

  return right.valueEurK - left.valueEurK;
}

function compareReminderCandidates(
  left: StaleReminderListItem,
  right: StaleReminderListItem,
  asOf: Date
): number {
  const overdueDifference =
    deriveOverdueDays({
      asOf,
      nextFollowUpDate: right.nextFollowUpDate,
      lastActivityAt: right.lastActivityAt
    }) -
    deriveOverdueDays({
      asOf,
      nextFollowUpDate: left.nextFollowUpDate,
      lastActivityAt: left.lastActivityAt
    });

  if (overdueDifference !== 0) {
    return overdueDifference;
  }

  return stagePriority(right.salesStage) - stagePriority(left.salesStage);
}

function compareWorkbookOpenOpportunities(
  left: WorkbookOpportunityListItem,
  right: WorkbookOpportunityListItem
): number {
  const staleDifference = staleRank(right.staleStatus) - staleRank(left.staleStatus);

  if (staleDifference !== 0) {
    return staleDifference;
  }

  const stageDifference = stagePriority(right.salesStage) - stagePriority(left.salesStage);

  if (stageDifference !== 0) {
    return stageDifference;
  }

  const closeDateDifference = left.expectedCloseDate.localeCompare(right.expectedCloseDate);

  if (closeDateDifference !== 0) {
    return closeDateDifference;
  }

  const valueDifference = right.valueEurK - left.valueEurK;

  if (valueDifference !== 0) {
    return valueDifference;
  }

  return left.ownerName.localeCompare(right.ownerName);
}

function compareWorkbookClosedOpportunities(
  left: WorkbookOpportunityListItem,
  right: WorkbookOpportunityListItem
): number {
  const leftClosedAt = left.closedAt?.toISOString() ?? '';
  const rightClosedAt = right.closedAt?.toISOString() ?? '';
  const closedDifference = rightClosedAt.localeCompare(leftClosedAt);

  if (closedDifference !== 0) {
    return closedDifference;
  }

  const valueDifference = right.valueEurK - left.valueEurK;

  if (valueDifference !== 0) {
    return valueDifference;
  }

  return left.ownerName.localeCompare(right.ownerName);
}

function staleRank(status: StaleStatus): number {
  switch (status) {
    case 'stale':
      return 4;
    case 'overdue':
      return 3;
    case 'due_soon':
      return 2;
    case 'fresh':
    default:
      return 1;
  }
}

function stagePriority(stage: SalesStage): number {
  switch (stage) {
    case 'waiting_po':
      return 5;
    case 'negotiation':
      return 4;
    case 'quoted':
      return 3;
    case 'qualified':
      return 2;
    case 'identified':
    default:
      return 1;
  }
}
