create extension if not exists citext;

create schema if not exists core;
create schema if not exists events;
create schema if not exists projections;
create schema if not exists ops;

create type core.user_role_enum as enum (
  'rep',
  'executive',
  'admin'
);

create type core.segment_code_enum as enum (
  'CI',
  'GET',
  'LVI',
  'MRM',
  'PDIX',
  'PP',
  'PT'
);

create type core.sales_stage_enum as enum (
  'identified',
  'qualified',
  'quoted',
  'negotiation',
  'waiting_po',
  'closed_won',
  'closed_lost'
);

create type core.close_precision_enum as enum (
  'day',
  'month'
);

create type core.stale_status_enum as enum (
  'fresh',
  'due_soon',
  'overdue',
  'stale'
);

create type ops.job_status_enum as enum (
  'queued',
  'claimed',
  'succeeded',
  'failed',
  'dead',
  'cancelled'
);

create type ops.sync_status_enum as enum (
  'pending',
  'retrying',
  'conflict',
  'quarantined'
);
