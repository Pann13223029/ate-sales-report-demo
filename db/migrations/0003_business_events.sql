create table events.business_events (
  event_id uuid primary key,
  idempotency_key text not null unique,
  event_type text not null check (nullif(btrim(event_type), '') is not null),
  opportunity_id text not null check (nullif(btrim(opportunity_id), '') is not null),
  actor_type text not null check (actor_type in ('user', 'system')),
  actor_user_id uuid references core.users(user_id),
  source text not null check (source in ('telegram', 'sheet', 'system', 'admin')),
  correlation_id uuid not null,
  causation_id uuid,
  base_version integer check (base_version is null or base_version >= 0),
  result_version integer not null check (result_version > 0),
  occurred_at timestamptz not null default now(),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  constraint business_events_actor_user_required_ck
    check (
      (actor_type = 'system' and actor_user_id is null)
      or (actor_type = 'user' and actor_user_id is not null)
    )
);

create index idx_business_events_opportunity_occurred_at
  on events.business_events (opportunity_id, occurred_at desc);

create index idx_business_events_correlation_id
  on events.business_events (correlation_id);

create index idx_business_events_event_type_occurred_at
  on events.business_events (event_type, occurred_at desc);
