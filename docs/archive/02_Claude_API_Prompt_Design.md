# AI Prompt Design — Gemini 2.5 Flash + Groq Fallback

> **System:** ATE Sales Report LINE Bot
> **Purpose:** Parse unstructured Thai/English LINE messages from field sales reps into structured JSON
> **Primary AI:** Gemini 2.5 Flash (Google, free tier)
> **Fallback AI:** Groq Llama 3.3 70B Versatile (free tier)
> **Date:** 2026-03-14

---

## Visual Overview — Parsing Pipeline

```
  ┌──────────┐     ┌──────────────┐     ┌───────────┐     ┌─────────────┐     ┌──────────────────┐
  │  Sales    │     │   LINE       │     │  Vercel   │     │  Gemini 2.5 │     │  Structured      │
  │  Rep      │────>│   Message    │────>│  Python   │────>│  Flash      │────>│  JSON Output     │
  │  (Field)  │     │  (Thai/Eng)  │     │  Webhook  │     │  (primary)  │     │  + Confirmation  │
  └──────────┘     └──────────────┘     └───────────┘     └─────────────┘     └────────┬─────────┘
                                              │                                         │
                                              │  on failure                              ▼
                                              │           ┌─────────────┐     ┌──────────────────┐
                                              └──────────>│  Groq Llama │────>│  Same JSON       │
                                                          │  3.3 70B    │     │  Schema          │
                                                          │  (fallback) │     └──────────────────┘
                                                          └─────────────┘
```

### Downstream Routing

| Condition | Action |
|---|---|
| `is_sales_report: true`, all fields present | Save to Sheets + send confirmation |
| `is_sales_report: true`, some fields null | Save to Sheets + confirmation + nudge for missing |
| `is_sales_report: false` | Ignore silently (no reply) |

---

## Table of Contents

