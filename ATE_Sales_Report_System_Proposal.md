# ATE Sales Report System — Implementation Overview

> **Company:** Advanced Technology Equipment Co., Ltd. (ATE)
> **Industry:** B2B Industrial Maintenance Equipment & Chemicals Distributor
> **Sales Team Size:** ~11 field representatives
> **Location:** Bangkok, Thailand
> **Demo Date:** March 14, 2026
> **Status:** Implemented — live demo system running on free-tier infrastructure

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [What We Built](#2-what-we-built)
3. [Architecture](#3-architecture)
4. [Tech Stack](#4-tech-stack)
5. [Key Features](#5-key-features)
6. [Data Model](#6-data-model)
7. [Cost](#7-cost)
8. [ROI & Business Impact](#8-roi--business-impact)
9. [Risks & Mitigations](#9-risks--mitigations)
10. [What's Next](#10-whats-next)

---

## 1. Problem Statement

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

**Pain points:** No standard format, scattered data, no real-time visibility, low reporting compliance, no historical trends.

---

## 2. What We Built

An AI-powered sales reporting system where reps send natural Thai-language LINE messages and the system automatically extracts structured data, writes it to a spreadsheet, and feeds a live dashboard — all at zero cost.

```
  ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
  │ COLLECT  │────→│  PARSE   │────→│  STORE   │────→│ DISPLAY  │────→│  REPLY   │
  │ passively│     │  with AI │     │  Google  │     │  Looker  │     │ via LINE │
  │ via LINE │     │ (Gemini) │     │  Sheets  │     │  Studio  │     │          │
  └──────────┘     └──────────┘     └──────────┘     └──────────┘     └──────────┘
    Zero effort      Thai/English     Dual-write       Real-time        Confirmation
    from reps        understanding    Live Data +      KPIs &           + soft nudge
                                      Sheet1           insights         if incomplete
```

---

## 3. Architecture

```
  ┌──────────┐     ┌──────────────────────┐     ┌──────────┐     ┌──────────────┐
  │  Phone   │     │   Vercel Serverless  │     │  Google  │     │ Google Looker│
  │  (LINE)  │────→│   Python Function    │────→│  Sheets  │────→│    Studio    │
  │          │←────│                      │     │          │     │  Dashboard   │
  └──────────┘     │  Gemini 2.5 Flash    │     └──────────┘     └──────────────┘
                   │  (Groq fallback)     │
                   └──────────────────────┘

  Flow:
  1. Sales rep sends Thai message in LINE group
  2. LINE forwards webhook POST to Vercel
  3. Vercel function calls Gemini AI to parse the message
  4. Structured data is written to Google Sheets (dual-write: Sheet1 + Live Data)
  5. Bot replies in LINE with confirmation or soft nudge for missing fields
  6. Looker Studio dashboard reads from Google Sheets in near-real-time
```

**Key architecture decisions:**
- **Direct `urllib.request`** for all external APIs (Gemini, Groq, LINE) — no SDKs, no version conflicts on Vercel
- **Lazy imports** for gspread/google-auth inside functions to avoid Vercel module-level import errors
- **Dual-write:** webhook writes to "Live Data" tab (permanent archive) and Sheet1 (demo/dashboard view)
- **Batch ID** (MSG-XXXXX) groups multi-activity messages; item labels (1/3, 2/3, 3/3)

---

## 4. Tech Stack

All free tiers. Zero monthly cost.

| Component | Tool | Cost |
|-----------|------|------|
| Messaging | LINE Official Account (Messaging API) | Free |
| Server | Vercel serverless Python | Free tier |
| AI (primary) | Gemini 2.5 Flash | Free tier |
| AI (fallback) | Groq — Llama 3.3 70B | Free tier |
| Database | Google Sheets via gspread 6.1.4 + google-auth 2.38.0 | Free |
| Dashboard | Google Looker Studio | Free |
| **Total** | | **$0/month** |

---

## 5. Key Features

**Data pipeline:**
- LINE message → AI extraction → Google Sheets → Looker Studio (end-to-end in seconds)
- 17 columns (A-Q): Timestamp, Rep, Customer, Product, Brand, Revenue, Activity Type, Sales Stage, Payment Status, etc.
- Conditional cell coloring on Activity Type, Sales Stage, Payment Status columns
- Data validation dropdowns on key columns

**Nudge system (3-tier):**
- 0 missing fields: clean confirmation only
- 1-2 missing fields: confirmation + gentle hint
- 3+ missing fields: confirmation + hint + example message

**Dashboard (Looker Studio):**
- KPI cards (total revenue, active deals, visits)
- Pipeline chart by sales stage
- Brand mix breakdown
- Activity feed with latest entries

**Demo data:**
- 31 sample rows with realistic deal progression stories
- Source column distinguishes `live` (bot entries) from `sample` (generated data)
- Backup system (max 3 backups) for safe re-population

---

## 6. Data Model

```
┌─────────────────────────────────────────────────────────────┐
│                    SALES ACTIVITY RECORD                     │
│                    (17 columns, A–Q)                         │
├──────────────┬──────────────────────────────────────────────┤
│  Timestamp   │  Auto-generated (Bangkok timezone)           │
│  Rep Name    │  From LINE display name                      │
│  Customer    │  Company name extracted by AI                │
│  Product     │  Brand + model extracted by AI               │
│  Revenue     │  Deal value (THB)                            │
│  Activity    │  Visit / Call / Quotation / Follow-up        │
│  Pipeline    │  Lead → Negotiation → Quotation → Won/Lost  │
│  Payment     │  Pending → Partial → Paid                   │
│  Batch ID    │  MSG-XXXXX (groups multi-item messages)      │
│  Source      │  live / sample                               │
│  Summary     │  AI-generated English summary                │
└──────────────┴──────────────────────────────────────────────┘

Tabs: Sheet1 (demo), Live Data (permanent), Legend, Backup_* (max 3)
```

---

## 7. Cost

```
  Current (Demo / Phase 1):   $0/month  — all free tiers
  Projected at full team:     $0/month  — free tiers are generous enough for 11 reps
```

The entire system runs on free tiers. Gemini 2.5 Flash free tier provides ample capacity for the team's daily reporting volume. Groq free tier serves as a fallback. Vercel free tier handles the webhook traffic. Google Sheets and Looker Studio are free.

---

## 8. ROI & Business Impact

| Before | After |
|--------|-------|
| No visibility into daily sales activity | Real-time dashboard updated in seconds |
| Manager chases reps manually for updates | Data flows automatically from LINE |
| No standard format — every rep different | AI normalizes all messages into structured rows |
| No historical data for analysis | Every interaction is logged with timestamps |
| Reporting feels like a chore | Reps just type naturally in LINE (zero behavior change) |

**Expected improvements:**
- Reporting compliance: from sporadic to near-100% (reps are already using LINE)
- Manager time saved: 1-2 hours/day previously spent collecting reports
- Data-driven decisions: pipeline visibility, brand mix, rep performance
- Zero training needed: reps continue using LINE as they already do

---

## 9. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| AI misparses Thai messages | Incorrect data | Nudge system asks for missing fields; human review possible in Sheets |
| Gemini free tier rate limits | Messages queue up | Groq Llama 3.3 70B as automatic fallback |
| Vercel cold starts | Slight delay on first message | Acceptable for this use case (seconds, not minutes) |
| Google Sheets row limits | Long-term data capacity | Sufficient for Phase 1; migrate to database in Phase 2 |
| LINE API changes | Webhook breaks | LINE Messaging API is stable; direct urllib calls are easy to update |
| Data privacy concerns | Employee pushback | System only reads messages from the dedicated sales reporting group |

---

## 10. What's Next

This demo system proves the concept works end-to-end at zero cost. Future phases can add:

- Database backend (Supabase/Postgres) for better data integrity
- Richer dashboard (Metabase or custom Next.js)
- LINE Rich Menu for guided input
- AI-powered forecasting and anomaly detection
- ERP/accounting integration

See **[08_Roadmap.md](./08_Roadmap.md)** for the detailed Phase 2 plan.

---

## Key Files

| File | Purpose |
|------|---------|
| `demo/api/webhook.py` | Main serverless function (LINE webhook → Gemini → Sheets → reply) |
| `demo/populate_sample_data.py` | 31 sample rows + formatting + backup system |
| `demo/requirements.txt` | gspread 6.1.4, google-auth 2.38.0 (no SDKs — all direct urllib) |

---

## Appendix: Document Index

| # | File | Description |
|---|------|-------------|
| 0 | `ATE_Sales_Report_System_Proposal.md` | This document — implementation overview |
| 1 | `01_LINE_Setup_Guide.md` | LINE Official Account + Messaging API setup |
| 2 | `02_Claude_API_Prompt_Design.md` | AI parsing prompt design and examples |
| 3 | `03_Google_Sheets_Template.md` | Sheet structure with sample data |
| 8 | `08_Roadmap.md` | Phase 2 plans and future roadmap |
