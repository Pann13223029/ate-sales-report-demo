# Claude API Prompt Design — ATE Sales Report Extraction

> **System:** ATE Sales Report LINE Bot
> **Purpose:** Parse unstructured Thai/English LINE messages from field sales reps into structured JSON
> **AI Model:** Claude (Haiku for Tier 1/2, Sonnet for Tier 3)
> **Date:** 2026-03-10

---

## Visual Overview — Parsing Pipeline at a Glance

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                          ATE SALES REPORT — END-TO-END MESSAGE FLOW                             │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘

  ┌──────────┐     ┌──────────────┐     ┌───────────┐     ┌────────────┐     ┌──────────────────┐
  │  Sales    │     │   LINE       │     │  n8n /    │     │  Claude    │     │  Structured      │
  │  Rep      │────→│   Message    │────→│  OpenClaw │────→│  API       │────→│  JSON Output     │
  │  (Field)  │     │  (Thai/Eng)  │     │  Webhook  │     │  (Haiku/   │     │  + Confirmation  │
  └──────────┘     └──────────────┘     └───────────┘     │   Sonnet)  │     └────────┬─────────┘
                                                           └────────────┘              │
                                                                                       ▼
                          ┌──────────────────────────────────────────────────────────────┐
                          │                      DOWNSTREAM ROUTING                      │
                          ├────────────────┬─────────────────────┬───────────────────────┤
                          │  is_sales_report │  is_sales_report   │   is_sales_report    │
                          │  = true          │  = true            │   = false             │
                          │  confidence ≥0.8 │  confidence 0.5-0.79│                      │
                          ├────────────────┼─────────────────────┼───────────────────────┤
                          │  Auto-save to  │  Save + flag for   │   Ignore / log for   │
                          │  DB + send     │  human review      │   analytics          │
                          │  confirmation  │                     │                       │
                          └────────────────┴─────────────────────┴───────────────────────┘
```

### Parsing Pipeline Steps

```
  ┌─────────────┐    ┌──────────────────┐    ┌────────────────┐    ┌──────────┐    ┌──────────────┐
  │  1. LINE     │    │  2. Classify      │    │  3. Extract     │    │  4. JSON  │    │  5. Confirm   │
  │  Message     │───→│  is_sales_report? │───→│  Fields from    │───→│  Output   │───→│  Message to   │
  │  Received    │    │  (yes/no)         │    │  Message Text   │    │  Schema   │    │  Rep (Thai)   │
  └─────────────┘    └──────────────────┘    └────────────────┘    └──────────┘    └──────────────┘
                              │
                              │ NO
                              ▼
                     ┌──────────────────┐
                     │  Return:          │
                     │  is_sales_report  │
                     │  = false          │
                     │  activities = []  │
                     └──────────────────┘
```

### "is_sales_report" Classification Decision Tree

```
                           ┌──────────────────────┐
                           │  Incoming LINE Message │
                           └──────────┬───────────┘
                                      │
                                      ▼
                           ┌──────────────────────┐
                           │  Does message mention  │
                           │  customers, products,  │
                           │  deals, visits, calls, │
                           │  quotations, payments? │
                           └──────────┬───────────┘
                                      │
                          ┌───────────┴───────────┐
                          │                       │
                         YES                      NO
                          │                       │
                          ▼                       ▼
                 ┌────────────────┐     ┌─────────────────────┐
                 │ SALES-RELATED  │     │ Does message mention │
                 │ Examples:      │     │ office work, quotation│
                 │ • Customer     │     │ prep, training,      │
                 │   visits       │     │ internal meetings?   │
                 │ • Phone calls  │     └──────────┬──────────┘
                 │ • Quotations   │                │
                 │ • Deal updates │       ┌────────┴────────┐
                 │ • Follow-ups   │       │                 │
                 │ • PO / payment │      YES                NO
                 │ • Inquiries    │       │                 │
                 └───────┬────────┘       ▼                 ▼
                         │       ┌──────────────┐  ┌──────────────────┐
                         │       │ SALES-RELATED │  │ NOT SALES-RELATED│
                         │       │ activity_type │  │ (casual chat,    │
                         ▼       │ = "other"     │  │  lunch plans,    │
                 ┌──────────────┐└──────────────┘  │  jokes, weather) │
                 │is_sales_report│                  └────────┬─────────┘
                 │= true         │                           │
                 │Extract fields │                           ▼
                 └──────────────┘                  ┌──────────────────┐
                                                   │ is_sales_report   │
                                                   │ = false            │
                                                   │ activities = []    │
                                                   └──────────────────┘
```

### Activity Type Classification Tree

```
                              ┌─────────────────────┐
                              │    Activity Type     │
                              │    Classification    │
                              └─────────┬───────────┘
                                        │
           ┌──────────┬────────┬────────┼────────┬──────────┬──────────┐
           │          │        │        │        │          │          │
           ▼          ▼        ▼        ▼        ▼          ▼          ▼
      ┌─────────┐┌────────┐┌────────┐┌────────┐┌─────────┐┌─────────┐┌───────┐
      │  visit   ││  call  ││quotation││follow_ ││closed_  ││closed_  ││ other │
      │         ││        ││        ││  up    ││  won    ││  lost   ││       │
      └────┬────┘└───┬────┘└───┬────┘└───┬────┘└────┬────┘└────┬────┘└──┬────┘
           │         │         │         │          │          │        │
           ▼         ▼         ▼         ▼          ▼          ▼        ▼
      ┌─────────┐┌────────┐┌────────┐┌────────┐┌─────────┐┌─────────┐┌───────┐
      │ไปเยี่ยม ││โทร     ││เสนอราคา││follow  ││ปิดดีล   ││เสียงาน  ││Office │
      │ไปพบ     ││โทรหา   ││ส่งใบ   ││up      ││ปิดการขาย││ไม่ได้   ││work,  │
      │เข้าพบ   ││โทรมา   ││เสนอราคา││ติดตาม  ││ได้งาน   ││lost     ││admin, │
      │ไปหา     ││ลูกค้า  ││ทำ QT   ││ตาม     ││PO เข้า  ││แพ้      ││mtgs,  │
      │ไป site  ││ โทร    ││quote   ││เช็ค    ││สั่งซื้อ  ││เลือก    ││train- │
      │visit    ││call    ││        ││สถานะ   ││closed   ││เจ้าอื่น ││ing    │
      └─────────┘└────────┘└────────┘└────────┘└─────────┘└─────────┘└───────┘
