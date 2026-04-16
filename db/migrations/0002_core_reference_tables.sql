create sequence core.opportunity_number_seq
  as bigint
  start with 1
  increment by 1
  minvalue 1
  no maxvalue
  cache 1;

create table core.users (
  user_id uuid primary key,
  role core.user_role_enum not null,
  owner_name text not null check (nullif(btrim(owner_name), '') is not null),
  email citext not null unique check (nullif(btrim(email::text), '') is not null),
  telegram_user_id bigint unique,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_users_role_active on core.users (role, active);
create index idx_users_telegram_user_id_active on core.users (telegram_user_id, active)
  where telegram_user_id is not null;

create table core.product_catalog (
  product_id uuid primary key,
  canonical_name text not null check (nullif(btrim(canonical_name), '') is not null),
  product_normalized text not null unique check (nullif(btrim(product_normalized), '') is not null),
  segment_code core.segment_code_enum not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_product_catalog_segment_active
  on core.product_catalog (segment_code, active);

create table core.product_aliases (
  alias_id uuid primary key,
  product_id uuid not null references core.product_catalog(product_id) on delete cascade,
  alias_raw text not null check (nullif(btrim(alias_raw), '') is not null),
  alias_normalized text not null unique check (nullif(btrim(alias_normalized), '') is not null),
  created_at timestamptz not null default now()
);

create index idx_product_aliases_product_id on core.product_aliases (product_id);
