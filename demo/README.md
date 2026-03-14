# ATE Sales Report Demo

Free, zero-budget demo: LINE message → AI parses Thai → Google Sheets → Looker Studio Dashboard

## Architecture

```
Phone (LINE) → Vercel (Python) → Gemini AI → Google Sheets → Looker Studio (Laptop)
                                  ↓              ↓
                            LINE reply      "Live Data" tab
                          (confirmation       (permanent
                            + nudge)           record)
```

## Features

| Feature | Description |
|---------|-------------|
| **AI Parsing** | Gemini 2.5 Flash (primary) + Groq Llama 3.3 70B (fallback) |
| **Thai + English** | Handles mixed-language messages, Thai currency slang (แสนห้า, 1.5ล้าน) |
| **Multi-activity** | Single message with multiple products → multiple rows, grouped by Batch ID |
| **Nudge System** | Gently reminds reps when mandatory fields are missing (3-tier: none, hint, hint+example) |
| **Live Data Tab** | Permanent record of all bot entries, never cleared by sample data scripts |
| **Source Column** | Distinguishes `live` (bot) vs `sample` (generated) data |
| **Backup System** | Timestamped backup tabs before sample data regeneration (max 3 kept) |
| **Sheet Formatting** | Conditional cell coloring, data validation dropdowns, frozen headers |
| **Partial Data Highlighting** | Rows with missing mandatory fields highlighted in light red |
| **Dashboard** | Looker Studio with KPIs, pipeline chart, brand mix, activity feed |

## Google Sheets Structure

### Tabs

| Tab | Purpose | Managed by |
|-----|---------|------------|
| **Sheet1** | Demo/dashboard data (sample + live) | `populate_sample_data.py` + webhook |
| **Live Data** | Permanent record of all bot entries | webhook only (auto-created) |
| **Legend** | Color coding reference | `populate_sample_data.py` |
| **Backup_*** | Timestamped backups (max 3) | `populate_sample_data.py` |

### Columns (A–Q, 17 total)

```
A: Timestamp           I: Activity Type       Q: Source (live/sample)
B: Rep Name            J: Sales Stage
C: Customer            K: Payment Status
D: Contact Person      L: Follow-up Notes
E: Product Brand       M: Summary (EN)
F: Product Name        N: Raw Message
G: Quantity            O: Batch ID
H: Deal Value (THB)    P: Item #
```

### Mandatory Fields (nudge triggers)

1. Customer Name
2. Product Brand
3. Deal Value (THB)
4. Activity Type
5. Sales Stage

### Data Validation Dropdowns

| Column | Options |
|--------|---------|
| Product Brand | Megger, Fluke, CRC, Salisbury, SmartWasher, IK Sprayer, Other |
| Activity Type | visit, call, quotation, follow_up, closed_won, closed_lost, other |
| Sales Stage | lead, negotiation, quotation_sent, closed_won, closed_lost |
| Payment Status | pending, partial, paid |

## Quick Setup

### Step 1: Get API Keys (30 min)

| # | What | Where | Time |
|---|------|-------|------|
| 1 | **Gemini API Key** | https://aistudio.google.com/apikey → Create API Key | 2 min |
| 2 | **Groq API Key** (fallback) | https://console.groq.com → API Keys → Create | 2 min |
| 3 | **LINE Credentials** | Follow `01_LINE_Setup_Guide.md` → get Channel Secret + Access Token | 20 min |
| 4 | **Google Service Account** | See below | 10 min |

#### Google Service Account Setup

1. Go to https://console.cloud.google.com
2. Create a new project: `ate-sales-demo`
3. Enable **Google Sheets API**: search "Sheets API" in the search bar → Enable
4. Go to **IAM & Admin → Service Accounts** → Create Service Account
   - Name: `ate-demo-bot`
   - Role: skip (not needed)
5. Click on the service account → **Keys** tab → Add Key → Create new key → JSON
6. Download the JSON file — this is your `GOOGLE_SERVICE_ACCOUNT_JSON`
7. Copy the `client_email` from the JSON file

### Step 2: Create Google Sheets (10 min)

1. Go to https://sheets.google.com → Create new spreadsheet
2. Name it: `ATE Sales Demo`
3. **Share the spreadsheet** with the service account email → give **Editor** access
4. Copy the **Spreadsheet ID** from the URL:
   ```
   https://docs.google.com/spreadsheets/d/THIS_IS_THE_ID/edit
   ```

### Step 3: Deploy to Vercel (15 min)

1. Install Vercel CLI (if not installed):
   ```bash
   npm install -g vercel
   ```

