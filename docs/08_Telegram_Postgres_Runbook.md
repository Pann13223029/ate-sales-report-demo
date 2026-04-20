# Telegram/Postgres Runbook

This is the **current** runbook for the TypeScript rebuild in [src](/Users/openclaw/ate-sales-report-demo/src).

Use this document for:

- local bring-up
- database bootstrap
- Telegram webhook registration
- root Vercel deployment shape
- Google workbook configuration
- reminder scheduler behavior
- sheet sync-back expectations

Do **not** use the old `demo/README.md` as the primary setup guide for the current app.

## 1. What This Runtime Does

`npm run serve` starts one Node process that:

- serves `GET /healthz`
- serves `GET /api/healthz`
- accepts `POST /telegram/webhook`
- accepts `POST /api/telegram/webhook`
- accepts `GET /api/cron` with cron authorization
- polls and drains async jobs
- runs the Bangkok-time scheduler

The async system handles:

- Telegram webhook processing
- Telegram outbound messages
- daily stale reminders
- operational workbook export
- executive workbook refresh
- operational sheet reconciliation

## 2. Required Environment

Copy [.env.example](/Users/openclaw/ate-sales-report-demo/.env.example) to `.env` and fill the values.

### Minimum to boot the app

- `DATABASE_URL`

With only `DATABASE_URL`, you can run migrations, typecheck, tests, and boot the server, but Telegram and Google integrations will stay inactive.