```

### Sales Stage Pipeline

```
      ┌────────┐     ┌─────────────┐     ┌───────────────┐     ┌────────────┐
      │  lead  │────→│ negotiation │────→│quotation_sent │────→│ closed_won │
      └────────┘     └─────────────┘     └───────────────┘     └────────────┘
           │               │                    │                     │
           │  First        │  Discussing        │  Quotation sent,   │  PO received,
           │  contact,     │  terms, pricing,   │  waiting for       │  customer
           │  customer     │  specs with        │  customer          │  confirmed
           │  inquiry      │  customer          │  response          │  purchase
           │               │                    │                    │
           │               │                    │               ┌────────────┐
           │               │                    └──────────────→│closed_lost │
           │               │                                    └────────────┘
           │               │                                         │
           │               └───────────────────────────────────────→ │  Deal lost
           └───────────────────────────────────────────────────────→ │  or cancelled
                                                                     │

    ═══════════════════════════════════════════════════════════════════════════
     TYPICAL FLOW:
     lead ──→ negotiation ──→ quotation_sent ──→ closed_won  (happy path)
                                               └──→ closed_lost (deal lost)
    ═══════════════════════════════════════════════════════════════════════════
```

### Confidence Score Routing Logic

```
    ┌──────────────────────────────────────────────────────────────────────────┐
    │                     CONFIDENCE SCORE ROUTING                             │
    └──────────────────────────────────────────────────────────────────────────┘

    confidence_score
    │
    │  1.0 ┤  ██████████████████████████████████
    │      │  █  HIGH CONFIDENCE (0.8 - 1.0)  █───→  AUTO-SAVE to database
    │  0.9 ┤  █  All key fields clearly stated █     + Send confirmation to rep
    │      │  █  Minor inference at most       █     + No human review needed
    │  0.8 ┤  ██████████████████████████████████
    │      │─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─
    │      │  ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒
    │  0.7 ┤  ▒ MEDIUM CONFIDENCE (0.5 - 0.79)▒───→  SAVE to database
    │      │  ▒ Some inference needed          ▒     + FLAG for human review
    │  0.6 ┤  ▒ Some fields ambiguous          ▒     + Send confirmation to rep
    │      │  ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒
    │  0.5 ┤─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─
    │      │  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
    │  0.4 ┤  ░  LOW CONFIDENCE (0.0 - 0.49)  ░───→  DO NOT SAVE yet
    │      │  ░  Very ambiguous, many guesses  ░     + ASK rep for clarification
    │  0.3 ┤  ░  Almost no useful data         ░     + Re-parse after rep replies
    │      │  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
    │  0.0 ┤
    └──────┘
```

### Model Selection & Cost Comparison

```
    ┌──────────────────────────────────────────────────────────────────────────────────┐
    │                       MODEL COST COMPARISON (per message)                        │
    │                 ~200 input tokens, ~500 output tokens per call                   │
    ├──────────────────────────────────────────────────────────────────────────────────┤
    │                                                                                  │
    │  HAIKU (claude-haiku-4-20250414)         SONNET (claude-sonnet-4-20250514)       │
    │  ┌──────────────────────────┐            ┌──────────────────────────┐            │
    │  │  Input:   $0.80 / MTok  │            │  Input:   $3.00 / MTok  │            │
    │  │  Output:  $4.00 / MTok  │            │  Output:  $15.00 / MTok │            │
    │  │                          │            │                          │            │
    │  │  Speed:   ★★★★★ Fast    │            │  Speed:   ★★★☆☆ Medium  │            │
    │  │  Quality: ★★★☆☆ Good    │            │  Quality: ★★★★★ Best    │            │
    │  │  Cost:    ★★★★★ Cheap   │            │  Cost:    ★★★☆☆ Moderate│            │
    │  └──────────────────────────┘            └──────────────────────────┘            │
    │                                                                                  │
    │         55 msgs/day                            55 msgs/day                       │
    │  ┌──────────────────────┐              ┌──────────────────────┐                  │
    │  │  Daily:   ~$0.12     │              │  Daily:   ~$0.45     │                  │
    │  │  Monthly: ~$3.60     │              │  Monthly: ~$13.50    │                  │
    │  │  Yearly:  ~$43.20    │              │  Yearly:  ~$162.00   │                  │
    │  └──────────────────────┘              └──────────────────────┘                  │
    │                                                                                  │
    │  RECOMMENDATION:                                                                 │
    │  ┌──────────┐  ┌──────────────────────────────────────────────────┐              │
    │  │  Tier 1  │──│  Haiku only (cheapest, fast, good enough)       │              │
    │  ├──────────┤  ├──────────────────────────────────────────────────┤              │
    │  │  Tier 2  │──│  Haiku default + Sonnet fallback (low conf.)    │              │
    │  ├──────────┤  ├──────────────────────────────────────────────────┤              │
    │  │  Tier 3  │──│  Sonnet always (best accuracy, worth the cost)  │              │
    │  └──────────┘  └──────────────────────────────────────────────────┘              │
    └──────────────────────────────────────────────────────────────────────────────────┘
```

### Full Message Flow (Detail)

```
    ┌──────────┐         ┌──────────┐         ┌───────────────────┐
    │  Sales   │  LINE   │  LINE    │ Webhook │  n8n / OpenClaw   │
    │  Rep     │────────→│  Server  │────────→│  Automation       │
    │  (phone) │ message │          │  POST   │  Platform         │
    └──────────┘         └──────────┘         └────────┬──────────┘
                                                       │
                                              Prepares API call:
                                              • system: [system prompt]
                                              • user: [raw message]
                                              • model: haiku/sonnet
                                              • max_tokens: 2048
                                              • temperature: 0
                                                       │
                                                       ▼
                                              ┌───────────────────┐
                                              │  Claude API        │
                                              │  (Anthropic)       │
                                              │                    │
                                              │  1. Classify msg   │
                                              │  2. Extract fields │
                                              │  3. Score confid.  │
                                              │  4. Generate JSON  │
                                              │  5. Write confirm  │
                                              └────────┬──────────┘
                                                       │
                                                  JSON response
                                                       │
                                                       ▼
                                              ┌───────────────────┐
                                              │  n8n Parse & Route │
                                              └────────┬──────────┘
                                                       │
                              ┌─────────────────┬──────┴──────┬────────────────┐
                              │                 │             │                │
                              ▼                 ▼             ▼                ▼
                    ┌──────────────┐   ┌──────────────┐ ┌──────────┐  ┌──────────────┐
                    │ is_sales=true│   │ is_sales=true│ │is_sales  │  │  Error /     │
                    │ conf >= 0.8  │   │ conf 0.5-0.79│ │= false   │  │  Malformed   │
                    └──────┬───────┘   └──────┬───────┘ └────┬─────┘  └──────┬───────┘
                           │                  │              │               │
                           ▼                  ▼              ▼               ▼
                    ┌──────────────┐   ┌──────────────┐ ┌──────────┐  ┌──────────────┐
                    │ Save to DB   │   │ Save to DB   │ │ Ignore / │  │ Retry once,  │
                    │ (auto)       │   │ + Flag for   │ │ Log for  │  │ then log     │
                    │              │   │ review       │ │ analytics│  │ error        │
                    └──────┬───────┘   └──────┬───────┘ └──────────┘  └──────────────┘
                           │                  │
                           ▼                  ▼
                    ┌─────────────────────────────┐
                    │ Send confirmation_message_th │
                    │ back to rep via LINE          │
                    └─────────────────────────────┘
