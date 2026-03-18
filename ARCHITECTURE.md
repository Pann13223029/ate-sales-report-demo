# ATE Sales Report System — Architecture

## 1. System Overview

A zero-budget AI-powered sales reporting system for ATE (Advanced Technology Equipment Co., Ltd.), a Thai B2B distributor of industrial equipment. Field sales reps report activities via LINE chat in natural Thai — the system parses, validates, stores, and visualizes the data automatically.

**Core Pipeline:**
```
LINE Message → Vercel Serverless → Gemini AI Parse → Google Sheets → LINE Reply
                                                            ↓
                                                      Looker Studio Dashboard
```

**Design Principles:**
- Zero cost: all free tiers (Vercel Hobby, Gemini free, LINE free messaging, Google Sheets)
- No SDKs: all external APIs called via `urllib.request` to avoid dependency/version conflicts on Vercel
- Lazy imports: `gspread` and `google-auth` imported inside functions to prevent Vercel module-level errors
- Thai-first: prompts, nudges, and confirmations in Thai; internal data in English

---

## 2. Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Chat Interface | LINE Messaging API | Sales rep input + bot replies |
| Serverless Runtime | Vercel Python (BaseHTTPRequestHandler) | Webhook handler + API endpoints |
| AI Parsing | Google Gemini 2.5 Flash (primary) | Thai NLP → structured JSON |
| AI Fallback | Groq Llama 3.3 70B | Fallback if Gemini fails |
| Database | Google Sheets (via gspread) | Multi-tab data storage |
| Dashboard | Looker Studio | KPIs, pipeline chart, brand mix |
| Cron | GitHub Actions | Weekly stale deal notifications |
| Rich Menu | LINE Rich Menu API | 5-button navigation |

**Dependencies** (`requirements.txt`):
- `gspread==6.1.4` — Google Sheets client
- `google-auth==2.38.0` — Service account authentication

All other integrations (LINE, Gemini, Groq) use `urllib.request` directly.

---

## 3. Data Flow

### 3.1 New Report Flow
```
1. Rep sends Thai message in LINE
2. Vercel webhook receives POST /api/webhook
3. LINE signature validated (HMAC-SHA256)
4. Rep profile fetched from LINE API (display name)
5. Check for command keywords (summary, help, update) → handle if matched
6. Gemini AI parses message → structured JSON with activities[]
7. Hard validation: reject if contact_channel missing (non-service activities)
8. Soft validation: nudge for other missing mandatory fields
9. Write to 4 sheets: Rep Personal → Combined → Live Data → Major Opportunity (Megger only)
10. Smart match: check for existing active deals with same customer+brand
11. Reply to LINE with confirmation + nudge + match suggestions
```

### 3.2 Update Flow
```
1. Rep sends "อัพเดท MSG-XXXXX <changes>"
2. Regex match extracts batch_id + update text
3. Existing row data fetched from Combined sheet
4. Gemini AI parses update text against existing data → changed fields only
5. Cell updates applied to: Combined → Rep Personal → Live Data → Major Opportunity
6. Reply with before→after diff
```

### 3.3 Summary Flow
```
1. Rep sends "สรุป" or "สรุปยอด"
2. All data read from Combined sheet
3. Stats aggregated: by stage, brand, rep
4. Gemini generates Thai-language summary (or fallback to raw stats)
5. Reply with pipeline summary
```

### 3.4 Stale Deal Notification Flow
```
1. GitHub Actions cron fires every Monday 8AM Bangkok (1AM UTC)
2. GET /api/stale-check with X-Cron-Secret header
3. Combined sheet scanned for active (non-terminal) deals
4. Deals grouped by batch_id, latest timestamp per deal
5. Deals with no update in 7+ days → grouped by rep
6. LINE push message sent to each rep with their stale deals
```

---

## 4. Data Model

### 4.1 Column Schema (24 columns, A–X)

