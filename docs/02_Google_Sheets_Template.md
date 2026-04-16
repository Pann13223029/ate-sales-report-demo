# ATE Sales Report — Google Sheets Structure

> Legacy note:
> This document describes the older demo-era Google Sheets design.
> The current rebuild still uses Google workbooks, but under a different `Telegram + Postgres + TypeScript` architecture and contract.
> Start from [../README.md](../README.md) and [08_Telegram_Postgres_Runbook.md](./08_Telegram_Postgres_Runbook.md) for the current path.

> **Purpose:** Flat 24-column Google Sheets workbook serving as database and Looker Studio data source.
> **Design:** Single-table structure with dual-write (Sheet1 for demo + Live Data for permanence).
> **Date:** 2026-03-14

---

## Visual Overview — Workbook Tabs

```
  ┌─────────────────────────────────────────────────────────────────────────┐
  │               ATE Sales Report — Data 2026                             │
  │                 (Google Sheets Workbook)                                │
  └─────────────────────────────────────────────────────────────────────────┘

  ┌───────────────────┐  ┌───────────────────┐  ┌──────────┐  ┌──────────────┐
  │  Sheet1            │  │  Live Data         │  │  Legend   │  │  Backup_*    │
  │  (demo/dashboard)  │  │  (permanent)       │  │  (color  │  │  (timestamped│
  │                    │  │                    │  │  ref)    │  │   max 3)     │
  │  Same 24-col       │  │  Same 24-col       │  │          │  │              │
  │  structure as      │  │  structure, never   │  │          │  │  Auto-created│
  │  Live Data         │  │  cleared for demos  │  │          │  │  before data │
  │                    │  │                    │  │          │  │  reset       │
  │  Source: Looker    │  │  Source: audit log  │  │          │  │              │
  │  Studio reads this │  │                    │  │          │  │              │
  └───────────────────┘  └───────────────────┘  └──────────┘  └──────────────┘
```

### Write Order

`LINE message` -> `Vercel webhook.py` -> `Gemini AI parse` -> `validate & sanitize` -> `gspread append_rows()`:
1. AI output validated: activity_type/sales_stage clamped to valid enums, `None` → `""`
2. All cell values sanitized against formula injection (`=`, `+`, `-`, `@` prefixes escaped)
3. Write to **Combined** tab (dashboard source, Looker Studio reads this)
4. Write to **Live Data** tab (permanent record, failures logged but non-blocking)
5. Send **LINE reply** with confirmation + nudge (error-handled)

---

## Tab Overview

| Tab Name | Purpose | Cleared for Demos? |
|---|---|---|
| Sheet1 | Primary data tab; Looker Studio data source | Yes (repopulated with sample data) |
| Live Data | Permanent record of all bot-written rows | Never cleared |
| Legend | Color-coding reference for conditional formatting | Static reference |
| Backup_* | Timestamped backups before data reset (max 3 kept) | Rotated automatically |

---

## 24-Column Structure (A-X)

All data tabs (Sheet1, Live Data, Backup_*) share the same column layout.

### Column Definitions

| Col | Header | Type | Description | Example |
|---|---|---|---|---|
| A | Timestamp | DateTime | Bangkok time (UTC+7), `YYYY-MM-DD HH:MM:SS` | `2026-03-14 09:15:00` |
| B | Rep Name | String | LINE display name of the sales rep | `สมชาย` |
| C | Customer | String | Company name as stated by rep | `PTT` |
| D | Contact Person | String | Customer contact name (if mentioned) | `คุณวิทยา` |
| E | Contact Channel | String | Phone number or email of contact person (**mandatory**) | `081-234-5678` |
| F | Product Name | String | Product or model mentioned | `MTO330` |
| G | Product Segment | Enum | Auto-matched from 431-product catalog | `PT` |
| H | Quantity | Number | Quantity discussed or ordered | `2` |
| I | Deal Value (THB) | Number | Deal value in Baht, comma-formatted | `285,000` |
| J | Activity Type | String | Type of sales activity | `visit` |
| K | Sales Stage | String | Pipeline stage | `quotation_sent` |
| L | Payment Status | String | Payment state | `pending` |
| M | Planned Visit Date | Date | Date of planned future visit (`YYYY-MM-DD`) | `2026-03-20` |
| N | Bidding Date | Date | Government bid submission deadline (`YYYY-MM-DD`) | `2026-04-01` |
| O | Accompanying Rep | String | Name of 2nd rep if mentioned | `น้องใหม่` |
| P | Training Flag | String | Auto-set `yes` when accompanying rep is a trainee | `yes` |
| Q | Close Reason | String | AI-filled reason for close/loss/expiry/defect (terminal stages only) | `ลูกค้าเลือกคู่แข่ง` |
| R | Follow-up Notes | String | AI-extracted notes or action items | `รอ PO สัปดาห์หน้า` |
| S | Summary (EN) | String | Brief English summary, under 100 chars | `Visited PTT, quoted Megger MTO330 at 285K` |
| T | Raw Message | String | Original LINE message text (audit trail) | `ไปเยี่ยม PTT วันนี้...` |
| U | Batch ID | String | `MSG-XXXXXXXX` hash grouping multi-activity messages (8 hex chars) | `MSG-A3F2B1C4` |
| V | Item # | String | Position label for multi-activity messages | `1/3` |
| W | Source | String | Origin of the row | `live` or `sample` |
| X | Manager Notes | String | Blank — for management manual input only | |