```

### Thai Currency Parsing Quick Reference

```
    ┌──────────────────────────────────────────────────────────────────┐
    │              THAI CURRENCY PARSING PATTERNS                      │
    ├──────────────────────────┬───────────────────────────────────────┤
    │  Input Pattern           │  Extracted Value (THB)               │
    ├──────────────────────────┼───────────────────────────────────────┤
    │  "150,000"               │  150000                              │
    │  "150000"                │  150000                              │
    │  "150K" / "150k"         │  150000                              │
    │  "1.5 ล้าน" / "1.5M"    │  1500000                             │
    │  "450,000 บาท"           │  450000                              │
    │  "แสนห้า"                │  150000                              │
    │  "สองแสน"                │  200000                              │
    │  "รวม VAT" / "ไม่รวม VAT"│  Note in follow_up_notes            │
    └──────────────────────────┴───────────────────────────────────────┘
```

### Brand Portfolio at a Glance

```
    ┌──────────────────────────────────────────────────────────────────────────────┐
    │                    ATE BRAND PORTFOLIO — Quick Reference                     │
    ├────────────────┬────────────────────────────────────────────────────────────┤
    │  Megger        │  Electrical testing (insulation testers, cable fault       │
    │                │  locators, transformer testers)                             │
    ├────────────────┼────────────────────────────────────────────────────────────┤
    │  Fluke         │  Electronic test tools (multimeters, thermal imagers,     │
    │                │  power quality analyzers)                                   │
    ├────────────────┼────────────────────────────────────────────────────────────┤
    │  CRC           │  Industrial chemicals (contact cleaners, lubricants,      │
    │                │  degreasers, corrosion inhibitors)                          │
    ├────────────────┼────────────────────────────────────────────────────────────┤
    │  Salisbury     │  Electrical safety (insulating gloves, arc flash          │
    │                │  protection, hot sticks, voltage detectors)                │
    ├────────────────┼────────────────────────────────────────────────────────────┤
    │  SmartWasher   │  Parts washing systems (bioremediating washers,           │
    │                │  OzzyJuice solutions)                                       │
    ├────────────────┼────────────────────────────────────────────────────────────┤
    │  IK Sprayer    │  Industrial sprayers (pressure, foam,                     │
    │                │  acid-resistant sprayers)                                   │
    └────────────────┴────────────────────────────────────────────────────────────┘
```

---

## Table of Contents

1. [System Prompt](#1-system-prompt)
2. [Output JSON Schema](#2-output-json-schema)
3. [Example Input/Output Pairs](#3-example-inputoutput-pairs)
4. [Confirmation Message Prompt](#4-confirmation-message-prompt)
5. [Prompt Design Decisions](#5-prompt-design-decisions)
6. [Integration Notes](#6-integration-notes)

---

## 1. System Prompt

This is the system prompt sent with every Claude API call. The user message will contain the raw LINE message text from a sales rep.

```
You are a sales report data extraction assistant for ATE (Advanced Technology Equipment Co., Ltd.), a Thai B2B distributor of industrial equipment.

ATE distributes the following brands:
- Megger — electrical testing equipment (insulation testers, cable fault locators, transformer testers, etc.)
- Fluke — electronic test tools, digital multimeters, thermal imagers, power quality analyzers
- CRC — industrial chemicals (contact cleaners, lubricants, degreasers, corrosion inhibitors)
- Salisbury — electrical safety equipment (insulating gloves, arc flash protection, hot sticks, voltage detectors)
- SmartWasher — parts washing systems (bioremediating parts washers, OzzyJuice solutions)
- IK Sprayer — industrial sprayers (pressure sprayers, foam sprayers, acid-resistant sprayers)

Your job is to analyze a LINE message from a field sales representative and extract structured sales activity data.

IMPORTANT RULES:

1. LANGUAGE: Messages will be in Thai, English, or a mix of both (code-switching). Thai sales reps commonly write brand names, model numbers, and company abbreviations in English within Thai sentences. Parse regardless of language.

2. CLASSIFICATION: First determine if the message is a sales-related report. Sales-related includes: customer visits, phone calls with customers, quotations, deal updates, follow-ups, order confirmations, payment updates, daily activity summaries, product inquiries from customers. If the message is NOT sales-related (casual chat, personal messages, jokes, lunch plans, complaints about weather, etc.), return `is_sales_report: false` with a null data object.

3. EXTRACTION: Extract all fields you can confidently identify from the message. Leave fields as null if the information is not present or cannot be reasonably inferred. NEVER fabricate data — if you are unsure, leave the field null and lower the confidence_score.

4. MULTIPLE ACTIVITIES: If a single message describes multiple distinct sales activities (e.g., "visited Customer A and then called Customer B"), extract each as a separate entry in the `activities` array.

5. DEAL VALUES: Parse Thai currency expressions flexibly:
   - "150,000" or "150000" → 150000
   - "150K" or "150k" → 150000
   - "1.5 ล้าน" or "1.5M" → 1500000
   - "450,000 บาท" → 450000
   - "แสนห้า" → 150000
   - "สองแสน" → 200000
   - If the value includes VAT notation (e.g., "รวม VAT", "ไม่รวม VAT"), capture it in follow_up_notes

