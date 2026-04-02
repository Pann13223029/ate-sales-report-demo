# ATE Sales Report Bot — Production Migration Plan

> **Document Version:** 1.0
> **Date:** 2026-04-02
> **Prepared by:** Engineering Team (synthesized from 6-expert panel review)
> **Audience:** Management, IT Admin, Sales Manager, Developer
> **Status:** Approved for execution

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Why Migrate?](#2-why-migrate)
3. [What Changes for End Users?](#3-what-changes-for-end-users)
4. [Pre-Migration Checklist (Organizational Tasks)](#4-pre-migration-checklist)
5. [Technical Changes — Priority 0 (Must Complete Before Launch)](#5-technical-changes--priority-0)
6. [Technical Changes — Priority 1 (First 2 Weeks After Launch)](#6-technical-changes--priority-1)
7. [Technical Changes — Priority 2 (First Month After Launch)](#7-technical-changes--priority-2)
8. [Infrastructure & Configuration](#8-infrastructure--configuration)
9. [Rollout Plan & Timeline](#9-rollout-plan--timeline)
10. [Cost Summary](#10-cost-summary)
11. [Data & Privacy (PDPA Compliance)](#11-data--privacy-pdpa-compliance)
12. [Account Ownership & Access Control](#12-account-ownership--access-control)
13. [Business Continuity & Knowledge Transfer](#13-business-continuity--knowledge-transfer)
14. [Monitoring, Alerting & Incident Response](#14-monitoring-alerting--incident-response)
15. [Risk Register](#15-risk-register)
16. [Success Metrics](#16-success-metrics)
17. [Key Decisions & Rationale](#17-key-decisions--rationale)
18. [Frequently Asked Questions (FAQ)](#18-frequently-asked-questions)
19. [Appendix A: Rollout Communication Templates](#appendix-a-rollout-communication-templates)
20. [Appendix B: Secret Rotation Schedule](#appendix-b-secret-rotation-schedule)
21. [Appendix C: File Change Summary](#appendix-c-file-change-summary)

---

## 1. Executive Summary

The ATE Sales Report Bot has been running as a **personal demo** on free-tier accounts since March 2026. It has proven the concept: LINE chat in, structured data out, live dashboard updated — at zero cost.

This document is the plan to migrate the bot from the developer's personal accounts to **ATE company-owned infrastructure** and make it the production sales reporting tool for **11 field sales representatives**.

### What stays the same

- The bot works exactly the same way for sales reps — they send Thai messages in LINE, get confirmations back
- Google Sheets remains the database (no migration needed)
- Looker Studio dashboard continues to work
- Total monthly cost remains under **700 THB/month** (~$20 USD)

### What changes

- All accounts move from personal ownership to **company ownership**
- Security is hardened for real business data
- The system is configured to handle production traffic reliably
- PDPA (Thai data privacy law) compliance is addressed
- Monitoring and alerting are added so problems are detected before reps notice

### Timeline

**4 weeks total:**
- Week -1: Preparation (accounts, compliance docs, code changes)
- Week 0: Production launch (phased rollout to reps)
- Weeks 1-2: Hardening and monitoring
- Weeks 3-4: Enhancements and dashboard polish

---

## 2. Why Migrate?

### The demo served its purpose — now it needs to be real

| Aspect | Demo (Current) | Production (Target) |
|--------|---------------|-------------------|
| **Account ownership** | Developer's personal accounts | ATE company accounts |
| **Vercel plan** | Hobby (free) — ToS prohibits commercial use | Pro ($20/mo) — commercial use allowed |
| **If developer leaves** | System becomes inaccessible | Company retains full control |
| **Data privacy** | No PDPA compliance | Privacy notice, retention policy, data processing agreements |
| **Monitoring** | No alerts — problems discovered by reps complaining | Automated health checks and failure alerts |
| **Security** | Basic (demo-grade) | Production-grade: API key protection, user allowlist, formula injection defense |
| **Reliability** | No retries, no failover logging | Retry logic, graceful degradation, structured logging |

### The business case is simple

The entire annual cost of running this system (~8,400 THB) is less than **6% of the smallest deal** tracked in the pipeline (150,000 THB). A single deal that closes because of better pipeline visibility pays for **17 years** of infrastructure.

---

## 3. What Changes for End Users?

### For sales reps: Almost nothing

| What | Before | After |
|------|--------|-------|
| How to report | Send LINE message — same | Send LINE message — same |
| Bot replies | Thai confirmation — same | Thai confirmation — same |
| Rich Menu buttons | 3 buttons — same | 3 buttons — same |
| Sending photos | Bot ignores silently | Bot politely asks for text instead |
| Sending stickers | Bot ignores silently | Bot politely asks for text instead |
| Very long messages | Processed (could be slow) | Rejected if over 2,000 characters (with helpful message) |
| Batch ID format | MSG-XXXXXXXX — same | MSG-XXXXXXXX — same |

### For the sales manager

| What | Before | After |
|------|--------|-------|
| Dashboard | Looker Studio (linked to demo sheet) | Looker Studio (linked to new production sheet) |
| Monthly summary | Manual (type "สรุป") | Automatic monthly push + manual on-demand |
| Stale deal alerts | Weekly push to reps | Same, but government bidding deals now use 30-day threshold |
| Who can use the bot | Anyone who adds it on LINE | Only approved reps (allowlist) |

### For IT/Management

| What | Before | After |
|------|--------|-------|
| Account access | Only the developer | IT admin + developer (shared ownership) |
| Billing | $0 (personal free tiers) | ~700 THB/month (Vercel Pro) |
| Security incidents | No plan | Documented runbook with rotation procedures |
| System health | Unknown until someone complains | Automated daily health check + failure alerts |
| PDPA compliance | Not addressed | Privacy notice, ROPA, retention policy in place |

---

## 4. Pre-Migration Checklist

These tasks must be completed **before any code changes**. They are organizational, not technical.

### 4.1 Account Setup

| # | Task | Who | Time Estimate | Status |
|---|------|-----|--------------|--------|
| 1 | **Upgrade Vercel to Pro plan** ($20/month) | IT / Finance | 15 minutes | |
| 2 | **Create ATE GitHub Organization** (e.g., `ate-thailand`) and transfer the repository | IT Admin + Developer | 30 minutes | |
| 3 | **Create ATE Google Cloud Platform project** (e.g., `ate-sales-production`) under company Google account | IT Admin | 30 minutes | |
| 4 | **Create new Google service account** under the company GCP project and download the JSON key | Developer | 15 minutes | |
| 5 | **Register LINE Official Account** under ATE business identity (requires company registration docs) | Marketing / IT | 1-2 days (LINE approval) | |
| 6 | **Create a fresh production Google Sheet** (`ATE Sales Report — Data 2026`) | Developer | 15 minutes | |
| 7 | **Share the production Sheet** with the new service account email (Editor access) | Developer / IT Admin | 5 minutes | |
| 8 | **Create a separate staging Google Sheet and LINE channel** for testing | Developer | 30 minutes | |
| 9 | **Generate new Gemini API key** under company GCP project | Developer | 10 minutes | |
| 10 | **Store all credentials** in a company password manager (1Password, Bitwarden, etc.) | IT Admin | 30 minutes | |

### 4.2 Compliance & Documentation

| # | Task | Who | Time Estimate | Status |
|---|------|-----|--------------|--------|
| 11 | **Update company privacy policy** (ate.co.th) to include sales activity tracking | Legal / IT | 2 hours | |
| 12 | **Create ROPA** (Record of Processing Activities) — required by PDPA Section 39 | Legal / IT | 2 hours | |
| 13 | **Define data retention policy** — recommended: 2 years active, then archive | Management / Legal | 1 hour | |
| 14 | **Create internal data processing notice** for the 11 sales reps | HR / Legal | 1 hour | |
| 15 | **Verify Gemini & Groq AI data processing terms** — ensure customer data is not used for model training | IT / Legal | 1 hour | |

---

## 5. Technical Changes — Priority 0

> **These 8 changes must be completed before the production launch.**
> Estimated developer effort: **2 days**

### 5.1 Move Gemini API Key Out of URL (CRITICAL SECURITY FIX)

**What:** The Gemini AI API key is currently passed in the URL query string. This means the key appears in server logs, proxy logs, and error reports — anyone with log access can steal it.

**Fix:** Move the key to an HTTP header (`x-goog-api-key`), which is the standard secure practice. This is a 3-line change in 3 locations.

**Risk if skipped:** API key compromise. Attacker could run up charges on ATE's Gemini account or intercept/modify AI processing.

---

### 5.2 Reduce AI Timeout Budget

**What:** The bot currently waits up to 30 seconds for Gemini and 20 seconds for Groq (the backup AI). If Gemini times out and Groq also times out, the total is 50 seconds — leaving almost no time for saving data and replying.

**Fix:** Reduce to Gemini 15 seconds, Groq 12 seconds. Both AIs typically respond in 2-5 seconds; the timeout is just a safety ceiling.

**Risk if skipped:** Bot hangs for 50+ seconds, LINE gives up waiting, rep gets no response. Data may or may not be saved.

---

### 5.3 Configure Vercel Function Timeout

**What:** Add explicit `maxDuration: 55` to `vercel.json` so Vercel Pro allows functions to run up to 55 seconds (the current default on Hobby is only 10 seconds).

**Risk if skipped:** Functions time out after 10 seconds on every request, causing total system failure.

---

### 5.4 Fail Fast on Missing Environment Variables

**What:** Currently, if an API key is missing from the Vercel configuration, the bot starts up silently with an empty string and only fails when a rep sends a message. This makes debugging difficult.

**Fix:** Validate all required environment variables at startup. If any are missing, the function refuses to start — making the problem immediately visible in deployment logs.

**Risk if skipped:** Silent failures that are hard to diagnose. A misconfigured deployment looks "healthy" but doesn't work.

---

### 5.5 Structured Logging

**What:** Replace 34 informal `print()` statements across the codebase with structured JSON logging. This makes production logs searchable, filterable, and compatible with log aggregation tools.

**Why it matters for management:** When something goes wrong in production, structured logs let the developer diagnose the issue in minutes instead of hours. Without them, debugging requires guessing.

---

### 5.6 Handle Photos, Stickers, and Non-Text Messages

**What:** Currently, if a rep sends a photo (e.g., a photo of a purchase order), the bot completely ignores it — no response at all. The rep thinks the bot is broken.

**Fix:** Reply with a polite Thai message: "ขออภัยครับ ตอนนี้ระบบรับได้เฉพาะข้อความตัวอักษร กรุณาพิมพ์รายงานเป็นข้อความนะครับ" (Sorry, the system currently only accepts text messages. Please type your report as text.)

**Why this is P0:** Based on expert panel assessment, there is a **95% probability** that reps will send photos in the first week. Silent failure erodes trust immediately.

---

### 5.7 Fix Hardcoded URL in Weekly Cron Job

**What:** The GitHub Actions workflow that runs the weekly stale deal check has the demo Vercel URL hardcoded. When we deploy to a new production URL, the cron will still hit the old demo endpoint.

**Fix:** Replace the hardcoded URL with a GitHub repository variable (`VERCEL_APP_URL`) that can be changed without modifying code.

---

### 5.8 Adjust Stale Deal Threshold for Government Deals

**What:** The bot currently flags deals as "stale" if there has been no update in 7 days. Government procurement deals in Thailand take 3-12 months. Reps handling government bids will receive weekly "stale deal" notifications that are meaningless — and will learn to ignore ALL notifications.

**Fix:** Deals in the `bidding` stage use a 30-day threshold instead of 7 days.

---

## 6. Technical Changes — Priority 1

> **Complete within the first 2 weeks after launch.**
> Estimated developer effort: **3 days**

### 6.1 Retry Logic for Google Sheets Writes

**What:** When the bot saves a report to Google Sheets, it currently tries once. If Google's server has a momentary hiccup (which happens), the data is lost and the rep is told "system error."

**Fix:** Try up to 3 times with increasing delays (1 second, then 3 seconds) before giving up.

**Impact:** Prevents data loss from transient Google API errors.

---

### 6.2 LINE User Allowlist

**What:** Currently, anyone who adds the bot on LINE can submit fake sales reports. There is no access control.

**Fix:** Add an environment variable `ALLOWED_USER_IDS` containing the LINE user IDs of the 11 authorized reps. Messages from unknown users are politely rejected.

**How to manage:** When a new rep joins, add their LINE user ID to the Vercel environment variable. When a rep leaves, remove their ID.

---

### 6.3 Log Aggregation (Axiom)

**What:** Vercel keeps function logs for only 72 hours. If an issue is reported on Monday about something that happened on Friday, the logs are gone.

**Fix:** Connect Vercel to Axiom (free tier: 500MB/month — more than enough). Logs are retained for 30 days and are searchable.

**Effort:** 15 minutes — click-through integration in Vercel dashboard, no code changes.

---

### 6.4 Health Check & Failure Alerts

**What:** Currently, if the bot stops working, nobody knows until a rep complains. There is no automated monitoring.

**Fix:**
- A daily GitHub Actions job pings the bot's health endpoint. If it fails, an alert is sent to a LINE group (or Slack).
- The weekly stale deal cron also sends an alert on failure.

**Who gets alerted:** Developer + IT manager, via a dedicated "[ATE Bot Alerts]" LINE group.

---

### 6.5 Monthly Auto-Push Summary

**What:** The roadmap includes a monthly pipeline summary push to management. The on-demand summary (type "สรุป") is already built. The monthly auto-push is not yet implemented.

**Fix:** Add a new GitHub Actions cron that triggers on the 1st of each month, generating and pushing a Thai-language pipeline summary to designated managers via LINE.

---

## 7. Technical Changes — Priority 2

> **Complete within the first month.**
> Estimated developer effort: **5 days**

| # | Change | What It Solves | Effort |
|---|--------|---------------|--------|
| A | **Move event deduplication to Vercel KV (Redis)** | Prevents duplicate rows when LINE retries webhook delivery. Current in-memory cache doesn't survive server restarts. | 3 hours |
| B | **Save raw message when AI is completely down** | If both Gemini and Groq fail, the rep's message is currently lost. Instead, save the raw text for manual processing later. | 2 hours |
| C | **"ดีลของฉัน" (My Recent Deals) command** | Reps forget their Batch IDs (MSG-XXXXXXXX). This command shows the rep's last 5 active deals with their IDs. | 2 hours |
| D | **Weekly CSV backup via GitHub Actions** | Automatic weekly export of Google Sheets data to a backup file. Insurance against accidental data deletion. | 1 hour |
| E | **Incident response runbook** | Documented step-by-step guide for: "bot stopped responding," "data not appearing," "API key needs rotation." | 2 hours |
| F | **Looker Studio dashboard enhancements** | Add 3 views managers will ask for: win rate by product segment, month-over-month comparison, rep activity heatmap. | 3 hours |

---

## 8. Infrastructure & Configuration

### 8.1 Vercel Configuration (vercel.json)

The production `vercel.json` explicitly sets function timeouts:

```
webhook.py    → 55-second max duration
stale_check.py → 55-second max duration
```

Both functions are configured with 15MB maximum package size to accommodate the gspread and google-auth dependencies.

### 8.2 Environment Variables

The production system requires **9 environment variables** set in the Vercel dashboard:

| Variable | Type | Description |
|----------|------|-------------|
| `LINE_CHANNEL_SECRET` | Secret | For webhook signature validation |
| `LINE_CHANNEL_ACCESS_TOKEN` | Secret | For LINE API calls |
| `GEMINI_API_KEY` | Secret | Primary AI engine |
| `GROQ_API_KEY` | Secret | Backup AI engine (optional but recommended) |
| `GOOGLE_SHEETS_ID` | Config | Production spreadsheet ID |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Secret | Full JSON key for Google Sheets access |
| `CRON_SECRET` | Secret | Authentication for the weekly stale check endpoint |
| `ALLOWED_USER_IDS` | Config | Comma-separated LINE user IDs of authorized reps (added in P1) |
| `KV_REST_API_URL` | Secret | Vercel KV connection string (added in P2) |

### 8.3 GitHub Configuration

| Setting | Value |
|---------|-------|
| Repository variable: `VERCEL_APP_URL` | The production Vercel URL (e.g., `https://ate-sales-bot.vercel.app`) |
| Repository secret: `CRON_SECRET` | Must match the Vercel environment variable |
| Repository secret: `ALERT_WEBHOOK_URL` | LINE Notify or Slack webhook for failure alerts |

### 8.4 Dependencies

The production system has intentionally minimal dependencies:

```
gspread==6.1.4        — Google Sheets client
google-auth==2.38.0   — Google service account authentication
```

All other integrations (LINE, Gemini, Groq) use Python's built-in `urllib.request` — no SDK dependencies, no version conflicts.

After P2-A (Vercel KV), one additional dependency is added:
```
redis==5.0.0          — For cross-instance event deduplication
```

---

## 9. Rollout Plan & Timeline

### Week -1: Preparation (5 working days)

```
Mon-Tue:  Complete pre-migration checklist (accounts, compliance docs)
Wed-Thu:  Implement all 8 P0 code changes
Fri:      Deploy to staging environment. Full test pass:
          ✓ New report → confirm data in staging Sheet
          ✓ Update command → verify before/after diff
          ✓ Summary command → verify Thai stats output
          ✓ Send photo → verify polite rejection
          ✓ Send sticker → verify polite rejection
          ✓ Stale check cron → verify notifications
          ✓ Structured logs → verify JSON format in Vercel dashboard
```

### Week 0: Production Launch

```
Monday:
  AM:     Production deploy to Vercel Pro
          Set all environment variables
          Connect LINE webhook URL to production
          Deploy Rich Menu via setup_rich_menu.py

  PM:     Sales Manager sends 5 test reports to the bot
          → Verify data appears in production Google Sheet
          → Verify Looker Studio dashboard shows the data

          Invite 2-3 champion reps (tech-comfortable, socially influential)
          → Each sends 1-2 real reports
          → Quick feedback: "Did the bot understand correctly?"

Tuesday:
          Full team announcement via LINE group
          15-minute meeting (NOT a training session):
            1. Manager demonstrates: send message → see confirmation → check Sheets
            2. Champions back up: "I've been using it, it's easy"
            3. Everyone sends their first real report during the meeting
            4. Pin the cheat sheet as a LINE Note

Wednesday-Friday:
          Monitor closely:
          → Watch Vercel function logs for errors
          → Check Sheet for data quality (are AI-parsed values correct?)
          → Be available in LINE group for rep questions
          → Fix any AI parsing issues with Thai shorthand/slang
```

### Weeks 1-2: Hardening

```
Week 1:
  Mon:    Implement Sheets retry logic (P1-A)
  Tue:    Implement LINE user allowlist (P1-B)
  Wed:    Set up Axiom log drain (P1-C)
  Thu:    Implement health check + alerting (P1-D)
  Fri:    Implement monthly summary cron (P1-E)

Week 2:
          Buffer for bug fixes, rep feedback, AI prompt tuning
          First stale deal notification goes out (Monday)
          Collect feedback: "Is the bot parsing your messages correctly?"
```

### Weeks 3-4: Enhancements

```
Week 3:
  Mon-Tue: Migrate idempotency cache to Vercel KV (P2-A)
  Wed:     Graceful degradation — save raw message on AI failure (P2-B)
  Thu-Fri: "My Recent Deals" command (P2-C)

Week 4:
  Mon:     Weekly CSV backup workflow (P2-D)
  Tue:     Write incident response runbook (P2-E)
  Wed:     Set up secret rotation calendar
  Thu-Fri: Build Looker Studio views: win rate, month-over-month, rep heatmap (P2-F)
```

### Post-Launch Milestones

| When | Milestone |
|------|-----------|
| End of Month 1 | Review adoption metrics. Target: 8 of 11 reps actively reporting. |
| End of Month 2 | First monthly auto-summary push to management. |
| End of Month 3 | Quarterly business review: pipeline visibility, time saved, data quality. |
| Month 6 | Review data volume. If approaching 3,000 rows, plan archival. |
| Month 12 | Annual review: feature roadmap, cost review, retention policy execution. |

---

## 10. Cost Summary

### Monthly Recurring Costs

| Service | Monthly Cost (THB) | Notes |
|---------|-------------------|-------|
| **Vercel Pro** | ~700 | Required for commercial use, 60s timeout, team access |
| Gemini API (2.5 Flash) | 0 | Free tier: 1,500 requests/day. We use ~50-110/day. |
| Groq API (Llama 3.3 70B) | 0 | Free tier. Fallback only — rarely used. |
| Google Sheets API | 0 | Free with service account |
| Google Cloud (service account) | 0 | No charges for Sheets API usage |
| LINE Messaging API | 0 | Free plan: 500 push messages/month. We use ~55/month. |
| Axiom (log aggregation) | 0 | Free tier: 500MB/month |
| Vercel KV (Redis) | 0 | Free tier: 256MB |
| Looker Studio | 0 | Free for Sheets-connected dashboards |
| GitHub (org, private repo, Actions) | 0 | Free plan covers all needs |
| **TOTAL** | **~700 THB/month** | |

### Annual Cost

| | Amount |
|---|--------|
| Annual infrastructure cost | ~8,400 THB (~$240 USD) |
| Smallest deal in pipeline | 150,000 THB |
| Largest deal in pipeline | 2,100,000 THB |
| **Break-even** | **Less than 1% of one small deal** |

### Cost Risks

| Scenario | Potential Additional Cost | Likelihood |
|----------|--------------------------|------------|
| Gemini free tier reduced/eliminated | ~35-105 THB/month ($1-3) | Low |
| LINE push messages exceed 500/month | Upgrade to Light plan: 1,200 THB/month | Very low (current usage: ~55/month) |
| Need for premium monitoring | Axiom Pro: $95/month if free tier exceeded | Very low |

---

## 11. Data & Privacy (PDPA Compliance)

### What Personal Data the System Handles

| Data Type | Where Stored | Why Collected |
|-----------|-------------|---------------|
| Customer company names | Google Sheets (columns C) | Sales pipeline tracking |
| Customer contact person names | Google Sheets (column D) | Identify decision makers |
| Phone numbers | Google Sheets (column E) | Contact channel for follow-up — **mandatory field** |
| Email addresses | Google Sheets (column E) | Contact channel for follow-up |
| Deal values (THB) | Google Sheets (column I) | Pipeline valuation |
| Rep names (LINE display) | Google Sheets (column B) + Rep Registry | Identify who reported |
| LINE user IDs | Rep Registry tab | Push notifications (stale deals) |
| Raw message text | Google Sheets (column T) | Audit trail |

### PDPA Compliance Actions

| # | Requirement | Action | Status |
|---|-------------|--------|--------|
| 1 | **Lawful basis** (Section 24) | Document "legitimate interest" for B2B sales management | Part of pre-migration checklist |
| 2 | **Privacy notice** (Section 23) | Update ate.co.th privacy policy to cover sales tracking; inform reps via data processing notice | Part of pre-migration checklist |
| 3 | **Record of Processing** (Section 39) | Create ROPA spreadsheet documenting data flows | Part of pre-migration checklist |
| 4 | **Data retention** | 2-year active retention, then archive. Define deletion process. | Part of pre-migration checklist |
| 5 | **Data subject rights** (Sections 30-36) | Establish process for access/deletion requests via privacy@ate.co.th | Within first month |
| 6 | **Cross-border transfer** (Section 28) | Verify DPAs with Google, Vercel, LINE. Vercel Pro plan includes DPA. | Part of pre-migration checklist |
| 7 | **Data breach notification** (Section 37) | Plan: notify PDPC within 72 hours if breach affects customer PII | Document in runbook |
| 8 | **AI data processing** | Verify Gemini/Groq terms — ensure customer data is not used for model training | Part of pre-migration checklist |

### Data Flow Diagram

```
Sales Rep (LINE)
    │
    ▼
LINE Messaging API (Japan/Global)    ← Data in transit: message text
    │
    ▼
Vercel Serverless (US)               ← Data in transit: message text
    │
    ├──► Gemini API (Google, US)      ← PII sent for AI parsing
    │    (or Groq API as fallback)       Phone numbers, names, deal values
    │
    ├──► Google Sheets (Google, Global) ← Data at rest: all 24 columns
    │                                     Retained for 2 years
    │
    └──► LINE Reply (Japan/Global)    ← Confirmation message only (no PII)
```

### PDPA Penalty Context

Non-compliance penalties under PDPA:
- Administrative fines: up to **5 million THB** per offense
- Criminal penalties: up to **1 year imprisonment** and/or **1 million THB fine**
- Civil damages: actual damages + punitive damages up to **2x actual damages**

**The compliance cost (a few hours of documentation) is negligible compared to the penalty risk.**

---

## 12. Account Ownership & Access Control

### Current State (RISK: Single Point of Failure)

```
┌─────────────────────────────────────────────────┐
│              Developer's Personal Accounts        │
│                                                   │
│  GitHub    ──  Personal account                   │
│  Vercel    ──  Personal Hobby account             │
│  GCP       ──  Personal Google project            │
│  LINE      ──  Personal LINE Developer account    │
│  Sheets    ──  Personal Google Drive               │
│  Gemini    ──  Personal API key                   │
│                                                   │
│  ⚠️  If developer leaves = TOTAL SYSTEM LOSS     │
└─────────────────────────────────────────────────┘
```

### Target State (Company Ownership)

```
┌─────────────────────────────────────────────────┐
│              ATE Company Accounts                 │
│                                                   │
│  GitHub Org    ──  ate-thailand                    │
│  Vercel Team   ──  ate-engineering                │
│  GCP Project   ──  ate-sales-production           │
│  LINE OA       ──  ATE Official Account           │
│  Sheets        ──  Company Google Drive            │
│  Gemini        ──  Company GCP API key            │
│                                                   │
│  Access:                                          │
│    IT Admin    ──  Owner (billing, credentials)   │
│    Developer   ──  Admin (deploy, code, logs)     │
│    Sales Mgr   ──  Viewer (Sheets, Dashboard)     │
│                                                   │
│  ✅  Developer leaves = Company retains control   │
└─────────────────────────────────────────────────┘
```

### Access Matrix

| System | IT Admin | Developer | Sales Manager | Sales Reps |
|--------|----------|-----------|---------------|------------|
| GitHub repo | Owner | Admin | — | — |
| Vercel dashboard | Owner | Developer | — | — |
| Vercel env vars | Full access | View only | — | — |
| Google Cloud Console | Owner | Editor | — | — |
| Google Sheets | Editor | Editor | Editor (Manager Notes only) | Viewer (via Rich Menu) |
| Looker Studio | Owner | Editor | Viewer | — (restricted) |
| LINE Developer Console | Owner | Admin | — | — |
| LINE Bot (messaging) | — | — | User | User |

---

## 13. Business Continuity & Knowledge Transfer

### Bus Factor Mitigation

| Risk | Mitigation |
|------|------------|
| **Developer leaves** | All accounts under company ownership. Credentials in password manager. Architecture doc + runbook enable new developer to take over. |
| **IT Admin leaves** | Second person (developer) has admin access. Credentials are shared, not personal. |
| **Service account key expires** | Rotation calendar with reminders (see Appendix B). Documented procedure in runbook. |
| **Google Sheets accidentally deleted** | Weekly CSV backups (P2-D). Google Sheets version history (built-in, 30+ days). Monthly Google Drive copy. |
| **Vercel has an outage** | LINE webhooks retry automatically for ~1 hour. When Vercel recovers, queued messages are processed. Idempotency prevents duplicates. |

### Documentation Inventory

| Document | Purpose | Location |
|----------|---------|----------|
| `ARCHITECTURE.md` | Full 16-section technical architecture | Repo root |
| `demo/README.md` | Step-by-step deployment guide | `demo/` |
| `docs/07_Sales_Team_Reporting_Guide.md` | Onboarding guide with expert panel consensus | `docs/` |
| `docs/08_Roadmap.md` | Feature roadmap and changelog | `docs/` |
| `docs/12_Production_Migration_Plan.md` | This document | `docs/` |
| Incident Response Runbook | Troubleshooting and recovery procedures | `docs/` (to be created, P2-E) |

### Knowledge Transfer Checklist

If transferring the system to a new developer:

- [ ] Grant access to GitHub org, Vercel team, GCP project, LINE Developer Console
- [ ] Share password manager vault with all API keys
- [ ] Walk through `ARCHITECTURE.md` (30 minutes)
- [ ] Walk through `webhook.py` structure (1 hour)
- [ ] Practice: deploy a code change to staging, verify in staging Sheet
- [ ] Practice: rotate one API key (e.g., CRON_SECRET) end-to-end
- [ ] Practice: read and interpret structured logs in Axiom

---

## 14. Monitoring, Alerting & Incident Response

### What Is Monitored

| Check | Frequency | Method | Alert On |
|-------|-----------|--------|----------|
| Bot health (HTTP 200) | Daily | GitHub Actions → `GET /api/webhook` | Non-200 response |
| Stale deal cron success | Weekly (Monday) | GitHub Actions workflow status | Job failure |
| Function error rate | Continuous | Axiom log drain (P1-C) | >3 errors in 5 minutes |
| Sheets write failures | Continuous | Structured log alerts | Any failure |
| AI failover (Gemini→Groq) | Continuous | Structured log alerts | >3 failovers in 1 hour |

### Alert Channels

| Channel | Who Receives | When Used |
|---------|-------------|-----------|
| LINE group "[ATE Bot Alerts]" | Developer + IT Manager | All production alerts |
| Email | IT Manager | Weekly summary digest |
| Vercel dashboard | Developer | Detailed function logs and deployment history |
| Axiom dashboard | Developer | Log search and analysis |

### Incident Response Summary

| Scenario | Immediate Action | Recovery |
|----------|-----------------|----------|
| **Bot not responding** | Check Vercel function logs. Check LINE webhook URL. Check API key validity. | Fix issue and redeploy (or rollback in Vercel dashboard — instant). |
| **Data not appearing in Sheets** | Check service account permissions. Check `GOOGLE_SHEETS_ID`. Check Sheets API quota. | Fix config and redeploy. Manually re-enter missed reports if needed. |
| **AI parsing errors** | System has automatic Groq fallback. Check Gemini API quota and status. | Usually self-healing. If persistent, check/update the system prompt. |
| **Credentials compromised** | Immediately revoke the compromised key/token. Generate new one. Update Vercel env var. Redeploy. | Follow rotation procedure (Appendix B). Review audit logs for unauthorized access. |
| **Accidental data deletion in Sheets** | Use Google Sheets version history (File → Version history) to restore. | If version history is insufficient, restore from weekly CSV backup. |

---

## 15. Risk Register

| # | Risk | Likelihood | Impact | Mitigation | Owner |
|---|------|-----------|--------|------------|-------|
| **R1** | Reps send photos, bot is silent, they lose trust in the system | Very High (95%) | High | P0: Add non-text message handler before launch (Commit 6) | Developer |
| **R2** | AI misparsing of unusual Thai shorthand in first week | High (70%) | Medium | Monitor first 100 messages closely. Add few-shot examples for recurring issues. | Developer |
| **R3** | Reps forget Batch IDs, can't update deals | High (80%) | Medium | Smart match already suggests IDs. P2: Add "my recent deals" command. Emphasize tip in onboarding. | Developer |
| **R4** | PDPA complaint from customer or rep | Low | Very High (5M THB fine) | Pre-migration compliance checklist (items 11-15). Privacy notice, ROPA, retention policy. | Legal / IT |
| **R5** | Developer leaves, system becomes unmaintainable | Medium (15% in 6 months) | Critical | Company-owned accounts, shared credentials, documentation, identify backup developer. | IT Admin |
| **R6** | Both AI providers (Gemini + Groq) down simultaneously | Very Low | High | P2-B: Save raw message for manual recovery. Monitor and alert. | Developer |
| **R7** | Google Sheets API quota exhaustion during peak | Low | Medium | P1-A: Retry with backoff (not retry storms). Expected usage is well under quota. | Developer |
| **R8** | Unauthorized person submits fake sales data | Medium | Medium | P1-B: LINE user allowlist. Only approved reps can use the bot. | Developer / IT |
| **R9** | Gemini free tier limits reduced by Google | Low | Low | Groq fallback handles it. Paid Gemini tier costs only ~35-105 THB/month if needed. | Developer |
| **R10** | Reps perceive bot as surveillance, resist adoption | Medium | High | Manager champions the tool visibly. Use the word "tool" never "tracking." Celebrate wins, never criticize gaps. Phase rollout. | Sales Manager |

---

## 16. Success Metrics

### Week 1-2: Adoption

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Active reporters | 8 of 11 reps (73%) sent at least 1 report | Count distinct Rep Name values in Sheets |
| Reports per rep per week | Minimum 3 | Count rows by rep by week |
| Zero-activity reps | Fewer than 2 reps with zero reports after week 2 | Identify reps not in Sheet |

### Month 1: Data Quality

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Field completeness | 70%+ of reports have all 6 key fields | Count rows with customer + contact + product + value + activity + stage all non-empty |
| Update command usage | At least 20% of deals have been updated at least once | Distinct batch IDs with >1 row ÷ total distinct batch IDs |
| AI parse accuracy | <5% of reports need manual correction | Spot-check 50 random records per month |

### Month 2-3: Business Value

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Pipeline visibility | Manager can state total pipeline value at any moment | Dashboard shows current number |
| Time saved per rep | <2 minutes per report (vs. Excel or email) | Qualitative survey |
| Stale deal reduction | Average days-since-update for active deals decreases | Trend from stale check data |
| Deal progression | Deals visibly move through stages | Count stage transitions per batch ID |

### What to Watch For (Anti-Metrics)

| Warning Sign | What It Means | Action |
|-------------|---------------|--------|
| 80%+ of reports have exactly the same structure with round numbers | Reps are submitting fake/template data | Manager spot-checks 10 random entries. Address privately, not in group. |
| Reports cluster at 5:00 PM every day | Reps batch-report at end of day from memory (less accurate) | Encourage real-time reporting: "ส่งทันทีหลังเจอลูกค้า = จำได้แม่น" |
| Reps stop using update command | Reps create duplicate deals instead of updating | Reinforce the update flow. Consider the "my recent deals" command (P2-C). |
| Manager never references dashboard data in meetings | Team sees no value in reporting | Manager must visibly use the data to celebrate wins. |

---

## 17. Key Decisions & Rationale

Decisions made by the 6-expert panel, documented for future reference.

| Decision | Verdict | Rationale |
|----------|---------|-----------|
| **Keep Google Sheets as database** | Yes, for at least 2 years | 11 reps, ~50 reports/week. Managers love direct editing. Migrate to PostgreSQL only if we hit 5K+ rows or need complex queries. |
| **Keep `drive` scope (not `drive.file`)** | Yes | `drive.file` only grants access to files the service account created. Since the Sheet is created by a user and shared with the SA, `drive.file` breaks access. Already tested and reverted (commit 5a9c6f0). |
| **Vercel Pro is mandatory** | Yes | Hobby plan ToS prohibits commercial use. Pro provides: 60s function timeout, DPA for PDPA compliance, team access, log drains. $20/month is trivial. |
| **No database migration** | Correct for now | Over-engineering for this scale. Google Sheets handles 2,600 rows/year at 24 columns without issues. |
| **Phased rollout (not big-bang)** | Yes | Manager first → 2-3 champions → full team over 10 days. Reduces risk of early bad experiences poisoning group opinion. |
| **Separate staging environment** | Yes | Never test against real reps. Separate LINE channel + Google Sheet for staging. |
| **Stay on free Gemini/Groq tiers** | Yes, for now | Expected usage (~100 requests/day) is well under free tier limits (1,500/day for Gemini). Monitor and upgrade only if needed. |
| **LINE Free plan (500 push/month)** | Yes | Current push usage: ~55/month (stale deals + future monthly summary). Well under 500 limit. |
| **30-day stale threshold for bidding** | Yes | Government procurement takes 3-12 months. 7-day alerts for bidding-stage deals create noise that reps learn to ignore. |
| **User allowlist (not role-based access)** | Yes, for Phase 1 | Simple comma-separated user IDs. Full role system (rep vs manager) comes in Phase 2 if needed. |

---

## 18. Frequently Asked Questions

### For Management

**Q: How much does this cost?**
A: ~700 THB/month ($20 USD). Less than 1% of the smallest deal we track. The demo ran at $0/month; the only new cost is the Vercel Pro plan required for commercial use and data privacy compliance.

**Q: What if the developer leaves?**
A: All accounts are transferred to company ownership before launch. Credentials are in the company password manager. The architecture documentation and runbook enable a new developer to take over. A second person (IT admin or backup developer) should have admin access to all systems.

**Q: What if the bot breaks?**
A: Automated health checks run daily and alert the developer + IT manager. Vercel supports instant rollback to any previous deployment (no rebuild required). Google Sheets has built-in version history for data recovery.

**Q: Are we compliant with Thai data privacy law (PDPA)?**
A: The migration plan includes PDPA compliance as a pre-launch requirement: privacy notice, record of processing, data retention policy, and data processing agreements with cloud providers. This is documented in Section 11.

**Q: Can competitors or unauthorized people access our sales data?**
A: No. The Google Sheet is only accessible to the service account and users it's shared with. The LINE bot will have a user allowlist (P1-B) — only the 11 approved reps can submit reports. The Looker Studio dashboard is shared only with designated managers.

**Q: Will the reps see the dashboard?**
A: No. The Rich Menu does not include a Dashboard button (removed per management request). Reps can see the Google Sheet (view-only suggested) but not the Looker Studio dashboard. Only managers receive the dashboard link.

---

### For the Sales Manager

**Q: How do I get my reps to use this?**
A: Don't make it a "requirement." Make it a "tool that makes their hard work visible." Be the first person to send a test message. Celebrate wins from the dashboard in team meetings. Never use the data to criticize individual reps in front of the group.

**Q: What if a rep refuses to use it?**
A: Handle it privately, one-on-one. Frame it as: "I want to make sure your big deals get counted in the quarterly report to the directors." The appeal to recognition works better than compliance arguments in Thai work culture.

**Q: How do I add or remove a rep?**
A: New reps are automatically registered when they first message the bot. To restrict access, update the `ALLOWED_USER_IDS` list in Vercel (ask IT admin or developer). Departing reps' data stays in the system as historical record.

**Q: Can I edit the data manually?**
A: Yes. Column X ("Manager Notes") is specifically for your manual input. You can also edit other cells in Google Sheets directly — the dashboard reflects all changes automatically.

---

### For the Developer

**Q: What's the deployment process?**
A: Push to `main` branch → Vercel auto-deploys to production. Push to any other branch → Vercel creates a preview deployment. No manual deploy commands needed.

**Q: How do I roll back a bad deployment?**
A: Vercel dashboard → Deployments → find the last good deployment → click "Promote to Production." This is instant (DNS alias swap, no rebuild). Code rollback only — Sheets data is not affected.

**Q: How do I add a new few-shot example to improve AI parsing?**
A: Edit the `FEW_SHOT_EXAMPLES` list in `webhook.py`. Add a new `{"input": "...", "output": "..."}` entry. Push to `main`. The change is live within 60 seconds.

**Q: How do I rotate an API key?**
A: (1) Generate new key in the provider's console. (2) Update the Vercel environment variable. (3) Redeploy the function. (4) Verify the bot is working. (5) Revoke the old key. For CRON_SECRET, also update the GitHub Actions secret. See Appendix B for the full schedule.

---

## Appendix A: Rollout Communication Templates

### Template 1: Sales Manager Announcement (LINE Group)

```
📢 แจ้งทีม

เริ่มใช้ระบบรายงานการขายผ่าน LINE แล้วนะครับ

แค่ส่งข้อความรายงานในแชทนี้ น้องบันทึก (บอท) จะจดให้เองอัตโนมัติ ✅

ตัวอย่าง:
"ไปเยี่ยม PTT คุณวีระ 081-234-5678 เสนอ MTO330 ราคา 150,000 สถานะเจรจา"

กดปุ่ม "วิธีรายงาน" ด้านล่างเพื่อดูตัวอย่างเพิ่มเติม

ไม่ต้อง format ให้สวย เขียนเหมือนแชทปกติได้เลยครับ 👍
```

### Template 2: PDPA Privacy Notice (for Reps)

```
📋 แจ้งเรื่องข้อมูลส่วนบุคคล

ระบบรายงานการขายจะเก็บข้อมูลต่อไปนี้เพื่อการบริหารงานขาย:
- ชื่อลูกค้าและผู้ติดต่อ
- เบอร์โทร/อีเมล ผู้ติดต่อ
- ข้อมูลดีลและสินค้า
- ชื่อและข้อความของผู้รายงาน

ข้อมูลจัดเก็บใน Google Sheets ภายใต้บัญชีบริษัท
เก็บรักษา 2 ปี แล้วจัดเก็บเป็นข้อมูลเก่า

สอบถามเพิ่มเติม: privacy@ate.co.th
```

---

## Appendix B: Secret Rotation Schedule

| Credential | Rotation Frequency | How to Rotate | Who |
|-----------|-------------------|---------------|-----|
| `LINE_CHANNEL_SECRET` | Annually or on compromise | LINE Developers Console → Channel → Reissue. Update Vercel env var. Redeploy. | Developer |
| `LINE_CHANNEL_ACCESS_TOKEN` | Annually or on compromise | LINE Developers Console → Channel → Reissue. Update Vercel env var. Redeploy. | Developer |
| `GEMINI_API_KEY` | Quarterly | Google Cloud Console → API Keys → Create new key → Restrict to Generative Language API. Update Vercel. Revoke old key. | Developer |
| `GROQ_API_KEY` | Quarterly | Groq Console → API Keys → Create. Update Vercel. Revoke old. | Developer |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Annually | GCP Console → IAM → Service Account → Keys → Add Key → JSON. Update Vercel. Delete old key. | IT Admin + Developer |
| `CRON_SECRET` | Quarterly | Generate: `openssl rand -hex 32`. Update in BOTH Vercel env vars AND GitHub Secrets simultaneously. | Developer |

**Set calendar reminders for:**
- January 1, April 1, July 1, October 1: Rotate Gemini, Groq, CRON_SECRET
- January 1: Rotate LINE credentials, service account key (annual items)

---

## Appendix C: File Change Summary

All production migration changes are scoped to these files:

| File | P0 Changes | P1 Changes | P2 Changes |
|------|-----------|-----------|-----------|
| `demo/api/webhook.py` | API key header, timeouts, env validation, logging, non-text handler | Sheets retry, user allowlist | Vercel KV idempotency, graceful degradation, "my deals" command |
| `demo/api/stale_check.py` | Env validation, logging, bidding threshold | — | — |
| `vercel.json` | Add `maxDuration` config | — | — |
| `.github/workflows/stale-check.yml` | Fix hardcoded URL | Add failure alerting | — |
| `.github/workflows/health-check.yml` | — | New file (daily health check) | — |
| `.github/workflows/monthly-summary.yml` | — | New file (monthly push) | — |
| `.github/workflows/weekly-backup.yml` | — | — | New file (CSV backup) |
| `requirements.txt` | — | — | Add `redis` for Vercel KV |

---

*This document should be reviewed and approved by:*
- *IT Manager (account ownership, infrastructure)*
- *Sales Manager (rollout plan, success metrics)*
- *Management (budget approval, PDPA compliance)*

*After approval, the developer begins execution per the Week -1 timeline.*