| Col | Header | Type | Source |
|-----|--------|------|--------|
| A | Timestamp | datetime `YYYY-MM-DD HH:MM:SS` | System (BKK timezone) |
| B | Rep Name | string | LINE display name |
| C | Customer | string | AI-parsed |
| D | Contact Person | string | AI-parsed |
| E | Contact Channel | string | AI-parsed (**mandatory**: phone/email) |
| F | Product Brand | enum | AI-parsed |
| G | Product Name | string | AI-parsed |
| H | Quantity | number | AI-parsed |
| I | Deal Value (THB) | number | AI-parsed |
| J | Activity Type | enum | AI-parsed |
| K | Sales Stage | enum | AI-parsed |
| L | Payment Status | enum | AI-parsed |
| M | Planned Visit Date | date `YYYY-MM-DD` | AI-parsed |
| N | Bidding Date | date `YYYY-MM-DD` | AI-parsed |
| O | Accompanying Rep | string | AI-parsed |
| P | Training Flag | `yes` or blank | Derived from `is_training` |
| Q | Close Reason | string | AI-parsed (terminal stages only) |
| R | Follow-up Notes | string | AI-parsed |
| S | Summary (EN) | string | AI-generated English summary |
| T | Raw Message | string | Original LINE message |
| U | Batch ID | `MSG-XXXXX` | MD5 hash of timestamp+rep+message |
| V | Item # | `1/3`, `2/3` etc. | Multi-activity grouping |
| W | Source | `live` or `sample` | Bot vs. generated data |
| X | Manager Notes | string | Manual entry only |

### 4.2 Enums

**Product Brand:** `Megger`, `Fluke`, `CRC`, `Salisbury`, `SmartWasher`, `IK Sprayer`, `HVOP`, `Other`

**Activity Type:** `visit`, `call`, `quotation`, `follow_up`, `closed_won`, `closed_lost`, `sent_to_service`, `other`

**Sales Stage:** `lead`, `plan_to_visit`, `visited`, `negotiation`, `quotation_sent`, `bidding`, `closed_won`, `closed_lost`, `job_expired`, `equipment_defect`

**Payment Status:** `pending`, `deposit`, `paid`

**Terminal Stages** (excluded from stale checks, smart match): `closed_won`, `closed_lost`, `job_expired`, `equipment_defect`

---

## 5. Google Sheets Structure

| Tab | Purpose | Protection | Created By |
|-----|---------|------------|------------|
| **Combined** | Dashboard source, all reps merged | Bot-managed, protected | Auto (renamed from Sheet1) |
| **Live Data** | Permanent record, never cleared | Bot-managed, protected | Auto on first write |
| **{Rep Name}** | Personal sheet per rep | Bot-managed, protected | Auto on first message |
| **Major Opportunity** | Megger deals only (high-value tracking) | Standard headers | Auto on first Megger deal |
| **Rep Registry** | LINE user_id → display name mapping | Standard headers | Auto on first message |
| **Legend** | Reference: brands, stages, activity types, column guide | Unprotected | populate_sample_data.py |

All bot-created sheets share the same header format: bold white text on dark blue background (`rgb(0.15, 0.3, 0.55)`), frozen first row, 24 columns A–X matching `LIVE_DATA_HEADERS`.

---

## 6. AI Parsing Pipeline

### 6.1 Provider Configuration

| Provider | Model | API | Timeout | Temperature |
|----------|-------|-----|---------|-------------|
| **Gemini** (primary) | `gemini-2.5-flash` | REST via `generativelanguage.googleapis.com/v1beta` | 30s | 0 |
| **Groq** (fallback) | `llama-3.3-70b-versatile` | REST via `api.groq.com/openai/v1` | 20s | 0 |

Both use `responseMimeType: "application/json"` / `response_format: json_object` to enforce structured output.

### 6.2 System Prompt

The system prompt (`SYSTEM_PROMPT`) instructs the AI to:
1. Parse Thai/English/mixed sales messages
2. Identify non-sales messages and return `is_sales_report: false`
3. Extract all 15 activity fields per the JSON schema
4. Parse Thai currency formats: `150K`, `1.5ล้าน`, `แสนห้า`, `สองแสน`
5. Parse Thai dates: `อังคารหน้า`, `สัปดาห์หน้า`, `25 มี.ค.`
6. Generate Thai confirmation message (`confirmation_th`)
7. Handle service entries (warranty/repair) with null `sales_stage`
8. Detect accompanying reps and training status
9. Extract close reasons for terminal stages
10. Contact channel must be real phone/email — never categories like "เข้าพบ"

