# ATE Sales Report — Google Sheets Template Structure

> **Purpose:** Define the Google Sheets workbook structure for the Lean (PoC) tier.
> This workbook serves as the database for parsed LINE message data and the data source for Google Looker Studio dashboards.
> **Date:** 2026-03-10

---

## Visual Overview — How the 5 Sheets Relate

```
                        ┌─────────────────────────────────────────────────────────┐
                        │               ATE Sales Report — Data 2026              │
                        │                  (Google Sheets Workbook)                │
                        └─────────────────────────────────────────────────────────┘

    ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
    │    Reps       │     │   Products   │     │  Customers   │
    │  (reference)  │     │  (reference) │     │  (reference) │
    │               │     │              │     │              │
    │  rep_id    PK │     │ product_id PK│     │ customer_id PK│
    │  rep_name     │     │ brand        │     │ company_name  │
    │  line_user_id │     │ product_name │     │ industry      │
    │  team         │     │ model        │     │ contact_person│
    │  region       │     │ category     │     │ phone         │
    │               │     │ list_price   │     │ email         │
    └──────┬───────┘     └──────┬───────┘     │ region        │
           │                    │              └──────┬───────┘
           │   lookup           │  lookup             │  lookup
           │   (rep_name)       │  (product_brand,    │  (customer_name)
           │                    │   product_name)     │
           ▼                    ▼                     ▼
    ┌─────────────────────────────────────────────────────────┐
    │                   Sales Activities                       │
    │                 (main data — 17 columns)                 │
    │                                                          │
    │  One row = one parsed LINE message from a sales rep      │
    │  Appended by n8n workflow after Claude parses message     │
    └───────────────────────────┬──────────────────────────────┘
                                │
                                │  aggregation
                                │  (COUNTIFS / SUMIFS by date + rep)
                                ▼
                   ┌──────────────────────────┐
                   │      Daily Summary        │
                   │    (aggregated stats)      │
                   │                            │
                   │  Per rep, per day:          │
                   │  visits, calls, quotations, │
                   │  deals closed, revenue      │
                   └──────────────────────────┘
```

### Entity Relationship Diagram

```
    ┌──────────┐          ┌───────────────────┐          ┌────────────┐
    │   Reps   │          │ Sales Activities   │          │  Products  │
    ├──────────┤          ├───────────────────┤          ├────────────┤
    │ rep_id   │◄─ ─ ─ ─ ─│ rep_name (FK)     │─ ─ ─ ─ ►│ product_id │
    │ rep_name │  lookup   │ customer_name (FK)│  lookup  │ brand      │
    │ line_uid │          │ product_brand (FK) │          │ prod_name  │
    │ team     │          │ product_name (FK)  │          │ model      │
    │ region   │          │ activity_type      │          │ category   │
    └──────────┘          │ sales_stage        │          │ list_price │
                          │ payment_status     │          └────────────┘
    ┌──────────┐          │ deal_value_thb     │
    │Customers │          │ ...13 more cols    │
    ├──────────┤          └────────┬──────────┘
    │ cust_id  │◄─ ─ ─ ─ ─ ─ ─ ─ ┘
    │ company  │    lookup          │
    │ industry │                    │ aggregation
    │ contact  │                    ▼
    │ phone    │          ┌───────────────────┐
    │ email    │          │  Daily Summary     │
    │ region   │          ├───────────────────┤
    └──────────┘          │ date              │
                          │ rep_name          │
                          │ total_visits      │
                          │ total_calls       │
                          │ total_quotations  │
                          │ total_deals_closed│
                          │ total_revenue_thb │
                          └───────────────────┘
```

---

## Data Flow — LINE Message to Spreadsheet

```
  ┌─────────────────────────────────────────────────────────────────────────────┐
  │  STEP 1: Sales Rep Sends LINE Message                                       │
  │                                                                             │
  │  "ไปเยี่ยม กฟผ. วันนี้ เจอคุณวิทยา เสนอ Megger MTO330 2 เครื่อง            │
  │   285,000 รอ PO สัปดาห์หน้า"                                                │
  └─────────────────────────────┬───────────────────────────────────────────────┘
                                │
                                ▼
  ┌─────────────────────────────────────────────────────────────────────────────┐
  │  STEP 2: LINE Webhook → n8n Workflow                                        │
  │                                                                             │
  │  Webhook payload includes:                                                  │
  │    - message.id  ──────────────────────────────► message_id (Col B)         │
  │    - source.userId ────────────────────────────► matched to rep_name (Col C)│
  │    - timestamp  ───────────────────────────────► timestamp (Col A)          │
  │    - message.text ─────────────────────────────► raw_message (Col Q)        │
  └─────────────────────────────┬───────────────────────────────────────────────┘
                                │
                                ▼
  ┌─────────────────────────────────────────────────────────────────────────────┐
  │  STEP 3: Claude AI Parses the Message                                       │
  │                                                                             │
  │  Raw text is analyzed and structured fields are extracted:                   │
  │                                                                             │
  │  "ไปเยี่ยม กฟผ..."                                                          │
  │    │                                                                        │
  │    ├── "ไปเยี่ยม"         → activity_type:  visit          (Col J)          │
  │    ├── "กฟผ."             → customer_name:  EGAT           (Col D)          │
  │    ├── "คุณวิทยา"          → contact_person: คุณวิทยา       (Col E)          │
  │    ├── "Megger"           → product_brand:  Megger         (Col F)          │
  │    ├── "MTO330"           → product_name:   MTO330 Trans.. (Col G)          │
  │    ├── "2 เครื่อง"         → quantity:       2              (Col H)          │
  │    ├── "285,000"          → deal_value_thb: 285000         (Col I)          │
  │    ├── "เสนอ" + value     → sales_stage:    quotation_sent (Col K)          │
  │    ├── (not mentioned)    → payment_status: pending        (Col L)          │
  │    ├── "สัปดาห์หน้า"       → follow_up_date: 2026-03-17    (Col M)          │
  │    ├── "รอ PO"            → follow_up_notes: รอลูกค้ายืนยัน PO..  (Col N)   │
  │    ├── (AI generates)     → daily_summary:  เยี่ยม EGAT... (Col O)          │
  │    └── (AI self-assess)   → confidence:     0.92           (Col P)          │
  └─────────────────────────────┬───────────────────────────────────────────────┘
                                │
                                ▼
  ┌─────────────────────────────────────────────────────────────────────────────┐
  │  STEP 4: n8n Appends Row to Google Sheets                                  │
  │                                                                             │
  │  ┌───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┐    │
  │  │ A │ B │ C │ D │ E │ F │ G │ H │ I │ J │ K │ L │ M │ N │ O │ P │ Q │    │
  │  ├───┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───┤    │
  │  │ts │mid│rep│cus│con│brd│prd│qty│val│act│stg│pay│fup│not│sum│scr│raw│    │
  │  └───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┘    │
  │            ▲         ▲         ▲                                             │
  │            │         │         │                                             │
  │     matched via    matched   matched via                                    │
  │     Reps sheet     via       Products sheet                                 │
  │     (line_user_id) Customers (brand + name)                                 │
  │                    sheet                                                     │
  └─────────────────────────────────────────────────────────────────────────────┘
```

