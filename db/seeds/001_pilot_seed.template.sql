-- Pilot seed template for the Telegram/Postgres rebuild.
--
-- Usage:
-- 1. Copy this file to a private local variant, for example:
--      db/seeds/001_pilot_seed.local.sql
-- 2. Replace placeholder names, emails, UUIDs, and Telegram user IDs.
-- 3. Run it against the same database used by DATABASE_URL.
--
-- Notes:
-- - Keep UUIDs stable once chosen.
-- - SHEET_SYNC_ACTOR_USER_ID should point at your admin user UUID.
-- - telegram_user_id must be the real numeric Telegram user ID for each rep.

begin;

-- Core users
insert into core.users (
  user_id,
  role,
  owner_name,
  email,
  telegram_user_id,
  active
) values
  ('11111111-1111-1111-1111-111111111111', 'admin', 'Your Name', 'you@example.com', null, true),
  ('22222222-2222-2222-2222-222222222222', 'executive', 'Head of Sales', 'hos@example.com', null, true),
  ('33333333-3333-3333-3333-333333333333', 'executive', 'MD', 'md@example.com', null, true),
  ('44444444-4444-4444-4444-444444444444', 'rep', 'Rep One', 'rep1@example.com', 123456789, true),
  ('55555555-5555-5555-5555-555555555555', 'rep', 'Rep Two', 'rep2@example.com', 987654321, true)
on conflict (user_id) do update
set
  role = excluded.role,
  owner_name = excluded.owner_name,
  email = excluded.email,
  telegram_user_id = excluded.telegram_user_id,
  active = excluded.active,
  updated_at = now();

-- Product catalog
insert into core.product_catalog (
  product_id,
  canonical_name,
  product_normalized,
  segment_code,
  active
) values
  ('aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'TRAX280', 'trax280', 'PT', true),
  ('aaaaaaa2-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 'MTO330', 'mto330', 'PT', true),
  ('aaaaaaa3-aaaa-aaaa-aaaa-aaaaaaaaaaa3', 'DELTA4110', 'delta4110', 'PP', true),
  ('aaaaaaa4-aaaa-aaaa-aaaa-aaaaaaaaaaa4', 'MIT525', 'mit525', 'GET', true),
  ('aaaaaaa5-aaaa-aaaa-aaaa-aaaaaaaaaaa5', 'DLRO10X', 'dlro10x', 'GET', true)
on conflict (product_normalized) do update
set
  canonical_name = excluded.canonical_name,
  segment_code = excluded.segment_code,
  active = excluded.active,
  updated_at = now();

-- Product aliases
insert into core.product_aliases (
  alias_id,
  product_id,
  alias_raw,
  alias_normalized
) values
  ('bbbbbbb1-bbbb-bbbb-bbbb-bbbbbbbbbbb1', 'aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'TRAX 280', 'trax 280'),
  ('bbbbbbb2-bbbb-bbbb-bbbb-bbbbbbbbbbb2', 'aaaaaaa2-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 'MTO-330', 'mto-330'),
  ('bbbbbbb3-bbbb-bbbb-bbbb-bbbbbbbbbbb3', 'aaaaaaa3-aaaa-aaaa-aaaa-aaaaaaaaaaa3', 'DELTA 4110', 'delta 4110'),
  ('bbbbbbb4-bbbb-bbbb-bbbb-bbbbbbbbbbb4', 'aaaaaaa4-aaaa-aaaa-aaaa-aaaaaaaaaaa4', 'MIT 525', 'mit 525'),
  ('bbbbbbb5-bbbb-bbbb-bbbb-bbbbbbbbbbb5', 'aaaaaaa5-aaaa-aaaa-aaaa-aaaaaaaaaaa5', 'DLRO 10X', 'dlro 10x')
on conflict (alias_normalized) do update
set
  alias_raw = excluded.alias_raw;

commit;