6. ACTIVITY TYPE CLASSIFICATION:
   - visit: Rep physically went to customer site ("ไปเยี่ยม", "ไปพบ", "เข้าพบ", "ไปหา", "ไป site", "visit")
   - call: Phone/video call with customer ("โทร", "โทรหา", "โทรมา", "ลูกค้าโทร", "call", "conference call")
   - quotation: Preparing or sending a quotation ("เสนอราคา", "ส่งใบเสนอราคา", "ทำ quotation", "ทำ QT", "quote")
   - follow_up: Following up on previous activity ("follow up", "ติดตาม", "ตาม", "เช็คสถานะ")
   - closed_won: Deal successfully closed ("ปิดดีล", "ปิดการขาย", "ได้งาน", "PO เข้า", "สั่งซื้อแล้ว", "closed", "won")
   - closed_lost: Deal lost ("เสียงาน", "ไม่ได้", "lost", "แพ้", "ลูกค้าเลือกเจ้าอื่น", "cancel")
   - other: Office work, internal meetings, admin tasks, training, or anything that does not fit the above categories

7. SALES STAGE INFERENCE: Infer the sales stage from context:
   - lead: First contact, customer expressed interest, initial inquiry
   - negotiation: Discussing terms, pricing, specs with customer
   - quotation_sent: Quotation has been sent/submitted, waiting for response
   - closed_won: Customer confirmed purchase, PO received
   - closed_lost: Deal lost or cancelled

8. CUSTOMER NAME NORMALIZATION: Thai companies are often referenced by abbreviations or informal names. Keep the name as written by the rep but clean obvious abbreviations:
   - "PTT" → "PTT" (keep as-is, well-known abbreviation)
   - "กฟผ" or "กฟผ." → "กฟผ. (EGAT)" (add English abbreviation if recognizable)
   - "SCG" → "SCG"
   - "ปตท" → "ปตท. (PTT)"
   - If the company name is ambiguous, keep the original text

9. CONFIDENCE SCORING: Set confidence_score based on:
   - 0.9–1.0: All key fields clearly stated in the message
   - 0.7–0.89: Most fields clear, minor inference needed
   - 0.5–0.69: Significant inference required, some fields ambiguous
   - 0.3–0.49: Very ambiguous message, many fields had to be guessed
   - 0.0–0.29: Almost no useful sales data could be extracted

10. DAILY SUMMARY: Always generate a brief English-language summary of the activity for dashboard display. Keep it under 100 characters.

Return your response as a single JSON object matching the schema below. Do not include any text outside the JSON.
```

---

## 2. Output JSON Schema

```json
{
  "is_sales_report": true,
  "rep_message_language": "th|en|mixed",
  "activities": [
    {
      "customer_name": "string | null",
      "contact_person": "string | null",
      "product_brand": "string | null — one of: Megger, Fluke, CRC, Salisbury, SmartWasher, IK Sprayer, Other, null",
      "product_name": "string | null — model number or product description",
      "quantity": "number | null",
      "deal_value_thb": "number | null — numeric value in Thai Baht",
      "activity_type": "visit | call | quotation | follow_up | closed_won | closed_lost | other",
      "sales_stage": "lead | negotiation | quotation_sent | closed_won | closed_lost | null",
      "payment_status": "pending | partial | paid | null",
      "follow_up_date": "string | null — ISO 8601 date format YYYY-MM-DD",
      "follow_up_notes": "string | null",
      "daily_summary": "string — brief English summary, under 100 characters",
      "confidence_score": "number — 0.0 to 1.0"
    }
  ],
  "confirmation_message_th": "string — Thai confirmation message to send back to rep via LINE"
}
```

**JSON Schema Visual Map:**

```
    ┌──────────────────────────────────────────────────────────────┐
    │  Root Object                                                 │
    ├──────────────────────────────────────────────────────────────┤
    │  is_sales_report ─────── boolean (true / false)             │
    │  rep_message_language ── "th" | "en" | "mixed"              │
    │  confirmation_message_th  string (Thai)                     │
    │                                                              │
    │  activities [ ] ─────────────────────────────────────┐      │
    │    ┌─────────────────────────────────────────────────┐│      │
    │    │  Activity Object                                ││      │
    │    ├─────────────────────────────────────────────────┤│      │
    │    │  customer_name ─────── string | null            ││      │
    │    │  contact_person ────── string | null            ││      │
    │    │  product_brand ─────── enum | null              ││      │
    │    │  product_name ──────── string | null            ││      │
    │    │  quantity ──────────── number | null            ││      │
    │    │  deal_value_thb ────── number | null            ││      │
    │    │  activity_type ─────── enum (7 values)          ││      │
    │    │  sales_stage ───────── enum (5 values) | null   ││      │
    │    │  payment_status ────── enum (3 values) | null   ││      │
    │    │  follow_up_date ────── ISO date | null          ││      │
    │    │  follow_up_notes ───── string | null            ││      │
    │    │  daily_summary ─────── string (English, <100ch) ││      │
    │    │  confidence_score ──── 0.0 to 1.0               ││      │
    │    └─────────────────────────────────────────────────┘│      │
    │    (repeats for each activity in message)              │      │
    └──────────────────────────────────────────────────────────────┘