---

## Google Sheets to Looker Studio — Lean Tier Architecture

```
  ┌─────────────────────────────────────────────────────────────────────────────┐
  │                          Lean (PoC) Tier Architecture                       │
  └─────────────────────────────────────────────────────────────────────────────┘

  ┌──────────┐    webhook     ┌──────────┐   API call    ┌──────────────┐
  │          │───────────────►│          │──────────────►│              │
  │   LINE   │                │   n8n    │               │  Claude AI   │
  │   App    │                │ Workflow │◄──────────────│  (parsing)   │
  │          │                │          │  parsed JSON  │              │
  └──────────┘                └────┬─────┘               └──────────────┘
                                   │
                                   │ Google Sheets API
                                   │ (append row)
                                   ▼
  ┌─────────────────────────────────────────────────────────────────────────────┐
  │                                                                             │
  │   Google Sheets Workbook: "ATE Sales Report — Data 2026"                    │
  │                                                                             │
  │   ┌─────────────────┐  ┌────────┐  ┌──────────┐  ┌───────────┐  ┌───────┐ │
  │   │Sales Activities  │  │  Reps  │  │ Products │  │ Customers │  │Daily  │ │
  │   │  (main data)     │  │ (ref)  │  │  (ref)   │  │   (ref)   │  │Summary│ │
  │   │  ~330 rows/day   │  │ 11 reps│  │ ~50 items│  │ growing   │  │ daily │ │
  │   └────────┬─────────┘  └───┬────┘  └────┬─────┘  └─────┬─────┘  └───┬───┘ │
  │            │                │             │              │             │     │
  └────────────┼────────────────┼─────────────┼──────────────┼─────────────┼─────┘
               │                │             │              │             │
               └────────┬───────┴─────────────┴──────────────┘             │
                        │     Google Sheets as Data Source                  │
                        ▼                                                  ▼
  ┌─────────────────────────────────────────────────────────────────────────────┐
  │                                                                             │
  │   Google Looker Studio (free)                                               │
  │                                                                             │
  │   ┌─────────────────────────────────────────────────────────────────────┐   │
  │   │  Dashboard Page 1: Daily / Weekly Activity Summary                  │   │
  │   │  ┌──────────────┐  ┌──────────────┐  ┌─────────────────────────┐   │   │
  │   │  │ Total Visits  │  │ Total Calls  │  │  Activity Trend Chart   │   │   │
  │   │  │     12        │  │      8       │  │  ╱╲    ╱╲              │   │   │
  │   │  └──────────────┘  └──────────────┘  │ ╱  ╲╱╱  ╲─            │   │   │
  │   │                                       └─────────────────────────┘   │   │
  │   ├─────────────────────────────────────────────────────────────────────┤   │
  │   │  Dashboard Page 2: Revenue Pipeline by Stage                        │   │
  │   │  ┌──────────────────────────────────────────────────────────────┐   │   │
  │   │  │ lead ████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  320,000           │   │   │
  │   │  │ qual ██████████░░░░░░░░░░░░░░░░░░░░░░░░░  750,000           │   │   │
  │   │  │ quot █████████████████░░░░░░░░░░░░░░░░░░ 1,200,000          │   │   │
  │   │  │ nego ███████████████████████░░░░░░░░░░░░ 1,800,000          │   │   │
  │   │  │  won ████████████████████████████████████ 2,500,000          │   │   │
  │   │  └──────────────────────────────────────────────────────────────┘   │   │
  │   ├─────────────────────────────────────────────────────────────────────┤   │
  │   │  Dashboard Page 3: Per-Rep Scoreboard                               │   │
  │   ├─────────────────────────────────────────────────────────────────────┤   │
  │   │  Dashboard Page 4: Product Brand Breakdown                          │   │
  │   └─────────────────────────────────────────────────────────────────────┘   │
  │                                                                             │
  └─────────────────────────────────────────────────────────────────────────────┘
```

---

## Workbook Overview

| Sheet Name | Purpose | Approximate Columns |
|---|---|---|
| Sales Activities | Main data — one row per parsed LINE message | 17 |
| Reps | Reference table of sales representatives | 5 |
| Products | Reference table of ATE product catalog | 6 |
| Customers | Reference table of known customers | 7 |
| Daily Summary | Aggregated daily stats per rep | 7 |

---

## Sheet 1: Sales Activities

This is the primary sheet. Each row represents one parsed LINE message from a sales rep. Rows are appended by the n8n workflow after Claude parses the message.

### Column Definitions

