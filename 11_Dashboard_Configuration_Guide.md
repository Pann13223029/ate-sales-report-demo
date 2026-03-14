# ATE Sales Report System — Looker Studio Dashboard Configuration Guide

> **Created:** 2026-03-15
> **Data Source:** Google Sheets → "Combined" tab (24 columns, A-X)
> **Current Dashboard:** [Looker Studio Link](https://lookerstudio.google.com/reporting/9a4b326f-4f51-4f85-be2f-2bf8e958a9ec)

---

## Table of Contents

1. [Data Source Setup](#1-data-source-setup)
2. [View 1: Active Pipeline](#2-view-1-active-pipeline-default)
3. [View 2: Win/Loss Analysis](#3-view-2-winloss-analysis)
4. [View 3: Stale Deals](#4-view-3-stale-deals)
5. [View 4: Expired / Defect Archive](#5-view-4-expired--defect-archive)
6. [Shared Components](#6-shared-components)
7. [Column Reference](#7-column-reference)

---

## 1. Data Source Setup

### Connect to Google Sheets

1. Open Looker Studio → Create → Data source
2. Choose **Google Sheets**
3. Select the ATE Sales Report spreadsheet
4. Select the **Combined** tab (not Live Data)
5. Check "Use first row as headers"
6. Click **Connect**

### Fix Column Types

After connecting, verify these column types in the data source editor:

| Column | Expected Type | Fix If Needed |
|--------|--------------|---------------|
| Timestamp | Date Hour (YYYY-MM-DD HH:mm:ss) | Change from Text to Date |
| Quantity | Number | Change from Text |
| Deal Value (THB) | Number | Change from Text |
| Planned Visit Date | Date | Change from Text |
| Bidding Date | Date | Change from Text |

### Data Freshness

1. Click the data source name at top
2. Data freshness → **1 minute** (for live demo) or **15 minutes** (daily use)

---

## 2. View 1: Active Pipeline (Default)

> **Purpose:** Day-to-day pipeline monitoring for management

### Page-Level Filter

Add a filter control or report-level filter:
- **Field:** Sales Stage
- **Condition:** IN
- **Values:** `lead`, `plan_to_visit`, `visited`, `negotiation`, `quotation_sent`, `bidding`

This excludes closed, expired, and defective deals.

### Components to Add

#### A. KPI Scorecards (top row, 4 cards)

| Scorecard | Metric | Configuration |
|-----------|--------|---------------|
| Total Pipeline Value | SUM of Deal Value (THB) | Number format: ฿#,##0 |
| Deal Count | Record Count | Filter: Deal Value > 0 |
| Avg Deal Size | AVG of Deal Value (THB) | Number format: ฿#,##0 |
| Reps Active | Count Distinct of Rep Name | — |

How to create:
1. Insert → Scorecard
2. Metric: drag "Deal Value (THB)"
3. Aggregation: SUM (or AVG for avg deal size)
4. Style → Number format → Custom: `฿#,##0`

#### B. Pipeline by Stage (bar chart)

1. Insert → Bar chart
2. **Dimension:** Sales Stage
3. **Metric:** SUM of Deal Value (THB)
4. **Sort:** Custom order (lead → plan_to_visit → visited → negotiation → quotation_sent → bidding)
5. **Style:**
   - Bar colors: use the "Series" color settings
   - Suggested colors per stage:
     - lead: gray (#E0E0E0)
     - plan_to_visit: light blue (#D6E9FF)
     - visited: blue (#ADC8FF)
     - negotiation: amber (#FFE0A0)
     - quotation_sent: sky blue (#B0D4FF)
     - bidding: purple (#DCC8FF)

How to set bar colors:
1. Click the chart → Style tab
2. Under "Color by" or "Series" → click each bar color to customize
3. If "Color by" only shows one option, use a Stacked bar chart with Sales Stage as both dimension and breakdown dimension

#### C. Brand Breakdown (donut chart)

1. Insert → Pie chart (set to Donut in style)
2. **Dimension:** Product Brand
3. **Metric:** SUM of Deal Value (THB)
4. **Sort:** Metric descending
5. **Style:** Show labels with % and value

#### D. Activity Feed (table)

1. Insert → Table
2. **Columns:** Timestamp, Rep Name, Customer, Product Brand, Product Name, Deal Value (THB), Activity Type, Sales Stage
3. **Sort:** Timestamp descending
4. **Rows per page:** 15-20
5. **Style:** Compact, alternating row colors

#### E. Rep Performance (optional bar chart)

1. Insert → Bar chart (horizontal)
2. **Dimension:** Rep Name
3. **Metric:** SUM of Deal Value (THB)
4. **Sort:** Metric descending

---

## 3. View 2: Win/Loss Analysis

> **Purpose:** Understand what wins and what loses

### Page-Level Filter

- **Field:** Sales Stage
- **Condition:** IN
- **Values:** `closed_won`, `closed_lost`

### Components to Add

#### A. Won vs Lost Scorecards (side by side)

| Scorecard | Filter | Color |
|-----------|--------|-------|
| Won Value | Sales Stage = closed_won | Green background |
| Won Count | Sales Stage = closed_won | Green |
| Lost Value | Sales Stage = closed_lost | Red background |
| Lost Count | Sales Stage = closed_lost | Red |

#### B. Win Rate Scorecard

This requires a calculated field:

1. Go to data source → Add a field
2. Name: `Win Rate`
3. Formula:
   ```
   COUNT_DISTINCT(CASE WHEN Sales Stage = "closed_won" THEN Batch ID END)
   /
   COUNT_DISTINCT(Batch ID)
   ```
4. Type: Percent
5. Add as Scorecard metric

**Alternative (simpler):** Create a blended data source or just calculate manually from the Won/Lost counts shown above.

#### C. Close Reason Table

1. Insert → Table
2. **Columns:** Customer, Product Brand, Product Name, Deal Value (THB), Sales Stage, Close Reason
3. **Sort:** Deal Value descending
4. **Style:** Color the Sales Stage column (green for won, red for lost)

#### D. Brand Win/Loss (stacked bar)

1. Insert → Stacked bar chart
2. **Dimension:** Product Brand
3. **Breakdown dimension:** Sales Stage
4. **Metric:** SUM of Deal Value (THB)
5. **Colors:** Green for closed_won, Red for closed_lost

---

## 4. View 3: Stale Deals

> **Purpose:** Identify deals that need attention (no update in 7+ days)

### Creating the Stale Filter

This requires a calculated field:

1. Data source → Add a field
2. Name: `Days Since Update`
3. Formula:
   ```
   DATE_DIFF(TODAY(), Timestamp)
   ```
4. Type: Number

### Page-Level Filters (both required)

1. **Sales Stage NOT IN:** `closed_won`, `closed_lost`, `job_expired`, `equipment_defect`
2. **Days Since Update >= 7**

### Components to Add

#### A. Stale Deal Count Scorecard

- Metric: Record Count
- Label: "Stale Deals (7+ days)"

#### B. Stale Deals Table (main component)

1. Insert → Table
2. **Columns:** Days Since Update, Rep Name, Customer, Product Brand, Product Name, Deal Value (THB), Sales Stage, Batch ID
3. **Sort:** Days Since Update descending (most stale first)
4. **Style:** Conditional formatting on Days Since Update:
   - 7-14 days: yellow
   - 15+ days: red
5. **Rows per page:** 20

#### C. Stale by Rep (bar chart)

1. Insert → Bar chart (horizontal)
2. **Dimension:** Rep Name
3. **Metric:** Record Count
4. **Sort:** Metric descending
5. Shows who has the most stale deals

---

## 5. View 4: Expired / Defect Archive

> **Purpose:** Track dead deals and equipment issues for pattern analysis

### Page-Level Filter

- **Field:** Sales Stage
- **Condition:** IN
- **Values:** `job_expired`, `equipment_defect`

### Components to Add

#### A. Summary Scorecards

| Scorecard | Filter | Description |
|-----------|--------|-------------|
| Expired Deal Value | Sales Stage = job_expired | Total value of dead deals |
| Expired Count | Sales Stage = job_expired | Number of expired deals |
| Defect Count | Sales Stage = equipment_defect | Equipment issues |

#### B. Archive Table

1. Insert → Table
2. **Columns:** Timestamp, Rep Name, Customer, Product Brand, Product Name, Deal Value (THB), Sales Stage, Close Reason
3. **Sort:** Timestamp descending
4. This shows why deals died (Close Reason) and which products had defects

#### C. Expired by Brand (donut)

1. Insert → Pie chart
2. **Dimension:** Product Brand
3. **Metric:** Record Count
4. **Filter:** Sales Stage = equipment_defect
5. Shows which products have the most defects

---

## 6. Shared Components

### Date Range Control

Add to every page:
1. Insert → Date range control
2. **Default:** Last 30 days (or custom)
3. Position at top-right of each page

### Rep Filter Dropdown

Add to every page:
1. Insert → Drop-down list
2. **Dimension:** Rep Name
3. Position at top of each page
4. Allows management to filter by specific rep

### Navigation

Use Looker Studio's page navigation:
1. Page → Manage pages
2. Rename pages: "Active Pipeline", "Win/Loss", "Stale Deals", "Archive"
3. The left sidebar nav or top tabs let users switch between views

---

## 7. Column Reference

Quick reference for the 24-column schema when building charts:

| Col | Field | Common Use |
|-----|-------|-----------|
| A | Timestamp | Date filter, sorting, stale calculation |
| B | Rep Name | Dimension for rep breakdown |
| C | Customer | Dimension for customer analysis |
| D | Contact Person | Table detail only |
| E | Contact Channel | Dimension (phone/email/visit distribution) |
| F | Product Brand | Dimension for brand breakdown |
| G | Product Name | Table detail, product analysis |
| H | Quantity | Metric (SUM for volume analysis) |
| I | Deal Value (THB) | **Primary metric** (SUM, AVG, COUNT) |
| J | Activity Type | Dimension for activity breakdown |
| K | Sales Stage | **Primary dimension** + filter for all views |
| L | Payment Status | Dimension for payment tracking |
| M | Planned Visit Date | Date field for visit planning |
| N | Bidding Date | Date field for bid tracking |
| O | Accompanying Rep | Dimension for training analysis |
| P | Training Flag | Filter: yes = training visits |
| Q | Close Reason | Text detail for win/loss analysis |
| R | Follow-up Notes | Text detail only |
| S | Summary (EN) | Text detail only |
| T | Raw Message | Not used in dashboard |
| U | Batch ID | Unique deal identifier |
| V | Item # | Multi-activity grouping |
| W | Source | Filter: `live` for real data, `sample` for demo |
| X | Manager Notes | Text detail, management input |

### Important Filters

- **Exclude sample data:** Add `Source = "live"` filter when you switch from demo to production
- **Active deals only:** Sales Stage NOT IN (closed_won, closed_lost, job_expired, equipment_defect)
- **Training visits:** Training Flag = "yes"
