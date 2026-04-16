import type { ColumnType, Generated, Insertable, Selectable, Updateable } from 'kysely';

export type UserRole = 'rep' | 'executive' | 'admin';
export type SegmentCode = 'CI' | 'GET' | 'LVI' | 'MRM' | 'PDIX' | 'PP' | 'PT';
export type SalesStage =
  | 'identified'
  | 'qualified'
  | 'quoted'
  | 'negotiation'
  | 'waiting_po'
  | 'closed_won'
  | 'closed_lost';
export type ClosePrecision = 'day' | 'month';
export type StaleStatus = 'fresh' | 'due_soon' | 'overdue' | 'stale';
export type JobStatus = 'queued' | 'claimed' | 'succeeded' | 'failed' | 'dead' | 'cancelled';
export type SyncStatus = 'pending' | 'retrying' | 'conflict' | 'quarantined';
export type ActorType = 'user' | 'system';
export type EventSource = 'telegram' | 'sheet' | 'system' | 'admin';
export type SegmentSource = 'catalog' | 'manual';
export type DraftType = 'new' | 'update' | 'conflict_review' | 'set_follow_up';
export type DraftStatus = 'active' | 'confirmed' | 'cancelled' | 'expired' | 'discarded';
export type InboxProcessingStatus = 'received' | 'queued' | 'processed' | 'failed' | 'dead';
export type WorkbookRefreshStatus = 'healthy' | 'delayed' | 'failed';
export type SyncIncidentSource = 'sheet' | 'projection' | 'workbook' | 'replay';
export type SyncIncidentStatus = 'open' | 'retrying' | 'resolved' | 'dead';

export type JsonPrimitive = boolean | number | string | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonArray;
export type JsonObject = { [key: string]: JsonValue };
export type JsonArray = JsonValue[];

type Timestamptz = ColumnType<Date, Date | string, Date | string>;
type DbDate = ColumnType<string, string, string>;
type Jsonb = ColumnType<JsonValue, JsonValue, JsonValue>;
type Int8 = ColumnType<string, string | number | bigint, string | number | bigint>;
type NullableInt8 = ColumnType<
  string | null,
  string | number | bigint | null | undefined,
  string | number | bigint | null
>;

export interface UsersTable {
  user_id: string;
  role: UserRole;
  owner_name: string;
  email: string;
  telegram_user_id: NullableInt8;
  active: ColumnType<boolean, boolean | undefined, boolean | undefined>;
  created_at: ColumnType<Date, Date | string | undefined, never>;
  updated_at: ColumnType<Date, Date | string | undefined, Date | string>;
}

export interface ProductCatalogTable {
  product_id: string;
  canonical_name: string;
  product_normalized: string;
  segment_code: SegmentCode;
  active: ColumnType<boolean, boolean | undefined, boolean | undefined>;
  created_at: ColumnType<Date, Date | string | undefined, never>;
  updated_at: ColumnType<Date, Date | string | undefined, Date | string>;
}

export interface ProductAliasesTable {
  alias_id: string;
  product_id: string;
  alias_raw: string;
  alias_normalized: string;
  created_at: ColumnType<Date, Date | string | undefined, never>;
}

export interface BusinessEventsTable {
  event_id: string;
  idempotency_key: string;
  event_type: string;
  opportunity_id: string;
  actor_type: ActorType;
  actor_user_id: string | null;
  source: EventSource;
  correlation_id: string;
  causation_id: string | null;
  base_version: number | null;
  result_version: number;
  occurred_at: ColumnType<Date, Date | string | undefined, never>;
  payload: Jsonb;
}

export interface OpportunitiesCurrentTable {
  opportunity_id: string;
  current_version: number;
  owner_user_id: string;
  owner_name: string;
  customer_raw: string;
  customer_normalized: string;
  contact_person: string;
  contact_channel: string;
  product_raw: string;
  product_normalized: string;
  product_segment_code: SegmentCode;
  segment_source: SegmentSource;
  quantity: number;
  value_eur_k: string | number;
  sales_stage: SalesStage;
  probability_pct: 0 | 5 | 25 | 50 | 75 | 90 | 100;
  expected_close_date: DbDate;
  expected_close_precision: ClosePrecision;
  next_follow_up_date: ColumnType<string | null, string | null | undefined, string | null>;
  stale_status: StaleStatus;
  competitor_raw: ColumnType<string | null, string | null | undefined, string | null>;
  stage_note: ColumnType<string | null, string | null | undefined, string | null>;
  follow_up_note: ColumnType<string | null, string | null | undefined, string | null>;
  lost_reason: ColumnType<string | null, string | null | undefined, string | null>;
  lost_reason_note: ColumnType<string | null, string | null | undefined, string | null>;
  win_note: ColumnType<string | null, string | null | undefined, string | null>;
  reopen_note: ColumnType<string | null, string | null | undefined, string | null>;
  register_date: DbDate;
  last_activity_at: Timestamptz;
  closed_at: ColumnType<Date | null, Date | string | null | undefined, Date | string | null>;
  last_reminder_sent_at: ColumnType<
    Date | null,
    Date | string | null | undefined,
    Date | string | null
  >;
  stale_count: ColumnType<number, number | undefined, number>;
  sync_version: ColumnType<string, string | number | bigint | undefined, string | number | bigint>;
  source: EventSource;
  created_by_user_id: string;
  updated_by_user_id: string;
  last_event_id: string;
  created_at: Timestamptz;
  updated_at: Timestamptz;
}