| Column | Header | Type | Description | Example |
|---|---|---|---|---|
| A | `timestamp` | DateTime | ISO 8601 timestamp when the message was received | `2026-03-10T09:15:00+07:00` |
| B | `message_id` | String | LINE message ID for deduplication and traceability | `17432856901234` |
| C | `rep_name` | String | Name of the sales rep who sent the message | `สมชาย` |
| D | `customer_name` | String | Company name of the customer mentioned | `การไฟฟ้าฝ่ายผลิตแห่งประเทศไทย (EGAT)` |
| E | `contact_person` | String | Name of the customer contact (if mentioned) | `คุณวิทยา` |
| F | `product_brand` | String | Brand name from ATE portfolio | `Megger` |
| G | `product_name` | String | Product name or model mentioned | `MTO330 Transformer Ohmmeter` |
| H | `quantity` | Number | Quantity discussed or ordered (0 if not mentioned) | `2` |
| I | `deal_value_thb` | Number | Deal or quotation value in Thai Baht (0 if not mentioned) | `285000` |
| J | `activity_type` | String | Type of activity: `visit`, `call`, `quotation`, `demo`, `delivery`, `follow_up`, `other` | `visit` |
| K | `sales_stage` | String | Pipeline stage: `lead`, `qualified`, `demo_scheduled`, `quotation_sent`, `negotiation`, `closed_won`, `closed_lost` | `quotation_sent` |
| L | `payment_status` | String | Payment state: `n/a`, `pending`, `partial`, `paid`, `overdue` | `pending` |
| M | `follow_up_date` | Date | Next follow-up date (if mentioned) | `2026-03-17` |
| N | `follow_up_notes` | String | AI-extracted follow-up action items | `รอลูกค้ายืนยัน PO ภายในสัปดาห์หน้า` |
| O | `daily_summary` | String | One-sentence AI summary of the activity | `เยี่ยม EGAT เสนอราคา Megger MTO330 x2 มูลค่า 285,000 บาท` |
| P | `confidence_score` | Number | AI confidence in parsing accuracy, 0.0 to 1.0 | `0.92` |
| Q | `raw_message` | String | Original LINE message text (for audit and debugging) | `ไปเยี่ยม กฟผ. วันนี้ เจอคุณวิทยา เสนอ Megger MTO330 2 เครื่อง 285,000 รอ PO สัปดาห์หน้า` |

### Visual Column Layout — Sales Activities

```
┌──────────────────────┬────────────────┬────────┬───────────────┬──────────┬─────────┬──────────────────┬─────┬────────────┬───────────┬────────────────┬────────────────┬─────────────┬──────────────────┬───────────────────────┬──────┬───────────────────┐
│ A: timestamp         │ B: message_id  │C: rep  │D: customer    │E: contact│F: brand │G: product_name   │H:qty│I: value_thb│J: act_type│K: sales_stage  │L: pay_status   │M: follow_up │N: follow_notes   │O: daily_summary       │P:conf│Q: raw_message     │
├──────────────────────┼────────────────┼────────┼───────────────┼──────────┼─────────┼──────────────────┼─────┼────────────┼───────────┼────────────────┼────────────────┼─────────────┼──────────────────┼───────────────────────┼──────┼───────────────────┤
│2026-03-10T09:15+07:00│17432856901234  │สมชาย   │EGAT           │คุณวิทยา  │Megger   │MTO330 Trans. Ohm.│  2  │   285,000  │visit      │quotation_sent  │pending         │2026-03-17   │รอลูกค้ายืนยัน PO│เยี่ยม EGAT เสนอราคา..│ 0.92 │ไปเยี่ยม กฟผ...   │
├──────────────────────┼────────────────┼────────┼───────────────┼──────────┼─────────┼──────────────────┼─────┼────────────┼───────────┼────────────────┼────────────────┼─────────────┼──────────────────┼───────────────────────┼──────┼───────────────────┤
│2026-03-10T10:45+07:00│17432856905678  │อรุณ    │ปตท.           │คุณสมศักดิ์│Fluke    │87V Digital Multi.│  5  │    75,000  │quotation  │quotation_sent  │n/a            │2026-03-14   │ส่งใบเสนอราคา..  │ส่งใบเสนอราคา Fluke..  │ 0.88 │ส่ง quote Fluke.. │
├──────────────────────┼────────────────┼────────┼───────────────┼──────────┼─────────┼──────────────────┼─────┼────────────┼───────────┼────────────────┼────────────────┼─────────────┼──────────────────┼───────────────────────┼──────┼───────────────────┤
│2026-03-10T14:00+07:00│17432856909012  │นภา     │ไทยออยล์        │คุณประยุทธ์│CRC      │CRC Contact Clean.│ 20  │    12,000  │delivery   │closed_won      │paid            │             │                  │ส่งของ CRC Contact..   │ 0.95 │ส่งของ CRC...     │
└──────────────────────┴────────────────┴────────┴───────────────┴──────────┴─────────┴──────────────────┴─────┴────────────┴───────────┴────────────────┴────────────────┴─────────────┴──────────────────┴───────────────────────┴──────┴───────────────────┘
```

### Data Validation Rules (apply in Google Sheets)

- **Column J (`activity_type`):** Dropdown list — `visit`, `call`, `quotation`, `demo`, `delivery`, `follow_up`, `other`
- **Column K (`sales_stage`):** Dropdown list — `lead`, `qualified`, `demo_scheduled`, `quotation_sent`, `negotiation`, `closed_won`, `closed_lost`
- **Column L (`payment_status`):** Dropdown list — `n/a`, `pending`, `partial`, `paid`, `overdue`
- **Column P (`confidence_score`):** Number between 0 and 1

### Visual Data Validation Rules

```
  Column J: activity_type              Column K: sales_stage              Column L: payment_status
  ┌─────────────────────┐              ┌─────────────────────┐           ┌─────────────────────┐
  │ activity_type     ▼ │              │ sales_stage       ▼ │           │ payment_status    ▼ │
  ├─────────────────────┤              ├─────────────────────┤           ├─────────────────────┤
  │ ○ visit             │              │ ○ lead              │           │ ○ n/a               │
  │ ○ call              │              │ ○ qualified         │           │ ○ pending           │
  │ ○ quotation         │              │ ○ demo_scheduled    │           │ ○ partial           │
  │ ○ demo              │              │ ○ quotation_sent    │           │ ○ paid              │
  │ ○ delivery          │              │ ○ negotiation       │           │ ○ overdue           │
  │ ○ follow_up         │              │ ○ closed_won        │           └─────────────────────┘
  │ ○ other             │              │ ○ closed_lost       │
  └─────────────────────┘              └─────────────────────┘

  Column F: product_brand (validated against Products sheet)
  ┌─────────────────────┐
  │ product_brand     ▼ │
  ├─────────────────────┤
  │ ○ Megger            │
  │ ○ Fluke             │
  │ ○ CRC               │
  │ ○ Salisbury         │
  │ ○ SmartWasher       │
  │ ○ IK Sprayer        │
  └─────────────────────┘

  Column P: confidence_score
  ┌─────────────────────────────────────────────────────────────┐
  │  Valid range: 0.00 ├────────────────────────────────┤ 1.00  │
  │                    ▲                                        │
  │                 Reject if                                   │
  │                 "< 0 or > 1"                                │
  │                                                             │
  │  Review threshold: rows with score < 0.7 need manual check │
  │                    ├───────┤                                 │
  │                 0.0       0.7                    1.0         │
  │                 ◄─ REVIEW ─►◄──── TRUSTED ──────►           │
  └─────────────────────────────────────────────────────────────┘
```