2. Navigate to the demo directory:
   ```bash
   cd ate_sales_report_system_planning/demo
   ```

3. Deploy:
   ```bash
   vercel
   ```

4. Set environment variables:
   ```bash
   vercel env add LINE_CHANNEL_SECRET
   vercel env add LINE_CHANNEL_ACCESS_TOKEN
   vercel env add GEMINI_API_KEY
   vercel env add GROQ_API_KEY
   vercel env add GOOGLE_SHEETS_ID
   vercel env add GOOGLE_SERVICE_ACCOUNT_JSON
   ```
   For `GOOGLE_SERVICE_ACCOUNT_JSON`, paste the **entire content** of the JSON key file as one line.

5. Redeploy with env vars:
   ```bash
   vercel --prod
   ```

6. Test the health check:
   ```bash
   curl https://your-project-name.vercel.app/api/webhook
   ```
   Should return: `{"status": "ok", "service": "ATE Sales Report Bot", ...}`

### Step 4: Connect LINE Webhook (5 min)

1. Go to LINE Developers Console → your channel → Messaging API tab
2. Set Webhook URL to: `https://your-project-name.vercel.app/api/webhook`
3. Click **Verify** — should show success
4. Enable **Use webhook**

### Step 5: Populate Sample Data

```bash
python3 populate_sample_data.py              # Backup + populate 31 sample rows
python3 populate_sample_data.py --no-backup  # Populate without backup
python3 populate_sample_data.py --restore    # Restore from latest backup
```

### Step 6: Test (5 min)

1. Open LINE on your phone
2. Send a message:
   ```
   ไปเยี่ยม PTT วันนี้ เสนอ Megger MTO330 ราคา 150,000
   ```
3. Bot should reply within 3-5 seconds with a Thai confirmation
4. Check Google Sheets — new row in both Sheet1 and Live Data tab

### Step 7: Build Looker Studio Dashboard

1. Go to https://lookerstudio.google.com → Create → Report
2. Connect Google Sheets → Sheet1
3. Build 4 sections:
   - **KPI Scorecards:** Total pipeline, total deals, won deals, win rate
   - **Pipeline Chart:** Bar chart by Sales Stage (color per stage)
   - **Brand Mix:** Donut chart by Product Brand
   - **Activity Feed:** Table with recent entries sorted by timestamp
4. Add filter controls: Rep Name, Product Brand, Date Range
5. Set data freshness to 1 minute
6. Share: Anyone with the link → Viewer

## Nudge System

The bot checks 5 mandatory fields after each message. Based on how many are missing:

| Missing | Response |
|---------|----------|
| 0 | AI confirmation only |
| 1-2 | Confirmation + hint listing missing fields |
| 3+ | Confirmation + hint + example message |

The nudge tone is soft: "ถ้าสะดวก ครั้งหน้าแจ้งในข้อความเดียวได้เลยนะครับ จะช่วยให้บันทึกได้ครบถ้วนขึ้น"

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Bot doesn't reply | Check Vercel logs: `vercel logs` |
| "Invalid signature" error | Verify `LINE_CHANNEL_SECRET` is correct |
| Gemini fails | Groq fallback kicks in automatically. Check `GROQ_API_KEY` |
| Sheets not updating | Verify service account has Editor access to the spreadsheet |
| Dashboard not refreshing | Set data freshness to 1 minute. Click refresh in Looker Studio |
| Sample data in wrong columns | Run `populate_sample_data.py --no-backup` to reset |
| Live Data tab missing | Auto-created on first LINE message. Send a test message |

## File Structure

```
demo/
├── api/
│   └── webhook.py              # Main serverless function (LINE → Gemini → Sheets → Reply)
├── populate_sample_data.py     # Generate 31 sample rows + formatting + backup system
├── vercel.json                 # Vercel routing config
├── requirements.txt            # Python dependencies (gspread, google-auth)
├── .env.example                # Environment variables template
├── .gitignore
└── README.md                   # This file
```

## Sample Data Overview

31 rows covering 1 month (Feb 10 – Mar 10, 2026):

- **3 deal progression stories:** PTT/Megger (won), EGAT/Fluke (lost), SCG/Salisbury (won)
- **2 multi-activity entries:** PTTEP 3-item visit, PEA 2-item visit
- **5 fictional reps:** สมชาย, วิภา, ธนกฤต, ปิยะ, อนุชา, นภัสสร
- **All 6 brands represented:** Megger (dominant), Fluke, CRC, Salisbury, SmartWasher, IK Sprayer
- **Realistic win/loss ratio:** ~30% won, ~20% lost, ~50% in pipeline
