# Database Foundation

This directory contains the SQL-first v2 foundation for the Telegram + Postgres rebuild.

The repo root now reflects the current rebuild, but older architecture and demo docs are still retained for reference. Treat the files in `db/migrations/` as the canonical starting point for the new system contract.

## Migration Order

Apply the migrations in lexical order:

1. `0001_extensions_and_enums.sql`
2. `0002_core_reference_tables.sql`
3. `0003_business_events.sql`
4. `0004_current_projection.sql`
5. `0005_ops_tables.sql`

The TypeScript migration runner reads these files directly:

```bash
npm run db:migrate
```

## Design Intent

- `core`: reference data and stable identities
- `events`: append-only business history
- `projections`: current-state read model and SQL views
- `ops`: drafts, ingress, jobs, workbook coordination, and incident tracking

The main contract is:

- confirmed business actions write to `events.business_events`
- the same transaction updates `projections.opportunities_current`
- downstream work such as workbook sync, reminder dispatch, and reconciliation runs asynchronously through `ops.jobs`

## Notes

- These migrations target PostgreSQL and assume `citext` is available.
- IDs such as `event_id`, `job_id`, and `user_id` are application-assigned UUIDs.
- `core.opportunity_number_seq` exists for generating human-friendly IDs such as `OPP-000042` in application code.
- Applied migrations are tracked in `public.schema_migrations` so bootstrap can run before the app schemas exist.