```

When `is_sales_report` is `false`:

```json
{
  "is_sales_report": false,
  "activities": [],
  "confirmation_message_th": null
}
```

---

## 3. Example Input/Output Pairs

### Example 1 — Customer Visit with Quotation (Thai)

**Input:**
```
ไปเยี่ยม PTT วันนี้ เสนอ Megger MTO330 ราคา 150,000
```

**Output:**
```json
{
  "is_sales_report": true,
  "rep_message_language": "mixed",
  "activities": [
    {
      "customer_name": "PTT",
      "contact_person": null,
      "product_brand": "Megger",
      "product_name": "MTO330",
      "quantity": null,
      "deal_value_thb": 150000,
      "activity_type": "visit",
      "sales_stage": "quotation_sent",
      "payment_status": null,
      "follow_up_date": null,
      "follow_up_notes": null,
      "daily_summary": "Visited PTT, quoted Megger MTO330 at 150K THB",
      "confidence_score": 0.9
    }
  ],
  "confirmation_message_th": "รับทราบครับ บันทึกแล้ว:\n- เข้าพบลูกค้า: PTT\n- สินค้า: Megger MTO330\n- มูลค่า: ฿150,000\n- สถานะ: เสนอราคาแล้ว"
}
```

### Example 2 — Inbound Customer Call with Quantity (Thai + English)

**Input:**
```
ลูกค้า SCG โทรมา สนใจ CRC contact cleaner 20 กระป๋อง
```

**Output:**
```json
{
  "is_sales_report": true,
  "rep_message_language": "mixed",
  "activities": [
    {
      "customer_name": "SCG",
      "contact_person": null,
      "product_brand": "CRC",
      "product_name": "Contact Cleaner",
      "quantity": 20,
      "deal_value_thb": null,
      "activity_type": "call",
      "sales_stage": "lead",
      "payment_status": null,
      "follow_up_date": null,
      "follow_up_notes": "Customer called in expressing interest; 20 cans requested",
      "daily_summary": "SCG called, interested in CRC Contact Cleaner x20",
      "confidence_score": 0.85
    }
  ],
  "confirmation_message_th": "รับทราบครับ บันทึกแล้ว:\n- ลูกค้าโทรเข้ามา: SCG\n- สินค้า: CRC Contact Cleaner\n- จำนวน: 20 กระป๋อง\n- สถานะ: ลูกค้าสนใจ (Lead)"
}
```

### Example 3 — Closed Deal with Partial Payment (Thai + English + Slang)

**Input:**
```
ปิดดีล Fluke 1770 กับ EGAT แล้ว 450K จ่ายแล้ว 50%
```

**Output:**
```json
{
  "is_sales_report": true,
  "rep_message_language": "mixed",
  "activities": [
    {
      "customer_name": "EGAT",
      "contact_person": null,
      "product_brand": "Fluke",
      "product_name": "1770",
      "quantity": null,
      "deal_value_thb": 450000,
      "activity_type": "closed_won",
      "sales_stage": "closed_won",
      "payment_status": "partial",
      "follow_up_date": null,
      "follow_up_notes": "Customer paid 50% (225,000 THB); remaining 50% pending",
      "daily_summary": "Closed Fluke 1770 deal with EGAT, 450K THB, 50% paid",
      "confidence_score": 0.95
    }
  ],
  "confirmation_message_th": "รับทราบครับ บันทึกแล้ว:\n- ปิดการขายสำเร็จ: EGAT\n- สินค้า: Fluke 1770\n- มูลค่า: ฿450,000\n- ชำระแล้ว: 50% (฿225,000)\n- สถานะ: ปิดดีลสำเร็จ\n\nยินดีด้วยครับ! 🎉"
}
```

### Example 4 — Office Day / No Customer Activity (Thai)

**Input:**
```
วันนี้ไม่ได้ออกไปพบลูกค้า ทำ quotation อยู่ office
```

**Output:**
```json
{
  "is_sales_report": true,
  "rep_message_language": "mixed",
  "activities": [
    {
      "customer_name": null,
      "contact_person": null,
      "product_brand": null,
      "product_name": null,
      "quantity": null,
      "deal_value_thb": null,
      "activity_type": "other",
      "sales_stage": null,
      "payment_status": null,
      "follow_up_date": null,
      "follow_up_notes": "Office day — preparing quotations, no customer visits",
      "daily_summary": "Office day, preparing quotations",
      "confidence_score": 0.8
    }
  ],
  "confirmation_message_th": "รับทราบครับ บันทึกแล้ว:\n- วันนี้: ทำ quotation อยู่ office\n\nถ้าเสร็จแล้วอย่าลืมอัพเดทชื่อลูกค้าและสินค้าด้วยนะครับ"
}
```

### Example 5 — Multiple Activities in One Message (Common Pattern)

**Input:**
```
วันนี้ไปเยี่ยม 2 ที่
1. IRPC เจอคุณสมชาย เสนอ Megger MIT525 ราคา 280,000 สนใจมาก นัดส่ง quotation อาทิตย์หน้า
2. Thai Oil เจอคุณวิภา follow up เรื่อง CRC น้ำยาทำความสะอาด 50 แกลลอน ราคา 85,000 ลูกค้ารออนุมัติงบ
```

**Output:**
```json
{
  "is_sales_report": true,
  "rep_message_language": "mixed",
  "activities": [
    {
      "customer_name": "IRPC",
      "contact_person": "คุณสมชาย",
      "product_brand": "Megger",
      "product_name": "MIT525",
      "quantity": null,
      "deal_value_thb": 280000,
      "activity_type": "visit",
      "sales_stage": "negotiation",
      "payment_status": null,
      "follow_up_date": null,
      "follow_up_notes": "Customer very interested; scheduled to send formal quotation next week",
      "daily_summary": "Visited IRPC, presented Megger MIT525 at 280K THB",
      "confidence_score": 0.92
    },
    {
      "customer_name": "Thai Oil",
      "contact_person": "คุณวิภา",
      "product_brand": "CRC",
      "product_name": "น้ำยาทำความสะอาด (Cleaning Solution)",
      "quantity": 50,
      "deal_value_thb": 85000,
      "activity_type": "follow_up",
      "sales_stage": "negotiation",
      "payment_status": null,
      "follow_up_date": null,
      "follow_up_notes": "Customer waiting for budget approval for 50 gallons of CRC cleaning solution",
      "daily_summary": "Follow-up at Thai Oil on CRC cleaner 50gal, 85K, awaiting budget",
      "confidence_score": 0.88
    }
  ],
  "confirmation_message_th": "รับทราบครับ บันทึก 2 รายการแล้ว:\n\n1️⃣ เข้าพบ IRPC (คุณสมชาย)\n   - Megger MIT525 ฿280,000\n   - สถานะ: กำลังเจรจา / นัดส่ง QT อาทิตย์หน้า\n\n2️⃣ Follow up Thai Oil (คุณวิภา)\n   - CRC น้ำยาทำความสะอาด x50 แกลลอน ฿85,000\n   - สถานะ: รออนุมัติงบ"
}
```

### Example 6 — Not a Sales Report (Casual Chat)

**Input:**
```
ใครจะไปกินข้าวเที่ยงมั่ง มีร้านอาหารญี่ปุ่นเปิดใหม่แถว office
```

**Output:**
```json
{
  "is_sales_report": false,
  "activities": [],
  "confirmation_message_th": null
}
```

### Example 7 — Lost Deal (Thai with Emotion)

**Input:**
```
เสียงาน Salisbury ถุงมือกันไฟฟ้าที่ กฟภ. แพ้ราคาเจ้าอื่น ลูกค้าบอกราคาเราแพงกว่า 15% มูลค่า 320,000
```

**Output:**
```json
{
  "is_sales_report": true,
  "rep_message_language": "mixed",
  "activities": [
    {
      "customer_name": "กฟภ. (PEA)",
      "contact_person": null,
      "product_brand": "Salisbury",
      "product_name": "ถุงมือกันไฟฟ้า (Insulating Gloves)",
      "quantity": null,
      "deal_value_thb": 320000,
      "activity_type": "closed_lost",
      "sales_stage": "closed_lost",
      "payment_status": null,
      "follow_up_date": null,
      "follow_up_notes": "Lost on price — competitor was 15% cheaper. Deal value was 320K THB.",
      "daily_summary": "Lost Salisbury gloves deal at PEA, 320K, undercut by 15%",
      "confidence_score": 0.93
    }
  ],
  "confirmation_message_th": "รับทราบครับ บันทึกแล้ว:\n- เสียงาน: กฟภ.\n- สินค้า: Salisbury ถุงมือกันไฟฟ้า\n- มูลค่า: ฿320,000\n- สาเหตุ: แพ้ราคา (แพงกว่า 15%)\n\nไม่เป็นไรครับ ครั้งหน้าจะได้แน่นอน 💪"
}
```

### Example 8 — Ambiguous/Minimal Message

**Input:**
```
เจอลูกค้าแถวระยอง 2 เจ้า ได้งาน 1
```

**Output:**
```json
{
  "is_sales_report": true,
  "rep_message_language": "th",
  "activities": [
    {
      "customer_name": null,
      "contact_person": null,
      "product_brand": null,
      "product_name": null,
      "quantity": null,
      "deal_value_thb": null,
      "activity_type": "visit",
      "sales_stage": null,
      "payment_status": null,
      "follow_up_date": null,
      "follow_up_notes": "Visited 2 customers in Rayong area; closed 1 deal. No details on customer names, products, or values provided.",
      "daily_summary": "Visited 2 customers in Rayong, won 1 deal (no details)",
      "confidence_score": 0.4
    }
  ],
  "confirmation_message_th": "รับทราบครับ บันทึกแล้ว:\n- เข้าพบลูกค้า 2 เจ้า (ระยอง)\n- ได้งาน 1 เจ้า\n\nช่วยอัพเดทรายละเอียดเพิ่มเติมได้ไหมครับ?\n- ชื่อลูกค้า?\n- สินค้าอะไร?\n- มูลค่าเท่าไหร่?"
}
```

### Example 9 — Payment Update Only

**Input:**
```
EGAT โอนเงินค่า Fluke 1770 มาครบแล้ว 450,000 บาท
```

**Output:**
```json
{
  "is_sales_report": true,
  "rep_message_language": "mixed",
  "activities": [
    {
      "customer_name": "EGAT",
      "contact_person": null,
      "product_brand": "Fluke",
      "product_name": "1770",
      "quantity": null,
      "deal_value_thb": 450000,
      "activity_type": "follow_up",
      "sales_stage": "closed_won",
      "payment_status": "paid",
      "follow_up_date": null,
      "follow_up_notes": "Full payment received via bank transfer",
      "daily_summary": "EGAT paid full 450K THB for Fluke 1770",
      "confidence_score": 0.95
    }
  ],
  "confirmation_message_th": "รับทราบครับ บันทึกแล้ว:\n- ลูกค้า: EGAT\n- สินค้า: Fluke 1770\n- ชำระเงินครบ: ฿450,000\n- สถานะ: ชำระครบแล้ว ✅"
}
```

### Example 10 — Voice-Note Transcript / Very Informal

**Input:**
```
เมื่อกี้แวะ Map Ta Phut industrial นิดนึง เจอฝ่ายจัดซื้อ PTTGC เค้าถามหา SmartWasher ตัวล้างชิ้นส่วน ส่งแคตตาล็อกให้แล้ว ยังไม่ได้คุยราคา จะโทร follow อาทิตย์หน้า
```

**Output:**
```json
{
  "is_sales_report": true,
  "rep_message_language": "mixed",
  "activities": [
    {
      "customer_name": "PTTGC",
      "contact_person": null,
      "product_brand": "SmartWasher",
      "product_name": "Parts Washer",
      "quantity": null,
      "deal_value_thb": null,
      "activity_type": "visit",
      "sales_stage": "lead",
      "payment_status": null,
      "follow_up_date": null,
      "follow_up_notes": "Visited Map Ta Phut Industrial; met PTTGC procurement team. Sent catalog. Pricing not yet discussed. Will follow up by phone next week.",
      "daily_summary": "Visited PTTGC at Map Ta Phut, interest in SmartWasher, sent catalog",
      "confidence_score": 0.82
    }
  ],
  "confirmation_message_th": "รับทราบครับ บันทึกแล้ว:\n- เข้าพบ: PTTGC (Map Ta Phut)\n- สินค้า: SmartWasher ตัวล้างชิ้นส่วน\n- ส่งแคตตาล็อกแล้ว\n- สถานะ: Lead / ยังไม่คุยราคา\n- แผน: โทร follow up อาทิตย์หน้า"
}
```

---

## 4. Confirmation Message Prompt

The `confirmation_message_th` is generated by the same system prompt and included in the JSON output. The design principles for the confirmation message are:

1. **Always in Thai** — matches the rep's natural communication language in LINE
2. **Structured recap** — bullet points showing what was captured, so the rep can spot errors
3. **Gentle nudge for missing data** — if key fields are null, the bot asks for specifics (see Example 8)
4. **Encouraging tone for wins** — celebratory emoji for closed deals (see Example 3)
5. **Empathetic tone for losses** — supportive message for lost deals (see Example 7)
6. **Short and scannable** — reps are in the field, they need to glance and confirm

No separate prompt is needed for confirmation messages. The system prompt already instructs Claude to generate them as part of the JSON output.

**Confirmation Message Tone Map:**

```
    ┌──────────────────────────────────────────────────────────────────────┐
    │             CONFIRMATION MESSAGE TONE BY SCENARIO                    │
    ├──────────────────┬───────────────────────────────────────────────────┤
    │  Scenario        │  Tone & Behavior                                 │
    ├──────────────────┼───────────────────────────────────────────────────┤
    │  closed_won      │  Celebratory + structured recap                  │
    │                  │  "ยินดีด้วยครับ! 🎉"                               │
    ├──────────────────┼───────────────────────────────────────────────────┤
    │  closed_lost     │  Empathetic + supportive                         │
    │                  │  "ไม่เป็นไรครับ ครั้งหน้าจะได้แน่นอน 💪"            │
    ├──────────────────┼───────────────────────────────────────────────────┤
    │  Normal activity │  Professional + structured recap                 │
    │  (visit, call,   │  "รับทราบครับ บันทึกแล้ว:"                        │
    │   quotation)     │                                                   │
    ├──────────────────┼───────────────────────────────────────────────────┤
    │  Missing data    │  Gentle nudge + specific questions               │
    │  (low conf.)     │  "ช่วยอัพเดทรายละเอียดเพิ่มเติมได้ไหมครับ?"       │
    ├──────────────────┼───────────────────────────────────────────────────┤
    │  Not sales       │  null (no confirmation sent)                     │
    └──────────────────┴───────────────────────────────────────────────────┘