### Sample Data

| timestamp | message_id | rep_name | customer_name | contact_person | product_brand | product_name | quantity | deal_value_thb | activity_type | sales_stage | payment_status | follow_up_date | follow_up_notes | daily_summary | confidence_score | raw_message |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 2026-03-10T09:15:00+07:00 | 17432856901234 | สมชาย | การไฟฟ้าฝ่ายผลิตแห่งประเทศไทย (EGAT) | คุณวิทยา | Megger | MTO330 Transformer Ohmmeter | 2 | 285000 | visit | quotation_sent | pending | 2026-03-17 | รอลูกค้ายืนยัน PO ภายในสัปดาห์หน้า | เยี่ยม EGAT เสนอราคา Megger MTO330 x2 มูลค่า 285,000 บาท | 0.92 | ไปเยี่ยม กฟผ. วันนี้ เจอคุณวิทยา เสนอ Megger MTO330 2 เครื่อง 285,000 รอ PO สัปดาห์หน้า |
| 2026-03-10T10:45:00+07:00 | 17432856905678 | อรุณ | บริษัท ปตท. จำกัด (มหาชน) | คุณสมศักดิ์ | Fluke | Fluke 87V Digital Multimeter | 5 | 75000 | quotation | quotation_sent | n/a | 2026-03-14 | ส่งใบเสนอราคาทางอีเมลแล้ว ติดตามวันศุกร์ | ส่งใบเสนอราคา Fluke 87V x5 ให้ ปตท. มูลค่า 75,000 บาท | 0.88 | ส่ง quote Fluke 87V 5 ตัวให้ ปตท. คุณสมศักดิ์ 75,000 บาท จะ follow up วันศุกร์ |
| 2026-03-10T14:00:00+07:00 | 17432856909012 | นภา | บริษัท ไทยออยล์ จำกัด (มหาชน) | คุณประยุทธ์ | CRC | CRC Contact Cleaner | 20 | 12000 | delivery | closed_won | paid | | | ส่งของ CRC Contact Cleaner 20 กระป๋อง ให้ไทยออยล์ ชำระเงินแล้ว | 0.95 | ส่งของ CRC Contact Cleaner 20 กระป๋องให้ไทยออยล์แล้ววันนี้ คุณประยุทธ์รับของแล้ว จ่ายเงินเรียบร้อย |
| 2026-03-10T15:30:00+07:00 | 17432856912345 | สมชาย | บริษัท บางจาก คอร์ปอเรชั่น จำกัด (มหาชน) | คุณณัฐพล | Salisbury | Salisbury Insulating Gloves Class 2 | 10 | 95000 | demo | demo_scheduled | n/a | 2026-03-20 | นัดสาธิตสินค้าวันที่ 20 มี.ค. ที่โรงกลั่น | นัดเดโม่ถุงมือ Salisbury Class 2 ที่บางจาก 20 มี.ค. | 0.85 | โทรคุยกับคุณณัฐพลบางจาก สนใจถุงมือ Salisbury Class 2 10 คู่ 95k นัดเดโม่ 20 มีค |
| 2026-03-10T16:20:00+07:00 | 17432856916789 | อรุณ | บริษัท อมตะ คอร์ปอเรชัน จำกัด (มหาชน) | คุณพิชัย | SmartWasher | SmartWasher SW-28 BioSolvent Parts Washer | 1 | 189000 | visit | negotiation | n/a | 2026-03-12 | ลูกค้าขอส่วนลด 10% รอตอบกลับจากผู้จัดการ | เยี่ยมอมตะ สนใจ SmartWasher SW-28 กำลังต่อรองราคา 189,000 บาท | 0.90 | ไปอมตะเจอคุณพิชัย ดู SmartWasher SW-28 สนใจมาก แต่ขอลด 10% ผมจะเช็คกับพี่ก่อนนะครับ |

---

## Sheet 2: Reps

Reference table for sales representatives. Used for data validation and joining data in Looker Studio.

### Column Definitions

| Column | Header | Type | Description | Example |
|---|---|---|---|---|
| A | `rep_id` | String | Unique rep identifier | `REP001` |
| B | `rep_name` | String | Rep's display name | `สมชาย` |
| C | `line_user_id` | String | LINE userId from webhook (used for sender matching) | `U4af4980629...` |
| D | `team` | String | Sales team assignment | `Team A` |
| E | `region` | String | Territory or region | `กรุงเทพฯ ตะวันออก` |

### Visual Column Layout — Reps

```
┌─────────┬──────────┬──────────────────────────────────────┬─────────┬───────────────────────────┐
│A: rep_id│B: rep_name│C: line_user_id                      │D: team  │E: region                  │
├─────────┼──────────┼──────────────────────────────────────┼─────────┼───────────────────────────┤
│ REP001  │ สมชาย    │ U4af4980629a1bc2d3e4f5a6b7c8d9e0f   │ Team A  │ กรุงเทพฯ ตะวันออก         │
├─────────┼──────────┼──────────────────────────────────────┼─────────┼───────────────────────────┤
│ REP002  │ อรุณ     │ U5bf5091730b2cd3e4f6a7b8c9d0e1f2a   │ Team A  │ ระยอง / ชลบุรี            │
├─────────┼──────────┼──────────────────────────────────────┼─────────┼───────────────────────────┤
│ REP003  │ นภา      │ U6cg6102841c3de4f5g7a8b9c0d1e2f3b   │ Team B  │ กรุงเทพฯ ตะวันตก         │
└─────────┴──────────┴──────────────────────────────────────┴─────────┴───────────────────────────┘
```

### Sample Data

