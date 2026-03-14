# ATE Sales Report System — Stale Deal Cron Setup Guide

> **Created:** 2026-03-15
> **For:** Weekly stale deal push notifications via `/api/stale-check`

---

## Overview

The stale deal check runs weekly (every Monday morning) and pushes LINE notifications to each rep listing their deals with no updates in 7+ days. This is triggered by an external cron hitting the Vercel endpoint.

---

## Prerequisites

1. **CRON_SECRET** env var set in Vercel — any random string for authentication
2. **LINE push messages** — uses the free tier (200 push/month). Each rep gets 1 message per week.
3. **Rep Registry** — auto-populated when reps send messages to the bot. No manual setup needed.

---

## Option A: GitHub Actions (Recommended — Free)

### Step 1: Create workflow file

In your GitHub repo, create `.github/workflows/stale-check.yml`:

```yaml
name: Weekly Stale Deal Check

on:
  schedule:
    # Every Monday at 8:00 AM Bangkok time (1:00 AM UTC)
    - cron: '0 1 * * 1'
  workflow_dispatch: # Allow manual trigger for testing

jobs:
  stale-check:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger stale deal check
        run: |
          curl -s -f -X GET \
            -H "X-Cron-Secret: ${{ secrets.CRON_SECRET }}" \
            "${{ secrets.STALE_CHECK_URL }}" \
            | jq .
```

### Step 2: Add GitHub Secrets

Go to your repo → Settings → Secrets and variables → Actions → New repository secret:

| Secret | Value |
|--------|-------|
| `CRON_SECRET` | Same value as your Vercel `CRON_SECRET` env var |
| `STALE_CHECK_URL` | `https://your-app.vercel.app/api/stale-check` |

### Step 3: Add CRON_SECRET to Vercel

```bash
# Via Vercel CLI
vercel env add CRON_SECRET

# Or via Vercel Dashboard:
# Project → Settings → Environment Variables → Add
```

### Step 4: Test manually

Go to GitHub → Actions → "Weekly Stale Deal Check" → Run workflow → Run workflow

Check the output for the JSON response:
```json
{
  "status": "ok",
  "stale_deals": 5,
  "reps_notified": 3,
  "reps_with_stale": ["สมชาย", "วิภา", "ธนกฤต"],
  "timestamp": "2026-03-17T08:00:05+07:00"
}
```

---

## Option B: cron-job.org (Free alternative)

1. Go to [cron-job.org](https://cron-job.org) and create a free account
2. Create new cron job:
   - **URL:** `https://your-app.vercel.app/api/stale-check`
   - **Schedule:** Every Monday at 08:00
   - **Request method:** GET
   - **Headers:** Add `X-Cron-Secret: your-secret-here`
3. Save and enable

---

## Option C: curl from any server

If you have access to a Linux server with crontab:

```bash
# Edit crontab
crontab -e

# Add this line (runs every Monday at 8:00 AM Bangkok time)
0 8 * * 1 curl -s -H "X-Cron-Secret: your-secret-here" https://your-app.vercel.app/api/stale-check >> /var/log/stale-check.log 2>&1
```

---

## Endpoint Reference

### `GET /api/stale-check`

**Headers:**
| Header | Required | Description |
|--------|----------|-------------|
| `X-Cron-Secret` | Yes (if CRON_SECRET env var is set) | Must match the `CRON_SECRET` environment variable |

**Success Response (200):**
```json
{
  "status": "ok",
  "stale_deals": 5,
  "reps_notified": 3,
  "reps_with_stale": ["สมชาย", "วิภา"],
  "timestamp": "2026-03-17T08:00:05+07:00"
}
```

**No stale deals (200):**
```json
{
  "status": "ok",
  "message": "No stale deals found",
  "stale_count": 0
}
```

**Unauthorized (401):**
```json
{
  "error": "unauthorized"
}
```

---

## What reps receive

Each rep gets a personal LINE push message listing their stale deals:

```
📋 คุณมี 3 ดีลที่ไม่มีอัพเดท 7+ วัน:

1. PTT / Megger MTO330 / ฿3,050,000 (12 วัน)
   📝 MSG-A1B2C
2. IRPC / Megger DLRO200 / ฿1,450,000 (9 วัน)
   📝 MSG-D4E5F
3. กฟภ. / Salisbury Insulating Gloves / ฿425,000 (7 วัน)
   📝 MSG-G6H7I

พิมพ์อัพเดทได้เลยครับ เช่น:
อัพเดท MSG-A1B2C สถานะเจรจา ราคา...
อัพเดท MSG-A1B2C job_expired ลูกค้าตัดงบ
```

---

## LINE Push Message Limits

| Plan | Free pushes/month | Cost |
|------|-------------------|------|
| Free | 200 | ฿0 |
| Light | 5,000 | ฿0 (promotional) |

With 6 reps × 4 Mondays = 24 pushes/month. Well within the free tier.

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| 401 Unauthorized | Check CRON_SECRET matches in both Vercel and GitHub Secrets |
| No reps notified | Reps must message the bot at least once to register their LINE user ID |
| Deals not detected as stale | Check that Timestamp column has valid dates (`YYYY-MM-DD HH:MM:SS` format) |
| Push fails for specific rep | Check Rep Registry tab — user ID must be valid. Rep may have blocked the bot |