### 6.3 Few-Shot Examples

8 examples covering:
- Basic visit with quotation (Megger MTO330)
- Closed deal with deposit (Fluke 1770)
- Phone lead with quantity (CRC Contact Cleaner)
- Non-sales message (lunch invitation)
- Planned visit with trainee (Megger MIT525)
- Lost deal with reason (Salisbury gloves)
- Warranty service (Megger MTO330)
- Government bidding with email (Megger MIT525)

### 6.4 Update Parsing

Update commands use a separate, shorter prompt that:
- Receives existing row data as context
- Parses only the changed fields
- Returns a minimal JSON with only modified fields
- Maps Thai shortcuts: `เจรจา`→negotiation, `ส่ง QT`→quotation_sent, `ปิดได้`→closed_won

---

## 7. Validation System

### 7.1 Hard Block (Contact Channel)

Reports without phone/email are **rejected before saving** (non-service activities only):
- AI prompt instructs: contact_channel is MANDATORY, must be real phone/email
- Post-parse check: any activity missing `contact_channel` triggers reject
- Reject message asks rep to resend with phone/email
- Service activities (`sent_to_service`) are exempt

### 7.2 Soft Nudge (Other Fields)

6 mandatory fields checked after successful save:
- `customer_name` — ชื่อลูกค้า
- `contact_channel` — เบอร์โทร/อีเมล ผู้ติดต่อ
- `product_brand` — สินค้า/แบรนด์
- `deal_value_thb` — มูลค่าดีล
- `activity_type` — ประเภทกิจกรรม
- `sales_stage` — สถานะดีล

**3-tier nudge:**
| Missing Fields | Response |
|---------------|----------|
| 0 | Clean confirmation only |
| 1–2 | Confirmation + polite hint (`ถ้าสะดวก ช่วยแจ้งเพิ่ม...`) |
| 3+ | Hint + full example message |

Service activities (`sent_to_service`) are exempt from all nudge checks.

---

## 8. Smart Match System

When a new report is saved, the system scans Combined sheet for existing active deals:
- **Match criteria:** customer name substring match + same brand or product name
- **Exclusions:** terminal-stage deals are skipped
- **Deduplication:** grouped by batch_id, max 3 matches returned
- Reply includes batch IDs so rep can use the update command

---

## 9. LINE Integration

### 9.1 Webhook Security

LINE webhook signature validated via HMAC-SHA256:
```
HMAC(LINE_CHANNEL_SECRET, request_body) == X-Line-Signature header
```

### 9.2 Message Routing

Keywords checked in order (case-insensitive):
1. **Summary:** `สรุป`, `สรุปยอด`, `สรุปยอดขาย`, `ยอดขาย`, `report`, `summary`
2. **Help:** `วิธีรายงาน`, `วิธีใช้`, `help`, `ช่วย`
3. **Help Update:** `วิธีอัพเดท`, `วิธีอัพเดต`, `วิธีแก้ไข`, `how to update`
4. **Update command:** regex `^(อัพเดท|อัพเดต|update|แก้ไข)\s+(MSG-[A-Za-z0-9]+)\s*(.*)`
5. **Sales report:** everything else → AI parsing pipeline

### 9.3 Rich Menu (5 buttons)

Asymmetric layout on 2500x843 canvas:
```
┌──────────┬──────────┬──────────┐
│ สรุปยอด  │ วิธีรายงาน │ วิธีอัพเดท │  (top: 3 × 833px)
├───────────────┬───────────────┤
│ เปิด Dashboard │ เปิด Sheets  │  (bottom: 2 × 1250px)
└───────────────┴───────────────┘
```
- Top 3: message actions (send keyword text)
- Bottom 2: URI actions (open Looker Studio / Google Sheets)

### 9.4 Push Notifications

