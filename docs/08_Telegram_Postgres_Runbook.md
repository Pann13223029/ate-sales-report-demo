# Telegram/Postgres Runbook

This is the **current** runbook for the TypeScript rebuild in [src](/Users/openclaw/ate-sales-report-demo/src).

Use this document for:

- local bring-up
- database bootstrap
- Telegram webhook registration
- Google workbook configuration
- reminder scheduler behavior
- sheet sync-back expectations

Do **not** use the old `demo/README.md` as the primary setup guide for the current app.

## 1. What This Runtime Does

`npm run serve` starts one Node process that:

- serves `GET /healthz`
- accepts `POST /telegram/webhook`
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
/telegram/webhook
```

The runtime validates the configured webhook secret header before accepting the request.

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
npm run worker:send-telegram-messages
npm run worker:run-scheduler
```

In normal local bring-up, `npm run serve` already handles the main polling loops.

## 11. Recommended Bring-Up Sequence

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

## 12. Legacy Warning

The following files are still legacy/demo-era and should not be treated as the primary operator path for the current runtime:

- [demo/README.md](/Users/openclaw/ate-sales-report-demo/demo/README.md)
- [ARCHITECTURE.md](/Users/openclaw/ate-sales-report-demo/ARCHITECTURE.md)
- [vercel.json](/Users/openclaw/ate-sales-report-demo/vercel.json)
- [requirements.txt](/Users/openclaw/ate-sales-report-demo/requirements.txt)

They are kept for reference while the repo completes the migration.