### Telegram runtime

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET`
- `PUBLIC_WEBHOOK_URL`
- `CRON_SECRET` preferred
- optional `INTERNAL_API_SECRET` alias

### Gemini parsing

- `GEMINI_API_KEY`
- optional `GEMINI_MODEL`  
  default: `gemini-2.5-flash`

If Gemini is missing, the parser falls back to the built-in heuristic parser.

### Google workbooks

- `GOOGLE_SERVICE_ACCOUNT_JSON`
- `OPERATIONAL_WORKBOOK_ID`
- `EXECUTIVE_WORKBOOK_ID`

### Operational sheet sync-back

- `SHEET_SYNC_ACTOR_USER_ID`
- optional `SHEET_SYNC_INTERVAL_MINUTES`  
  default: `5`

Important:

- sync-back does not know the real editor identity from Sheets polling
- it attributes manager-side sheet corrections to the configured `SHEET_SYNC_ACTOR_USER_ID`

### Reminder scheduler

- `REMINDER_TIMEZONE`  
  default: `Asia/Bangkok`
- `REMINDER_DAILY_HOUR`  
  default: `8`
- `REMINDER_DAILY_MINUTE`  
  default: `30`

## 3. Bootstrap

Install dependencies:

```bash
npm install
```

Run migrations:

```bash
npm run db:migrate
```

Verify static checks:

```bash
npm run typecheck
npm test
```

## 4. Start the App

```bash
npm run serve
```

Expected local behavior:

- server listens on `PORT` (default `3000`)
- scheduler loop starts
- job drain loop starts

Health check:

```bash
curl http://localhost:3000/healthz
```

Hosted-compatible local health check:

```bash
curl http://localhost:3000/api/healthz
```

Expected response:

```json
{"ok":true,"status":"healthy"}
```

## 5. Register Telegram Webhook

Inspect current webhook config:

```bash
npm run telegram:webhook info
```

Set webhook:

```bash
npm run telegram:webhook set https://your-public-host
```

Delete webhook:

```bash
npm run telegram:webhook delete
```

The app expects Telegram POSTs at:

```text
/api/telegram/webhook
```

The runtime validates the configured webhook secret header before accepting the request.

Note:

- the local dev server accepts both:
  - `POST /telegram/webhook`
  - `POST /api/telegram/webhook`
- the root hosted Vercel path is `POST /api/telegram/webhook`
- `npm run telegram:webhook set ...` now defaults to the hosted `/api/telegram/webhook` path

## 6. Database Contract

Canonical database layout:

- `core`
- `events`
- `projections`
- `ops`

Main contract:

- confirmed business writes go to `events.business_events`
- the same transaction updates `projections.opportunities_current`
- downstream work is queued into `ops.jobs`

See [db/README.md](/Users/openclaw/ate-sales-report-demo/db/README.md) and `db/migrations/*`.

## 7. Workbook Behavior

Two workbooks are expected:

### Operational workbook

Tabs:

- `Instructions`
- `Opportunities_Operational`

Behavior:

- generated from current Postgres projection
- open opportunities only
- row-level `Sync Status` surface
- supports manager correction polling/reconciliation

### Executive workbook

Tabs:

- `Guide`
- `Opportunities_Management`
- `Closed_Opportunities`

Behavior:

- read-only reporting surface
- full-tab rewrite refresh
- includes freshness and refresh status

## 8. Scheduler Behavior

The scheduler is polled by the running app.

It can enqueue:

- daily stale reminder batches
- periodic operational sheet reconciliation jobs

You can also run the scheduler once manually:

```bash
npm run worker:run-scheduler
```

Or enqueue reminder work directly:

```bash
npm run worker:enqueue-daily-reminders
```

## 9. Manager Sheet Sync-Back

Operational sheet sync-back is currently a **poll/reconcile** workflow.

Behavior:

- reads `Opportunities_Operational`
- diffs sheet rows against `projections.opportunities_current`
- converts valid edits into `manager_sheet_correction` business events
- unresolved invalid/conflicting rows become sync incidents
- canonical workbook projection can overwrite invalid rows back to DB truth

Important current limitation:

- this is not an Apps Script edit-trigger system yet
- attribution is configured actor-based, not true per-editor attribution

## 10. Manual Workers

Useful one-shot commands:

```bash
npm run worker:drain-jobs
npm run worker:process-webhooks
npm run worker:run-runtime-tick
npm run worker:send-telegram-messages
npm run worker:run-scheduler
```

`npm run worker:run-runtime-tick` is the closest local equivalent to hitting `/api/cron` once.

In normal local bring-up, `npm run serve` already handles the main polling loops.

## 11. Root Vercel Deployment

The repo root now exposes current Vercel Functions under [api](/Users/openclaw/ate-sales-report-demo/api):

- `/api/healthz`
- `/api/telegram/webhook`
- `/api/cron`

`/api/cron` runs one scheduler + job-drain tick and is intended for:

- Vercel cron invocation
- manual secure ticking
- external pingers if you want extra background progress between user webhooks

Authorization for `/api/cron`:

- if `CRON_SECRET` or `INTERNAL_API_SECRET` is set, send either:
  - `Authorization: Bearer <secret>`
  - `X-Cron-Secret: <secret>`
- if no secret is set, the endpoint only trusts Vercel cron user agent `vercel-cron/1.0`

Local example:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron
```

Current root [vercel.json](/Users/openclaw/ate-sales-report-demo/vercel.json) is for the rebuild.
Legacy Vercel config is preserved in [demo/vercel.json](/Users/openclaw/ate-sales-report-demo/demo/vercel.json).

The repo does not hardcode a high-frequency Vercel cron in `vercel.json`.
That is deliberate: Vercel officially limits Hobby cron jobs to `once per day`, while `5-minute` cadence requires a higher plan.
For the current path, the repository provides [../.github/workflows/runtime-tick.yml](/Users/openclaw/ate-sales-report-demo/.github/workflows/runtime-tick.yml), which hits `/api/cron` every `5 minutes`.
Reminder business timing is still unchanged: the scheduler only enqueues daily stale reminders once the Bangkok clock passes `08:30`.

GitHub configuration required for `runtime-tick.yml`:

- repository variable: `APP_BASE_URL`
- repository secret: `CRON_SECRET`

The workflow is designed to skip cleanly until both values are configured.

## 12. Recommended Bring-Up Sequence

Use this exact sequence for the first live validation:

1. Fill `.env`
2. Run `npm install`
3. Run `npm run db:migrate`
4. Run `npm run typecheck`
5. Run `npm test`
6. Run `npm run serve`
7. Register webhook with `npm run telegram:webhook set ...`
8. Send one new Telegram report
9. Confirm one update via `/mydeals`
10. Verify:
   - business event written
   - `projections.opportunities_current` updated
   - operational workbook row exported
   - executive workbook refresh occurs
11. Test one manager sheet edit and verify a `manager_sheet_correction` event

## 13. Legacy Warning

The following files are still legacy/demo-era and should not be treated as the primary operator path for the current runtime:

- [demo/README.md](/Users/openclaw/ate-sales-report-demo/demo/README.md)
- [ARCHITECTURE.md](/Users/openclaw/ate-sales-report-demo/ARCHITECTURE.md)
- [vercel.json](/Users/openclaw/ate-sales-report-demo/vercel.json)
- [requirements.txt](/Users/openclaw/ate-sales-report-demo/requirements.txt)

They are kept for reference while the repo completes the migration.