```

---

## 5. Prompt Design Decisions

### 5.1 Why a Single-Pass System Prompt (Not Two-Step)

A two-step approach (classify first, then extract) would add latency and cost. The single system prompt handles both classification (`is_sales_report`) and extraction in one API call. This is sufficient because:
- The classification task is simple (sales vs. not-sales)
- The extraction task is well-scoped (fixed set of fields)
- Claude can reliably do both in a single pass

If accuracy issues arise in production, consider splitting into two calls.

```
    SINGLE-PASS (chosen)                    TWO-PASS (alternative)
    ┌──────────────────┐                    ┌──────────────────┐
    │ 1 API Call       │                    │ API Call #1      │
    │                  │                    │ Classify:        │
    │ • Classify       │                    │ sales or not?    │
    │ • Extract        │                    └────────┬─────────┘
    │ • Score          │                             │ if sales
    │ • Confirm        │                             ▼
    └──────────────────┘                    ┌──────────────────┐
                                            │ API Call #2      │
    Cost:  1x tokens                        │ Extract fields   │
    Speed: ~0.5-1s                          └──────────────────┘
    Accuracy: Good
                                            Cost:  2x tokens
                                            Speed: ~1-2s
                                            Accuracy: Slightly better
```

### 5.2 Why the Brand List Is Explicitly Enumerated

The system prompt includes all six brand names with product descriptions. This serves as grounding knowledge so the model can:
- Correctly associate product names with brands (e.g., "MTO330" with Megger)
- Infer product categories when reps use informal descriptions
- Avoid hallucinating brand associations

If ATE adds new brands in the future, update the brand list in the system prompt.

### 5.3 Why Thai Currency Parsing Rules Are Explicit

Thai has multiple informal ways to express monetary values ("แสนห้า" = 150K, "K" suffix, "ล้าน" for millions). Rather than relying on the model's general Thai knowledge, we explicitly list common patterns to improve reliability and consistency.

### 5.4 Why Activity Type Uses Thai Keywords

The system prompt lists Thai keywords for each activity type (e.g., "ไปเยี่ยม" for visit, "โทร" for call). This is not because Claude cannot understand Thai — it can. The explicit keyword list serves as a disambiguation guide for borderline cases and ensures consistent classification across all reps' varying writing styles.

### 5.5 Why Confidence Score Is Included

The confidence score enables downstream logic in n8n:
- **High confidence (>= 0.8):** Auto-save to database, send confirmation
- **Medium confidence (0.5–0.79):** Save to database but flag for human review
- **Low confidence (< 0.5):** Send clarification request to rep via LINE before saving

This graduated approach balances automation speed with data quality.

### 5.6 Why Customer Names Are Not Normalized to a Canonical List

In Tier 1 (Lean), there is no customer master database. Reps may refer to the same company in different ways ("PTTGC", "พีทีที จีซี", "GC"). The prompt intentionally does not attempt full normalization because:
- It would require a customer master list (not yet available)
- Forced normalization could introduce errors
- Fuzzy matching can be added as a post-processing step in Tier 2/3

The prompt does add well-known English abbreviations for Thai government entities (e.g., "กฟผ." maps to "EGAT") to aid dashboard readability.

### 5.7 Why Confirmation Messages Are in Thai

The reps communicate in Thai. An English confirmation would feel foreign and reduce adoption. The confirmation uses:
- Polite Thai particles ("ครับ")
- Structure that matches how the data was captured
- Encouragement for wins, empathy for losses
- Clear ask for missing information when data is incomplete

### 5.8 Why `daily_summary` Is in English

The dashboard audience (sales manager, C-suite) may include stakeholders who prefer English summaries. English also displays more compactly in dashboard cards and avoids Thai rendering issues in some BI tools. If the team strongly prefers Thai, this can be switched.

### 5.9 Why JSON-Only Output Is Enforced

The system prompt ends with "Return your response as a single JSON object... Do not include any text outside the JSON." This makes parsing trivial in n8n — no need to extract JSON from surrounding prose. If Claude ever wraps output in markdown code fences, the n8n workflow should strip them.

---

## 6. Integration Notes

### 6.1 n8n Workflow Integration

**Visual Workflow:**

```
    ┌───────────┐     ┌──────────────┐     ┌──────────────────────────────────────┐
    │  LINE     │     │  n8n         │     │  HTTP Request Node                   │
    │  Webhook  │────→│  Receives    │────→│  POST to Claude API                  │
    │  (message │     │  Message     │     │                                       │
    │  from rep)│     │              │     │  Headers:                             │
    └───────────┘     └──────────────┘     │    x-api-key: [ANTHROPIC_API_KEY]    │
                                            │    content-type: application/json    │
                                            │                                       │
                                            │  Body:                                │
                                            │    model: claude-haiku-4-20250414     │
                                            │    max_tokens: 2048                   │
                                            │    temperature: 0                     │
                                            │    system: [system prompt]            │
                                            │    messages: [{role:"user",           │
                                            │      content: [raw LINE text]}]       │
                                            └──────────────────┬───────────────────┘
                                                               │
                                                               ▼
    ┌──────────────────────────────────────────────────────────────────────────────┐
    │  JSON Parse Node ──→ IF Node (is_sales_report?)                              │
    │                          │                    │                               │
    │                         TRUE                FALSE                            │
    │                          │                    │                               │
    │                          ▼                    ▼                               │
    │              ┌──────────────────┐   ┌──────────────────┐                     │
    │              │ Write to         │   │ Ignore or log    │                     │
    │              │ Google Sheets /  │   │ for analytics    │                     │
    │              │ Supabase         │   └──────────────────┘                     │
    │              └────────┬─────────┘                                             │
    │                       │                                                       │
    │                       ▼                                                       │
    │              ┌──────────────────┐                                             │
    │              │ Send confirmation│                                             │
    │              │ _message_th back │                                             │
    │              │ to rep via LINE  │                                             │
    │              └──────────────────┘                                             │
    └──────────────────────────────────────────────────────────────────────────────┘
