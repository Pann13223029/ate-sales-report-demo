# Pilot Runbook

This is the runbook for the **first live pilot** of the `Telegram + Postgres + Google Sheets + TypeScript` rebuild.

Use this only after the steps in [08_Telegram_Postgres_Runbook.md](/Users/openclaw/ate-sales-report-demo/docs/08_Telegram_Postgres_Runbook.md) have passed.

The target pilot shape is:

- `2 reps`
- `you` as `admin`
- `Head of Sales` as the only operational workbook editor besides you
- `MD` as executive workbook viewer only

## 1. Pilot Goal

The pilot is not a scale test.

The goal is to prove:

- reps can create and update opportunities reliably through Telegram
- reminders drive action instead of noise
- current-state projection stays correct
- manager sheet corrections do not corrupt state
- the operational model is usable day to day

Success is measured by correctness first, then UX friction.

## 2. Roles

### Admin

`You`

Own:

- env and deployment
- database and workbook setup
- runtime monitoring
- sync incident review
- retry/replay if needed
- product catalog additions

### Operational manager

`Head of Sales`

Own:

- reviewing the executive workbook
- making allowed single-row corrections in the operational workbook
- reporting any confusing rep flows or workbook issues

### Executive viewer

`MD`

Own:

- reading the executive workbook only
- reporting visibility/reporting gaps

### Pilot reps

`Rep One`, `Rep Two`

Own:

- new opportunity creation in Telegram
- updates through `/mydeals`, reminder buttons, and guided draft flow
- reporting unclear parsing or confirmation behavior immediately

## 3. Pilot Scope

Allowed in pilot:

- `new opportunity`
- `update`
- `set follow-up`
- `close lost`
- `/mydeals`
- daily stale reminders
- operational workbook correction by `you + Head of Sales`
- executive workbook viewing by `you + Head of Sales + MD`

Explicitly out of scope:

- broad team rollout
- direct rep access to Sheets
- advanced admin UI workflows
- reopen-heavy historical cleanup
- large-scale catalog reclassification

## 4. Daily Operator Checklist

Run this once at the start of each business day.

### Admin checklist

1. Confirm hosted app health.
2. Confirm `runtime-tick` is still executing.
3. Check for failed jobs.
4. Check for sync incidents.
5. Check reminder delivery for the day after `08:30 Asia/Bangkok`.

Useful queries:

```sql
select job_type, status, count(*)
from ops.jobs
group by 1, 2
order by 1, 2;

select *
from ops.sync_incidents
where current_status in ('open', 'retrying', 'dead')
order by first_seen_at desc
limit 20;

select opportunity_id, owner_name, stale_status, last_reminder_sent_at, stale_count
from projections.opportunities_current
where sales_stage not in ('closed_won', 'closed_lost')
order by updated_at desc
limit 20;
```

### Head of Sales checklist

1. Open `Opportunities_Management`.
2. Check `Last Refreshed At` and `Refresh Status`.
3. Review stale and high-priority opportunities.
4. If a correction is needed, use only `Opportunities_Operational`.
5. Edit one row only, never multi-row paste.

### Rep checklist

1. Use Telegram only.
2. Create new opportunities one deal per message.
3. Use `/mydeals` for updates.
4. Use reminder buttons when prompted.
5. Report any confusing draft or confirmation flow.

## 5. Allowed Operational Workbook Behavior

Operational workbook rules remain strict during pilot:

- edit `single rows only`
- white columns only
- never bulk paste
- never reorder tabs
- never insert or delete columns
- treat `Conflict` / `Quarantined` as operator attention signals

If a row shows `Conflict` or `Quarantined`:

1. stop editing that row
2. let the row refresh/revert
3. check the latest incident
4. retry with one clean single-row edit only if the cause is understood

## 6. Pilot KPIs

Track these daily during pilot:

- number of new opportunities created
- number of successful Telegram updates
- number of draft abandonments
- number of parser clarification turns per successful create
- number of reminders sent
- number of reminder-driven updates
- number of manager sheet corrections
- number of sync incidents
- number of stale-version conflicts
- number of uncataloged product mentions

## 7. Blockers

Treat these as `pilot blockers`:

- Telegram webhook is down
- jobs stop draining
- reminders stop sending
- workbook refresh status stays `Failed`
- operational workbook corrections are not writing business events
- invalid sheet edits are not reverting safely
- repeated duplicate opportunity creation from one message flow
- version conflicts silently overwrite data

If a blocker happens:

1. pause new pilot onboarding immediately
2. keep usage limited to existing users only if safe
3. capture the exact incident and timestamp
4. review `ops.jobs`, `ops.sync_incidents`, and latest `business_events`

## 8. Soft Issues

These are not blockers by themselves, but should be logged:

- parser asks for one extra clarification more than expected
- reminder copy feels noisy
- workbook column ordering feels awkward
- executives want a better summary view
- one product alias is missing

Soft issues become hard issues only if they repeat enough to affect daily usage.

## 9. Incident Triage Order

Use this order when something is wrong:

1. `Is the webhook or app unreachable?`
2. `Are jobs backing up?`
3. `Did the business event write succeed?`
4. `Did projections update?`
5. `Did workbook export fail?`
6. `Was the issue caused by sheet correction polling?`
7. `Is this parser friction rather than system failure?`

Useful queries:

```sql
select event_type, opportunity_id, source, result_version, occurred_at
from events.business_events
order by occurred_at desc
limit 30;

select opportunity_id, current_version, sales_stage, stale_status, updated_at
from projections.opportunities_current
order by updated_at desc
limit 30;

select job_type, status, attempts, last_error, created_at
from ops.jobs
order by created_at desc
limit 50;
```

## 10. End Of Day Review

At end of each pilot day, review:

1. open incidents
2. failed jobs
3. reminder sends
4. number of rep creates/updates
5. any product alias gaps
6. any confusing rep feedback

Capture a short summary:

- what worked
- what broke
- what repeated
- whether the next day should continue unchanged

## 11. Pilot Exit Criteria

Pilot is ready to expand only if all of these are true for several consecutive days:

- create/update flows are stable
- no silent data-loss behavior observed
- reminders are functioning normally
- workbook refreshes remain healthy
- manager sheet corrections work safely
- uncataloged product volume is manageable
- rep confusion is low enough that support overhead is reasonable

If these are not true, stay in pilot and fix the highest-frequency issues first.