export interface JobsTable {
  job_id: string;
  job_type: string;
  status: ColumnType<JobStatus, JobStatus | undefined, JobStatus>;
  correlation_id: string | null;
  dedupe_key: string | null;
  payload: Jsonb;
  available_at: ColumnType<Date, Date | string | undefined, Date | string>;
  claimed_at: ColumnType<Date | null, Date | string | null | undefined, Date | string | null>;
  lease_expires_at: ColumnType<
    Date | null,
    Date | string | null | undefined,
    Date | string | null
  >;
  heartbeat_at: ColumnType<Date | null, Date | string | null | undefined, Date | string | null>;
  attempts: ColumnType<number, number | undefined, number>;
  max_attempts: ColumnType<number, number | undefined, number>;
  last_error: ColumnType<string | null, string | null | undefined, string | null>;
  created_at: ColumnType<Date, Date | string | undefined, never>;
  finished_at: ColumnType<Date | null, Date | string | null | undefined, Date | string | null>;
}

export interface TelegramWebhookInboxTable {
  inbox_id: Generated<string>;
  telegram_update_id: Int8;
  telegram_user_id: NullableInt8;
  correlation_id: string;
  raw_payload: Jsonb;
  processing_status: InboxProcessingStatus;
  received_at: ColumnType<Date, Date | string | undefined, never>;
  processed_job_id: ColumnType<string | null, string | null | undefined, string | null>;
  last_error: ColumnType<string | null, string | null | undefined, string | null>;
  retained_until: Timestamptz;
}

export interface TelegramDraftsTable {
  draft_id: string;
  telegram_user_id: Int8;
  draft_type: DraftType;
  status: DraftStatus;
  opportunity_id: ColumnType<string | null, string | null | undefined, string | null>;
  base_version: ColumnType<number | null, number | null | undefined, number | null>;
  current_step: ColumnType<string | null, string | null | undefined, string | null>;
  payload: Jsonb;
  expires_at: Timestamptz;
  created_at: ColumnType<Date, Date | string | undefined, never>;
  finalized_at: ColumnType<Date | null, Date | string | null | undefined, Date | string | null>;
  updated_at: ColumnType<Date, Date | string | undefined, Date | string>;
}

export interface WorkbookLocksTable {
  workbook_key: string;
  lock_token: ColumnType<string | null, string | null | undefined, string | null>;
  locked_by_job_id: ColumnType<string | null, string | null | undefined, string | null>;
  lease_expires_at: ColumnType<Date | null, Date | string | null | undefined, Date | string | null>;
  heartbeat_at: ColumnType<Date | null, Date | string | null | undefined, Date | string | null>;
  updated_at: ColumnType<Date, Date | string | undefined, Date | string>;
}

export interface WorkbookStateTable {
  workbook_key: string;
  last_success_at: ColumnType<Date | null, Date | string | null | undefined, Date | string | null>;
  last_status: ColumnType<
    WorkbookRefreshStatus | null,
    WorkbookRefreshStatus | null | undefined,
    WorkbookRefreshStatus | null
  >;
  last_error: ColumnType<string | null, string | null | undefined, string | null>;
  updated_at: ColumnType<Date, Date | string | undefined, Date | string>;
}

export interface SyncIncidentsTable {
  incident_id: string;
  opportunity_id: ColumnType<string | null, string | null | undefined, string | null>;
  issue_type: string;
  source: SyncIncidentSource;
  current_status: SyncIncidentStatus;
  summary: string;
  first_seen_at: Timestamptz;
  last_attempt_at: ColumnType<Date | null, Date | string | null | undefined, Date | string | null>;
  retry_count: ColumnType<number, number | undefined, number>;
  latest_context: ColumnType<JsonValue | null, JsonValue | null | undefined, JsonValue | null>;
  resolved_at: ColumnType<Date | null, Date | string | null | undefined, Date | string | null>;
}

export interface Database {
  users: UsersTable;
  product_catalog: ProductCatalogTable;
  product_aliases: ProductAliasesTable;
  business_events: BusinessEventsTable;
  opportunities_current: OpportunitiesCurrentTable;
  jobs: JobsTable;
  telegram_webhook_inbox: TelegramWebhookInboxTable;
  telegram_drafts: TelegramDraftsTable;
  workbook_locks: WorkbookLocksTable;
  workbook_state: WorkbookStateTable;
  sync_incidents: SyncIncidentsTable;
}

export type UserRow = Selectable<UsersTable>;
export type NewUser = Insertable<UsersTable>;
export type UserUpdate = Updateable<UsersTable>;

export type NewBusinessEvent = Insertable<BusinessEventsTable>;
export type BusinessEventRow = Selectable<BusinessEventsTable>;

export type OpportunityCurrentRow = Selectable<OpportunitiesCurrentTable>;
export type NewOpportunityCurrent = Insertable<OpportunitiesCurrentTable>;
export type OpportunityCurrentUpdate = Updateable<OpportunitiesCurrentTable>;

export type NewJob = Insertable<JobsTable>;
export type JobRow = Selectable<JobsTable>;
export type JobUpdate = Updateable<JobsTable>;

export type TelegramWebhookInboxRow = Selectable<TelegramWebhookInboxTable>;
export type NewTelegramWebhookInbox = Insertable<TelegramWebhookInboxTable>;
export type TelegramWebhookInboxUpdate = Updateable<TelegramWebhookInboxTable>;

export type TelegramDraftRow = Selectable<TelegramDraftsTable>;
export type NewTelegramDraft = Insertable<TelegramDraftsTable>;
export type TelegramDraftUpdate = Updateable<TelegramDraftsTable>;