| rep_id | rep_name | line_user_id | team | region |
|---|---|---|---|---|
| REP001 | สมชาย | U4af4980629a1bc2d3e4f5a6b7c8d9e0f | Team A | กรุงเทพฯ ตะวันออก |
| REP002 | อรุณ | U5bf5091730b2cd3e4f6a7b8c9d0e1f2a | Team A | ระยอง / ชลบุรี |
| REP003 | นภา | U6cg6102841c3de4f5g7a8b9c0d1e2f3b | Team B | กรุงเทพฯ ตะวันตก |
| REP004 | วีรพงษ์ | U7dh7213952d4ef5g6h8a9b0c1d2e3f4c | Team B | สมุทรปราการ / ฉะเชิงเทรา |
| REP005 | กาญจนา | U8ei8324063e5fg6h7i9a0b1c2d3e4f5d | Team A | นครราชสีมา / ภาคอีสาน |

---

## Sheet 3: Products

Reference table of ATE product catalog. Used for product name matching and Looker Studio dashboards.

### Column Definitions

| Column | Header | Type | Description | Example |
|---|---|---|---|---|
| A | `product_id` | String | Unique product identifier | `PRD001` |
| B | `brand` | String | Brand name | `Megger` |
| C | `product_name` | String | Full product name | `MTO330 Transformer Ohmmeter` |
| D | `model` | String | Model number | `MTO330` |
| E | `category` | String | Product category | `Test & Measurement` |
| F | `list_price_thb` | Number | List price in THB | `142500` |

### Visual Column Layout — Products

```
┌────────────┬────────────┬───────────────────────────────────────────┬────────────┬───────────────────────┬──────────────┐
│A: product_id│B: brand    │C: product_name                            │D: model    │E: category            │F: list_price │
├────────────┼────────────┼───────────────────────────────────────────┼────────────┼───────────────────────┼──────────────┤
│ PRD001     │ Megger     │ MTO330 Transformer Ohmmeter               │ MTO330     │ Test & Measurement    │   142,500    │
├────────────┼────────────┼───────────────────────────────────────────┼────────────┼───────────────────────┼──────────────┤
│ PRD003     │ Fluke      │ 87V Digital Multimeter                    │ 87V        │ Test & Measurement    │    15,000    │
├────────────┼────────────┼───────────────────────────────────────────┼────────────┼───────────────────────┼──────────────┤
│ PRD005     │ CRC        │ CRC Contact Cleaner                       │ 02016      │ Maintenance Chemicals │       350    │
├────────────┼────────────┼───────────────────────────────────────────┼────────────┼───────────────────────┼──────────────┤
│ PRD007     │ Salisbury  │ Insulating Gloves Class 2                 │ E216B      │ Electrical Safety     │     9,500    │
├────────────┼────────────┼───────────────────────────────────────────┼────────────┼───────────────────────┼──────────────┤
│ PRD009     │ SmartWasher│ SW-28 BioSolvent Parts Washer             │ SW-28      │ Parts Cleaning        │   189,000    │
└────────────┴────────────┴───────────────────────────────────────────┴────────────┴───────────────────────┴──────────────┘
```

### Sample Data

| product_id | brand | product_name | model | category | list_price_thb |
|---|---|---|---|---|---|
| PRD001 | Megger | MTO330 Transformer Ohmmeter | MTO330 | Test & Measurement | 142500 |
| PRD002 | Megger | MIT1025 10kV Insulation Resistance Tester | MIT1025 | Test & Measurement | 385000 |
| PRD003 | Fluke | 87V Digital Multimeter | 87V | Test & Measurement | 15000 |
| PRD004 | Fluke | Ti480 PRO Thermal Imager | Ti480 PRO | Thermal Imaging | 450000 |
| PRD005 | CRC | CRC Contact Cleaner | 02016 | Maintenance Chemicals | 350 |
| PRD006 | CRC | CRC Lectra Clean II Degreaser | 02120 | Maintenance Chemicals | 420 |
| PRD007 | Salisbury | Insulating Gloves Class 2 | E216B | Electrical Safety | 9500 |
| PRD008 | Salisbury | Arc Flash Face Shield Kit | SK40-LFH40 | Electrical Safety | 28500 |
| PRD009 | SmartWasher | SW-28 BioSolvent Parts Washer | SW-28 | Parts Cleaning | 189000 |
| PRD010 | SmartWasher | OzzyJuice SW-1 Degreasing Solution (5 gal) | SW-1 | Parts Cleaning | 8500 |
| PRD011 | IK Sprayer | IK Foam Pro 12 | 83811916 | Spraying Equipment | 4200 |
| PRD012 | IK Sprayer | IK Multi Pro 12 | 83812916 | Spraying Equipment | 3800 |

---

## Sheet 4: Customers

Reference table of known customer companies. This starts with a few seed entries and grows as Claude identifies new customers from messages.

### Column Definitions

| Column | Header | Type | Description | Example |
|---|---|---|---|---|
| A | `customer_id` | String | Unique customer identifier | `CUS001` |
| B | `company_name` | String | Full company name | `การไฟฟ้าฝ่ายผลิตแห่งประเทศไทย (EGAT)` |
| C | `industry` | String | Industry or segment | `พลังงาน / Energy` |
| D | `contact_person` | String | Primary contact name | `คุณวิทยา` |
| E | `phone` | String | Contact phone number | `02-436-8000` |
| F | `email` | String | Contact email | `wittaya@egat.co.th` |
| G | `region` | String | Customer location/region | `นนทบุรี` |

### Visual Column Layout — Customers

```
┌──────────────┬───────────────────────────┬──────────────────────────┬───────────────┬──────────────┬──────────────────────┬──────────────────┐
│A: customer_id│B: company_name            │C: industry               │D: contact     │E: phone      │F: email              │G: region         │
├──────────────┼───────────────────────────┼──────────────────────────┼───────────────┼──────────────┼──────────────────────┼──────────────────┤
│ CUS001       │ EGAT (การไฟฟ้าฝ่ายผลิตฯ)  │ พลังงาน / Energy         │ คุณวิทยา      │ 02-436-8000  │ wittaya@egat.co.th   │ นนทบุรี           │
├──────────────┼───────────────────────────┼──────────────────────────┼───────────────┼──────────────┼──────────────────────┼──────────────────┤
│ CUS002       │ ปตท. (PTT)                │ ปิโตรเคมี / Petrochemical│ คุณสมศักดิ์    │ 02-537-2000  │ somsak.p@pttplc.com  │ จตุจักร, กรุงเทพฯ │
├──────────────┼───────────────────────────┼──────────────────────────┼───────────────┼──────────────┼──────────────────────┼──────────────────┤
│ CUS003       │ ไทยออยล์ (Thai Oil)        │ กลั่นน้ำมัน / Oil Refinery│ คุณประยุทธ์    │ 038-359-000  │ prayuth@thaioil..    │ ศรีราชา, ชลบุรี   │
└──────────────┴───────────────────────────┴──────────────────────────┴───────────────┴──────────────┴──────────────────────┴──────────────────┘
```

