create table ops.jobs (
  job_id uuid primary key,
  job_type text not null check (nullif(btrim(job_type), '') is not null),
  status ops.job_status_enum not null default 'queued',
  correlation_id uuid,
  dedupe_key text unique,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  available_at timestamptz not null default now(),
  claimed_at timestamptz,
  lease_expires_at timestamptz,
  heartbeat_at timestamptz,
  attempts integer not null default 0 check (attempts >= 0),
  max_attempts integer not null default 10 check (max_attempts > 0),
  last_error text,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create index idx_jobs_status_available_at
  on ops.jobs (status, available_at);

create index idx_jobs_type_status_available_at
  on ops.jobs (job_type, status, available_at);

create index idx_jobs_lease_expires_at
  on ops.jobs (lease_expires_at);

create table ops.telegram_webhook_inbox (
  inbox_id bigserial primary key,
  telegram_update_id bigint not null unique,
  telegram_user_id bigint,
  correlation_id uuid not null,
  raw_payload jsonb not null check (jsonb_typeof(raw_payload) = 'object'),
  processing_status text not null check (
    processing_status in ('received', 'queued', 'processed', 'failed', 'dead')
  ),
  received_at timestamptz not null default now(),
  processed_job_id uuid references ops.jobs(job_id),
  last_error text,
  retained_until timestamptz not null
);

create index idx_telegram_webhook_inbox_status_received_at
  on ops.telegram_webhook_inbox (processing_status, received_at desc);

create table ops.telegram_drafts (
  draft_id uuid primary key,
  telegram_user_id bigint not null,
  draft_type text not null check (
    draft_type in ('new', 'update', 'conflict_review', 'set_follow_up')
  ),
  status text not null check (
    status in ('active', 'confirmed', 'cancelled', 'expired', 'discarded')
  ),
  opportunity_id text,
  base_version integer check (base_version is null or base_version >= 0),
  current_step text,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  finalized_at timestamptz,
  updated_at timestamptz not null default now()
);

create unique index idx_telegram_drafts_one_active_per_user
  on ops.telegram_drafts (telegram_user_id)
  where status = 'active';

create index idx_telegram_drafts_expires_at
  on ops.telegram_drafts (expires_at);

create table ops.workbook_locks (
  workbook_key text primary key check (nullif(btrim(workbook_key), '') is not null),
  lock_token uuid,
  locked_by_job_id uuid references ops.jobs(job_id),
  lease_expires_at timestamptz,
  heartbeat_at timestamptz,
  updated_at timestamptz not null default now()
);

create table ops.workbook_state (
  workbook_key text primary key check (nullif(btrim(workbook_key), '') is not null),
  last_success_at timestamptz,
  last_status text check (last_status in ('healthy', 'delayed', 'failed') or last_status is null),
  last_error text,
  updated_at timestamptz not null default now()
);

create table ops.sync_incidents (
  incident_id uuid primary key,
  opportunity_id text,
  issue_type text not null check (nullif(btrim(issue_type), '') is not null),
  source text not null check (source in ('sheet', 'projection', 'workbook', 'replay')),
  current_status text not null check (current_status in ('open', 'retrying', 'resolved', 'dead')),
  summary text not null check (nullif(btrim(summary), '') is not null),
  first_seen_at timestamptz not null,
  last_attempt_at timestamptz,
  retry_count integer not null default 0 check (retry_count >= 0),
  latest_context jsonb check (latest_context is null or jsonb_typeof(latest_context) = 'object'),
  resolved_at timestamptz
);

create index idx_sync_incidents_status_first_seen_at
  on ops.sync_incidents (current_status, first_seen_at desc);
