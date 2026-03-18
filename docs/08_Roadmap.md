# ATE Sales Report System — Roadmap

> **Last updated:** 2026-03-14

---

## Phase 1: Core Demo (Completed)

**Goal:** Prove the concept — LINE message in, structured data out, live dashboard.
**Timeline:** 3 days (Mar 9–11, 2026)
**Status:** Done. Demo scheduled for Friday Mar 14.

### Delivered Features

| # | Feature | Status |
|---|---------|--------|
| 1 | LINE → Gemini AI → Google Sheets pipeline | Done |
| 2 | Thai/English mixed-language parsing | Done |
| 3 | Groq Llama 3.3 70B fallback if Gemini fails | Done |
| 4 | LINE reply confirmation in Thai | Done |
| 5 | Multi-activity message support (1 message → multiple rows) | Done |
| 6 | Batch ID grouping for multi-activity entries | Done |
| 7 | Nudge system for incomplete reports (3-tier) | Done |
| 8 | Google Sheets formatting (conditional colors, dropdowns, frozen headers) | Done |
| 9 | Partial data row highlighting (light red) | Done |
| 10 | 31 rows of realistic sample data with deal progression stories | Done |
| 11 | Backup system with timestamped tabs (max 3) | Done |
| 12 | Live Data tab — permanent record, separated from demo data | Done |
| 13 | Source column to distinguish live vs sample data | Done |
| 14 | Looker Studio dashboard (KPIs, pipeline chart, brand mix, activity feed) | Done |
| 15 | Debug logging cleaned up for production | Done |

### Architecture

```
Phone (LINE) → Vercel (Python) → Gemini AI → Google Sheets → Looker Studio
                                  ↓              ↓
                            LINE reply      "Live Data" tab
                          (confirmation       (permanent
                            + nudge)           record)
```

### Tech Stack

| Component | Technology | Cost |
|-----------|-----------|------|
| Serverless hosting | Vercel (free tier) | Free |
| AI parsing | Gemini 2.5 Flash (free tier, 500 req/day) | Free |
| AI fallback | Groq Llama 3.3 70B (free tier) | Free |
| Messaging | LINE Messaging API (free tier, 200 push/month) | Free |
| Database | Google Sheets via gspread | Free |
| Dashboard | Looker Studio | Free |

---

## Phase 2: Production-Ready Features

**Goal:** Turn the demo into a tool the sales team uses daily.
**Timeline:** Estimated 2-3 weeks after demo approval.

### P1 — Build Next (before full rollout)

| # | Feature | Effort | Description | Status |
|---|---------|--------|-------------|--------|
| 1 | **Monthly Summary + On-demand** | 3 hrs | Auto-push on 1st of month + on-demand via "สรุป" keyword. Gemini generates natural Thai summary from pipeline data. Monthly cadence fits ATE's cyclical sales (industrial equipment, 2-6 month deal cycles). | **On-demand: DONE.** Monthly auto-push cron: pending. |
| 2 | **LINE Rich Menu** | 2 hrs | 4-button persistent menu: สรุปยอด (summary), วิธีรายงาน (how to report), เปิด Dashboard (URL), เปิด Sheets (URL). Setup via API script + Pillow-generated image. | **DONE** |

### P2 — Enhance

| # | Feature | Effort | Description |
|---|---------|--------|-------------|
| 3 | **Photo/Receipt OCR** | 4-5 hrs | Reps snap photo of PO, receipt, or business card → Gemini Vision extracts data → auto-populate sheets. Handles Thai printed text. |
| 4 | **Monthly PDF Report** | 3-4 hrs | Auto-generate formatted PDF with charts and tables for manager meetings. Attach to LINE or email. |

### P3 — Strategic

| # | Feature | Effort | Description |
|---|---------|--------|-------------|
| 5 | **Competitor Tracking** | 2 hrs | Parse competitor names from lost-deal messages. Build a "lost reasons" dashboard — which competitors, on what products, by how much. |
| 6 | **Forecast Model** | 5+ hrs | Predict monthly/quarterly revenue from current pipeline data. Weight by sales stage probability (lead=10%, negotiation=30%, quotation=50%). |

### Decision Log

| Decision | Chosen | Rationale |
|----------|--------|-----------|
| Summary cadence | Monthly + on-demand | Industrial equipment has long sales cycles (2-6 months). Weekly summaries would highlight slow periods unnecessarily. |
| Summary AI | Gemini | Free tier (500 req/day) has plenty of headroom. 1 summary call is negligible vs 60+ daily parse calls. |
| Rich Menu | API script + Pillow | Reproducible, version-controlled. No dependency on LINE OA console. |
| Removed: Voice transcription | Cut | Low priority — reps type messages fine. Adds complexity (Whisper API) for little demo impact. |
| Removed: Multi-group support | Cut | Not needed for initial team of 5-6 reps in single group. |
| Removed: Rep leaderboard | Cut | Risk of negative competition culture. Revisit after team feedback. |
| Removed: Follow-up reminders | Cut | Deferred — need to understand ATE's existing follow-up process first. |
| Removed: CRM integration | Cut | No existing CRM confirmed. Premature to build integration. |
| Removed: Approval workflow | Cut | Adds process overhead. Revisit when deal volume justifies it. |

---

## Demo Checklist (Friday Mar 14) -- TODAY IS DEMO DAY

- [x] Set Looker Studio data freshness to 1 minute
- [x] Share dashboard link (Anyone with link → Viewer)
- [x] Test full LINE → Sheets → Dashboard flow 5+ times
- [x] Bookmark Google Sheets URL as fallback
- [x] Prepare talking points for sales manager
- [ ] Rehearse 7-minute demo script (final run-through today)

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| v1.0 | 2026-03-11 | Core pipeline — LINE → Gemini → Sheets → Reply. Includes nudge system, batch IDs, sample data, Looker Studio dashboard, backup system, Live Data tab. |
| v1.1 | 2026-03-11 | Rich Menu (4 buttons) + on-demand summary via "สรุป"/"สรุปยอด" keyword + roadmap document. |