### Sample Data

| customer_id | company_name | industry | contact_person | phone | email | region |
|---|---|---|---|---|---|---|
| CUS001 | การไฟฟ้าฝ่ายผลิตแห่งประเทศไทย (EGAT) | พลังงาน / Energy | คุณวิทยา | 02-436-8000 | wittaya@egat.co.th | นนทบุรี |
| CUS002 | บริษัท ปตท. จำกัด (มหาชน) | ปิโตรเคมี / Petrochemical | คุณสมศักดิ์ | 02-537-2000 | somsak.p@pttplc.com | จตุจักร, กรุงเทพฯ |
| CUS003 | บริษัท ไทยออยล์ จำกัด (มหาชน) | กลั่นน้ำมัน / Oil Refinery | คุณประยุทธ์ | 038-359-000 | prayuth@thaioilgroup.com | ศรีราชา, ชลบุรี |
| CUS004 | บริษัท บางจาก คอร์ปอเรชั่น จำกัด (มหาชน) | พลังงาน / Energy | คุณณัฐพล | 02-335-8888 | nuttapon@bangchak.co.th | พระโขนง, กรุงเทพฯ |
| CUS005 | บริษัท อมตะ คอร์ปอเรชัน จำกัด (มหาชน) | นิคมอุตสาหกรรม / Industrial Estate | คุณพิชัย | 038-939-007 | pichai@amata.com | ชลบุรี |

---

## Sheet 5: Daily Summary

Aggregated daily statistics per rep. This can be auto-calculated via Google Sheets formulas or populated by a separate n8n workflow that runs at end of day.

### Column Definitions

| Column | Header | Type | Description | Example |
|---|---|---|---|---|
| A | `date` | Date | Summary date | `2026-03-10` |
| B | `rep_name` | String | Sales rep name | `สมชาย` |
| C | `total_visits` | Number | Number of customer visits | `3` |
| D | `total_calls` | Number | Number of phone calls / remote contacts | `2` |
| E | `total_quotations` | Number | Number of quotations sent | `1` |
| F | `total_deals_closed` | Number | Number of deals closed (won) | `0` |
| G | `total_revenue_thb` | Number | Sum of deal_value_thb for closed deals | `0` |

### Visual Column Layout — Daily Summary

```
┌────────────┬──────────┬──────────────┬──────────────┬──────────────────┬────────────────────┬───────────────────┐
│A: date     │B: rep    │C: visits     │D: calls      │E: quotations     │F: deals_closed     │G: revenue_thb     │
├────────────┼──────────┼──────────────┼──────────────┼──────────────────┼────────────────────┼───────────────────┤
│ 2026-03-10 │ สมชาย    │      2       │      1       │       1          │        0           │         0         │
├────────────┼──────────┼──────────────┼──────────────┼──────────────────┼────────────────────┼───────────────────┤
│ 2026-03-10 │ อรุณ     │      1       │      0       │       1          │        0           │         0         │
├────────────┼──────────┼──────────────┼──────────────┼──────────────────┼────────────────────┼───────────────────┤
│ 2026-03-10 │ นภา      │      1       │      0       │       0          │        1           │    12,000         │
└────────────┴──────────┴──────────────┴──────────────┴──────────────────┴────────────────────┴───────────────────┘

  Formulas (example for Row 2, where A2=date, B2=rep_name):
  ┌──────────────────────────────────────────────────────────────────────────────────────┐
  │ C2 = COUNTIFS('Sales Activities'!A:A, ">="&A2, 'Sales Activities'!A:A,              │
  │              "<"&A2+1, 'Sales Activities'!C:C, B2, 'Sales Activities'!J:J, "visit") │
  │ D2 = COUNTIFS(... same pattern ..., 'Sales Activities'!J:J, "call")                 │
  │ E2 = COUNTIFS(... same pattern ..., 'Sales Activities'!J:J, "quotation")            │
  │ F2 = COUNTIFS(... same pattern ..., 'Sales Activities'!K:K, "closed_won")           │
  │ G2 = SUMIFS('Sales Activities'!I:I, ... date & rep match ...,                       │
  │             'Sales Activities'!K:K, "closed_won")                                   │
  └──────────────────────────────────────────────────────────────────────────────────────┘
```

### Sample Data

| date | rep_name | total_visits | total_calls | total_quotations | total_deals_closed | total_revenue_thb |
|---|---|---|---|---|---|---|
| 2026-03-10 | สมชาย | 2 | 1 | 1 | 0 | 0 |
| 2026-03-10 | อรุณ | 1 | 0 | 1 | 0 | 0 |
| 2026-03-10 | นภา | 1 | 0 | 0 | 1 | 12000 |
| 2026-03-09 | สมชาย | 3 | 2 | 2 | 1 | 385000 |
| 2026-03-09 | อรุณ | 2 | 1 | 0 | 0 | 0 |

---

## Migration Path — Google Sheets to Supabase (Lean to Mid Tier)