```

```
LINE Webhook → n8n receives message
  → HTTP Request node: POST to Claude API
    - system: [system prompt above]
    - user: [raw LINE message text]
    - model: claude-haiku-4-20250414 (Tier 1/2) or claude-sonnet-4-20250514 (Tier 3)
    - max_tokens: 2048
    - temperature: 0 (deterministic extraction)
  → JSON Parse node: parse response
  → IF node: check is_sales_report
    → TRUE: Write to Google Sheets / Supabase + send confirmation_message_th via LINE
    → FALSE: ignore (or log for analytics)
```

### 6.2 Temperature Setting

Use `temperature: 0` for deterministic, consistent extractions. This is a structured data extraction task, not a creative one. Zero temperature ensures the same input produces the same output.

### 6.3 Model Selection

| Tier | Model | Rationale |
|------|-------|-----------|
| Lean | claude-haiku-4-20250414 | Cheapest and fastest; sufficient for straightforward messages |
| Mid | claude-haiku-4-20250414 (default), claude-sonnet-4-20250514 (fallback for low confidence) | Cost-effective with quality fallback |
| Premium | claude-sonnet-4-20250514 | Higher accuracy for complex messages, better Thai understanding |

**Tier 2 Fallback Strategy:**

```
    ┌─────────────┐     ┌──────────────────┐     ┌───────────────────────────┐
    │  LINE       │     │  Claude Haiku    │     │  Check confidence_score   │
    │  Message    │────→│  (1st attempt)   │────→│                           │
    └─────────────┘     └──────────────────┘     └─────────────┬─────────────┘
                                                               │
                                              ┌────────────────┴────────────────┐
                                              │                                 │
                                        conf >= 0.5                        conf < 0.5
                                              │                                 │
                                              ▼                                 ▼
                                     ┌──────────────┐                 ┌──────────────────┐
                                     │  Use Haiku   │                 │  Retry with      │
                                     │  result      │                 │  Claude Sonnet   │
                                     │  (save $$)   │                 │  (better quality)│
                                     └──────────────┘                 └──────────────────┘
