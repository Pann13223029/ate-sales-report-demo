# ATE Sales Report — Google Sheets Structure

> **Purpose:** Flat 17-column Google Sheets workbook serving as database and Looker Studio data source.
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
  │  Same 17-col       │  │  Same 17-col       │  │          │  │              │
  │  structure as      │  │  structure, never   │  │          │  │  Auto-created│
  │  Live Data         │  │  cleared for demos  │  │          │  │  before data │
  │                    │  │                    │  │          │  │  reset       │
  │  Source: Looker    │  │  Source: audit log  │  │          │  │              │
  │  Studio reads this │  │                    │  │          │  │              │
  └───────────────────┘  └───────────────────┘  └──────────┘  └──────────────┘
```

### Write Order

`LINE message` -> `Vercel webhook.py` -> `Gemini AI parse` -> `gspread append_rows()`:
1. Write to **Live Data** tab first (permanent record)
2. Write to **Sheet1** second (demo/dashboard, Looker Studio reads this)
3. Send **LINE reply** with confirmation + nudge

---

## Tab Overview

| Tab Name | Purpose | Cleared for Demos? |
|---|---|---|
| Sheet1 | Primary data tab; Looker Studio data source | Yes (repopulated with sample data) |
| Live Data | Permanent record of all bot-written rows | Never cleared |
| Legend | Color-coding reference for conditional formatting | Static reference |
| Backup_* | Timestamped backups before data reset (max 3 kept) | Rotated automatically |

---

## 17-Column Structure (A-Q)

All data tabs (Sheet1, Live Data, Backup_*) share the same column layout.

### Column Definitions

| Col | Header | Type | Description | Example |
|---|---|---|---|---|
| A | Timestamp | DateTime | Bangkok time (UTC+7), `YYYY-MM-DD HH:MM:SS` | `2026-03-14 09:15:00` |
| B | Rep Name | String | LINE display name of the sales rep | `สมชาย` |
| C | Customer | String | Company name as stated by rep | `PTT` |
| D | Contact Person | String | Customer contact name (if mentioned) | `คุณวิทยา` |
| E | Product Brand | String | Brand from ATE portfolio | `Megger` |
| F | Product Name | String | Product or model mentioned | `MTO330` |
| G | Quantity | Number | Quantity discussed or ordered | `2` |
| H | Deal Value (THB) | Number | Deal value in Baht, comma-formatted | `285,000` |
| I | Activity Type | String | Type of sales activity | `visit` |
| J | Sales Stage | String | Pipeline stage | `quotation_sent` |
| K | Payment Status | String | Payment state | `pending` |
| L | Follow-up Notes | String | AI-extracted notes or action items | `รอ PO สัปดาห์หน้า` |
| M | Summary (EN) | String | Brief English summary, under 100 chars | `Visited PTT, quoted Megger MTO330 at 285K` |
| N | Raw Message | String | Original LINE message text (audit trail) | `ไปเยี่ยม PTT วันนี้...` |
| O | Batch ID | String | `MSG-XXXXX` hash grouping multi-activity messages | `MSG-A3F2B` |
| P | Item # | String | Position label for multi-activity messages | `1/3` |
| Q | Source | String | Origin of the row | `live` or `sample` |

Multi-activity messages share the same Batch ID (col O) and Raw Message (col N). Item # (col P) labels each entry (e.g., `1/2`, `2/2`). Single-activity messages leave Item # blank.

---

## Data Validation Dropdowns

Applied to data columns starting from row 2 onward.

| Column | Dropdown Values |
|---|---|
| E (Product Brand) | Megger, Fluke, CRC, Salisbury, SmartWasher, IK Sprayer, Other |
| I (Activity Type) | visit, call, quotation, follow_up, closed_won, closed_lost, other |
| J (Sales Stage) | lead, negotiation, quotation_sent, closed_won, closed_lost |
| K (Payment Status) | pending, partial, paid |

---

## Conditional Formatting

Cell-only coloring (not full-row) is applied to three columns. Colors make pipeline status scannable at a glance.

### Activity Type (Column I)

| Value | Color |
|---|---|
| visit | Light blue |
| call | Light green |
| quotation | Light yellow |
| follow_up | Light purple |
| closed_won | Green |
| closed_lost | Light red |
| other | Light gray |

### Sales Stage (Column J)

| Value | Color |
|---|---|
| lead | Light blue |
| negotiation | Light orange |
| quotation_sent | Light yellow |
| closed_won | Green |
| closed_lost | Red |

### Payment Status (Column K)

| Value | Color |
|---|---|
| pending | Light yellow |
| partial | Light orange |
| paid | Light green |

### Partial Data Highlighting

Rows missing mandatory fields (Customer, Product Brand, Deal Value, Activity Type, Sales Stage) are highlighted with a light red background on the empty cells. This is applied by `populate_sample_data.py` when generating sample data.

---

## Number Formatting & Source Column

| Column | Format / Notes |
|---|---|
| H (Deal Value) | `#,##0` — comma separator, no decimals |
| G (Quantity) | Plain number |
| Q (Source) | `live` = bot webhook, `sample` = generated for demo. Allows Looker Studio filtering. |

---

## Dual-Write Strategy

The webhook writes every parsed message to two tabs: **Live Data** first (permanent), then **Sheet1** (demo/dashboard). If the Live Data tab does not exist, the webhook creates it automatically with headers and formatting.

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
- **Brand mix:** Pie/donut chart by product brand
- **Activity feed:** Recent entries table
- **Data freshness:** Set to 1-minute refresh interval
