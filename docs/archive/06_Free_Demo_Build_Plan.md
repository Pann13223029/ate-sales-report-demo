# ATE Sales Report System — FREE Demo Build Plan

> **Status: COMPLETED.** Demo built and deployed. See `demo/README.md` for setup instructions and `08_Roadmap.md` for Phase 2 plans.

> **Purpose:** Build a live, zero-budget demo to show ATE's sales manager the full end-to-end flow
> **Constraint:** 3 days, zero budget, all free tiers
> **Date:** 2026-03-10 (demo date: 2026-03-14)
> **Method:** Expert panel debate → consensus recommendation

---

## Table of Contents

1. [Expert Panel Debate](#1-expert-panel-debate)
2. [Cross-Examination & Conflict Resolution](#2-cross-examination--conflict-resolution)
3. [Final Consensus: Recommended Tech Stack](#3-final-consensus-recommended-tech-stack)
4. [Architecture Diagram](#4-architecture-diagram)
5. [3-Day Build Plan](#5-3-day-build-plan)
6. [Demo Script](#6-demo-script)
7. [Risk & Fallback Plan](#7-risk--fallback-plan)
8. [Pre-populated Sample Data](#8-pre-populated-sample-data)

---

## 1. Expert Panel Debate

### Expert 1: AI/LLM Engineer — Which Free AI for Thai Sales Message Parsing?

**Recommendation: Google Gemini 2.5 Flash (primary) + Groq Llama 3.3 70B (fallback)**

I have evaluated six free AI options for parsing messy Thai sales messages into structured JSON. The core challenge is that Thai language has no spaces between words, uses informal abbreviations, and our sales reps mix Thai and English freely — for example, "ไปเยี่ยม PTT วันนี้ เสนอ Megger MTO330 ราคา 150,000 ลูกค้าสนใจ" needs to become clean JSON with customer, product, price, and status fields.

**Google Gemini 2.5 Flash** is my top pick. Its free tier provides 10 RPM and 250 requests/day — more than sufficient for a demo where we will send perhaps 5-10 messages. Gemini has excellent Thai language understanding, likely the best among free options because Google has invested heavily in multilingual training data. It outputs reliable JSON when properly prompted with `response_mime_type: "application/json"` and a schema. Latency is typically 1-3 seconds, which is comfortably within LINE's 30-second reply token window. The API requires no credit card and setup is a single API key from Google AI Studio.

**Groq with Llama 3.3 70B** is my recommended fallback. Groq's inference speed is exceptional — often under 1 second — which gives us the fastest response times of any option. The free tier allows approximately 30 RPM and 14,400 requests/day for smaller models. Llama 3.3 70B has reasonable Thai capability (not as strong as Gemini, but functional for structured extraction when given strong few-shot examples in the prompt). The risk is that open-source models sometimes produce malformed JSON or hallucinate field names, so we need strict prompt engineering with explicit examples.

**Why I rejected the others:**
- **Ollama (local):** Requires a machine with 16GB+ RAM for 70B models. If the demo runs on a laptop, it competes for resources. Too risky for a 3-day build.
- **Hugging Face Inference API:** Free tier is rate-limited and the hosted models for Thai are mediocre. Not reliable enough.
- **OpenRouter:** Aggregator — free models rotate and may disappear. Unreliable for a demo that must work.
- **Cohere:** Trial tier exists but Thai language support is weak compared to Gemini.
- **Mistral API:** Free tier exists but Thai language understanding is noticeably behind Gemini and even Llama 3.3.

**Critical implementation detail:** The prompt must include 5-6 few-shot examples of real ATE messages in Thai, with the expected JSON output. This is what makes the parsing reliable regardless of which model we use. I will provide the prompt template in the build plan.

---

### Expert 2: Backend/Integration Engineer — Wiring LINE to AI to Database to Dashboard

**Recommendation: Single Python script on Vercel Serverless Functions (or Cloudflare Workers as alternative)**

For a 3-day zero-budget build, I strongly recommend against using workflow platforms like n8n Cloud, Make.com, or Pipedream for the demo. Here is why: n8n Cloud's free tier allows only 300 executions per month and test runs count against that limit — we could burn through the quota during development. Make.com and Pipedream have similar constraints. More importantly, introducing a workflow platform adds a layer of abstraction that is unnecessary for a demo with a single linear flow: LINE webhook receives message, call AI API, write to database, reply to LINE.

**A single Python script deployed as a Vercel Serverless Function** is the optimal choice. Vercel's free Hobby tier provides 100GB bandwidth, and serverless functions with generous invocation limits. The script handles one endpoint: `POST /api/webhook` which LINE calls when a message arrives. The function: (1) validates the LINE signature, (2) extracts the message text, (3) calls Gemini API, (4) parses the JSON response, (5) writes to Google Sheets via the Sheets API, (6) sends a reply via LINE's reply API using the reply token. This is approximately 80-120 lines of Python code. Vercel provides a public HTTPS URL automatically — no domain purchase or SSL certificate needed.

**Why Vercel over alternatives:**
- **Cloudflare Workers:** Also excellent (100K requests/day free, global edge), but Workers use a JavaScript-only runtime with some API limitations. Vercel is more flexible with Python.
- **Render.com:** Free tier spins down after 15 minutes of inactivity. Cold starts take ~30 seconds — this could cause LINE's reply token to expire during the demo. Unacceptable risk.
- **Railway:** Removed their free tier in 2024. Not an option.

**Database choice: Google Sheets via Sheets API.** For a demo, Google Sheets is the ideal "database" because: (1) it is free with no limits that matter for our scale, (2) the dashboard tool (Looker Studio) connects natively, (3) the sales manager can open the sheet directly and see raw data — this builds trust, (4) Python's `gspread` library makes writes trivial. We use a Google Service Account (free) for authentication.

**One concern I must flag:** Vercel's free tier is for "personal, non-commercial use." For a demo this is fine. For production, the existing proposal already recommends moving to a proper stack.

---

### Expert 3: Dashboard/Frontend Engineer — Best Free Publicly Accessible Dashboard

**Recommendation: Google Looker Studio (primary dashboard) with Google Sheets as the live data layer**

I have evaluated seven options for a dashboard that must be: (a) free, (b) accessible via public URL on a laptop, (c) visually impressive enough to win over a sales manager, (d) buildable in under one day, and (e) able to show near-real-time updates.

**Google Looker Studio** is the clear winner for this demo. It connects directly to Google Sheets as a data source — no database middleware needed. It produces professional-looking charts, tables, and KPI scorecards out of the box. Dashboards can be shared via a public link — anyone with the URL can view it, no login required. It is mobile-responsive for tablet-size viewing. Most importantly for our 3-day timeline: I can build a compelling multi-page dashboard in 3-4 hours because Looker Studio's drag-and-drop interface is fast for this kind of work.

**The near-real-time trick:** Looker Studio's default data freshness for Google Sheets is 15 minutes, but we can set it to refresh every 1 minute in the data source settings. For the demo, we also add a manual "Refresh data" button (built into Looker Studio's viewer controls). The demo flow would be: send a LINE message, wait 30-60 seconds, click refresh on the dashboard, and the new row appears. This is not instant, but it is visually compelling and the 30-60 second delay actually works in our favor — it gives the presenter time to narrate what is happening behind the scenes.

**Why I rejected alternatives:**
- **Streamlit on Streamlit Cloud:** Excellent for Python developers, and it can auto-refresh. However, the free tier requires a public GitHub repo (our code and credentials structure would be exposed), the UI looks more "developer tool" than "executive dashboard," and it would take longer to make it visually polished. Good fallback, though.
- **Vercel + Next.js custom dashboard:** Would look the best, but building a custom dashboard in 3 days while also building the backend and LINE integration is too risky. Not enough time.
- **Retool:** Free tier limits to 5 users and requires login — not a clean demo experience.
- **Grafana Cloud:** Free tier is generous, but Grafana is designed for infrastructure monitoring, not sales dashboards. The learning curve for making it look like a sales dashboard is steep.
- **Notion:** No real chart capabilities. Would look unprofessional for this use case.
- **Google Sheets as dashboard:** Too basic. A sales manager sees spreadsheets every day — we need to show something that feels like an upgrade, not more of the same.

**Dashboard layout plan (4 sections):**
1. **KPI Header:** Total pipeline value, deals this month, visits this week, conversion rate — big numbers with trend arrows
2. **Pipeline Chart:** Horizontal bar chart showing deals by stage (Lead / Negotiation / Quotation / Won / Lost)
3. **Brand Revenue Breakdown:** Pie or donut chart — Megger, Fluke, CRC, Salisbury, etc.
4. **Activity Feed Table:** Latest 20 entries — date, rep name, customer, product, value, status — sorted by most recent first

---

### Expert 4: LINE Platform Specialist — Getting LINE Official Account + Bot Working Fast

**Recommendation: LINE Official Account (free Communication plan) + Messaging API with webhook to Vercel**

The LINE setup is the critical path item — it has the most manual steps and the most potential for delays. Here is my plan to minimize the setup time from the typical 30-45 minutes down to about 20 minutes.

**Step-by-step fast track:**
1. Go to LINE Official Account Manager (manager.line.biz), create an account (5 min). Choose the **free Communication plan** — in Thailand this gives 200 broadcast messages/month (some regions give 500). But here is the critical insight: **reply messages do NOT count against this limit**. Reply messages — sent using the `replyToken` from a webhook event — are unlimited and free on all plans. Since our bot only replies to messages it receives, we will never hit the message limit even with hundreds of test messages.
2. In the LINE Official Account settings, enable the **Messaging API** (3 min). This generates a Channel ID and Channel Secret.
3. Go to LINE Developers Console (developers.line.biz), find the linked channel, and issue a **Channel Access Token** (long-lived) (2 min).
4. Set the **Webhook URL** to our Vercel endpoint: `https://your-app.vercel.app/api/webhook` (2 min).
5. Enable **"Use webhook"** and disable **"Auto-reply messages"** and **"Greeting messages"** in the LINE OA Manager — otherwise LINE's default auto-replies will interfere with our bot (3 min).
6. Add the bot to a test LINE group chat — scan the QR code from the LINE OA Manager with your phone (2 min).
7. Send a test message and verify the webhook fires (3 min).

**The 30-second reply token issue:** When LINE sends a webhook event, the `replyToken` is valid for only 30 seconds. After that, we cannot reply to that specific message. This is a hard constraint. My assessment: Gemini API typically responds in 1-3 seconds. Our Vercel function adds maybe 500ms of overhead. Google Sheets write takes 1-2 seconds. Total: 3-6 seconds. We are well within the 30-second window. However, if the AI is slow (network issue, rate limit), we should implement a **two-phase reply strategy:**
- Phase 1 (immediate, within 2 seconds): Send a quick reply "Received. Processing..." using the reply token before it expires.
- Phase 2 (after AI completes): Use a **push message** to send the detailed confirmation. Push messages cost against our monthly quota, but for a demo we will only send a handful.

Actually, on reflection, the two-phase approach adds complexity. For a demo, I recommend the simpler approach: just call the AI and reply. If it takes more than 25 seconds (timeout safety margin), we catch the error and the message still gets logged — the rep just does not get a confirmation for that one message. During the live demo, we control the conditions, so this is extremely unlikely to fail.

**Group chat consideration:** When the bot is in a group, it only receives messages if: (a) the message mentions the bot using @, or (b) the bot's "group chat" settings allow it to read all messages. For the demo, we want option (b) — the bot silently reads everything in the sales report group. This is configured in the LINE Developers Console under the Messaging API channel settings: set **"Allow bot to join group chats"** to enabled.

---

### Expert 5: Project Manager / Demo Strategist — Maximizing Impact in 3 Days

**Recommendation: Pre-load rich sample data, demonstrate 3 live messages, script every second of the demo**

The sales manager does not care about our tech stack. They care about three things: (1) Does it save time for my reps? (2) Can I see what my team is doing in real-time? (3) Is this data I can actually use to make decisions? Our demo must answer "yes" to all three within 5-7 minutes.

**The pre-loading strategy is critical.** An empty dashboard with 2-3 entries looks like a toy. A dashboard with 20+ entries showing two weeks of realistic activity data — with real ATE product names (Megger MTO330, Fluke 1587 FC, CRC 2-26), real Thai customer names (PTT, EGAT, SCG, IRPC, BCP), and realistic deal values in Thai Baht — looks like a system that is already working. We pre-populate Google Sheets with 20 sample entries before the demo. During the demo, we send 2-3 live messages that appear on the dashboard in real-time. The contrast between "look at all this historical data" and "watch this new entry appear live" is what creates the wow factor.

**The 3-day timeline is tight but achievable with strict prioritization:**
- **Day 1 (8 hours):** LINE Official Account setup + Vercel webhook + Gemini API integration. Goal: send a Thai message in LINE, get a structured JSON reply. This is the critical path — if this works, everything else is layering on top.
- **Day 2 (8 hours):** Google Sheets integration + Looker Studio dashboard build + pre-populate sample data. Goal: full pipeline working — LINE message becomes a row in Sheets, visible on dashboard.
- **Day 3 (4 hours build + 4 hours rehearsal):** Polish, error handling, demo rehearsal. Goal: run through the demo script 3-5 times until it is smooth. Fix any issues discovered during rehearsal.

**What to show during the demo (scripted, 7 minutes):**

1. **[1 min] Problem statement:** "Right now, sales reports come in different formats — LINE messages, spreadsheets, verbal updates. No central view. Let me show you what we built."
2. **[1 min] Show the dashboard on the laptop:** Walk through the pre-loaded data. "Here is the last two weeks of sales activity. You can see total pipeline, activity by rep, revenue by product brand."
3. **[2 min] Live demo — send 3 messages from phone:**
   - Message 1 (Thai, simple): "ไปเยี่ยม EGAT วันนี้ เสนอ Fluke 1587 FC ราคา 85,000" — basic visit report
   - Message 2 (Thai, deal update): "ปิดดีล SCG สั่ง CRC 2-26 จำนวน 50 กระป๋อง มูลค่า 25,000" — a closed deal
   - Message 3 (Mixed Thai/English): "Follow up PTT เรื่อง Megger MTO330 ลูกค้าขอ demo สัปดาห์หน้า" — a follow-up activity
4. **[1 min] Show bot replies in LINE:** "The bot confirmed each message, showing exactly what it understood. If it got something wrong, the rep can correct it."
5. **[1 min] Refresh the dashboard:** "Now let us look at the dashboard again." Click refresh. The 3 new entries appear. Point out how the KPI numbers updated.
6. **[1 min] Wrap up:** "This is a working prototype. The reps keep using LINE exactly as they do today — no new app, no training. The data flows automatically to this dashboard. We can have this running for the full team within two weeks."

**Fallback plans:**
- If AI fails during demo: have 3 pre-written JSON responses ready to manually paste into Google Sheets. The dashboard will still update.
- If LINE webhook fails: have a backup Vercel endpoint that accepts manual POST requests. Use Postman on the laptop to simulate.
- If dashboard does not refresh: open Google Sheets directly and show the new rows — "The data is here, the dashboard will catch up in a moment."

---

## 2. Cross-Examination & Conflict Resolution

### Challenge 1: Expert 4 challenges Expert 1 — "What if Gemini is slow and we lose the reply token?"

**Expert 4 (LINE Specialist):** "You said Gemini takes 1-3 seconds. But what about cold starts? What about rate limits? If we hit the free tier limit during development and testing, the API returns an error during the demo."

**Expert 1 (AI Engineer):** "Valid concern. Gemini Flash-Lite allows 15 RPM and 1,000 requests/day. During development, I estimate we will make 50-100 test calls. That leaves 900+ for demo day. On rate limits: 15 RPM means one request every 4 seconds. We will never send messages that fast in a demo. On cold starts: Gemini API does not have cold starts — it is a managed service. The 1-3 seconds is consistent."

**Expert 2 (Backend):** "I can add a simple safeguard: set a 20-second timeout on the Gemini API call. If it times out, we reply with a generic 'Received, processing...' and log the message for manual review. For the demo, this is a non-issue. For the fallback Groq path, response time is under 1 second — even faster."

**Resolution:** Use Gemini 2.5 Flash as primary. Implement a 20-second timeout with a graceful fallback reply. Keep Groq API key configured as a backup that can be switched with one environment variable change.

---

### Challenge 2: Expert 3 challenges Expert 2 — "Google Sheets is not real-time. Won't the dashboard lag feel awkward?"

**Expert 3 (Dashboard):** "Looker Studio minimum refresh is 1 minute from Google Sheets. There will be a visible delay between sending the LINE message and seeing it on the dashboard. In a live demo, silence while waiting is deadly."

**Expert 5 (Demo Strategist):** "This is a presentation problem, not a technical problem. Here is how we handle it: After sending the 3 LINE messages, we narrate for 60-90 seconds — show the bot replies on the phone, explain what is happening behind the scenes ('The AI is parsing the Thai message, extracting customer name, product, and deal value, and writing it to our database'). By the time we turn back to the dashboard and click refresh, the data is there. The delay becomes a feature — it gives us time to tell the story."

**Expert 2 (Backend):** "I can also add a timestamp to each row in Google Sheets. When we refresh the dashboard, the new entries will be at the top with today's timestamp, making them immediately visible."

**Resolution:** Accept the 60-90 second delay. Use the narration strategy during the demo. Add a "Last Updated" timestamp column to make new entries obvious.

---

### Challenge 3: Expert 5 challenges Expert 1 — "Is Gemini reliable enough for Thai parsing? What if it misparses during the demo?"

**Expert 5 (Demo Strategist):** "This is the single biggest risk. If we send a perfectly crafted Thai message and the AI returns garbage JSON, the demo is dead. How confident are you?"

**Expert 1 (AI Engineer):** "Very confident, for three reasons. First, the demo messages are scripted — we know exactly what we will send and we will have tested those exact messages dozens of times. Second, the prompt will include 6 few-shot examples that are nearly identical to our demo messages. The AI is essentially doing pattern matching at that point. Third, Gemini 2.5 Flash consistently handles Thai-English code-switching well — I have tested this. The risk is with truly ambiguous or misspelled messages, which we avoid by scripting the demo."

**Expert 2 (Backend):** "As additional insurance, I will add basic validation in the webhook function: if the AI response is not valid JSON or is missing required fields (customer, product), we use a regex-based fallback parser that extracts known product names (Megger, Fluke, CRC) and known customer names (PTT, EGAT, SCG) from the raw text. It will not be as clean, but it will produce a valid row."

**Resolution:** Script the demo messages. Test them 10+ times during Day 2. Implement a simple regex fallback parser. Keep a manual override ready (paste JSON directly into Sheets).

---

### Challenge 4: Expert 2 challenges Expert 3 — "What about using Streamlit for a more interactive real-time experience?"

**Expert 2 (Backend):** "Streamlit can auto-refresh every few seconds, showing data as soon as it hits Google Sheets. No manual refresh button needed. The auto-refresh would make the demo smoother."

**Expert 3 (Dashboard):** "Streamlit's auto-refresh is nice, but the trade-offs are significant for a 3-day build. First, the free tier on Streamlit Community Cloud requires a public GitHub repo — our Google Sheets credentials and API keys would need to be in secrets management, adding setup time. Second, Streamlit's default styling looks like a data science notebook, not an executive dashboard. Styling it to look professional takes hours. Third, Looker Studio gives us drag-and-drop chart building — I can create 6 charts in 2 hours. In Streamlit, each chart requires Python code (plotly or altair), which takes longer. Given 3 days, Looker Studio gets us a better-looking result faster."

**Expert 5 (Demo Strategist):** "The sales manager will judge the dashboard by how it looks, not by how it refreshes. A polished Looker Studio dashboard with a manual refresh is far more impressive than a janky auto-refreshing Streamlit app. I side with Expert 3."

**Resolution:** Use Looker Studio. The manual refresh with narration is sufficient for the demo.

---

### Challenge 5: Expert 4 challenges Expert 2 — "Vercel free tier says non-commercial use only. Is this a problem?"

**Expert 4 (LINE Specialist):** "If ATE sees this demo and wants to go live, we would need to migrate. Does this create a bad precedent?"

**Expert 2 (Backend):** "For the demo, this is explicitly a prototype — non-commercial use. The existing proposal (document 00) already outlines a proper production architecture with VPS hosting. The demo is to prove the concept works, not to be the production system. If they ask 'Can we go live with this exact setup?', the answer is 'The concept is proven, and we move to a production-grade hosting for the real deployment.' Alternatively, Cloudflare Workers allows commercial use on the free tier (100K requests/day) and is an easy migration target."

**Resolution:** Use Vercel for the demo. Document Cloudflare Workers as the production-ready free alternative if needed.

---

## 3. Final Consensus: Recommended Tech Stack

| Component | Tool | Free Tier Details | Why This Choice |
|-----------|------|-------------------|-----------------|
| **AI Parsing (Primary)** | Google Gemini 2.5 Flash | 10 RPM, 250 req/day, no credit card | Best Thai language understanding among free options; reliable JSON output; 1-3 sec latency |
| **AI Parsing (Fallback)** | Groq (Llama 3.3 70B) | ~30 RPM, 14,400 req/day | Sub-second latency; switch with one env variable if Gemini has issues |
| **Backend / Webhook** | Vercel Serverless Functions (Python) | 100GB bandwidth, generous invocations | Public HTTPS URL automatic; deploy from Git in minutes; Python ecosystem |
| **Database** | Google Sheets (via Sheets API) | Unlimited for our scale | Zero setup; native Looker Studio connection; manager can inspect raw data |
| **Dashboard** | Google Looker Studio | Completely free, public sharing | Professional charts in hours; drag-and-drop; shareable public URL; mobile-responsive |
| **Messaging Platform** | LINE Official Account (free plan) | 200 broadcast msg/mo (Thailand); **reply messages are unlimited** | Already used by ATE team; zero adoption friction |
| **LINE Bot Framework** | LINE Messaging API + `line-bot-sdk` (Python) | Free; webhook-based | Official SDK; handles signature validation; reply token management |
| **Version Control / Deploy** | GitHub + Vercel Git integration | Free | Push to deploy; environment variables for secrets |
| **AI Prompt Approach** | 6 few-shot examples + JSON schema | N/A | Maximizes parsing accuracy for Thai-English mixed input |

**Total monthly cost: 0 THB / $0 USD**

---

## 4. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        ATE SALES DEMO — ARCHITECTURE                        │
└─────────────────────────────────────────────────────────────────────────────┘

  PHONE (Sales Rep)                    CLOUD (Free Tiers)                LAPTOP (Manager)
  ─────────────────                    ─────────────────                ────────────────

  ┌─────────────────┐     HTTPS POST    ┌──────────────────────────┐
  │   LINE App      │─────────────────→│  Vercel Serverless       │
  │                 │    (webhook)      │  Function (Python)       │
  │  Sales Rep      │                  │                          │
  │  sends Thai     │                  │  1. Validate LINE sig    │
  │  message in     │                  │  2. Extract message text │
  │  group chat     │                  │  3. Call Gemini API ─────│──→ Google Gemini
  │                 │                  │  4. Parse JSON response  │    2.5 Flash
  │                 │                  │  5. Write to Sheets ─────│──→ Google Sheets
  │                 │     LINE Reply   │  6. Reply via LINE ──────│──→ LINE Platform
  │  ← Bot replies │←─────────────────│                          │
  │  with parsed    │   "รับทราบครับ    │                          │
  │  confirmation   │    บันทึกแล้ว"    │                          │
  └─────────────────┘                  └──────────────────────────┘
                                              │
                                              │ writes rows
                                              ▼
                                       ┌──────────────────┐
                                       │  Google Sheets    │      ┌──────────────────┐
                                       │                   │      │  Google Looker    │
                                       │  - Sales Activity │─────→│  Studio Dashboard │
                                       │  - Sample Data    │ data │                  │
                                       │  - Config/Lookup  │ src  │  - KPI Cards     │
                                       │                   │      │  - Pipeline Chart │
                                       └──────────────────┘      │  - Brand Revenue  │
                                                                  │  - Activity Feed  │
                                                                  │                  │
                                                                  │  Public URL ──────│──→ Manager's
                                                                  │  (no login)       │    Laptop
                                                                  └──────────────────┘    Browser
```

```
DATA FLOW (timeline for a single message):

  0.0s  Rep sends LINE message
  0.1s  LINE Platform sends webhook POST to Vercel
  0.2s  Vercel function starts executing
  0.3s  LINE signature validated, message text extracted
  0.5s  Gemini API called with Thai message + few-shot prompt
  2.0s  Gemini returns structured JSON
  2.1s  JSON validated, row constructed
  2.5s  Row appended to Google Sheets via Sheets API
  3.0s  LINE reply sent using replyToken
  3.5s  Rep sees confirmation in LINE

  ~60s  Looker Studio refreshes data (configurable: 1-minute minimum)
  ~60s  Dashboard on manager's laptop shows the new entry

  TOTAL: 3.5 seconds for LINE round-trip, ~60 seconds for dashboard visibility
```

---

## 5. 3-Day Build Plan

> **Status: All 3 days completed.** System is live at ate-sales-demo.vercel.app

### Day 1 (8 hours): Core Pipeline — LINE to AI to Reply

| Time | Task | Details | Done Criteria |
|------|------|---------|---------------|
| **0:00-0:30** | Create Google Cloud project | Go to console.cloud.google.com, create project "ate-sales-demo", enable Sheets API, create Service Account, download JSON key | Service Account JSON key file downloaded |
| **0:30-1:00** | Get Gemini API key | Go to aistudio.google.com, create API key for the project | API key obtained, tested with curl |
| **1:00-1:30** | Set up LINE Official Account | Create at manager.line.biz, enable Messaging API, get Channel Secret + Access Token, configure webhook URL (placeholder for now) | Channel credentials obtained |
| **1:30-2:00** | Create GitHub repo + Vercel project | Create `ate-sales-demo` repo, connect to Vercel, set up Python serverless function skeleton at `api/webhook.py` | Vercel deploys, endpoint returns 200 OK |
| **2:00-3:30** | Build webhook handler | Implement LINE signature validation, message extraction, basic logging. Test with LINE webhook — send message, verify function fires. | LINE message triggers function, logs appear in Vercel |
| **3:30-5:00** | Integrate Gemini API parsing | Write the Thai-English parsing prompt with 6 few-shot examples. Call Gemini API from the webhook handler. Parse and validate JSON response. | Thai message in → structured JSON out (tested with 5 sample messages) |
| **5:00-6:00** | Build LINE reply | Format the parsed JSON as a Thai confirmation message. Send reply using LINE reply token. | Bot replies in LINE with parsed data summary |
| **6:00-7:00** | Set up Groq fallback | Get Groq API key, implement fallback: if Gemini fails or times out (20s), try Groq. | Switching `AI_PROVIDER=groq` env var works |
| **7:00-8:00** | End-to-end testing | Send 10 different Thai messages covering all scenarios (visit, quotation, closed deal, follow-up). Fix any parsing issues. | 8/10 messages parse correctly |

**Day 1 deliverable:** Send a Thai sales message in LINE → bot replies with structured confirmation in Thai.

---

### Day 2 (8 hours): Database + Dashboard + Sample Data

| Time | Task | Details | Done Criteria |
|------|------|---------|---------------|
| **0:00-1:00** | Create Google Sheets structure | Create spreadsheet "ATE Sales Demo" with columns: Timestamp, Rep Name, Customer, Product Brand, Product Model, Quantity, Deal Value (THB), Activity Type, Deal Stage, Follow-up Date, Notes, Raw Message | Spreadsheet created with headers and formatting |
| **1:00-2:00** | Integrate Sheets API into webhook | Use `gspread` + Service Account to append parsed data as new rows. Test end-to-end: LINE message → Sheets row. | New rows appear in Google Sheets within 3 seconds of sending LINE message |
| **2:00-2:30** | Pre-populate sample data | Enter 20 sample rows (see Section 8) covering the past 2 weeks. Mix of reps, customers, products, deal stages. | 20 realistic rows in the spreadsheet |
| **2:30-5:00** | Build Looker Studio dashboard | Connect to Google Sheets. Build 4 sections: (1) KPI scorecards, (2) Pipeline bar chart, (3) Brand revenue donut, (4) Activity feed table. Style with ATE-appropriate colors. | Dashboard looks professional, shows all sample data correctly |
| **5:00-5:30** | Configure data freshness | Set Looker Studio data source to refresh every 1 minute. Test: add a row to Sheets, verify it appears on dashboard within 1-2 minutes. | New data appears on dashboard within 2 minutes |
| **5:30-6:00** | Create public sharing link | Set Looker Studio dashboard to "Anyone with the link can view." Test in incognito browser. | Dashboard accessible without login |
| **6:00-7:00** | Full pipeline test | Send 3 LINE messages → verify bot replies → verify rows in Sheets → verify dashboard updates. Time the entire flow. | Complete flow works in under 90 seconds end-to-end |
| **7:00-8:00** | Error handling & edge cases | Test: empty message, image (not text), very long message, English-only message, message with no product mention. Add graceful handling for each. | No crashes; non-parseable messages get a polite "Could not understand" reply |

**Day 2 deliverable:** Full pipeline working. Dashboard with 20+ entries looks impressive. Live messages flow through within 90 seconds.

---

### Day 3 (4 hours build + 4 hours rehearsal)

| Time | Task | Details | Done Criteria |
|------|------|---------|---------------|
| **0:00-1:00** | Polish bot reply messages | Make Thai confirmation messages clean and professional. Add bullet points, emoji sparingly. Ensure the confirmation format matches what a sales manager expects. | Reply messages look professional and clear |
| **1:00-2:00** | Dashboard polish | Adjust chart colors, add "ATE Sales Dashboard" title, add date range filter, ensure mobile-responsive view works. Add a "How to read this dashboard" text block. | Dashboard looks presentation-ready |
| **2:00-3:00** | Prepare demo environment | Charge phone, open LINE group. Open dashboard on laptop in full-screen Chrome. Prepare the 3 scripted messages (typed out, ready to copy-paste into LINE). Set up fallback tools (Postman, direct Sheets access). | All demo materials ready |
| **3:00-3:30** | Rehearsal 1 | Run through full demo script (Section 6). Time it. Note any issues. | Identify issues |
| **3:30-4:00** | Fix issues from rehearsal 1 | Address any problems found. | Issues resolved |
| **4:00-4:30** | Rehearsal 2 | Run through again. Verify fixes. | Smooth run-through |
| **4:30-5:00** | Rehearsal 3 | Final run. Practice narration and transitions. | Demo runs in 6-8 minutes, smooth |
| **5:00-6:00** | Contingency rehearsal | Practice fallback scenarios: what if AI fails? What if dashboard does not refresh? What if LINE is slow? | Comfortable handling any failure |
| **6:00-8:00** | Buffer time | Fix any remaining issues. Rest before demo day. | Ready |

**Day 3 deliverable:** Demo-ready system. Presenter is rehearsed and confident. Fallback plans tested.

---

## 6. Demo Script

**Duration:** 7 minutes
**Setup:** Phone (LINE app open) + Laptop (Looker Studio dashboard in full-screen Chrome)
**Audience:** Sales Manager (primary), optionally Director

---

### Scene 1: The Problem [1 minute]

**[Laptop shows a blank or messy mockup — optional]**

> "Right now, our 11 sales reps report their activities in different ways — some send LINE messages, some use spreadsheets, some report verbally. There is no central view. You have to chase each person to know what is happening. Let me show you something that changes this."

---

### Scene 2: The Dashboard [1.5 minutes]

**[Switch laptop to Looker Studio dashboard — pre-loaded with 20 entries]**

> "This is a live sales dashboard. It shows the last two weeks of activity."

Point to each section:
- **KPI Cards:** "Total pipeline value: 3.2 million baht. 23 active deals. 47 customer visits this period. 35% conversion rate."
- **Pipeline Chart:** "You can see deals moving through stages — 12 leads, 8 in negotiation, 5 with quotations sent, 11 closed won."
- **Brand Breakdown:** "Megger is 45% of revenue, Fluke at 28%. You can see exactly which product lines are driving business."
- **Activity Table:** "Every interaction is logged — who visited which customer, what product was discussed, what is the deal value."

> "All of this data was captured automatically. Let me show you how."

---

### Scene 3: Live Demo — Sending Messages [2 minutes]

**[Pick up phone, show LINE group chat to the audience]**

> "This is a LINE group for sales reports. Reps type their updates naturally — in Thai, in English, however they want. Watch."

**Send Message 1:** Type (or paste) into the LINE group:
```
ไปเยี่ยม EGAT วันนี้ เสนอ Fluke 1587 FC ราคา 85,000 ลูกค้าสนใจมาก
```

> "I just reported a visit to EGAT, offering a Fluke 1587 FC at 85,000 baht."

**[Wait 3-5 seconds for bot reply. Show phone to audience.]**

> "The bot immediately confirms: it understood the customer is EGAT, the product is Fluke 1587 FC, the value is 85,000 baht, and it is a quotation. The rep does not need to fill any form."

**Send Message 2:**
```
ปิดดีล SCG สั่ง CRC 2-26 จำนวน 50 กระป๋อง มูลค่า 25,000 บาท
```

> "This is a closed deal — SCG ordered 50 cans of CRC 2-26 for 25,000 baht."

**[Show bot reply]**

**Send Message 3:**
```
Follow up PTT เรื่อง Megger MTO330 ลูกค้าขอ demo สัปดาห์หน้า
```

> "A follow-up — PTT wants a demo of the Megger MTO330 next week."

**[Show bot reply]**

---

### Scene 4: Dashboard Updates [1.5 minutes]

**[Turn to laptop]**

> "Now, the AI has parsed these messages and saved them to our database. Let me refresh the dashboard."

**[Click the refresh button on Looker Studio. If data does not appear, narrate: "It takes about a minute for the dashboard to update — the data is already in our database."]**

**[When data appears:]**

> "Here they are — the three messages we just sent. You can see EGAT, SCG, and PTT all logged with the correct products and values. The KPI numbers at the top have updated too."

> "This is what real-time visibility looks like. No chasing reps. No waiting for weekly reports. Every interaction is captured the moment it happens."

---

### Scene 5: Close [1 minute]

> "To summarize: the reps keep using LINE — no new app, no training, no forms. They type naturally in Thai or English. The AI handles the rest. You get this dashboard that updates throughout the day."

> "This is a working prototype built in three days. For a full rollout to all 11 reps, we would need about two more weeks to set up the production version. Want to try sending a message yourself?"

**[Hand the phone to the sales manager and let them send a message. This creates buy-in through participation.]**

---

## 7. Risk & Fallback Plan

### Risk Matrix

| # | Risk | Likelihood | Impact | Prevention | Fallback if It Happens |
|---|------|-----------|--------|------------|----------------------|
| R1 | Gemini API returns error during demo | Low | Critical | Test 10+ times on demo day morning; monitor quota | Switch to Groq by changing one env var; redeploy takes 30 seconds |
| R2 | Gemini misparses a demo message | Very Low | High | Use scripted messages tested dozens of times | Have 3 pre-prepared JSON rows; manually paste into Google Sheets ("Let me show you what the parsed data looks like") |
| R3 | LINE webhook fails to fire | Low | Critical | Test 30 min before demo; verify Vercel function is running | Use Postman on laptop to send a manual POST to the webhook endpoint; still triggers AI + Sheets + dashboard |
| R4 | Dashboard does not refresh / shows stale data | Medium | Medium | Set 1-min refresh; test timing beforehand | Open Google Sheets directly: "Here is the raw data — the dashboard updates every minute" |
| R5 | Vercel function cold start causes timeout | Low | Medium | Send a "warm-up" request 5 min before demo | The function stays warm for ~15 min after a request; the warm-up guarantees fast response |
| R6 | Google Sheets API quota exceeded | Very Low | High | We are far under quota limits | Use a backup spreadsheet with a different service account |
| R7 | Internet connectivity issues at demo location | Medium | Critical | Test WiFi beforehand; have phone hotspot ready | Use mobile hotspot; all services are cloud-based and low-bandwidth |
| R8 | Sales manager asks to test an edge case message | Medium | Low | Not a failure — show that the system handles gracefully | If it parses well: great. If not: "This is the kind of edge case we fine-tune during the full rollout" |
| R9 | LINE bot does not respond in group chat | Low | Critical | Test group chat permissions; ensure bot can read all messages | Have a backup 1-on-1 chat with the bot as alternative demo path |

### Pre-Demo Checklist (Day of Demo)

```
  2 HOURS BEFORE DEMO:
  [ ] Verify Vercel function is deployed and responding (curl the health endpoint)
  [ ] Send a test message in LINE group — verify bot replies
  [ ] Check Google Sheets — verify new row appeared
  [ ] Open Looker Studio dashboard — verify it loads and shows data
  [ ] Check Gemini API quota — confirm we have remaining requests
  [ ] Verify phone is charged (>80%)
  [ ] Verify laptop is charged (>80%)
  [ ] Test WiFi at demo location
  [ ] Open fallback tools: Postman, Google Sheets direct link, Groq API key ready

  30 MINUTES BEFORE DEMO:
  [ ] Send one "warm-up" message in LINE to warm the Vercel function
  [ ] Refresh dashboard to confirm it is working
  [ ] Open LINE group on phone — ready to type
  [ ] Open dashboard on laptop in full-screen Chrome
  [ ] Have the 3 scripted messages ready to copy-paste (in phone Notes app)
  [ ] Close all unnecessary apps on both devices
  [ ] Set phone to Do Not Disturb (except LINE notifications)
```

---

## 8. Pre-populated Sample Data

These 20 entries should be loaded into Google Sheets **before** the demo. They represent two weeks of realistic ATE sales activity with real product names, real Thai customer names, and realistic deal values.

> **Actual implementation note:** The final demo uses 31 sample rows (not 20 as planned here), with richer deal progression stories and batch ID grouping. See `demo/populate_sample_data.py`.

### Data Schema

| Column | Type | Description |
|--------|------|-------------|
| Timestamp | DateTime | When the report was received |
| Rep Name | Text | Sales rep name (Thai) |
| Customer | Text | Company name |
| Product Brand | Text | Megger / Fluke / CRC / Salisbury / SmartWasher / IK Sprayer |
| Product Model | Text | Specific model number |
| Quantity | Number | Units (1 if not specified) |
| Deal Value (THB) | Number | Value in Thai Baht |
| Activity Type | Text | Visit / Call / Quotation / Follow-up / Closed Deal / Demo |
| Deal Stage | Text | Lead / Negotiation / Quotation / Won / Lost |
| Follow-up Date | Date | Next action date (if applicable) |
| Notes | Text | Additional context |
| Raw Message | Text | Original Thai message (for audit) |

### 20 Sample Entries

| # | Timestamp | Rep Name | Customer | Brand | Model | Qty | Value (THB) | Activity | Stage | Follow-up | Notes |
|---|-----------|----------|----------|-------|-------|-----|-------------|----------|-------|-----------|-------|
| 1 | 2026-02-24 09:15 | สมชาย | PTT | Megger | MTO330 | 1 | 280,000 | Visit | Quotation | 2026-03-03 | ลูกค้าสนใจมาก ขอใบเสนอราคา |
| 2 | 2026-02-24 14:30 | วิภา | EGAT | Fluke | 1587 FC | 2 | 170,000 | Quotation | Quotation | 2026-03-01 | ส่งใบเสนอราคาแล้ว รอตอบกลับ |
| 3 | 2026-02-25 10:00 | ธนา | SCG | CRC | 2-26 | 100 | 50,000 | Closed Deal | Won | — | สั่งซื้อแล้ว จัดส่งสัปดาห์หน้า |
| 4 | 2026-02-25 11:30 | มานะ | IRPC | Megger | MIT525 | 1 | 450,000 | Visit | Lead | 2026-03-05 | เข้าพบแผนก maintenance |
| 5 | 2026-02-26 09:00 | สุดา | BCP (Bangchak) | Fluke | Ti480 PRO | 1 | 350,000 | Demo | Negotiation | 2026-03-02 | สาธิตให้ทีม QC ดู ลูกค้าประทับใจ |
| 6 | 2026-02-26 13:45 | สมชาย | Thai Oil | Salisbury | Gloves Class 2 | 20 | 120,000 | Quotation | Quotation | 2026-03-04 | ต้องการถุงมือป้องกันไฟฟ้าสำหรับทีมช่าง |
| 7 | 2026-02-27 08:30 | วิภา | EGAT | Megger | DLRO200 | 1 | 380,000 | Follow-up | Negotiation | 2026-03-06 | ลูกค้าขอส่วนลด 5% กำลังพิจารณา |
| 8 | 2026-02-27 15:00 | ธนา | Siam Cement | CRC | Lectra Clean | 200 | 80,000 | Closed Deal | Won | — | สั่งซื้อประจำ ส่งมอบปลายเดือน |
| 9 | 2026-02-28 10:15 | พิชัย | TOT/NT | Fluke | Networks Pro3000 | 3 | 135,000 | Visit | Lead | 2026-03-07 | ทีม IT สนใจเครื่องทดสอบสาย LAN |
| 10 | 2026-02-28 14:00 | สุดา | Gulf Energy | SmartWasher | SW-37 | 2 | 95,000 | Quotation | Quotation | 2026-03-05 | เครื่องล้างชิ้นส่วน ลูกค้าต้องการทดลองใช้ |
| 11 | 2026-03-03 09:30 | สมชาย | PTT | Megger | MTO330 | 1 | 280,000 | Follow-up | Negotiation | 2026-03-10 | ลูกค้ารออนุมัติงบ ยังสนใจอยู่ |
| 12 | 2026-03-03 11:00 | มานะ | IRPC | Fluke | 1775 | 1 | 220,000 | Call | Lead | 2026-03-08 | โทรสอบถามความต้องการเพิ่มเติม |
| 13 | 2026-03-04 10:00 | วิภา | EGAT | Fluke | 1587 FC | 2 | 160,000 | Closed Deal | Won | — | ปิดดีลสำเร็จ ลดราคาให้ 6% |
| 14 | 2026-03-04 14:30 | ธนา | Double A | IK Sprayer | IK Foam Pro 12 | 5 | 45,000 | Visit | Lead | 2026-03-11 | เข้าพบแผนกโรงงาน แนะนำสินค้า |
| 15 | 2026-03-05 09:00 | พิชัย | True Corp | Fluke | DSX-5000 | 1 | 890,000 | Demo | Negotiation | 2026-03-12 | สาธิตเครื่อง certification tester ลูกค้าขอเวลาพิจารณา |
| 16 | 2026-03-05 13:00 | สุดา | BCP (Bangchak) | Fluke | Ti480 PRO | 1 | 330,000 | Follow-up | Negotiation | 2026-03-09 | ลูกค้าขอส่วนลด 8% ส่งราคาใหม่แล้ว |
| 17 | 2026-03-06 08:45 | สมชาย | Thai Oil | Salisbury | Gloves Class 2 | 20 | 114,000 | Closed Deal | Won | — | ปิดดีลได้ ลดราคา 5% ตามที่ลูกค้าขอ |
| 18 | 2026-03-06 11:30 | มานะ | WHA Group | Megger | PAT420 | 2 | 190,000 | Visit | Quotation | 2026-03-13 | ลูกค้าต้องการเครื่องทดสอบเครื่องใช้ไฟฟ้า |
| 19 | 2026-03-07 10:00 | วิภา | Ratch Group | CRC | 5-56 | 500 | 125,000 | Closed Deal | Won | — | สั่งซื้อ CRC สำหรับโรงไฟฟ้า |
| 20 | 2026-03-07 15:30 | ธนา | SCG | SmartWasher | SW-28 | 1 | 75,000 | Quotation | Quotation | 2026-03-14 | ส่งใบเสนอราคาเพิ่มเติม ต่อยอดจากครั้งก่อน |

### Summary Statistics (what the dashboard should show)

```
  TOTALS FROM SAMPLE DATA:
  ────────────────────────────────────────────────
  Total Deal Value (pipeline):      ฿4,144,000
  Deals Won:                        5 deals = ฿529,000
  Deals in Negotiation:             4 deals = ฿1,150,000
  Deals in Quotation:               5 deals = ฿975,000
  Leads:                            4 deals = ฿1,290,000
  Demos:                            2 deals = ฿1,220,000

  BY BRAND:
  ────────────────────────────────────────────────
  Megger:       4 entries  ฿1,200,000  (29%)
  Fluke:        7 entries  ฿1,940,000  (47%)
  CRC:          3 entries  ฿255,000    (6%)
  Salisbury:    2 entries  ฿234,000    (6%)
  SmartWasher:  2 entries  ฿170,000    (4%)
  IK Sprayer:   1 entry    ฿45,000     (1%)

  BY REP:
  ────────────────────────────────────────────────
  สมชาย:  4 entries  ฿794,000
  วิภา:   4 entries  ฿835,000
  ธนา:    4 entries  ฿250,000
  มานะ:   3 entries  ฿860,000
  สุดา:   3 entries  ฿775,000
  พิชัย:  2 entries  ฿1,025,000

  BY CUSTOMER:
  ────────────────────────────────────────────────
  PTT:           2 entries  ฿560,000
  EGAT:          3 entries  ฿710,000
  SCG:           2 entries  ฿125,000
  IRPC:          2 entries  ฿670,000
  BCP:           2 entries  ฿680,000
  Thai Oil:      2 entries  ฿234,000
  Others:        7 entries  ฿1,165,000
```

---

## Appendix A: Gemini Prompt Template

```
You are a Thai-English bilingual sales data parser for ATE (Advanced Technology Equipment Co., Ltd.),
a B2B distributor of industrial equipment in Thailand.

Your job: Parse informal Thai/English sales messages into structured JSON.

ATE's product brands: Megger, Fluke, CRC, Salisbury, SmartWasher, IK Sprayer

Common customers: PTT, EGAT, SCG, IRPC, BCP (Bangchak), Thai Oil, Gulf Energy, Ratch Group,
WHA Group, True Corp, TOT/NT, Double A, Siam Cement

Activity types: Visit, Call, Quotation, Follow-up, Closed Deal, Demo
Deal stages: Lead, Negotiation, Quotation, Won, Lost

Output ONLY valid JSON with this schema:
{
  "rep_name": "string (from sender if available, else 'Unknown')",
  "customer": "string",
  "product_brand": "string (one of the brands above)",
  "product_model": "string",
  "quantity": number,
  "deal_value_thb": number,
  "activity_type": "string (one of the types above)",
  "deal_stage": "string (one of the stages above)",
  "follow_up_date": "string (YYYY-MM-DD or null)",
  "notes": "string (brief summary in Thai)"
}

EXAMPLES:

Input: "ไปเยี่ยม PTT วันนี้ เสนอ Megger MTO330 ราคา 150,000 ลูกค้าสนใจมาก นัด follow up อาทิตย์หน้า"
Output: {"rep_name":"Unknown","customer":"PTT","product_brand":"Megger","product_model":"MTO330","quantity":1,"deal_value_thb":150000,"activity_type":"Visit","deal_stage":"Quotation","follow_up_date":"<next week date>","notes":"ลูกค้าสนใจมาก นัด follow up อาทิตย์หน้า"}

Input: "ปิดดีล SCG สั่ง CRC 2-26 จำนวน 50 กระป๋อง มูลค่า 25,000"
Output: {"rep_name":"Unknown","customer":"SCG","product_brand":"CRC","product_model":"2-26","quantity":50,"deal_value_thb":25000,"activity_type":"Closed Deal","deal_stage":"Won","follow_up_date":null,"notes":"สั่งซื้อ 50 กระป๋อง"}

Input: "โทร IRPC สอบถาม Megger MIT525 งบ 450K ลูกค้ายังไม่ตัดสินใจ"
Output: {"rep_name":"Unknown","customer":"IRPC","product_brand":"Megger","product_model":"MIT525","quantity":1,"deal_value_thb":450000,"activity_type":"Call","deal_stage":"Lead","follow_up_date":null,"notes":"ลูกค้ายังไม่ตัดสินใจ"}

Input: "Follow up EGAT เรื่อง Fluke 1587 ลูกค้าขอส่วนลด 5%"
Output: {"rep_name":"Unknown","customer":"EGAT","product_brand":"Fluke","product_model":"1587 FC","quantity":1,"deal_value_thb":0,"activity_type":"Follow-up","deal_stage":"Negotiation","follow_up_date":null,"notes":"ลูกค้าขอส่วนลด 5%"}

Input: "สาธิต Fluke Ti480 PRO ที่ BCP ทีม QC ประทับใจ ราคา 350,000"
Output: {"rep_name":"Unknown","customer":"BCP","product_brand":"Fluke","product_model":"Ti480 PRO","quantity":1,"deal_value_thb":350000,"activity_type":"Demo","deal_stage":"Negotiation","follow_up_date":null,"notes":"ทีม QC ประทับใจ"}

Input: "เข้าพบ WHA Group เสนอ Megger PAT420 2 เครื่อง ราคา 190,000 ส่งใบเสนอราคาแล้ว"
Output: {"rep_name":"Unknown","customer":"WHA Group","product_brand":"Megger","product_model":"PAT420","quantity":2,"deal_value_thb":190000,"activity_type":"Visit","deal_stage":"Quotation","follow_up_date":null,"notes":"ส่งใบเสนอราคาแล้ว"}

Now parse this message:
```

---

## Appendix B: LINE Bot Reply Message Template (Thai)

```
Successful parse:
────────────────
รับทราบครับ บันทึกแล้ว ✅
• ลูกค้า: {customer}
• สินค้า: {product_brand} {product_model}
• จำนวน: {quantity}
• มูลค่า: ฿{deal_value_thb:,}
• กิจกรรม: {activity_type}
• สถานะ: {deal_stage}
{• นัด follow up: {follow_up_date} — if not null}

Failed parse:
────────────────
ขอโทษครับ ไม่สามารถอ่านข้อความได้ 🔄
กรุณาส่งใหม่ในรูปแบบ:
"เข้าพบ [ลูกค้า] เสนอ [สินค้า] ราคา [จำนวนเงิน]"

Non-text message (image/sticker):
────────────────
ขอบคุณครับ ขณะนี้ระบบรองรับเฉพาะข้อความตัวอักษร 📝
กรุณาพิมพ์รายงานเป็นข้อความครับ
```

---

## Appendix C: Key API Endpoints & Credentials Checklist

```
  CREDENTIALS NEEDED (store as Vercel environment variables):
  ──────────────────────────────────────────────────────────
  [ ] LINE_CHANNEL_SECRET          — from LINE Developers Console
  [ ] LINE_CHANNEL_ACCESS_TOKEN    — from LINE Developers Console
  [ ] GEMINI_API_KEY               — from Google AI Studio
  [ ] GROQ_API_KEY                 — from console.groq.com (fallback)
  [ ] GOOGLE_SHEETS_CREDENTIALS    — Service Account JSON (base64 encoded)
  [ ] GOOGLE_SHEETS_SPREADSHEET_ID — from the Google Sheets URL
  [ ] AI_PROVIDER                  — "gemini" (default) or "groq" (fallback)

  API ENDPOINTS:
  ──────────────────────────────────────────────────────────
  LINE Webhook:          POST https://your-app.vercel.app/api/webhook
  LINE Reply API:        POST https://api.line.me/v2/bot/message/reply
  Gemini API:            POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent
  Groq API:              POST https://api.groq.com/openai/v1/chat/completions
  Google Sheets API:     https://sheets.googleapis.com/v4/spreadsheets/{id}/values/{range}:append
  Looker Studio:         https://lookerstudio.google.com/reporting/{dashboard_id}
```

---

*This document is the tactical build plan for the ATE Sales Report System free demo. It complements the strategic proposal in `ATE_Sales_Report_System_Proposal.md`.*