1. [API Configuration](#1-api-configuration)
2. [System Prompt](#2-system-prompt)
3. [Few-Shot Examples](#3-few-shot-examples)
4. [Output JSON Schema](#4-output-json-schema)
5. [Prompt Assembly](#5-prompt-assembly)
6. [Nudge System](#6-nudge-system)
7. [Prompt Design Rationale](#7-prompt-design-rationale)
8. [Cost & Rate Limits](#8-cost--rate-limits)

---

## 1. API Configuration

Both AI providers are called via direct `urllib.request` — no SDKs installed, avoiding version conflicts on Vercel serverless.

### Gemini 2.5 Flash (Primary)

| Setting | Value |
|---|---|
| Endpoint | `generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent` |
| Auth | API key as query parameter |
| Temperature | `0` |
| Structured output | `responseMimeType: "application/json"` in `generationConfig` |
| Timeout | 30 seconds |
| Prompt format | System instruction via `systemInstruction` field + user content with few-shot examples |

### Groq Llama 3.3 70B Versatile (Fallback)

| Setting | Value |
|---|---|
| Endpoint | `api.groq.com/openai/v1/chat/completions` |
| Auth | Bearer token in `Authorization` header |
| Model | `llama-3.3-70b-versatile` |
| Temperature | `0` |
| Structured output | `response_format: {"type": "json_object"}` |
| Timeout | 20 seconds |
| Prompt format | OpenAI-compatible `messages` array (system + user) |

### Failover Logic

Gemini is tried first. On any exception, the webhook falls back to Groq (if `GROQ_API_KEY` is set). If both fail, the error is caught and the rep receives a generic error reply.

---

## 2. System Prompt

This is the actual system prompt used in production (`SYSTEM_PROMPT` variable in `webhook.py`). It is sent as the `systemInstruction` for Gemini and as the `system` message for Groq.

```
You are a sales report data extraction assistant for ATE (Advanced Technology Equipment Co., Ltd.),
a Thai B2B distributor of industrial equipment.

ATE distributes the following brands:
- Megger — electrical testing equipment (insulation testers, cable fault locators, transformer
  testers like MTO330, MIT525, MTO300)
- Fluke — electronic test tools (digital multimeters, thermal imagers, power quality analyzers
  like 1587 FC, 1770, 87V)
- CRC — industrial chemicals (contact cleaners like 2-26, lubricants, degreasers, corrosion
  inhibitors)
- Salisbury — electrical safety equipment (insulating gloves, arc flash protection, hot sticks)
- SmartWasher — parts washing systems (bioremediating parts washers, OzzyJuice)
- IK Sprayer — industrial sprayers (pressure sprayers, foam sprayers)

Analyze the LINE message from a field sales rep and extract structured data.

RULES:
1. Messages will be in Thai, English, or mixed. Parse regardless of language.
2. If the message is NOT sales-related (casual chat, jokes, lunch plans), return
   is_sales_report: false.
3. Extract all fields you can identify. Use null for missing fields. NEVER fabricate data.
4. Parse Thai currency: "150K"=150000, "1.5ล้าน"=1500000, "แสนห้า"=150000, "สองแสน"=200000.
5. Generate a Thai confirmation message (confirmation_th) to send back to the rep.
6. If the message is ambiguous, ask for clarification in the confirmation message.

Return ONLY valid JSON matching this schema:
{
  "is_sales_report": boolean,
  "activities": [
    {
      "customer_name": "string or null",
      "contact_person": "string or null",
      "product_brand": "Megger|Fluke|CRC|Salisbury|SmartWasher|IK Sprayer|Other|null",
      "product_name": "string or null",
      "quantity": number or null,
      "deal_value_thb": number or null,
      "activity_type": "visit|call|quotation|follow_up|closed_won|closed_lost|other",
      "sales_stage": "lead|negotiation|quotation_sent|closed_won|closed_lost|null",
      "payment_status": "pending|partial|paid|null",
      "follow_up_notes": "string or null",
      "summary_en": "string — brief English summary under 100 chars"
    }
  ],
  "confirmation_th": "string — Thai confirmation message"
}

If is_sales_report is false, return:
{"is_sales_report": false, "activities": [], "confirmation_th": null}
```

---

## 3. Few-Shot Examples

Six examples are prepended to every user message. They cover the key scenarios: single activity, deal closure with partial payment, inbound call, non-sales message, multi-activity message, and a lost deal.

| # | Scenario | Input | Key Extractions |
|---|---|---|---|
| 1 | Visit + quotation | `ไปเยี่ยม PTT วันนี้ เสนอ Megger MTO330 ราคา 150,000` | visit, quotation_sent, 150K THB |
| 2 | Deal closed, partial pay | `ปิดดีล Fluke 1770 กับ EGAT แล้ว 450K จ่ายแล้ว 50%` | closed_won, partial, 450K THB |
| 3 | Inbound call (lead) | `ลูกค้า SCG โทรมา สนใจ CRC contact cleaner 20 กระป๋อง` | call, lead, qty 20, value null |
| 4 | Non-sales (ignored) | `ใครจะไปกินข้าวเที่ยงมั่ง` | is_sales_report: false |
| 5 | Multi-activity (2 entries) | `วันนี้ไปเยี่ยม 2 ที่ 1. IRPC... 2. Thai Oil...` | 2 activities, separate customers |
| 6 | Lost deal | `เสียงาน Salisbury ถุงมือกันไฟฟ้าที่ กฟภ. แพ้ราคา 320,000` | closed_lost, 320K THB |

Each example includes full JSON output in `FEW_SHOT_EXAMPLES` with a Thai confirmation message tailored to the scenario. The confirmation for won deals includes encouraging emoji; lost deals include a supportive message.

---

## 4. Output JSON Schema

The schema is defined inline in the system prompt above. Key enum values:

| Field | Allowed Values |
|---|---|
| `product_brand` | Megger, Fluke, CRC, Salisbury, SmartWasher, IK Sprayer, Other, null |
| `activity_type` | visit, call, quotation, follow_up, closed_won, closed_lost, other |
| `sales_stage` | lead, negotiation, quotation_sent, closed_won, closed_lost, null |
| `payment_status` | pending, partial, paid, null |

The `activities` array contains one object per distinct activity in the message. Non-sales messages return an empty array.

---

## 5. Prompt Assembly

The prompt is assembled differently for each provider, but uses the same content.

### Gemini Request Structure

```json
{
  "systemInstruction": {
    "parts": [{"text": "<SYSTEM_PROMPT>"}]
  },
  "contents": [{
    "role": "user",
    "parts": [{"text": "<few-shot examples + user message>"}]
  }],
  "generationConfig": {
    "responseMimeType": "application/json",
    "temperature": 0
  }
}
```

### Groq Request Structure (OpenAI-compatible)

```json
{
  "model": "llama-3.3-70b-versatile",
  "messages": [
    {"role": "system", "content": "<SYSTEM_PROMPT>"},
    {"role": "user", "content": "<few-shot examples + user message>"}
  ],
  "temperature": 0,
  "response_format": {"type": "json_object"}
}
```

### User Content Format

The few-shot examples and user message are concatenated into a single user message:

```
--- Example ---
Input: ไปเยี่ยม PTT วันนี้ เสนอ Megger MTO330 ราคา 150,000
Output: {"is_sales_report":true,"activities":[...],...}

--- Example ---
Input: ปิดดีล Fluke 1770 กับ EGAT แล้ว 450K จ่ายแล้ว 50%
Output: {"is_sales_report":true,"activities":[...],...}

... (4 more examples) ...

--- Now parse this message ---
Input: <actual user message>
Output:
```

---

## 6. Nudge System

After AI parsing, the webhook checks for missing mandatory fields and appends a nudge to the confirmation message.

### Mandatory Fields

| Field | Thai Label |
|---|---|
| `customer_name` | ชื่อลูกค้า |
| `product_brand` | สินค้า/แบรนด์ |
| `deal_value_thb` | มูลค่าดีล |
| `activity_type` | ประเภทกิจกรรม |
| `sales_stage` | สถานะดีล |

### Three-Tier Nudge Logic

| Missing Fields | Behavior |
|---|---|
| 0 | No nudge — clean confirmation only |
| 1-2 | Append: "ถ้าสะดวก ช่วยแจ้งเพิ่มได้นะครับ: [missing fields]" |
| 3+ | Same hint + append example message: "ตัวอย่าง: ไปเยี่ยม PTT เสนอ Megger MTO330 ราคา 150,000 สถานะเจรจา" |

The nudge tone is deliberately soft, using "ถ้าสะดวก" (if convenient) prefix.

---

## 7. Prompt Design Rationale

### Why few-shot over fine-tuning?
- Zero-cost iteration: update examples in code, deploy instantly
- No training data collection needed for a PoC/demo
- Six examples cover the major patterns (visit, call, close, loss, multi-activity, non-sales)

### Why temperature 0?
- Sales data extraction demands deterministic, reproducible output
- Creative variation is undesirable for structured field extraction

### Why JSON-mode enforcement?
- Gemini's `responseMimeType: "application/json"` guarantees parseable JSON
- Groq's `response_format: {"type": "json_object"}` does the same
- Eliminates markdown fences, preamble text, and other formatting noise

### Why no confidence score?
- The planned implementation originally included a confidence score
- In practice, the simpler approach works: save everything, nudge for missing fields
- Reduces prompt complexity and output size

### Why no SDK?
- Gemini SDK (`google-generativeai`) and Groq SDK have version conflicts on Vercel Python runtime
- Direct `urllib.request` is dependency-free and works reliably on serverless
- Keeps `requirements.txt` minimal: only `gspread` and `google-auth` needed

---

## 8. Cost & Rate Limits

Both providers are used on free tiers with zero cost.

| Provider | Free Tier Limit | Typical Usage | Headroom |
|---|---|---|---|
| Gemini 2.5 Flash | 500 requests/day | ~50 messages/day | 10x |
| Groq (Llama 3.3 70B) | 14,400 requests/day | Fallback only | >100x |

### Latency

| Provider | Typical Response Time |
|---|---|
| Gemini 2.5 Flash | 2-5 seconds |
| Groq Llama 3.3 70B | 1-3 seconds |

Both are well within LINE's reply token expiry window.
