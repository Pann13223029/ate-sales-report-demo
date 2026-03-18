# ATE Sales Report System — Phase 2 Implementation Plan

> **Created:** 2026-03-15
> **Completed:** 2026-03-18
> **Status:** Complete — all features implemented in `demo/api/webhook.py`
> **Context:** Requirements gathered from demo feedback (Mar 14) + expert panel consensus (Mar 15)

---

## Table of Contents

1. [Requirements Summary](#1-requirements-summary)
2. [Schema Changes](#2-schema-changes)
3. [Sales Stage / Activity Type / Status Revisions](#3-sales-stage--activity-type--status-revisions)
4. [Architecture Changes](#4-architecture-changes)
5. [New Features](#5-new-features)
6. [Dashboard Configuration Guide](#6-dashboard-configuration-guide)
7. [Expert Panel Decisions](#7-expert-panel-decisions)
8. [Implementation Order](#8-implementation-order)
9. [Changelog](#9-changelog)

---

## 1. Requirements Summary

16 feature requests from demo feedback session (Mar 14, 2026):

| # | Feature | Category | Status |
|---|---------|----------|--------|
| 1 | Visit stage: `visited`, `plan_to_visit` (with date) | Sales Stage | Done |
| 2 | 7-day stale deal push notification to reps | Automation | Done |
| 3 | Payment status: rename `partial` → `deposit` | Schema | Done |
| 4 | Add Contact Channel column (phone, email, visit) | Schema | Done |
| 5 | Individual sheet per rep + combined auto-sheet | Architecture | Done |
| 6 | Visibility control: rep sees only own sheet, management sees all | Permissions | Done |
| 7 | Separate "Major Opportunity" sheet for Megger | New Sheet | Done |
| 8 | Service/warranty activity type (`sent_to_service`, no sales stage) | Activity Type | Done |
| 9 | Switch to 1-on-1 LINE reporting (no group chat) | LINE Config | Done |
| 10 | Training flag (Accompanying Rep + auto-flag) | New Columns | Done |
| 11 | Equipment Defect sales stage | Sales Stage | Done |
| 12 | `job_expired` stage + hide from main dashboard | Sales Stage | Done |
| 13 | Close Reason (AI-filled) + Manager Notes (manual) | New Columns | Done |
| 14 | `bidding` stage + Bidding Date column (government procurement) | Sales Stage + Column | Done |
| 15 | Add HVOP (KATO tech) to product brands | Brand List | Done |
| 16 | Product segment auto-match from product name | Future (data pending) | Postponed |

---

## 2. Schema Changes

### Column Layout: 17 → 24 columns (A-X)

| Col | Field | Status | Notes |
|-----|-------|--------|-------|
| A | Timestamp | Existing | |
| B | Rep Name | Existing | |
| C | Customer | Existing | |
| D | Contact Person | Existing | |
| E | Contact Channel | **NEW** | phone / email / visit |
| F | Product Brand | Existing | Add HVOP (KATO tech) |
| G | Product Name | Existing | |
| H | Quantity | Existing | |
| I | Deal Value (THB) | Existing | |
| J | Activity Type | Existing | Add `sent_to_service` |
| K | Sales Stage | Existing | Revised (see section 3) |
| L | Payment Status | Existing | `partial` → `deposit` |
| M | Planned Visit Date | **NEW** | For `plan_to_visit` stage |
| N | Bidding Date | **NEW** | Submission deadline for government bids |
| O | Accompanying Rep | **NEW** | Name of 2nd rep on visit |
| P | Training Flag | **NEW** | Auto-set `yes` when Accompanying Rep is filled |
| Q | Close Reason | **NEW** | AI-filled only on terminal stages |
| R | Follow-up Notes | Existing | |
| S | Summary (EN) | Existing | |
| T | Raw Message | Existing | |
| U | Batch ID | Existing | |
| V | Item # | Existing | |
| W | Source | Existing | `live` / `sample` |
| X | Manager Notes | **NEW** | Blank — for management manual input only |

### Column Grouping

| Group | Columns | Purpose |
|-------|---------|---------|
| Who/When | A-B | Timestamp + reporter |
| Customer | C-E | Customer info + contact channel |
| Product | F-H | Brand, name, quantity |
| Deal | I-L | Value, activity, stage, payment |
| Dates | M-N | Planned visit, bidding deadline |
| Team | O-P | Accompanying rep, training flag |
| Close/Notes | Q-R-S | Close reason, follow-up, summary |
| Raw Data | T-V-W | Raw message, batch ID, item #, source |
| Management | X | Manager notes (manual) |

---

## 3. Sales Stage / Activity Type / Status Revisions

### Sales Stage (revised)

| Stage | Description | Show on Dashboard? |
|-------|-------------|-------------------|
| `lead` | Initial contact/interest | Yes |
| `plan_to_visit` | Visit scheduled (with planned date) | Yes |
| `visited` | Visit completed | Yes |
| `negotiation` | Active price/terms discussion | Yes |
| `quotation_sent` | Formal quotation submitted | Yes |
| `bidding` | Government procurement bid submitted (with bidding date) | Yes |
| `closed_won` | Deal won (with close reason: discount given, etc.) | Yes |
| `closed_lost` | Lost to competitor (with close reason: why) | Yes |
| `job_expired` | Deal died — customer ghosted / no budget / went silent | **No** (hidden) |
| `equipment_defect` | Demo/test failed due to defective equipment | **No** (hidden) |

### Activity Type (revised)

| Type | Description | Has Sales Stage? |
|------|-------------|-----------------|
| `visit` | In-person customer visit | Yes |
| `call` | Phone call | Yes |
| `quotation` | Sent quotation | Yes |
| `follow_up` | Follow-up contact | Yes |
| `closed_won` | Closed the deal | Yes |
| `closed_lost` | Lost the deal | Yes |
| `sent_to_service` | Warranty/repair service entry | **No** (leave stage blank) |
| `other` | Other activity | Optional |

### Payment Status (revised)

| Status | Change |
|--------|--------|
| `pending` | Unchanged |
| `deposit` | Renamed from `partial` |
| `paid` | Unchanged |

### Product Brands (revised)

Added: **HVOP (KATO tech)**

Full list: Megger, Fluke, CRC, Salisbury, SmartWasher, IK Sprayer, HVOP, Other

---

## 4. Architecture Changes

### Sheet Structure (revised)

```
Spreadsheet
├── Combined          ← Replaces Sheet1. All reps' data. Visible to all.
├── สมชาย             ← Personal sheet. Protected: only สมชาย + management.
├── วิภา              ← Personal sheet. Protected: only วิภา + management.
├── ธนกฤต             ← Personal sheet. Protected: only ธนกฤต + management.
├── ...               ← Auto-created on first message from new rep.
├── Major Opportunity ← Auto-copy of all Megger deals.
├── Live Data         ← Permanent record. Never cleared.
├── Legend            ← Color coding + product segment reference.
└── Backup_*          ← Timestamped backups (max 3).
```

### Write Flow (per message)

```
LINE message from rep
  → AI parses
  → Write to rep's personal sheet (auto-create if first time)
  → Write to Combined sheet
  → Write to Live Data tab
  → If Megger deal: also write to Major Opportunity tab
  → Reply to LINE
```

### Individual Sheet Behavior

- **Created dynamically** on rep's first message (no hardcoded config)
- **Named** by LINE display name
- **Protected** via Google Sheets API (only service account + rep can edit)
- **Same 24-column schema** as Combined sheet
- **Limitation:** True per-user view restriction requires separate spreadsheet files. Current approach uses protection (edit restriction, not view restriction).

### Reporting Mode

- **1-on-1 only** — reps message the bot directly, no group chat
- Bot still identifies sender via LINE user profile

---

## 5. New Features

### 5.1 Update Existing Entries

**Explicit update:**
```
อัพเดท MSG-A1B2C สถานะเจรจา ราคาลดเหลือ 2.8 ล้าน
```
→ Bot finds Batch ID, updates row in all sheets, replies with before→after summary.

**Smart match detection (plain messages):**
```
PTT MTO330 ลดราคาเหลือ 2.8 ล้าน
```
→ Bot detects existing PTT/MTO330 deal, shows match:
> "พบดีลที่ตรงกัน:
> 📋 MSG-A1B2C | PTT / Megger MTO330 / ฿3,050,000 / quotation_sent
>
> ตอบ: `อัพเดท MSG-A1B2C` หรือพิมพ์ต่อเพื่อสร้างรายการใหม่"

### 5.2 Stale Deal Push Notification

- **Trigger:** External cron (GitHub Actions) hits `/api/stale-check` every Monday
- **Logic:** Scan combined sheet for deals with no update in 7+ days
- **Recipients:** Each rep gets their own stale deal list via LINE push
- **Message format:**
> "คุณมี 3 ดีลที่ไม่มีอัพเดท 7+ วัน:
> 1. PTT / Megger MTO330 / ฿3.05M (7 วัน)
> 2. IRPC / Megger DLRO200 / ฿1.45M (12 วัน)
>
> พิมพ์อัพเดทได้เลยครับ หรือถ้าดีลจบแล้ว พิมพ์: อัพเดท MSG-XXXXX job_expired"

### 5.3 Major Opportunity Sheet (Megger)

- Auto-copy **all** Megger deals to "Major Opportunity" tab
- Same 24-column schema
- Management filters what's "major" manually
- Criteria can be refined later (e.g. value threshold)

### 5.4 Updated Rich Menu Help Text

Help message updated to include:
- New activity types (`sent_to_service`)
- Update command (`อัพเดท MSG-XXXXX`)
- New stages (`plan_to_visit`, `bidding`, `job_expired`)
- Summary command (`สรุป`)

---

## 6. Dashboard Configuration Guide

### View 1: Active Pipeline (default view)

**Filter:** Sales Stage IN (`lead`, `plan_to_visit`, `visited`, `negotiation`, `quotation_sent`, `bidding`)

Shows:
- KPI scorecards: total pipeline value, deal count, avg deal size
- Bar chart by Sales Stage
- Brand breakdown (donut)
- Activity feed (table)

### View 2: Win/Loss Analysis

**Filter:** Sales Stage IN (`closed_won`, `closed_lost`)

Shows:
- Won vs Lost comparison (value + count)
- Win rate scorecard
- Close Reason breakdown (table or word cloud)
- Brand performance (which brands win/lose most)

### View 3: Stale Deals

**Filter:** Sales Stage NOT IN (`closed_won`, `closed_lost`, `job_expired`, `equipment_defect`) AND last Timestamp > 7 days ago

Shows:
- Table of stale deals sorted by days since last update
- Rep breakdown (who has most stale deals)

### View 4: Expired / Defect (archive)

**Filter:** Sales Stage IN (`job_expired`, `equipment_defect`)

Shows:
- Historical list of expired/defective deals
- Total value lost to expiry vs defect
- Useful for identifying patterns (e.g. certain products have more defects)

---

## 7. Expert Panel Decisions

| Decision | Chosen | Rationale |
|----------|--------|-----------|
| Schema expansion | 17 → 24 columns | 7 new fields cover all requirements without over-engineering |
| Training Flag | Auto-derived from Accompanying Rep | Less manual input, AI detects from message context |
| Close Reason | AI-filled on terminal stages only | Keeps column clean, no manual effort for reps |
| Individual sheets | Dynamic creation on first message | Zero config, scales with team size |
| Sheet protection | Google Sheets API protection | Edit restriction (not view). True privacy needs separate files (future) |
| Combined sheet | Bot writes to both personal + combined | Real-time sync, simple, same as existing dual-write pattern |
| Major Opportunity | Auto-copy ALL Megger deals | No value threshold — let management filter. Less logic, less risk |
| Update entries | Explicit Batch ID + smart match detection | Batch ID = direct update. Smart match = show + ask |
| Stale deal push | Weekly Monday cron + direct push to reps | Management requested direct push. Actionable with Batch IDs |
| `job_expired` | Separate from `closed_lost` | Dead deals ≠ competitor losses. Keeps pipeline clean |
| Dashboard views | 4 views: pipeline, win/loss, stale, expired | Each serves a different management need |
| Product segments | Postponed | Data not yet received from management |

---

## 8. Implementation Order

| # | Task | Effort | Dependencies | Status |
|---|------|--------|-------------|--------|
| 1 | Update schema (24 columns) + AI prompt | 2 hrs | None | Done |
| 2 | Update `populate_sample_data.py` for new schema | 1 hr | Task 1 | Done |
| 3 | Individual sheets + combined + protection | 2 hrs | Task 1 | Done |
| 4 | Major Opportunity auto-copy (Megger) | 30 min | Task 3 | Done |
| 5 | Update entry (`อัพเดท MSG-XXXXX`) | 2 hrs | Task 1 | Done |
| 6 | Smart match detection on plain messages | 1 hr | Task 5 | Done |
| 7 | Stale deal push (`/api/stale-check`) | 2 hrs | Task 3 | Done |
| 8 | Update Rich Menu help text | 15 min | Task 5 | Done |
| 9 | Dashboard configuration guide | 1 hr | Task 1 | Done |
| 10 | Deploy + test | 30 min | All | Done |

**Total estimated: ~12 hours**

---

## 9. Changelog

| Date | Change |
|------|--------|
| 2026-03-15 | Document created from demo feedback + expert panel consensus |
| 2026-03-18 | All 15 features implemented and deployed (feature #16 remains postponed) |