Used for stale deal alerts only. Requires LINE user_id from Rep Registry tab. Free under LINE messaging limits.

---

## 10. Stale Deal Notifications

**Endpoint:** `GET /api/stale-check`

**Security:** `X-Cron-Secret` header must match `CRON_SECRET` env var.

**Logic:**
1. Read all rows from Combined sheet
2. Group by batch_id → keep latest timestamp per deal
3. Exclude terminal stages (`closed_won`, `closed_lost`, `job_expired`, `equipment_defect`)
4. Filter deals where last update > 7 days ago
5. Group stale deals by rep name
6. Look up LINE user_id from Rep Registry tab
7. Push notification to each rep (max 10 deals per message)
8. Message includes batch IDs + example update command

**Trigger:** GitHub Actions cron — `0 1 * * 1` (Monday 8AM Bangkok / 1AM UTC), plus manual dispatch.

---

## 11. Environment Variables

| Variable | Used By | Purpose |
|----------|---------|---------|
| `LINE_CHANNEL_SECRET` | webhook.py | Webhook signature validation |
| `LINE_CHANNEL_ACCESS_TOKEN` | webhook.py, stale_check.py | LINE API authentication |
| `GEMINI_API_KEY` | webhook.py | Gemini AI API key |
| `GROQ_API_KEY` | webhook.py | Groq fallback API key |
| `GOOGLE_SHEETS_ID` | webhook.py, stale_check.py | Target spreadsheet ID |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | webhook.py, stale_check.py | Service account credentials (full JSON) |
| `CRON_SECRET` | stale_check.py | Stale check endpoint auth |

**GitHub Actions Secrets** (for stale-check workflow):
- `CRON_SECRET` — must match Vercel env var
- `STALE_CHECK_URL` — full URL: `https://ate-sales-demo.vercel.app/api/stale-check`

---

## 12. API Endpoints

| Method | Path | Handler | Purpose |
|--------|------|---------|---------|
| `POST` | `/api/webhook` | webhook.py | LINE webhook (messages, events) |
| `GET` | `/api/webhook` | webhook.py | Health check (returns status JSON) |
| `GET` | `/api/stale-check` | stale_check.py | Stale deal scan + push notifications |

---

## 13. Deployment

**Platform:** Vercel (Hobby plan, free)

**Configuration:**
- Root `vercel.json` sets `"rootDirectory": "demo"`
- `demo/vercel.json` defines builds and routes:
  - `api/webhook.py` → `@vercel/python`
  - `api/stale_check.py` → `@vercel/python`
- Auto-deploy on push via GitHub integration

**URL:** `https://ate-sales-demo.vercel.app`

---

## 14. Error Handling & Fallbacks

| Scenario | Behavior |
|----------|----------|
| Gemini API fails | Falls back to Groq Llama 3.3 70B |
| Groq also fails | Generic error reply to LINE |
| Sheets write fails | Report still confirmed to user with warning badge |
| LINE profile fetch fails | Uses raw `user_id` as rep name |
| Stale check unauthorized | Returns 401 JSON |
| Stale check error | Returns 500 with truncated error message |
| Non-sales message | Silently ignored (no reply) |
| Empty webhook body | Returns 200 OK (LINE verify request) |
| Missing contact channel | Report rejected before saving, rep asked to resend |

---

## 15. File Structure

```
ate_sales_report_system_planning/
├── vercel.json                      # Root: sets rootDirectory to demo/
├── .github/
│   └── workflows/
│       └── stale-check.yml          # Weekly cron trigger
├── demo/
│   ├── vercel.json                  # Builds + routes config
│   ├── requirements.txt             # gspread + google-auth
│   ├── api/
│   │   ├── webhook.py               # Main serverless function (1261 lines)
│   │   └── stale_check.py           # Stale deal endpoint (264 lines)
│   ├── populate_sample_data.py      # Sample data + sheet formatting
│   ├── generate_rich_menu_image.py  # Rich menu PNG generator
│   ├── setup_rich_menu.py           # Rich menu LINE API setup
│   └── README.md                    # Quick-start guide
└── docs/                            # Planning & reference docs
```