Multi-activity messages share the same Batch ID (col U) and Raw Message (col T). Item # (col V) labels each entry (e.g., `1/2`, `2/2`). Single-activity messages leave Item # blank.

---

## Data Validation Dropdowns

Applied to data columns starting from row 2 onward.

| Column | Dropdown Values |
|---|---|
| G (Product Segment) | CI, GET, LVI, MRM, PDIX, PP, PT |
| J (Activity Type) | visit, call, quotation, follow_up, closed_won, closed_lost, sent_to_service, other |
| K (Sales Stage) | lead, plan_to_visit, visited, negotiation, quotation_sent, bidding, closed_won, closed_lost, job_expired, equipment_defect |
| L (Payment Status) | pending, deposit, paid |

---

## Conditional Formatting

Cell-only coloring (not full-row) is applied to three columns. Colors make pipeline status scannable at a glance.

### Activity Type (Column J)

| Value | Color |
|---|---|
| visit | Light blue |
| call | Light green |
| quotation | Light yellow |
| follow_up | Light purple |
| closed_won | Green |
| closed_lost | Light red |
| sent_to_service | Light cyan |
| other | Light gray |

### Sales Stage (Column K)

| Value | Color |
|---|---|
| lead | Light blue |
| plan_to_visit | Light cyan |
| visited | Light teal |
| negotiation | Light orange |
| quotation_sent | Light yellow |
| bidding | Light purple |
| closed_won | Green |
| closed_lost | Red |
| job_expired | Gray |
| equipment_defect | Dark red |

### Payment Status (Column L)

| Value | Color |
|---|---|
| pending | Light yellow |
| deposit | Light orange |
| paid | Light green |

### Partial Data Highlighting

Rows missing mandatory fields (Customer, Contact Channel, Product Name, Deal Value, Activity Type, Sales Stage) are highlighted with a light red background on the empty cells. This is applied by `populate_sample_data.py` when generating sample data.

---

## Number Formatting & Source Column

| Column | Format / Notes |
|---|---|
| I (Deal Value) | `#,##0` — comma separator, no decimals |
| H (Quantity) | Plain number |
| W (Source) | `live` = bot webhook, `sample` = generated for demo. Allows Looker Studio filtering. |

---

## Dual-Write Strategy

The webhook writes every parsed message to two tabs: **Combined** first (dashboard), then **Live Data** (permanent). If either tab does not exist, the webhook creates it automatically with headers and formatting. Live Data write failures are logged but do not block the request — the Combined write (dashboard source) takes priority.

---

## Backup System

Before clearing Sheet1 for a demo reset, `populate_sample_data.py`:

1. Creates a `Backup_YYYYMMDD_HHMMSS` tab with current Sheet1 data
2. Keeps a maximum of 3 backup tabs (oldest deleted first)
3. Clears Sheet1 and repopulates with 31 sample rows

---

## Header Formatting

| Property | Value |
|---|---|
| Background | Dark navy blue (RGB: 0.15, 0.3, 0.55) |
| Text | White, bold |
| Frozen rows | 1 (header always visible) |
| Column widths | Auto-fitted to content |

---

## Integration with Looker Studio

Looker Studio connects to Sheet1 as its data source. Key dashboard components:

- **KPI scorecards:** Total pipeline value, deals won, deals lost
- **Pipeline chart:** Stacked bar by sales stage
- **Segment mix:** Pie/donut chart by product segment
- **Activity feed:** Recent entries table
- **Data freshness:** Set to 1-minute refresh interval
