create table projections.opportunities_current (
  opportunity_id text primary key check (nullif(btrim(opportunity_id), '') is not null),
  current_version integer not null check (current_version > 0),
  owner_user_id uuid not null references core.users(user_id),
  owner_name text not null check (nullif(btrim(owner_name), '') is not null),

  customer_raw text not null check (nullif(btrim(customer_raw), '') is not null),
  customer_normalized text not null check (nullif(btrim(customer_normalized), '') is not null),

  contact_person text not null check (nullif(btrim(contact_person), '') is not null),
  contact_channel text not null check (nullif(btrim(contact_channel), '') is not null),

  product_raw text not null check (nullif(btrim(product_raw), '') is not null),
  product_normalized text not null check (nullif(btrim(product_normalized), '') is not null),
  product_segment_code core.segment_code_enum not null,
  segment_source text not null check (segment_source in ('catalog', 'manual')),

  quantity integer not null check (quantity > 0),
  value_eur_k numeric(14,2) not null check (value_eur_k > 0),

  sales_stage core.sales_stage_enum not null,
  probability_pct smallint not null check (probability_pct in (0, 5, 25, 50, 75, 90, 100)),

  expected_close_date date not null,
  expected_close_precision core.close_precision_enum not null,

  next_follow_up_date date,
  stale_status core.stale_status_enum not null,

  competitor_raw text,

  stage_note text,
  follow_up_note text,
  lost_reason text,
  lost_reason_note text,
  win_note text,
  reopen_note text,

  register_date date not null,
  last_activity_at timestamptz not null,
  closed_at timestamptz,
  last_reminder_sent_at timestamptz,
  stale_count integer not null default 0 check (stale_count >= 0),
  sync_version bigint not null default 1 check (sync_version > 0),

  source text not null check (source in ('telegram', 'sheet', 'system', 'admin')),
  created_by_user_id uuid not null references core.users(user_id),
  updated_by_user_id uuid not null references core.users(user_id),
  last_event_id uuid not null references events.business_events(event_id),
  created_at timestamptz not null,
  updated_at timestamptz not null,

  constraint opportunities_current_month_precision_ck
    check (
      expected_close_precision <> 'month'
      or extract(day from expected_close_date) = 1
    ),

  constraint opportunities_current_stage_note_required_ck
    check (
      sales_stage not in ('negotiation', 'waiting_po')
      or nullif(btrim(stage_note), '') is not null
    ),

  constraint opportunities_current_stage_probability_ck
    check (
      (sales_stage = 'identified' and probability_pct = 5)
      or (sales_stage = 'qualified' and probability_pct = 25)
      or (sales_stage = 'quoted' and probability_pct = 50)
      or (sales_stage = 'negotiation' and probability_pct = 75)
      or (sales_stage = 'waiting_po' and probability_pct = 90)
      or (sales_stage = 'closed_won' and probability_pct = 100)
      or (sales_stage = 'closed_lost' and probability_pct = 0)
    ),

  constraint opportunities_current_win_note_required_ck
    check (
      sales_stage <> 'closed_won'
      or nullif(btrim(win_note), '') is not null
    ),

  constraint opportunities_current_lost_reason_required_ck
    check (
      sales_stage <> 'closed_lost'
      or nullif(btrim(lost_reason), '') is not null
    ),

  constraint opportunities_current_closed_at_consistency_ck
    check (
      (
        sales_stage in ('closed_won', 'closed_lost')
        and closed_at is not null
      )
      or (
        sales_stage not in ('closed_won', 'closed_lost')
        and closed_at is null
      )
    )
);

create index idx_opportunities_current_owner_stage
  on projections.opportunities_current (owner_user_id, sales_stage);

create index idx_opportunities_current_expected_close_date
  on projections.opportunities_current (expected_close_date);

create index idx_opportunities_current_next_follow_up_date
  on projections.opportunities_current (next_follow_up_date);

create index idx_opportunities_current_stale_status
  on projections.opportunities_current (stale_status);

create index idx_opportunities_current_closed_at
  on projections.opportunities_current (closed_at desc);

create view projections.opportunities_open_view as
select *
from projections.opportunities_current
where sales_stage not in ('closed_won', 'closed_lost');

create view projections.opportunities_closed_view as
select *
from projections.opportunities_current
where sales_stage in ('closed_won', 'closed_lost');