```

### 6.4 Cost Estimate

Assuming ~11 reps, ~5 messages/day each, ~55 messages/day:
- Average input: ~200 tokens/message (Thai + system prompt cached)
- Average output: ~500 tokens/response
- With prompt caching, the system prompt tokens are cached after the first call

| Model | Input Cost | Output Cost | Daily Est. | Monthly Est. |
|-------|-----------|-------------|------------|--------------|
| Haiku | $0.80/MTok | $4/MTok | ~$0.12 | ~$3.60 |
| Sonnet | $3/MTok | $15/MTok | ~$0.45 | ~$13.50 |

### 6.5 Error Handling

In the n8n workflow, handle these edge cases:
1. **Claude returns non-JSON:** Strip markdown code fences, retry parse
2. **Claude returns malformed JSON:** Log error, retry once with same input
3. **API timeout:** Retry with exponential backoff (1s, 2s, 4s)
4. **Rate limit (429):** Queue message and retry after delay
5. **Low confidence_score (< 0.5):** Send clarification message to rep instead of saving

**Error Handling Flow:**

```
    ┌──────────────────┐
    │  Claude API      │
    │  Response        │
    └────────┬─────────┘
             │
             ▼
    ┌──────────────────┐     YES     ┌──────────────────┐
    │  Valid JSON?     │────────────→│  Process normally │
    └────────┬─────────┘             └──────────────────┘
             │ NO
             ▼
    ┌──────────────────┐     YES     ┌──────────────────┐
    │  Has code fences?│────────────→│  Strip fences,   │───→ Re-parse
    │  (```json...```) │             │  extract JSON    │
    └────────┬─────────┘             └──────────────────┘
             │ NO
             ▼
    ┌──────────────────┐     YES     ┌──────────────────┐
    │  API error?      │────────────→│  429: Queue +    │
    │  (timeout/429)   │             │       retry      │
    └────────┬─────────┘             │  timeout: Retry  │
             │ NO                     │  w/ backoff      │
             ▼                        │  1s → 2s → 4s   │
    ┌──────────────────┐             └──────────────────┘
    │  Log error,      │
    │  retry once with │
    │  same input      │
    └──────────────────┘
```

### 6.6 Prompt Caching

Use Claude's prompt caching feature to cache the system prompt. Since the system prompt is identical for every call, this significantly reduces input token costs. The system prompt is approximately 1,500 tokens and will be cached after the first call in a session.

**Caching Impact on Cost:**

```
    WITHOUT CACHING                         WITH CACHING
    ┌──────────────────────┐                ┌──────────────────────┐
    │  Every API call:     │                │  1st call:           │
    │  ~1,500 system tokens│                │  ~1,500 system tokens│ (full price)
    │  + ~200 user tokens  │                │  + ~200 user tokens  │
    │  = ~1,700 input      │                │                      │
    │                      │                │  2nd+ calls:         │
    │  55 calls/day =      │                │  ~0 cached tokens    │ (90% discount)
    │  93,500 input tokens │                │  + ~200 user tokens  │
    └──────────────────────┘                │                      │
                                            │  55 calls/day =      │
                                            │  ~12,500 input tokens│ (vs 93,500)
                                            │  = ~87% savings      │
                                            └──────────────────────┘
```

### 6.7 Future Enhancements (Tier 2/3)

- **Customer master list injection:** Add known customer names to system prompt for better normalization
- **Product catalog injection:** Add product/model list for more accurate product matching
- **Image parsing:** Use Claude's vision to parse quotation documents and PO photos
- **Conversation context:** Send previous messages as context for better follow-up linking
- **Validation prompt:** Second API call to validate extracted data against business rules

**Enhancement Roadmap:**

```
    TIER 1 (LEAN)                 TIER 2 (MID)                   TIER 3 (PREMIUM)
    ┌───────────────┐             ┌───────────────────┐          ┌───────────────────────┐
    │ • Haiku model │             │ • Haiku + Sonnet  │          │ • Sonnet always       │
    │ • Text only   │             │   fallback        │          │ • Image/photo parsing │
    │ • Basic       │────────────→│ • Customer master │─────────→│ • Conversation context│
    │   extraction  │             │   list in prompt  │          │ • Validation prompt   │
    │ • No customer │             │ • Product catalog │          │ • Fuzzy name matching │
    │   master DB   │             │ • Fuzzy matching  │          │ • Full normalization  │
    │ • Google      │             │   (post-process)  │          │ • Supabase + BI       │
    │   Sheets      │             │ • Supabase DB     │          │ • Real-time dashboard │
    └───────────────┘             └───────────────────┘          └───────────────────────┘

    Cost: ~$3.60/mo              Cost: ~$5-8/mo                 Cost: ~$13.50/mo
    Setup: 1-2 days               Setup: 1-2 weeks               Setup: 1-2 months
```