```
  ┌─────────────────────────────────────────────────────────────────────────────┐
  │                  LEAN TIER (PoC) — Current                                  │
  │                                                                             │
  │  LINE ──► n8n ──► Claude ──► Google Sheets ──► Looker Studio                │
  │                                                                             │
  │  Pros: Free, fast to set up, familiar to team                               │
  │  Cons: 588K row limit, no real-time, limited concurrent access              │
  └──────────────────────────────┬──────────────────────────────────────────────┘
                                 │
                                 │  When to migrate:
                                 │  - >100K rows accumulated
                                 │  - Need real-time dashboards
                                 │  - Need multi-user concurrent writes
                                 │  - Need advanced queries / joins
                                 │
                                 ▼
  ┌─────────────────────────────────────────────────────────────────────────────┐
  │                  MID TIER — Supabase (PostgreSQL)                            │
  │                                                                             │
  │  LINE ──► n8n ──► Claude ──► Supabase (PostgreSQL) ──► Metabase / Grafana   │
  │                                                                             │
  │  Pros: Unlimited scale, real-time, SQL power, row-level security            │
  │  Cons: Monthly cost (~$25/mo), requires DB knowledge                        │
  └─────────────────────────────────────────────────────────────────────────────┘

  MIGRATION STEPS:
  ═══════════════

  Step 1: Create Supabase Tables
  ┌──────────────────────────────────────────────────────────────────────┐
  │  Google Sheets                 Supabase PostgreSQL                   │
  │                                                                     │
  │  Sheet: Sales Activities  ──►  Table: sales_activities              │
  │  Sheet: Reps              ──►  Table: reps                          │
  │  Sheet: Products          ──►  Table: products                      │
  │  Sheet: Customers         ──►  Table: customers                     │
  │  Sheet: Daily Summary     ──►  View:  daily_summary_view (auto)     │
  │                                                                     │
  │  Column names already in snake_case -- direct 1:1 mapping!          │
  └──────────────────────────────────────────────────────────────────────┘

  Step 2: Add Foreign Keys & Indexes
  ┌──────────────────────────────────────────────────────────────────────┐
  │                                                                     │
  │  sales_activities.rep_name    ──FK──►  reps.rep_name                │
  │  sales_activities.product_brand ─FK─►  products.brand               │
  │  sales_activities.customer_name ─FK─►  customers.company_name       │
  │                                                                     │
  │  Indexes on: timestamp, rep_name, sales_stage, activity_type        │
  └──────────────────────────────────────────────────────────────────────┘

  Step 3: Migrate Historical Data
  ┌──────────────────────────────────────────────────────────────────────┐
  │                                                                     │
  │  Google Sheets ──(export CSV)──► Import to Supabase                 │
  │                                                                     │
  │  OR use n8n workflow:                                                │
  │  Google Sheets Read ──► Loop ──► Supabase Insert                    │
  └──────────────────────────────────────────────────────────────────────┘

  Step 4: Update n8n Workflow
  ┌──────────────────────────────────────────────────────────────────────┐
  │                                                                     │
  │  BEFORE:  n8n ──► Google Sheets Append Row                          │
  │  AFTER:   n8n ──► Supabase Insert Row                               │
  │                                                                     │
  │  Change only the final node in the workflow!                        │
  └──────────────────────────────────────────────────────────────────────┘

  Step 5: Connect Dashboard
  ┌──────────────────────────────────────────────────────────────────────┐
  │                                                                     │
  │  BEFORE:  Looker Studio ◄── Google Sheets                           │
  │  AFTER:   Metabase      ◄── Supabase (direct PostgreSQL connection) │
  │           OR Grafana    ◄── Supabase                                │
  │                                                                     │
  └──────────────────────────────────────────────────────────────────────┘
```

### Schema Mapping Cheat Sheet

```
  ┌──────────────────────────────────────────────────────────────────────────────────────┐
  │  Google Sheets Column         PostgreSQL Column            Type Change               │
  ├──────────────────────────────────────────────────────────────────────────────────────┤
  │  timestamp (DateTime)    ──►  timestamp TIMESTAMPTZ        (same)                    │
  │  message_id (String)     ──►  message_id TEXT UNIQUE       (add UNIQUE constraint)   │
  │  rep_name (String)       ──►  rep_name TEXT REFERENCES     (add FK to reps)          │
  │  customer_name (String)  ──►  customer_name TEXT REFERENCES(add FK to customers)     │
  │  quantity (Number)       ──►  quantity INTEGER              (enforce integer)         │
  │  deal_value_thb (Number) ──►  deal_value_thb NUMERIC(12,2) (add precision)           │
  │  activity_type (String)  ──►  activity_type TEXT CHECK(...) (dropdown → CHECK)       │
  │  sales_stage (String)    ──►  sales_stage TEXT CHECK(...)   (dropdown → CHECK)       │
  │  payment_status (String) ──►  payment_status TEXT CHECK(...)(dropdown → CHECK)       │
  │  confidence_score (Num)  ──►  confidence_score NUMERIC(3,2) CHECK(0..1)              │
  │  follow_up_date (Date)   ──►  follow_up_date DATE           (same)                   │
  └──────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Sales Pipeline Stage Flow

```
  This diagram shows how a deal progresses through the sales_stage values:

                                ┌────────────┐
                                │   lead     │  Initial contact / inquiry
                                └─────┬──────┘
                                      │
                                      ▼
                                ┌────────────┐
                                │ qualified  │  Customer need confirmed
                                └─────┬──────┘
                                      │
                          ┌───────────┴───────────┐
                          ▼                       ▼
                   ┌──────────────┐        ┌────────────────┐
                   │demo_scheduled│        │quotation_sent  │
                   └──────┬───────┘        └───────┬────────┘
                          │                        │
                          └───────────┬────────────┘
                                      ▼
                                ┌────────────┐
                                │negotiation │  Price / terms discussion
                                └─────┬──────┘
                                      │
                          ┌───────────┴───────────┐
                          ▼                       ▼
                   ┌────────────┐          ┌────────────┐
                   │ closed_won │          │ closed_lost│
                   │   (deal!)  │          │  (lost)    │
                   └────────────┘          └────────────┘
```

---

## Activity Type Icons Reference

```
  ┌──────────────┬────────────────────────────────────────────────────────┐
  │ activity_type│ Description                                           │
  ├──────────────┼────────────────────────────────────────────────────────┤
  │ visit        │ [BUILDING] In-person customer visit at their site     │
  │ call         │ [PHONE]    Phone call or video call                   │
  │ quotation    │ [DOCUMENT] Sent a price quotation / proposal          │
  │ demo         │ [GEAR]     Product demonstration or trial             │
  │ delivery     │ [TRUCK]    Product delivered to customer              │
  │ follow_up    │ [CLOCK]    Follow-up on previous activity             │
  │ other        │ [NOTE]     Any other sales-related activity           │
  └──────────────┴────────────────────────────────────────────────────────┘
