# ATE Sales Report System — Proposal Draft

> **Company:** Advanced Technology Equipment Co., Ltd. (ATE)
> **Industry:** B2B Industrial Maintenance Equipment & Chemicals Distributor
> **Sales Team Size:** ~11 field representatives
> **Location:** Bangkok, Thailand
> **Prepared for:** Internal discussion with Sales Manager, Director, and C-suite
> **Date:** 2026-03-10
> **Status:** Draft — for brainstorming and stakeholder review

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [Proposed Solution](#2-proposed-solution)
3. [Three-Tier Plans](#3-three-tier-plans)
4. [Comparison Matrix](#4-comparison-matrix)
5. [Architecture Alternatives Comparison](#45-architecture-alternatives-comparison)
6. [Recommended Approach](#5-recommended-approach)
7. [Key Risks & Mitigations](#6-key-risks--mitigations)
8. [Open Questions for Next Meeting](#7-open-questions-for-next-meeting)
9. [Next Steps](#8-next-steps)
10. [Appendix](#appendix)

---

## 1. Problem Statement

### Current State vs. Desired State

```
┌─────────────────── CURRENT STATE ────────────────────┐     ┌──────────────────── DESIRED STATE ───────────────────┐
│                                                       │     │                                                      │
│  Rep A ──→ LINE message (informal)                    │     │  Rep A ──→ LINE message ──┐                          │
│  Rep B ──→ Spreadsheet (own format)                   │     │  Rep B ──→ LINE message ──┤                          │
│  Rep C ──→ Nothing / forgot                 ──→  ???  │     │  Rep C ──→ LINE message ──┼──→ AI ──→ Dashboard ──→  │
│  Rep D ──→ LINE message (different group)             │     │  Rep D ──→ LINE message ──┤      Real-time KPIs     │
│  Rep E ──→ Verbal report to manager                   │     │  Rep E ──→ LINE message ──┘                          │
│                                                       │     │                                                      │
│  Result: No visibility, no data, no insights          │     │  Result: Structured data, trends, forecasts          │
└───────────────────────────────────────────────────────┘     └──────────────────────────────────────────────────────┘
```

### Pain Points at a Glance

```
  ╔══════════════════════╗    ╔══════════════════════╗    ╔══════════════════════╗
  ║  NO STANDARD FORMAT  ║    ║   SCATTERED DATA     ║    ║  NO REAL-TIME VIEW   ║
  ║                      ║    ║                      ║    ║                      ║
  ║  Spreadsheets, LINE  ║    ║  LINE groups, files  ║    ║  Manager must chase  ║
  ║  messages, verbal,   ║    ║  personal drives,    ║    ║  each rep manually   ║
  ║  or nothing at all   ║    ║  random spreadsheets ║    ║  to get updates      ║
  ╚══════════════════════╝    ╚══════════════════════╝    ╚══════════════════════╝

  ╔══════════════════════╗    ╔══════════════════════╗
  ║   LOW COMPLIANCE     ║    ║  NO HISTORY/TRENDS   ║
  ║                      ║    ║                      ║
  ║  Formal reporting    ║    ║  Can't analyze past  ║
  ║  feels like a chore  ║    ║  performance, no     ║
  ║  → reps skip it      ║    ║  forecasting ability ║
  ╚══════════════════════╝    ╚══════════════════════╝
```

---

## 2. Proposed Solution

An **AI-powered automated reporting system** that:

```
  ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
  │ COLLECT  │────→│  PARSE   │────→│  STORE   │────→│ DISPLAY  │
  │ passively│     │  with AI │     │ in a DB  │     │ dashboard│
  │ via LINE │     │ (Claude) │     │          │     │          │
  └──────────┘     └──────────┘     └──────────┘     └──────────┘
    Zero effort      Thai/English     Centralized      Real-time
    from reps        understanding    & structured     KPIs & insights
```

We present **two architecture alternatives** for building this system:

- **Alternative A: n8n Workflow Approach** — uses n8n as the workflow/integration engine with manual LINE webhook wiring
- **Alternative B: OpenClaw Gateway Approach** — uses OpenClaw, a self-hosted AI gateway with native LINE support, to simplify the messaging pipeline

### Core Data Points Captured

```
┌─────────────────────────────────────────────────────────────┐
│                    SALES ACTIVITY RECORD                     │
├──────────────┬──────────────────────────────────────────────┤
│  Customer    │  Company name, contact person, industry      │
│  Product     │  Brand (Megger/Fluke/CRC/...), model, qty   │
│  Revenue     │  Deal value (THB), quotation, discount       │
│  Activity    │  Visit / Call / Quotation / Follow-up        │
│  Pipeline    │  Lead → Negotiation → Quotation → Won/Lost  │
│  Payment     │  Pending → Partial → Paid                   │
│  Follow-up   │  Next steps, date, notes                    │
│  Summary     │  Daily/weekly English summary for dashboard  │
└──────────────┴──────────────────────────────────────────────┘
```

### System Flow — Alternative A: n8n Workflow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Sales Rep  │     │  LINE OA     │     │     n8n      │     │  Claude API  │
│  (in field)  │     │  (Webhook)   │     │  (Workflow)  │     │  (AI Parse)  │
└──────┬───────┘     └──────┬───────┘     └──────┬───────┘     └──────┬───────┘
       │                    │                    │                    │
       │  LINE message      │                    │                    │
       │  "ไปเยี่ยม PTT     │                    │                    │
       │   เสนอ Megger      │                    │                    │
       │   150K"            │                    │                    │
       │───────────────────→│                    │                    │
       │                    │  Webhook POST      │                    │
       │                    │───────────────────→│                    │
       │                    │                    │  HTTP Request      │
       │                    │                    │───────────────────→│
       │                    │                    │                    │
       │                    │                    │  Structured JSON   │
       │                    │                    │←───────────────────│
       │                    │                    │                    │
       │                    │                    │──→ Database (write)
       │                    │                    │──→ Dashboard (update)
       │                    │  Reply: "บันทึกแล้ว" │                    │
       │                    │←───────────────────│                    │
       │  Confirmation      │                    │                    │
       │←───────────────────│                    │                    │
       │                    │                    │                    │

  Components: LINE OA + n8n + Claude API + Database + Dashboard
  Moving parts: 5 separate services to configure and maintain
```

### System Flow — Alternative B: OpenClaw Gateway

```
┌──────────────┐     ┌─────────────────────────────────┐     ┌──────────────┐
│   Sales Rep  │     │          OpenClaw Gateway        │     │   Database   │
│  (in field)  │     │  ┌───────────┐  ┌────────────┐  │     │  + Dashboard │
│              │     │  │LINE Plugin│  │Claude Agent│  │     │              │
└──────┬───────┘     └──┴─────┬─────┴──┴─────┬──────┴──┘     └──────┬───────┘
       │                      │              │                      │
       │  LINE message        │              │                      │
       │  "ไปเยี่ยม PTT         │              │                      │
       │   เสนอ Megger        │              │                      │
       │   150K"              │              │                      │
       │─────────────────────→│              │                      │
       │                      │  Route msg   │                      │
       │                      │─────────────→│                      │
       │                      │              │                      │
       │                      │  Parsed JSON │                      │
       │                      │←─────────────│                      │
       │                      │              │  Write data          │
       │                      │              │─────────────────────→│
       │  "บันทึกแล้ว"           │              │                      │
       │←─────────────────────│              │                      │
       │                      │              │                      │

  Components: OpenClaw (LINE + AI in one) + Database + Dashboard
  Moving parts: 3 services (OpenClaw handles LINE + AI natively)
```

---

## 3. Three-Tier Plans

### Tier Overview

```
  LEAN (PoC)              MID (Production)           PREMIUM (Enterprise)
  ฿0–1,500/mo             ฿3,500–7,000/mo            ฿15,000–35,000/mo
  2–4 weeks               4–6 weeks                  8–12 weeks

  ┌─────────┐             ┌─────────┐                ┌─────────┐
  │ Google  │             │Metabase │                │ Custom  │
  │ Sheets  │             │Dashboard│                │Dashboard│
  │ +Looker │             │+Supabase│                │+Postgres│
  │ Studio  │             │         │                │ +PWA    │
  └─────────┘             └─────────┘                └─────────┘
       │                       │                          │
  Test with               Full team                  Branded,
  2-3 reps                of 11                      AI insights,
                                                     forecasting
```

---

### Tier 1 — LEAN (PoC / Pilot)

**Goal:** Prove the concept works with minimal cost and effort.
**Timeline:** 2–4 weeks to set up
**Monthly Cost:** ~฿0–1,500/month (~$0–40 USD)

#### Alternative A: n8n Workflow

| Component | Tool | Notes |
|-----------|------|-------|
| LINE Integration | LINE Official Account (free) | Messaging API webhook |
| Workflow Engine | n8n Cloud (free tier: 300 executions/mo) or self-hosted on a ฿200/mo VPS | Visual workflow, no code |
| AI Parsing | Claude API (pay-per-use) | ~$5–15/mo for 11 reps |
| Database | Google Sheets | Familiar, zero learning curve |
| Dashboard | Google Looker Studio (free) | Connects directly to Sheets |
| Notifications | LINE push messages via n8n | Confirmation back to rep, alerts to manager |

#### Alternative B: OpenClaw Gateway

| Component | Tool | Notes |
|-----------|------|-------|
| LINE Integration + AI Gateway | OpenClaw (self-hosted on ฿200/mo VPS) | Built-in LINE plugin — webhook, group chat, media, flex messages handled natively |
| AI Parsing | Claude API (pay-per-use) | ~$5–15/mo for 11 reps |
| Database | Google Sheets | Familiar, zero learning curve |
| Dashboard | Google Looker Studio (free) | Connects directly to Sheets |
| Notifications | LINE replies via OpenClaw | Confirmation back to rep natively; manager alerts via LINE |

> **Key difference:** OpenClaw replaces both the separate LINE webhook setup and n8n workflow engine. The LINE ↔ AI pipeline is handled as a single unit. OpenClaw also provides built-in session memory and multi-agent routing if needed.

#### Lean Architecture Diagram

```
  Alternative A (n8n):
  ┌──────┐    ┌────────┐    ┌──────┐    ┌────────┐    ┌──────────────┐
  │ LINE │───→│  n8n   │───→│Claude│───→│ Google │───→│Google Looker │
  │  OA  │←───│Workflow│←───│ API  │    │ Sheets │    │   Studio     │
  └──────┘    └────────┘    └──────┘    └────────┘    └──────────────┘

  Alternative B (OpenClaw):
  ┌──────┐    ┌────────────────┐    ┌────────┐    ┌──────────────┐
  │ LINE │───→│   OpenClaw     │───→│ Google │───→│Google Looker │
  │  OA  │←───│ (LINE+Claude)  │    │ Sheets │    │   Studio     │
  └──────┘    └────────────────┘    └────────┘    └──────────────┘
```

**What you get:**
- AI parses LINE messages into structured rows in Google Sheets
- Basic dashboard with daily/weekly sales summary, per-rep activity
- Rep receives confirmation: "Got it — logged: Visit to PTT, Megger MTO330, ฿150,000 quotation"
- Manager gets daily summary notification in LINE

**Limitations:**
- Google Sheets has row limits (poor for long-term data)
- Dashboard is basic — no drill-down or advanced filtering
- No offline/mobile-optimized dashboard
- Manual cleanup may be needed for AI misparses
- **Alt A only:** 300 executions/month may not be enough (can self-host to remove limit)
- **Alt B only:** OpenClaw is a newer project — documentation still maturing

**Best for:** Testing with 2–3 reps for 1 month before committing budget.

---

### Tier 2 — MID (Production-Ready)

**Goal:** Reliable system for full team, better data integrity, richer dashboards.
**Timeline:** 4–6 weeks to set up
**Monthly Cost:** ~฿3,500–7,000/month (~$100–200 USD)

#### Alternative A: n8n Workflow

| Component | Tool | Notes |
|-----------|------|-------|
| LINE Integration | LINE Official Account | Same webhook setup |
| Workflow Engine | n8n self-hosted on VPS (e.g., DigitalOcean ฿500/mo) | Unlimited executions |
| AI Parsing | Claude API (Haiku for speed, Sonnet for accuracy) | ~$10–30/mo |
| Database | Supabase (free tier → Pro at $25/mo if needed) | Postgres, real-time, REST API |
| Dashboard | Metabase (open-source, self-hosted on same VPS) | Rich charts, filters, drill-down |
| Notifications | LINE + Email summaries | Daily/weekly digest |
| Backup | Automated DB backup to Google Drive | Via n8n scheduled workflow |

#### Alternative B: OpenClaw Gateway

| Component | Tool | Notes |
|-----------|------|-------|
| LINE Integration + AI Gateway | OpenClaw (self-hosted on VPS, e.g., DigitalOcean ฿500/mo) | Built-in LINE plugin handles all messaging; multi-agent routing, sessions, memory |
| AI Parsing | Claude API (Haiku for speed, Sonnet for accuracy) | ~$10–30/mo |
| Database | Supabase (free tier → Pro at $25/mo if needed) | Postgres, real-time, REST API |
| Dashboard | Metabase (open-source, self-hosted on same VPS) | Rich charts, filters, drill-down |
| Notifications | LINE replies via OpenClaw + Email via external service | Daily/weekly digest |
| Backup | Automated DB backup to Google Drive | Via cron job or simple script on VPS |

> **Key difference:** OpenClaw replaces n8n for the LINE ↔ AI pipeline. For scheduled tasks (backups, email digests), a simple cron job or lightweight script replaces n8n's scheduled workflows. OpenClaw and Metabase can share the same VPS.

#### Mid Architecture Diagram

```
  Alternative A (n8n):
  ┌──────┐    ┌────────┐    ┌──────┐    ┌──────────┐    ┌──────────┐
  │ LINE │───→│  n8n   │───→│Claude│───→│ Supabase │───→│ Metabase │
  │  OA  │←───│Workflow│←───│ API  │    │ (Postgres)│    │Dashboard │
  └──────┘    └────┬───┘    └──────┘    └──────────┘    └──────────┘
                   │
                   ├──→ Email digests
                   └──→ Scheduled backups

  Alternative B (OpenClaw):
  ┌──────┐    ┌────────────────┐    ┌──────────┐    ┌──────────┐
  │ LINE │───→│   OpenClaw     │───→│ Supabase │───→│ Metabase │
  │  OA  │←───│ (LINE+Claude)  │    │ (Postgres)│    │Dashboard │
  └──────┘    └────────────────┘    └──────────┘    └──────────┘
                                         │
                                    cron: backups
                                    cron: email digests
```

**What you get (in addition to Lean):**
- Proper relational database — structured tables for customers, products, activities, deals
- AI validation layer — if message is ambiguous, bot asks rep for clarification in LINE
- Rich dashboard with:
  - Revenue pipeline by stage (lead → won/lost)
  - Per-rep performance scorecard
  - Product category breakdown (Megger vs CRC vs Fluke)
  - Monthly/quarterly trends
  - Activity heatmap (visits per week)
- Role-based views: Sales Manager sees team detail, C-suite sees top-line KPIs
- Data export to Excel for ad-hoc reporting
- Historical data for trend analysis

**Limitations:**
- Requires someone to manage the VPS (updates, monitoring) — but minimal effort
- Dashboard not branded (Metabase default UI)
- No mobile app — but Metabase is mobile-responsive in browser
- **Alt A only:** n8n adds another service to maintain alongside the LINE webhook configuration
- **Alt B only:** Non-LINE scheduled tasks (email digests, backups) need separate scripting since OpenClaw focuses on the messaging pipeline

**Best for:** Full team rollout with real business value.

---

### Tier 3 — PREMIUM (Enterprise-Grade)

**Goal:** Polished, scalable, branded solution with advanced analytics and integrations.
**Timeline:** 8–12 weeks to set up
**Monthly Cost:** ~฿15,000–35,000/month (~$400–1,000 USD)

#### Alternative A: n8n Workflow

| Component | Tool | Notes |
|-----------|------|-------|
| LINE Integration | LINE Official Account + Rich Menus | Guided input forms inside LINE |
| Workflow Engine | n8n self-hosted on cloud VM (redundant) | With monitoring & auto-restart |
| AI Parsing | Claude API (Sonnet/Opus) with fine-tuned prompts | Higher accuracy, Thai language optimized |
| AI Features | Anomaly detection, forecasting, smart nudges | "Rep X hasn't reported in 3 days" |
| Database | Supabase Pro or managed Postgres (e.g., AWS RDS) | Scalable, backed-up, monitored |
| Dashboard | Custom Next.js dashboard or Retool | Branded, tailored to ATE's needs |
| Mobile | PWA (Progressive Web App) for management | Installable on phone, works offline |
| Notifications | LINE + Email + push notifications | Configurable alert rules |
| Integrations | Connect to accounting software, ERP if applicable | Future-proof |
| Security | Role-based access, audit log, data encryption | Compliance-ready |

#### Alternative B: OpenClaw Gateway

| Component | Tool | Notes |
|-----------|------|-------|
| LINE Integration + AI Gateway | OpenClaw (self-hosted on cloud VM, redundant) | Built-in LINE plugin with Rich Menu support, flex messages, group chat, media handling |
| AI Parsing | Claude API (Sonnet/Opus) with fine-tuned prompts | Higher accuracy, Thai language optimized |
| AI Features | Multi-agent routing via OpenClaw + anomaly detection, forecasting, smart nudges | "Rep X hasn't reported in 3 days" — leveraging OpenClaw's multi-agent and memory features |
| Database | Supabase Pro or managed Postgres (e.g., AWS RDS) | Scalable, backed-up, monitored |
| Dashboard | Custom Next.js dashboard or Retool | Branded, tailored to ATE's needs |
| Mobile | PWA (Progressive Web App) for management | Installable on phone, works offline |
| Notifications | LINE replies via OpenClaw + Email + push notifications | Configurable alert rules |
| Integrations | Connect to accounting software, ERP if applicable | API calls from OpenClaw agents or separate integration layer |
| Security | Role-based access, audit log, data encryption | Compliance-ready |

> **Key difference:** At the Premium tier, OpenClaw's multi-agent routing becomes a significant advantage — different agents can handle different report types (visits, sales, follow-ups) with specialized prompts and memory. For non-LINE integrations (ERP, accounting), a lightweight integration layer or script would supplement OpenClaw, whereas n8n handles these natively through its connector library.

#### Premium Architecture Diagram

```
  Alternative A (n8n):
  ┌──────┐    ┌─────────────────────────┐    ┌──────────┐    ┌─────────────┐
  │ LINE │───→│         n8n             │───→│ Managed  │───→│   Custom    │
  │  OA  │←───│  ┌─────────────────┐    │    │ Postgres │    │  Next.js    │
  │ Rich │    │  │ Parsing workflow│    │    │ (AWS RDS)│    │  Dashboard  │
  │ Menu │    │  │ Alert workflow  │    │    └──────────┘    │  + PWA      │
  │      │    │  │ Digest workflow │    │                    └─────────────┘
  │      │    │  │ ERP sync flow  │    │         ┌──────────┐
  │      │    │  └─────────────────┘    │────────→│ ERP /    │
  │      │    └─────────────────────────┘         │Accounting│
  └──────┘                                        └──────────┘

  Alternative B (OpenClaw + supplementary):
  ┌──────┐    ┌─────────────────────────┐    ┌──────────┐    ┌─────────────┐
  │ LINE │───→│       OpenClaw          │───→│ Managed  │───→│   Custom    │
  │  OA  │←───│  ┌───────────────────┐  │    │ Postgres │    │  Next.js    │
  │ Rich │    │  │ Sales Parse Agent │  │    │ (AWS RDS)│    │  Dashboard  │
  │ Menu │    │  │ Follow-up Agent   │  │    └──────────┘    │  + PWA      │
  │      │    │  │ Nudge Agent       │  │                    └─────────────┘
  │      │    │  └───────────────────┘  │         ┌──────────┐
  │      │    └─────────────────────────┘    ┌───→│ ERP /    │
  └──────┘                                   │    │Accounting│
                                     cron/scripts └──────────┘
```

**What you get (in addition to Mid):**
- **LINE Rich Menu** — reps tap buttons to choose report type (visit, sale, follow-up) for more structured input
- **Smart AI features:**
  - Auto-categorize products from message context
  - Flag unusual deals (e.g., discount > 30%)
  - Weekly AI-generated summary email to C-suite
  - Revenue forecasting based on pipeline data
  - "Nudge" notifications: remind reps to follow up on pending deals
- **Branded dashboard** with ATE logo, Thai language UI
- **Advanced analytics:**
  - Win/loss analysis by product category, customer segment, rep
  - Customer lifetime value tracking
  - Sales cycle duration analysis
  - Territory/region performance map
- **Audit trail** — every data change is logged
- **Multi-channel input** — LINE + optional web form for detailed reports
- **API ready** — can connect to future ERP/accounting systems

**Limitations:**
- Higher cost and initial setup effort
- Needs a developer or vendor for initial build (can be outsourced)
- Ongoing maintenance more involved (though still manageable)
- **Alt A only:** n8n workflow complexity grows significantly at this tier — many interconnected workflows to manage
- **Alt B only:** ERP/accounting integrations require custom scripting outside OpenClaw; fewer pre-built connectors than n8n

**Best for:** Long-term strategic investment, especially if planning to scale the sales team.

---

## 4. Comparison Matrix

### Tier-by-Tier Feature Comparison

```
Feature                      │  LEAN         │  MID            │  PREMIUM
─────────────────────────────┼───────────────┼─────────────────┼─────────────────
LINE message collection      │  Yes          │  Yes            │  Yes
AI parsing (TH + EN)        │  Basic        │  + clarification│  + validation
Dashboard                    │  Looker Studio│  Metabase       │  Custom branded
Database                     │  Google Sheets│  Supabase       │  Managed Postgres
Real-time updates            │  Near         │  Near           │  Real-time
Per-rep tracking             │  Basic        │  Detailed       │  + AI insights
Revenue pipeline             │  No           │  Yes            │  + forecasting
Product breakdown            │  Basic        │  Yes            │  + trends
Role-based access            │  No           │  Basic          │  Full RBAC
LINE confirmation            │  Yes          │  + clarification│  + rich menu
Mobile-optimized             │  No           │  Responsive     │  PWA
Notifications                │  LINE only    │  LINE + Email   │  + push + nudges
AI anomaly detection         │  No           │  No             │  Yes
Revenue forecasting          │  No           │  No             │  Yes
ERP integration              │  No           │  No             │  Ready
─────────────────────────────┼───────────────┼─────────────────┼─────────────────
Monthly cost (est.)          │  ฿0–1,500     │  ฿3,500–7,000   │  ฿15,000–35,000
Setup time                   │  2–4 weeks    │  4–6 weeks      │  8–12 weeks
Maintenance                  │  Very low     │  Low            │  Moderate
Developer needed             │  No           │  Minimal        │  Yes (initial)
```

### Cost Breakdown Visualization

```
  Monthly Cost (THB)
  ▲
  │
  │                                            ┌──────────────┐
35K│ · · · · · · · · · · · · · · · · · · · · · │   PREMIUM    │
  │                                            │  ฿15K–35K    │
  │                                            │              │
15K│ · · · · · · · · · · · · · · · · · · · · · ├──────────────┘
  │
  │                     ┌──────────────┐
 7K│ · · · · · · · · · · │     MID      │
  │                     │ ฿3.5K–7K    │
3.5K│ · · · · · · · · · · ├──────────────┘
  │
  │  ┌──────────────┐
1.5K│ · │    LEAN      │
  │  │  ฿0–1.5K    │
  0│──┴──────────────┴──────────────────────────────────────→
       Phase 1           Phase 2              Phase 3
       (Month 1)         (Month 2-3)          (Month 4+)
```

---

## 4.5 Architecture Alternatives Comparison

### Side-by-Side Summary

```
  ┌──────────────────────────────┐     ┌──────────────────────────────┐
  │    ALT A: n8n Workflow       │     │  ALT B: OpenClaw Gateway     │
  ├──────────────────────────────┤     ├──────────────────────────────┤
  │                              │     │                              │
  │  + 400+ integrations         │     │  + Native LINE support       │
  │  + Visual no-code builder    │     │  + Simpler setup for LINE→AI │
  │  + Mature community (2019+)  │     │  + Built-in multi-agent      │
  │  + General-purpose           │     │  + Session memory included   │
  │                              │     │  + Fewer moving parts        │
  │  - Manual LINE wiring        │     │                              │
  │  - More moving parts         │     │  - Newer project             │
  │  - AI is just an API call    │     │  - Smaller community         │
  │                              │     │  - LINE-focused (not general)│
  ├──────────────────────────────┤     ├──────────────────────────────┤
  │  Best for:                   │     │  Best for:                   │
  │  Many integrations beyond    │     │  LINE → AI is the primary    │
  │  LINE, visual workflow fans  │     │  use case, simplicity first  │
  └──────────────────────────────┘     └──────────────────────────────┘
```

### Detailed Comparison

| Criteria | Alternative A: n8n | Alternative B: OpenClaw |
|----------|-------------------|------------------------|
| **Ease of setup** | Moderate — configure LINE webhook, n8n workflows, connect together. Visual builder helps. | Easier for LINE — `npm install`, configure via Control UI. LINE plugin handles everything natively. |
| **Maintenance** | Moderate — n8n updates, workflow debugging, VPS management. Workflows are visual/self-documenting. | Lower for LINE pipeline — fewer parts. Scheduled tasks (backups, digests) need cron jobs. |
| **LINE integration** | Functional but manual — wire webhooks, handle reply tokens, parse media yourself. | Native — webhooks, group chats, media, flex messages, replies as first-class features. |
| **Flexibility** | Very high — 400+ connectors (Slack, email, Sheets, Supabase, ERP, HTTP). General-purpose. | Focused on AI agent ↔ messaging. Excellent for LINE-to-AI. Non-messaging needs external tools. |
| **Community** | Mature — large community, extensive docs, active since 2019, many tutorials. | Newer — smaller community, docs maturing. MIT-licensed, open-source. |
| **Cost** | Free tier (300 exec/mo) or self-hosted (฿200–500/mo VPS). | Free (MIT). Self-hosted (฿200–500/mo VPS). No execution limits. |
| **AI features** | AI = external API call. Build routing/memory yourself. | Built-in multi-agent routing, sessions, memory. Designed for AI orchestration. |
| **Best for** | Teams wanting broad integrations, visual no-code, mature ecosystem. | Teams where LINE → AI is primary, wanting simplest path with native LINE features. |

### Decision Flowchart

```
                        ┌─────────────────────┐
                        │ Is LINE → AI your   │
                        │ PRIMARY use case?    │
                        └─────────┬───────────┘
                                  │
                        ┌─────────┴─────────┐
                        │                   │
                       YES                  NO
                        │                   │
                        ▼                   ▼
               ┌────────────────┐  ┌────────────────┐
               │ Do you need    │  │                │
               │ ERP/accounting │  │  Choose Alt A  │
               │ integration    │  │    (n8n)       │
               │ RIGHT NOW?     │  │                │
               └───────┬────────┘  └────────────────┘
                       │
              ┌────────┴────────┐
              │                 │
             YES                NO
              │                 │
              ▼                 ▼
     ┌────────────────┐  ┌────────────────┐
     │  Choose HYBRID │  │  Choose Alt B  │
     │  OpenClaw +    │  │  (OpenClaw)    │
     │  n8n for ERP   │  │                │
     └────────────────┘  └────────────────┘
```

---

## 5. Recommended Approach

### Start Lean → Graduate to Mid → Expand to Premium

#### Architecture Decision

We recommend **Alternative B (OpenClaw)** as the starting point:

```
  WHY OPENCLAW FOR ATE:

  ✓  Core use case = LINE → AI → Database (exactly what OpenClaw does)
  ✓  Built-in LINE plugin = no webhook wiring headaches
  ✓  Fewer moving parts = faster pilot, less maintenance
  ✓  Multi-agent + memory = built in for future growth
  ✓  No dev team needed = critical for ATE's team composition
```

However, **Alternative A (n8n) remains a strong choice** if:
- The team is already familiar with n8n or similar workflow tools
- There are near-term plans to integrate with ERP, accounting, or non-LINE channels
- Stakeholders prefer a visual no-code workflow builder with a mature community

A **hybrid approach** is also possible: start with OpenClaw for the LINE ↔ AI pipeline, and add n8n later for scheduled tasks and non-LINE integrations as the system grows.

#### Phased Rollout

```
  MONTH 1              MONTH 2-3              MONTH 4+
  ┌────────────┐       ┌────────────┐         ┌────────────┐
  │            │       │            │         │            │
  │   LEAN     │──────→│    MID     │────────→│  PREMIUM   │
  │   (Pilot)  │       │ (Full Team)│         │(Enterprise)│
  │            │       │            │         │            │
  └────────────┘       └────────────┘         └────────────┘

  • 2-3 reps           • All 11 reps          • Evaluate ROI
  • Google Sheets       • Supabase             • Custom dashboard?
  • Looker Studio       • Metabase             • AI forecasting?
  • Validate AI         • Train team           • ERP integration?
    parsing             • Train management     • Add n8n if needed
```

1. **Phase 1 (Month 1):** Deploy Lean tier with 2–3 willing reps as pilot
   - Choose Alternative A or B (see Section 4.5 for guidance)
   - Validate that AI can accurately parse Thai LINE messages about ATE products
   - Get feedback from pilot reps and management
   - Measure: parsing accuracy, data completeness, dashboard usefulness

2. **Phase 2 (Month 2–3):** Upgrade to Mid tier, roll out to full team of 11
   - Migrate data to Supabase
   - Deploy Metabase dashboard
   - Train all reps (minimal training needed — they just keep using LINE)
   - Train management on dashboard usage

3. **Phase 3 (Month 4+):** Evaluate Premium features based on ROI
   - Add features that provide most value based on real usage data
   - Consider custom dashboard only if Metabase doesn't meet needs
   - If using OpenClaw, evaluate whether n8n should be added for non-LINE integrations

---

## 6. Key Risks & Mitigations

### Risk Heat Map

```
  IMPACT
  HIGH   │  AI misparse ●      │  OpenClaw abandonment ○  │  Claude API outage ●
         │                     │  VPS downtime ●          │
  ───────┼─────────────────────┼──────────────────────────┼──────────────────
  MEDIUM │  Privacy concerns ● │  n8n complexity ◐        │  Cost spike ●
         │  Reps stop posting ●│  OpenClaw docs ○         │
  ───────┼─────────────────────┼──────────────────────────┼──────────────────
  LOW    │                     │  LINE API changes ●      │  Key person leaves ●
         │                     │  Node 22 compat ○        │
  ───────┼─────────────────────┼──────────────────────────┼──────────────────
         │       LOW           │       MEDIUM             │       HIGH
                                   LIKELIHOOD

  ● = General risk   ◐ = Alt A (n8n) risk   ○ = Alt B (OpenClaw) risk
```

### General Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| AI misparses Thai messages | Incorrect data in dashboard | Validation layer: bot confirms parsed data with rep; human review queue |
| Reps stop using LINE group | No data collected | This is existing behavior, not new; add gentle reminders |
| LINE API changes/limits | System breaks | LINE Messaging API is stable; monitor announcements |
| VPS downtime | Dashboard unavailable | Use managed hosting with auto-restart; not critical for daily operations |
| Data privacy concerns | Employee pushback | Clarify: system only reads sales-related messages from dedicated group |
| Claude API cost spikes | Budget overrun | Set usage limits; use Haiku model for routine parsing |
| Key person leaves | No one can maintain | Document everything; keep architecture simple and well-documented |

### Alternative A (n8n) Specific Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| n8n workflow complexity grows | Hard to debug, fragile | Keep workflows modular; use sub-workflows; document each workflow's purpose |
| n8n Cloud free tier limits (300 exec/mo) | System stops processing messages mid-month | Self-host n8n to remove execution limits |
| LINE webhook token management | Messages not delivered or replies fail | Implement token refresh logic; monitor webhook health in n8n |

### Alternative B (OpenClaw) Specific Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| OpenClaw is a newer project | Potential bugs, breaking changes in updates | Pin to a stable version; test updates in staging before production; monitor the GitHub repo for issues |
| Smaller community | Fewer resources for troubleshooting | Engage directly with the project maintainers; contribute bug reports; maintain internal documentation of solutions |
| Documentation still maturing | Slower onboarding, harder troubleshooting | Supplement with internal setup guides; document ATE-specific configuration thoroughly |
| Node 22+ requirement | Server compatibility | Ensure VPS runs Node 22+; use nvm for version management |
| Non-LINE integrations need separate tooling | Additional development for ERP, email, etc. | Plan for hybrid approach (add n8n or scripts) if non-LINE integrations are needed |
| Project abandonment risk (open-source) | No future updates or security patches | MIT license means code is always available to fork; evaluate project health (commit frequency, issue responsiveness) periodically |

---

## 7. Open Questions for Next Meeting

```
  PRIORITY          QUESTION                                              IMPACTS
  ─────────────────────────────────────────────────────────────────────────────────
  ★★★ HIGH    LINE group setup — dedicated "Sales Reports" group?     System design
  ★★★ HIGH    Reporting frequency — daily, per-visit, weekly?         AI prompt, dashboard
  ★★★ HIGH    Budget approval — who signs off on monthly costs?       Tier selection
  ★★☆ MED     Existing customer/product lists in digital format?      AI accuracy
  ★★☆ MED     Current KPIs or targets the team is measured against?   Dashboard metrics
  ★★☆ MED     Who gets dashboard access? (names and roles)            RBAC setup
  ★★☆ MED     Capture photos? (site visits, quotations, POs)         Media handling
  ★☆☆ LOW     Preferred cloud provider / IT policy restrictions?      Hosting
  ★☆☆ LOW     Accounting or ERP system to connect to?                 Integration scope
  ★☆☆ LOW     Data retention policy — how long to keep data?          Storage planning
  ★☆☆ LOW     Dashboard language — Thai, English, bilingual?          UI design
  ★☆☆ LOW     Most frequently sold products/brands?                   AI prompt tuning
```

---

## 8. Next Steps

```
  STEP    ACTION                                        OWNER        WHEN
  ─────────────────────────────────────────────────────────────────────────
   1      Review this document with stakeholders         You          Week 1
   2      Choose Alt A (n8n) or Alt B (OpenClaw)         Stakeholders Week 1
   3      Decide pilot scope (which reps, which group)   Sales Mgr    Week 1
   4      Set up LINE Official Account                   You          Week 2
   5      Build Lean tier PoC on test LINE group         You          Week 2-3
   6      Demo to management for feedback                You          Week 4
   7      Iterate based on feedback                      You          Week 4+
```

---

## Appendix

### A. Document Index

| # | File | Description |
|---|------|-------------|
| 0 | `ATE_Sales_Report_System_Proposal.md` | This document — master proposal |
| 1 | `01_LINE_Setup_Guide.md` | LINE Official Account + Messaging API setup |
| 2 | `02_Claude_API_Prompt_Design.md` | AI parsing prompt, 10 examples, cost estimates |
| 3 | `03_Google_Sheets_Template.md` | 5-sheet data structure with sample data |
| 4 | `04_n8n_Workflow_Guide.md` | Alternative A — n8n workflow setup guide |
| 5 | `05_OpenClaw_Setup_Guide.md` | Alternative B — OpenClaw gateway setup guide |

### B. Glossary

| Term | Definition |
|------|-----------|
| **LINE OA** | LINE Official Account — business account that can receive messages via API |
| **n8n** | Open-source workflow automation tool (visual, no-code) |
| **OpenClaw** | Self-hosted AI gateway with native chat app integrations (MIT license) |
| **Claude** | Anthropic's AI model used for parsing Thai/English messages |
| **Supabase** | Open-source Firebase alternative (Postgres database + REST API) |
| **Metabase** | Open-source business intelligence / dashboard tool |
| **PWA** | Progressive Web App — installable on phone from browser |
| **VPS** | Virtual Private Server — cloud hosting (e.g., DigitalOcean) |
| **Webhook** | HTTP callback — LINE sends a POST request when a message is received |
| **RBAC** | Role-Based Access Control — different views for different user roles |

### C. Example: What a Sales Rep Sees

```
  ┌─────────────────────────────────────────────┐
  │              LINE Group Chat                 │
  │                                              │
  │  สมชาย:                                      │
  │  ไปเยี่ยม PTT วันนี้ เสนอ Megger MTO330      │
  │  ราคา 150,000 ลูกค้าสนใจมาก                   │
  │  นัด follow up อาทิตย์หน้า                     │
  │                                              │
  │  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
  │                                              │
  │  ATE Sales Bot:                              │
  │  รับทราบครับ บันทึกแล้ว:                       │
  │  • เข้าพบลูกค้า: PTT                          │
  │  • สินค้า: Megger MTO330                      │
  │  • มูลค่า: ฿150,000                           │
  │  • สถานะ: เสนอราคาแล้ว                        │
  │  • Follow up: อาทิตย์หน้า                      │
  │                                              │
  └─────────────────────────────────────────────┘
```

### D. Example: What Management Sees (Dashboard)

```
  ┌─────────────────────────────────────────────────────────────────────┐
  │  ATE Sales Dashboard                              March 2026       │
  ├─────────────────┬─────────────────┬─────────────────┬──────────────┤
  │  Total Revenue  │  Active Deals   │  Visits Today   │  Conversion  │
  │  ฿2,450,000     │  23             │  8              │  34%         │
  │  ▲ 12% vs Feb   │  ▲ 3 new        │  ■■■■■■■■□□    │  ▲ 2%        │
  ├─────────────────┴─────────────────┴─────────────────┴──────────────┤
  │                                                                     │
  │  Pipeline by Stage                Revenue by Brand                  │
  │  ┌────────────────────────┐       ┌────────────────────────┐       │
  │  │ Lead         ████ 12   │       │ Megger    ████████ 45% │       │
  │  │ Negotiation  ███  8    │       │ Fluke     █████   28%  │       │
  │  │ Quotation    ██   5    │       │ CRC       ███     15%  │       │
  │  │ Won          ████ 11   │       │ Salisbury ██      8%   │       │
  │  │ Lost         █    3    │       │ Other     █       4%   │       │
  │  └────────────────────────┘       └────────────────────────┘       │
  │                                                                     │
  │  Top Reps This Month              Recent Activity                   │
  │  ┌────────────────────────┐       ┌────────────────────────────┐   │
  │  │ 1. สมชาย    ฿580K     │       │ 14:30 สมชาย visited PTT   │   │
  │  │ 2. วิภา     ฿420K     │       │ 13:15 วิภา  closed EGAT   │   │
  │  │ 3. ธนา      ฿350K     │       │ 11:00 ธนา   called SCG    │   │
  │  │ 4. มานะ     ฿290K     │       │ 10:30 มานะ  quoted IRPC   │   │
  │  └────────────────────────┘       └────────────────────────────┘   │
  └─────────────────────────────────────────────────────────────────────┘
```

---

*This document is a living draft. It will be updated after each stakeholder discussion.*
