import { Kysely, PostgresDialect } from 'kysely';
import { newDb } from 'pg-mem';

import type { Database } from '../db/schema.js';

const SCHEMA_STATEMENTS = [
  'create schema core',
  'create schema events',
  'create schema projections',
  'create schema ops',
  `
    create sequence core.opportunity_number_seq
      as bigint
      start with 1
      increment by 1
  `,
  `
    create sequence "core.opportunity_number_seq"
      as bigint
      start with 1
      increment by 1
  `,
  `
    create sequence opportunity_number_seq
      as bigint
      start with 1
      increment by 1
  `,
  `
    create table core.users (
      user_id text primary key,
      role text not null,
      owner_name text not null,
      email text not null unique,
      telegram_user_id bigint unique,
      active boolean not null default true,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `,
  `
    create table core.product_catalog (
      product_id text primary key,
      canonical_name text not null,
      product_normalized text not null unique,
      segment_code text not null,
      active boolean not null default true,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `,
  `
    create table core.product_aliases (
      alias_id text primary key,
      product_id text not null references core.product_catalog(product_id) on delete cascade,
      alias_raw text not null,
      alias_normalized text not null unique,
      created_at timestamptz not null default now()
    )
  `,
  `
    create table events.business_events (
      event_id text primary key,
      idempotency_key text not null unique,
      event_type text not null,
      opportunity_id text not null,
      actor_type text not null,
      actor_user_id text references core.users(user_id),
      source text not null,
      correlation_id text not null,
      causation_id text,
      base_version integer,
      result_version integer not null,
      occurred_at timestamptz not null default now(),
      payload json not null
    )
  `,
  `
    create table projections.opportunities_current (
      opportunity_id text primary key,
      current_version integer not null,
      owner_user_id text not null references core.users(user_id),
      owner_name text not null,
      customer_raw text not null,
      customer_normalized text not null,
      contact_person text not null,
      contact_channel text not null,
      product_raw text not null,
      product_normalized text not null,
      product_segment_code text not null,
      segment_source text not null,
      quantity integer not null,
      value_eur_k numeric(14,2) not null,
      sales_stage text not null,
      probability_pct smallint not null,
      expected_close_date text not null,
      expected_close_precision text not null,
      next_follow_up_date text,
      stale_status text not null,
      competitor_raw text,
      stage_note text,
      follow_up_note text,
      lost_reason text,
      lost_reason_note text,
      win_note text,
      reopen_note text,
      register_date text not null,
      last_activity_at timestamptz not null,
      closed_at timestamptz,
      last_reminder_sent_at timestamptz,
      stale_count integer not null default 0,
      sync_version bigint not null default 1,
      source text not null,
      created_by_user_id text not null references core.users(user_id),
      updated_by_user_id text not null references core.users(user_id),
      last_event_id text not null references events.business_events(event_id),
      created_at timestamptz not null,
      updated_at timestamptz not null
    )
  `,
  `
    create table ops.jobs (
      job_id text primary key,
      job_type text not null,
      status text not null default 'queued',
      correlation_id text,
      dedupe_key text unique,
      payload json not null,
      available_at timestamptz not null default now(),
      claimed_at timestamptz,
      lease_expires_at timestamptz,
      heartbeat_at timestamptz,
      attempts integer not null default 0,
      max_attempts integer not null default 10,
      last_error text,
      created_at timestamptz not null default now(),
      finished_at timestamptz
    )
  `
] as const;

export interface IntegrationDatabase {
  db: Kysely<Database>;
  destroy: () => Promise<void>;
}

export async function createIntegrationDatabase(): Promise<IntegrationDatabase> {
  const memoryDb = newDb({
    autoCreateForeignKeyIndices: true
  });
  const { Pool } = memoryDb.adapters.createPg();
  const pool = new Pool();
  const db = new Kysely<Database>({
    dialect: new PostgresDialect({ pool })
  });

  for (const statement of SCHEMA_STATEMENTS) {
    await pool.query(statement);
  }

  return {
    db,
    destroy: async () => {
      await db.destroy();
    }
  };
}