```

---

## Capacity Planning

```
  Google Sheets Limits:
  ┌────────────────────────────────────────────────────────────────────────┐
  │  Max cells per workbook:    10,000,000                                │
  │  Columns in Sales Activities:    17                                   │
  │  Max rows possible:         10,000,000 / 17 = ~588,235 rows          │
  │                                                                       │
  │  Expected daily volume:                                               │
  │    11 reps x ~30 messages/day = ~330 rows/day                         │
  │                                                                       │
  │  Projected growth:                                                    │
  │  ┌──────────┬───────────┬─────────┬──────────────────────────────┐    │
  │  │ Period   │ Rows      │ Cells   │ % of Sheets Limit            │    │
  │  ├──────────┼───────────┼─────────┼──────────────────────────────┤    │
  │  │ 1 month  │    9,900  │ 168,300 │  1.7%  ░░░░░░░░░░░░░░░░░░░  │    │
  │  │ 3 months │   29,700  │ 504,900 │  5.0%  █░░░░░░░░░░░░░░░░░░  │    │
  │  │ 6 months │   59,400  │  1.01M  │ 10.1%  ██░░░░░░░░░░░░░░░░░  │    │
  │  │ 1 year   │  120,450  │  2.05M  │ 20.5%  ████░░░░░░░░░░░░░░░  │    │
  │  │ 2 years  │  240,900  │  4.10M  │ 41.0%  ████████░░░░░░░░░░░  │    │
  │  │ 3 years  │  361,350  │  6.14M  │ 61.4%  ████████████░░░░░░░  │    │
  │  └──────────┴───────────┴─────────┴──────────────────────────────┘    │
  │                                                                       │
  │  Recommendation: Archive quarterly or migrate to Supabase at ~100K   │
  │  rows for best performance.                                           │
  └────────────────────────────────────────────────────────────────────────┘
```

---

## Setup Instructions

### Step 1: Create the Workbook

1. Go to Google Sheets and create a new blank spreadsheet
2. Rename it to `ATE Sales Report — Data [Year]` (e.g., `ATE Sales Report — Data 2026`)
3. Create five sheets with the exact names: `Sales Activities`, `Reps`, `Products`, `Customers`, `Daily Summary`
4. Delete the default `Sheet1` if it remains

### Step 2: Set Up Headers

Copy the column headers from the definitions above into Row 1 of each sheet. **Use the exact header names** (lowercase with underscores) as the n8n workflow references them by name.

### Step 3: Format Columns

- **Sales Activities:**
  - Column A: Format as Date Time
  - Column H: Format as Number (0 decimal places)
  - Column I: Format as Number (0 decimal places) with comma separator
  - Column M: Format as Date
  - Column P: Format as Number (2 decimal places)
- **Products:**
  - Column F: Format as Number (0 decimal places) with comma separator
- **Daily Summary:**
  - Column A: Format as Date
  - Columns C-F: Format as Number (0 decimal places)
  - Column G: Format as Number (0 decimal places) with comma separator

### Step 4: Add Data Validation

In the `Sales Activities` sheet:

1. Select Column J (all rows below header) > Data > Data Validation > List of items:
   `visit,call,quotation,demo,delivery,follow_up,other`

2. Select Column K > Data Validation > List of items:
   `lead,qualified,demo_scheduled,quotation_sent,negotiation,closed_won,closed_lost`

3. Select Column L > Data Validation > List of items:
   `n/a,pending,partial,paid,overdue`

```
  Quick Reference — Data Validation Setup in Google Sheets:
  ┌────────────────────────────────────────────────────────────────────────┐
  │                                                                        │
  │  1. Select the column range (e.g., J2:J)                               │
  │  2. Menu: Data > Data Validation > Add Rule                            │
  │  3. Criteria: "Dropdown (from a list)"                                 │
  │  4. Paste the comma-separated values                                   │
  │  5. Check "Show warning" or "Reject input" for invalid entries         │
  │                                                                        │
  │  ┌──────────────────────────────────────────────────┐                  │
  │  │  Data Validation Rule                            │                  │
  │  │  ┌──────────────────────────────────────────┐    │                  │
  │  │  │ Apply to range:  Sales Activities!J2:J   │    │                  │
  │  │  ├──────────────────────────────────────────┤    │                  │
  │  │  │ Criteria: Dropdown (from a list)         │    │                  │
  │  │  │ Values: visit, call, quotation, demo,    │    │                  │
  │  │  │         delivery, follow_up, other       │    │                  │
  │  │  ├──────────────────────────────────────────┤    │                  │
  │  │  │ On invalid data: [x] Reject input        │    │                  │
  │  │  └──────────────────────────────────────────┘    │                  │
  │  └──────────────────────────────────────────────────┘                  │
  │                                                                        │
  └────────────────────────────────────────────────────────────────────────┘
```

### Step 5: Freeze Header Rows

For each sheet, select Row 1 and go to View > Freeze > 1 row.

### Step 6: Seed Reference Data

Populate the `Reps`, `Products`, and `Customers` sheets with known data. The `Products` sheet should include all major items from the ATE catalog. The `Reps` sheet must include LINE user IDs (obtained from LINE webhook payloads during testing).

### Step 7: Share and Set Permissions

1. Share the spreadsheet with the Google service account email from n8n's Google Sheets credentials (e.g., `n8n-service@project-id.iam.gserviceaccount.com`)
2. Grant **Editor** access to the service account
3. Share read-only access with management for direct viewing
4. Note the Spreadsheet ID from the URL — you will need it in the n8n workflow

### Step 8: Connect to Looker Studio

1. Go to Google Looker Studio (https://lookerstudio.google.com)
2. Create a new report and add Google Sheets as a data source
3. Select the `ATE Sales Report — Data 2026` spreadsheet
4. Add each sheet as a separate data source
5. Build dashboard pages for:
   - Daily/weekly activity summary
   - Revenue pipeline by stage
   - Per-rep activity scoreboard
   - Product brand breakdown

---

## Notes and Considerations

- **Row limits:** Google Sheets supports up to 10 million cells. With 17 columns, that allows ~588,000 rows. At ~30 messages/day from 11 reps, you get ~330 rows/day or ~120,000 rows/year. This is well within limits for the PoC phase.
- **Deduplication:** The `message_id` column prevents duplicate entries. The n8n workflow should check for existing `message_id` before appending (or rely on LINE webhook idempotency).
- **Data cleanup:** Periodically review rows with `confidence_score` below 0.7. These may contain parsing errors that need manual correction.
- **Archiving:** At the end of each quarter or year, archive the workbook and start a fresh one to keep performance snappy.
- **Transition to Tier 2:** When migrating to Supabase (Mid tier), this sheet structure maps directly to database tables. Column names are already in snake_case for easy migration.
