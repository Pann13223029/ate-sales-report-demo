> **ARCHIVED:** This guide was part of the original planning phase. The final implementation uses Vercel serverless Python instead of n8n. Kept for reference in case n8n integration is needed in future phases. See `demo/README.md` for the current implementation.

---

# ATE Sales Report — n8n Workflow Configuration Guide

> **Purpose:** Step-by-step instructions for building the n8n workflow that receives LINE messages, parses them with Claude AI, stores structured data in Google Sheets, and sends confirmations back to the LINE group.
> **Tier:** Lean (PoC)
> **Date:** 2026-03-10

---

## Visual Workflow Overview

The diagram below shows the complete n8n workflow at a glance. Every message from a sales rep flows left to right through these nodes:

```
  ┌─────────────────────────────────────────────────────────────────────────────────────────────────────────┐
  │                        ATE Sales Report — LINE to Sheets   (n8n Workflow)                              │
  └─────────────────────────────────────────────────────────────────────────────────────────────────────────┘

  ┌──────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐
  │  LINE    │    │  Parse LINE  │    │  Is Sales    │    │  Claude API  │    │  Parse Claude    │
  │  Webhook │───▶│  Payload     │───▶│  Group?      │───▶│  (HTTP Req)  │───▶│  Response        │
  │  (Node1) │    │  (Node2)     │    │  (Node3)     │    │  (Node4)     │    │  (Node5)         │
  └──────────┘    └──────────────┘    └──────┬───────┘    └──────────────┘    └────────┬─────────┘
                                             │ No                                      │
                                             ▼                                         ▼
                                      ┌────────────┐                          ┌────────────────┐
                                      │ No-Op STOP │                          │ Confidence     │
                                      └────────────┘                          │ Check (Node6)  │
                                                                              └───┬────────┬───┘
                                                                                  │        │
                                                                          Yes     │        │    No
                                                                       (>= 0.7)  │        │  (< 0.7)
                                                                                  ▼        ▼
                                                                ┌──────────────┐  │  ┌──────────────────┐
                                                                │ Google Sheets│  │  │ Low Confidence   │
                                                                │ Append Row   │  │  │ Handler (Node9)  │
                                                                │ (Node7)      │  │  │ LINE Reply:      │
                                                                └──────┬───────┘  │  │ "ช่วยส่งข้อมูล   │
                                                                       │          │  │  เพิ่มเติม..."    │
                                                                       ▼          │  └──────────────────┘
                                                                ┌──────────────┐  │
                                                                │ LINE Reply   │  │
                                                                │ Confirmation │◀─┘
                                                                │ (Node8)      │
                                                                │ "บันทึกแล้ว" │
                                                                └──────────────┘
```

### Quick-Reference: Node Summary Table

```
  ┌──────┬──────────────────────┬──────────────┬──────────────────────────────────┐
  │ Node │ Name                 │ Type         │ What It Does                     │
  ├──────┼──────────────────────┼──────────────┼──────────────────────────────────┤
  │  1   │ LINE Webhook         │ Webhook      │ Receives POST from LINE          │
  │  2   │ Parse LINE Payload   │ Code (JS)    │ Extracts text, IDs, replyToken   │
  │  3   │ Is Sales Group?      │ IF           │ Filters by groupId               │
  │  4   │ Claude API           │ HTTP Request │ Sends text to Claude for parsing │
  │  5   │ Parse Claude Resp.   │ Code (JS)    │ Extracts JSON from Claude reply  │
  │  6   │ Confidence Check     │ IF           │ Routes on confidence >= 0.7      │
  │  7   │ Google Sheets        │ Sheets Node  │ Appends parsed row to sheet      │
  │  8   │ LINE Reply (OK)      │ HTTP Request │ Sends confirmation to group      │
  │  9   │ LINE Reply (Low)     │ HTTP Request │ Asks rep for clarification       │
  └──────┴──────────────────────┴──────────────┴──────────────────────────────────┘
```

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Credential Setup in n8n](#2-credential-setup-in-n8n)
3. [Workflow Overview](#3-workflow-overview)
4. [Node 1: LINE Webhook Trigger](#4-node-1-line-webhook-trigger)
5. [Node 2: Parse LINE Payload](#5-node-2-parse-line-payload)
6. [Node 3: Filter — Is Sales Group?](#6-node-3-filter--is-sales-group)
7. [Node 4: Claude API — Parse Message](#7-node-4-claude-api--parse-message)
8. [Node 5: Parse Claude Response](#8-node-5-parse-claude-response)
9. [Node 6: Confidence Check](#9-node-6-confidence-check)
10. [Node 7: Append to Google Sheets](#10-node-7-append-to-google-sheets)
11. [Node 8: Reply to LINE](#11-node-8-reply-to-line)
12. [Node 9: Low Confidence Handler](#12-node-9-low-confidence-handler)
13. [Error Handling](#13-error-handling)
14. [Testing Checklist](#14-testing-checklist)
15. [LINE Webhook Payload Reference](#15-line-webhook-payload-reference)

---

## 1. Prerequisites

Before building the workflow, ensure you have:

- [ ] **LINE Official Account** created at [LINE Developers Console](https://developers.line.biz/)
  - Messaging API channel created
  - Channel Access Token (long-lived) generated
  - Webhook URL field ready to fill in (you will get the URL from n8n)
- [ ] **Claude API key** from [Anthropic Console](https://console.anthropic.com/)
  - At least $5 credit loaded
  - Using `claude-sonnet-4-20250514` model (best balance of cost/quality for Thai parsing)
- [ ] **Google Cloud service account** with Google Sheets API enabled
  - JSON key file downloaded
  - Service account email noted
- [ ] **Google Sheets workbook** created per the Template Structure document
  - Spreadsheet ID noted (from the URL: `https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/edit`)
  - Shared with service account email (Editor access)
- [ ] **n8n instance** running (cloud free tier or self-hosted)
  - Accessible via public URL (required for LINE webhook)

---

## 2. Credential Setup in n8n

### Visual Credential Map

Below is a map of every API key / token used in this workflow, showing exactly which node uses which credential and how the credential reaches the external service:

```
  ┌─────────────────────────────────────────────────────────────────────────────────────────┐
  │                              CREDENTIAL MAP                                             │
  │                                                                                         │
  │   n8n Credentials Store                                                                 │
  │   ┌──────────────────────────────────────────────┐                                      │
  │   │                                              │                                      │
  │   │  ┌────────────────────────────────────────┐  │      Used by              Service    │
  │   │  │  LINE Channel Access Token             │  │                                      │
  │   │  │  ─────────────────────────────────      │  │                                      │
  │   │  │  Type: Header Auth                     │  │                                      │
  │   │  │  Header: Authorization                 │──┼──┬──▶ Node 8 (LINE Reply OK)  ───▶ LINE API  │
  │   │  │  Value:  Bearer sk-line-xxxxx          │  │  │                                   │
  │   │  └────────────────────────────────────────┘  │  └──▶ Node 9 (LINE Reply Low) ───▶ LINE API  │
  │   │                                              │                                      │
  │   │  ┌────────────────────────────────────────┐  │                                      │
  │   │  │  Anthropic API Key                     │  │                                      │
  │   │  │  ─────────────────────────────────      │  │                                      │
  │   │  │  Type: Header Auth                     │  │                                      │
  │   │  │  Header: x-api-key                     │──┼─────▶ Node 4 (Claude API)     ───▶ Anthropic API │
  │   │  │  Value:  sk-ant-xxxxx                  │  │                                      │
  │   │  └────────────────────────────────────────┘  │                                      │
  │   │                                              │                                      │
  │   │  ┌────────────────────────────────────────┐  │                                      │
  │   │  │  ATE Google Sheets                     │  │                                      │
  │   │  │  ─────────────────────────────────      │  │                                      │
  │   │  │  Type: Service Account JSON             │  │                                      │
  │   │  │  Scope: spreadsheets (read/write)      │──┼─────▶ Node 7 (Google Sheets)  ───▶ Sheets API │
  │   │  │  Email: ate-bot@proj.iam.gserviceacc..│  │                                      │
  │   │  └────────────────────────────────────────┘  │                                      │
  │   │                                              │                                      │
  │   └──────────────────────────────────────────────┘                                      │
  │                                                                                         │
  │   NOT stored in n8n (configured in LINE Dev Console):                                   │
  │   ┌────────────────────────────────────────┐                                            │
  │   │  LINE Channel Secret                   │─────▶ Used for webhook signature           │
  │   │  (only needed if you verify x-line-    │       verification (optional for PoC)      │
  │   │   signature — see Node 1 notes)        │                                            │
  │   └────────────────────────────────────────┘                                            │
  └─────────────────────────────────────────────────────────────────────────────────────────┘
```

### 2a. LINE Channel Access Token

1. In n8n, go to **Settings > Credentials > Add Credential**
2. Search for **Header Auth** (we will use this for LINE API calls)
3. Name: `LINE Channel Access Token`
4. Configure:
   - Name: `Authorization`
   - Value: `Bearer {YOUR_LINE_CHANNEL_ACCESS_TOKEN}`

> Alternatively, you can store the token as a variable or just hardcode it in the HTTP Request node headers. The Header Auth credential approach keeps it centralized.

### 2b. Claude API Key

1. Add another **Header Auth** credential
2. Name: `Anthropic API Key`
3. Configure:
   - Name: `x-api-key`
   - Value: `{YOUR_ANTHROPIC_API_KEY}`

### 2c. Google Sheets

1. Add a **Google Sheets API** credential (or **Google Sheets OAuth2** depending on your n8n version)
2. For **Service Account** method:
   - Paste the entire JSON key file content
3. For **OAuth2** method:
   - Follow n8n's guided flow to authenticate with a Google account that has access to the spreadsheet
4. Name: `ATE Google Sheets`

---

## 3. Workflow Overview

```
[Webhook: LINE]
      │
      ▼
[Code: Parse LINE Payload]
      │
      ▼
[IF: Is Sales Group?] ──No──▶ [No Operation] (stop)
      │
     Yes
      ▼
[HTTP Request: Claude API]
      │
      ▼
[Code: Parse Claude Response]
      │
      ▼
[IF: Confidence ≥ 0.7?]
      │              │
     Yes            No
      │              ▼
      │     [HTTP Request: LINE Reply — ask for clarification]
      ▼
[Google Sheets: Append Row]
      │
      ▼
[HTTP Request: LINE Reply — confirmation]
```

Create a new workflow in n8n and name it: **ATE Sales Report — LINE to Sheets**

---

## 4. Node 1: LINE Webhook Trigger

**Node type:** Webhook

This node receives incoming messages from LINE whenever someone sends a message in the monitored group.

### Configuration

| Setting | Value |
|---|---|
| HTTP Method | `POST` |
| Path | `line-webhook` |
| Authentication | None (LINE uses signature verification — see note below) |
| Response Mode | `Immediately` |
| Response Code | `200` |

### After Saving

1. Copy the **Production URL** (or Test URL for testing), e.g.:
   `https://your-n8n-instance.com/webhook/line-webhook`
2. Go to LINE Developers Console > Your Channel > Messaging API tab
3. Paste this URL into the **Webhook URL** field
4. Click **Verify** — it should show success
5. Enable **Use webhook** toggle

### Important: LINE Signature Verification (Optional but Recommended)

LINE sends a `x-line-signature` header with each webhook request. For production, you should verify this signature to prevent spoofed requests. For the PoC, you can skip this and add it later.

To add verification, insert a **Code** node after the webhook that:
1. Reads the `x-line-signature` header
2. Computes HMAC-SHA256 of the raw body using your Channel Secret
3. Compares the two values
4. Stops the workflow if they do not match

---

## 5. Node 2: Parse LINE Payload

**Node type:** Code (JavaScript)

This node extracts the essential fields from the LINE webhook payload structure.

### Visual: LINE Webhook Payload Structure

This diagram shows where each field lives inside the raw JSON that LINE sends to n8n, and which fields the Parse node extracts:

```
  LINE Webhook POST Body
  ══════════════════════════════════════════════════════════════════════════
  {
    "destination": "U1234...",                          (bot's user ID)
    "events": [                                         <── array; may have
      {                                                     multiple events
  ┌─── "type": "message",  ◀─── filter: only "message"
  │    "message": {
  │  ┌── "type": "text",   ◀─── filter: only "text"
  │  │   "id": "174328...",  ─────────────────────────▶ messageId
  │  │   "text": "ไปเยี่ยม กฟผ ..."  ────────────────▶ messageText
  │  └── },
  │    "timestamp": 1741569300000,  ──────────────────▶ timestamp (ISO)
  │    "source": {
  │      "type": "group",  ───────────────────────────▶ sourceType
  │      "groupId": "C4af49...",  ────────────────────▶ groupId
  │      "userId": "U4af49..."  ──────────────────────▶ userId
  │    },
  └─── "replyToken": "a1b2c3d4...",  ────────────────▶ replyToken
        "mode": "active",
        "webhookEventId": "01HZXY...",
        "deliveryContext": { "isRedelivery": false }
      }
    ]
  }
  ══════════════════════════════════════════════════════════════════════════

  Output of Node 2 (one item per text message event):
  ┌──────────────────────────────────────────────────────┐
  │  {                                                   │
  │    replyToken:   "a1b2c3d4..."                       │
  │    messageId:    "174328..."                          │
  │    messageText:  "ไปเยี่ยม กฟผ ..."                    │
  │    userId:       "U4af49..."                          │
  │    groupId:      "C4af49..."                          │
  │    timestamp:    "2026-03-10T09:15:00.000Z"          │
  │    sourceType:   "group"                             │
  │  }                                                   │
  └──────────────────────────────────────────────────────┘
```

### Configuration

**Mode:** Run Once for All Items

**Code:**

```javascript
// LINE sends an array of events in the body
const events = $input.first().json.body.events;

// Process only message events that contain text
const results = [];

for (const event of events) {
  if (event.type === 'message' && event.message.type === 'text') {
    results.push({
      json: {
        replyToken: event.replyToken,
        messageId: event.message.id,
        messageText: event.message.text,
        userId: event.source.userId,
        groupId: event.source.groupId || null,
        timestamp: new Date(event.timestamp).toISOString(),
        sourceType: event.source.type  // 'group', 'room', or 'user'
      }
    });
  }
}

// If no text messages found, return empty to stop workflow
if (results.length === 0) {
  results.push({ json: { skip: true } });
}

return results;
```

### Notes

- LINE can batch multiple events in a single webhook call, so we loop through all events.
- We only process text messages for the PoC. Image/voice messages would require additional processing (OCR, speech-to-text) which is a Tier 2+ feature.
- The `replyToken` is critical for sending replies and **expires in approximately 30 seconds**. The workflow must reach the reply node quickly.

---

## 6. Node 3: Filter — Is Sales Group?

**Node type:** IF

This node ensures we only process messages from the designated sales reporting LINE group (not direct messages or other groups).

### Configuration

| Setting | Value |
|---|---|
| Condition | `{{ $json.groupId }}` **String** **equals** `{YOUR_LINE_GROUP_ID}` |

### How to Find Your LINE Group ID

The `groupId` appears in the webhook payload when a message is sent in a group. To capture it:

1. Temporarily connect the Webhook node directly to a **Set** node or log output
2. Send a test message in your LINE sales group
3. Look at the webhook payload — the `groupId` will be in `events[0].source.groupId`
4. It looks like: `C4af4980629a1bc2d3e4f5a6b7c8d9e0f`
5. Copy this value and paste it into the IF node condition

### Also Filter Out Skip Flag

Add a second condition (AND):
- `{{ $json.skip }}` **does not exist** (or **is not equal to** `true`)

---

## 7. Node 4: Claude API — Parse Message

**Node type:** HTTP Request

This is the core of the system — sending the LINE message text to Claude for structured data extraction.

### Configuration

| Setting | Value |
|---|---|
| Method | `POST` |
| URL | `https://api.anthropic.com/v1/messages` |
| Authentication | Predefined Credential: `Anthropic API Key` (Header Auth) |
| Send Headers | Yes |
| Send Body | Yes |
| Body Content Type | JSON |

### Headers

| Header Name | Header Value |
|---|---|
| `anthropic-version` | `2023-06-01` |
| `content-type` | `application/json` |

> Note: The `x-api-key` header is automatically added by the Header Auth credential.

### Body (JSON)

```json
{
  "model": "claude-sonnet-4-20250514",
  "max_tokens": 1024,
  "messages": [
    {
      "role": "user",
      "content": "You are a data extraction assistant for ATE (Advanced Technology Equipment), a Thai B2B distributor of Megger, Fluke, CRC, Salisbury, SmartWasher, and IK Sprayer products.\n\nParse the following sales activity message from a field sales representative. The message may be in Thai, English, or a mix of both.\n\nExtract the following fields and return ONLY a valid JSON object (no markdown, no explanation):\n\n{\n  \"customer_name\": \"company name (full name if identifiable, otherwise as written)\",\n  \"contact_person\": \"contact person name or empty string\",\n  \"product_brand\": \"one of: Megger, Fluke, CRC, Salisbury, SmartWasher, IK Sprayer, Other, or empty string\",\n  \"product_name\": \"specific product name/model or empty string\",\n  \"quantity\": 0,\n  \"deal_value_thb\": 0,\n  \"activity_type\": \"one of: visit, call, quotation, demo, delivery, follow_up, other\",\n  \"sales_stage\": \"one of: lead, qualified, demo_scheduled, quotation_sent, negotiation, closed_won, closed_lost\",\n  \"payment_status\": \"one of: n/a, pending, partial, paid, overdue\",\n  \"follow_up_date\": \"YYYY-MM-DD or empty string\",\n  \"follow_up_notes\": \"next steps in Thai or empty string\",\n  \"daily_summary\": \"one-sentence summary in Thai\",\n  \"confidence_score\": 0.0\n}\n\nRules:\n- confidence_score: 0.0 to 1.0 reflecting how confident you are in the overall extraction accuracy\n- If a field is not mentioned in the message, use empty string for text fields, 0 for numbers, \"n/a\" for payment_status\n- For deal_value_thb, interpret Thai abbreviations: \"k\" = 1,000, \"ล\" or \"ล้าน\" = 1,000,000\n- For follow_up_date, interpret relative dates based on today being {{ $now.format('yyyy-MM-dd') }}\n- Common Thai abbreviations: กฟผ = EGAT, ปตท = PTT, กฟภ = PEA, กฟน = MEA\n- Identify the sales stage from context clues (e.g., \"ส่งใบเสนอราคา\" = quotation_sent, \"ปิดดีล\" = closed_won)\n\nMessage:\n\"{{ $json.messageText }}\""
    }
  ]
}
```

### Expression Notes

- `{{ $now.format('yyyy-MM-dd') }}` — injects today's date so Claude can resolve relative dates like "next Friday" or "สัปดาห์หน้า"
- `{{ $json.messageText }}` — injects the actual LINE message text from the previous node
- Make sure to escape any special characters in the message text. In n8n, you may need to use the `$json.messageText.replace(/"/g, '\\"')` expression if messages contain double quotes.

### Timeout

Set the HTTP Request timeout to **25 seconds**. Claude typically responds in 2-5 seconds, but we want a buffer while staying under LINE's reply token expiry.

---

## 8. Node 5: Parse Claude Response

**Node type:** Code (JavaScript)

Claude's response contains the JSON data extraction embedded in the API response structure. This node extracts and validates it.

### Visual: JSON Extraction Fallback Chain

The node tries three strategies in order to pull the JSON out of Claude's response:

```
  Claude API Response (response.content[0].text)
  │
  │   Could be any of these formats:
  │
  │   Format A (ideal):          Format B:                   Format C:
  │   {"customer_name":...}      ```json                     Some text...
  │                              {"customer_name":...}       {"customer_name":...}
  │                              ```                         ...more text
  │
  ▼
  ┌─────────────────────────┐
  │ Try 1: JSON.parse()     │──── Success ──▶ Use parsed object
  │ (direct parse)          │
  └───────────┬─────────────┘
              │ Fail (SyntaxError)
              ▼
  ┌─────────────────────────┐
  │ Try 2: Regex for        │──── Success ──▶ Use parsed object
  │ ```json ... ``` block    │
  └───────────┬─────────────┘
              │ Fail (no match)
              ▼
  ┌─────────────────────────┐
  │ Try 3: Regex for        │──── Success ──▶ Use parsed object
  │ first { ... } in text   │
  └───────────┬─────────────┘
              │ Fail (no match)
              ▼
  ┌─────────────────────────┐
  │ THROW ERROR              │
  │ "Could not extract JSON" │
  └─────────────────────────┘
```

### Code

```javascript
const response = $input.first().json;

// Extract the text content from Claude's response
const textContent = response.content[0].text;

// Parse the JSON from Claude's response
let parsed;
try {
  // Try direct JSON parse first
  parsed = JSON.parse(textContent);
} catch (e) {
  // If Claude wrapped it in markdown code blocks, extract it
  const jsonMatch = textContent.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    parsed = JSON.parse(jsonMatch[1].trim());
  } else {
    // Last resort: try to find JSON object in the text
    const objMatch = textContent.match(/\{[\s\S]*\}/);
    if (objMatch) {
      parsed = JSON.parse(objMatch[0]);
    } else {
      throw new Error('Could not extract JSON from Claude response: ' + textContent.substring(0, 200));
    }
  }
}

// Carry forward the metadata from earlier nodes
const inputData = $('Parse LINE Payload').first().json;

return [{
  json: {
    // Metadata from LINE
    timestamp: inputData.timestamp,
    message_id: inputData.messageId,
    reply_token: inputData.replyToken,
    user_id: inputData.userId,
    raw_message: inputData.messageText,

    // Parsed data from Claude
    customer_name: parsed.customer_name || '',
    contact_person: parsed.contact_person || '',
    product_brand: parsed.product_brand || '',
    product_name: parsed.product_name || '',
    quantity: parsed.quantity || 0,
    deal_value_thb: parsed.deal_value_thb || 0,
    activity_type: parsed.activity_type || 'other',
    sales_stage: parsed.sales_stage || 'lead',
    payment_status: parsed.payment_status || 'n/a',
    follow_up_date: parsed.follow_up_date || '',
    follow_up_notes: parsed.follow_up_notes || '',
    daily_summary: parsed.daily_summary || '',
    confidence_score: parsed.confidence_score || 0
  }
}];
```

### Notes

- The `$('Parse LINE Payload').first().json` expression references data from the earlier "Parse LINE Payload" node by name. Make sure the node name matches exactly.
- The triple-fallback JSON extraction (direct parse, markdown block extraction, object match) handles variations in how Claude formats its response.

---

## 9. Node 6: Confidence Check

**Node type:** IF

Routes messages based on Claude's parsing confidence. High-confidence results go to Google Sheets; low-confidence results get flagged.

### Visual: Confidence Score Branching Logic

```
                         ┌──────────────────────────────────────────┐
                         │       CONFIDENCE SCORE ROUTING            │
                         └──────────────────────────────────────────┘

      confidence_score from Claude (0.0 ─────────────────────── 1.0)

      ◀──── LOW (unreliable) ────┼──── HIGH (trustworthy) ────▶

      0.0    0.2    0.4    0.6   │ 0.7   0.8    0.9    1.0
      ├──────┼──────┼──────┼─────┼──────┼──────┼──────┤
      ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░
      ◀── DO NOT SAVE ─────────▶ ◀──── SAVE TO SHEETS ──▶
                                 │
                            threshold = 0.7
                                 │
            ┌────────────────────┼────────────────────┐
            │                    │                     │
            ▼                    │                     ▼
  ┌─────────────────────┐       │        ┌──────────────────────┐
  │  ROUTE: Low Branch  │       │        │  ROUTE: High Branch  │
  │                     │       │        │                      │
  │  Node 9: Reply to   │       │        │  Node 7: Append to   │
  │  LINE group with    │       │        │  Google Sheets       │
  │  clarification      │       │        │         │            │
  │  request            │       │        │         ▼            │
  │                     │       │        │  Node 8: Reply to    │
  │  "ช่วยส่งข้อมูล       │       │        │  LINE group with    │
  │   เพิ่มเติมได้ไหมครับ" │       │        │  confirmation       │
  └─────────────────────┘       │        │                      │
                                │        │  "บันทึกแล้ว"          │
                                │        └──────────────────────┘
                                │
            ┌───────────────────────────────────────────┐
            │  SCORE INTERPRETATION GUIDE                │
            ├───────────────────────────────────────────┤
            │  0.9 - 1.0  Very clear, all fields found  │
            │  0.7 - 0.89 Most fields found, some       │
            │             assumptions — acceptable       │
            │  0.5 - 0.69 Ambiguous — ask for more info │
            │  0.0 - 0.49 Too vague or not a sales msg  │
            └───────────────────────────────────────────┘
```

### Configuration

| Setting | Value |
|---|---|
| Condition | `{{ $json.confidence_score }}` **Number** **greater than or equal** `0.7` |

### Branch Routing

- **True (confidence >= 0.7):** Continue to Google Sheets append (Node 7)
- **False (confidence < 0.7):** Go to Low Confidence Handler (Node 9)

### Why 0.7?

- **0.9-1.0:** Very clear message, all fields extracted confidently
- **0.7-0.89:** Most fields extracted, some assumptions made (acceptable for PoC)
- **Below 0.7:** Message was ambiguous, mixed topics, or too short to parse reliably. Storing this data would pollute the dataset.

You can adjust this threshold after reviewing real-world results during the pilot.

---

## 10. Node 7: Append to Google Sheets

**Node type:** Google Sheets (Append Row)

This node writes the parsed data to the "Sales Activities" sheet.

### Configuration

| Setting | Value |
|---|---|
| Credential | `ATE Google Sheets` |
| Operation | **Append Row** |
| Document | Select by ID: `{YOUR_SPREADSHEET_ID}` |
| Sheet | `Sales Activities` |
| Mapping Mode | **Map Each Column Manually** |

### Column Mapping

Map each column to the corresponding expression from the previous node:

| Sheet Column | Value (Expression) |
|---|---|
| `timestamp` | `{{ $json.timestamp }}` |
| `message_id` | `{{ $json.message_id }}` |
| `rep_name` | `{{ $json.user_id }}` (see note below) |
| `customer_name` | `{{ $json.customer_name }}` |
| `contact_person` | `{{ $json.contact_person }}` |
| `product_brand` | `{{ $json.product_brand }}` |
| `product_name` | `{{ $json.product_name }}` |
| `quantity` | `{{ $json.quantity }}` |
| `deal_value_thb` | `{{ $json.deal_value_thb }}` |
| `activity_type` | `{{ $json.activity_type }}` |
| `sales_stage` | `{{ $json.sales_stage }}` |
| `payment_status` | `{{ $json.payment_status }}` |
| `follow_up_date` | `{{ $json.follow_up_date }}` |
| `follow_up_notes` | `{{ $json.follow_up_notes }}` |
| `daily_summary` | `{{ $json.daily_summary }}` |
| `confidence_score` | `{{ $json.confidence_score }}` |
| `raw_message` | `{{ $json.raw_message }}` |

### Rep Name Lookup

For `rep_name`, you need to resolve the LINE `userId` to a name. Two approaches:

**Option A — Simple lookup in Code node (recommended for PoC):**

Add a Code node before Google Sheets that maps `userId` to `rep_name`:

```javascript
const repMap = {
  'U4af4980629a1bc2d3e4f5a6b7c8d9e0f': 'สมชาย',
  'U5bf5091730b2cd3e4f6a7b8c9d0e1f2a': 'อรุณ',
  'U6cg6102841c3de4f5g7a8b9c0d1e2f3b': 'นภา',
  // Add all reps here
};

const items = $input.all();
for (const item of items) {
  item.json.rep_name = repMap[item.json.user_id] || item.json.user_id;
}
return items;
```

**Option B — Lookup from Reps sheet via Google Sheets node:**

Use a Google Sheets "Read Rows" node to find the rep name matching the `userId`. This is more maintainable but adds latency (risky given the reply token timeout).

---

## 11. Node 8: Reply to LINE

**Node type:** HTTP Request

Sends a confirmation message back to the LINE group so the rep knows their report was logged.

### Configuration

| Setting | Value |
|---|---|
| Method | `POST` |
| URL | `https://api.line.me/v2/bot/message/reply` |
| Authentication | Predefined Credential: `LINE Channel Access Token` (Header Auth) |
| Send Headers | Yes |
| Send Body | Yes |
| Body Content Type | JSON |

### Headers

| Header Name | Header Value |
|---|---|
| `Content-Type` | `application/json` |

### Body (JSON)

```json
{
  "replyToken": "{{ $json.reply_token }}",
  "messages": [
    {
      "type": "text",
      "text": "✅ บันทึกแล้ว\n📋 {{ $json.daily_summary }}\n\n👤 ลูกค้า: {{ $json.customer_name }}\n📦 สินค้า: {{ $json.product_brand }} {{ $json.product_name }}\n💰 มูลค่า: {{ $json.deal_value_thb > 0 ? '฿' + Number($json.deal_value_thb).toLocaleString() : '-' }}\n📊 สถานะ: {{ $json.sales_stage }}\n{{ $json.follow_up_date ? '📅 ติดตาม: ' + $json.follow_up_date : '' }}"
    }
  ]
}
```

### Visual: Reply Token Timing Budget

```
  ┌─────────────────────── 30-second LINE reply token window ────────────────────────┐
  │                                                                                  │
  │  0s         5s        10s        15s        20s        25s        30s             │
  │  ├──────────┼──────────┼──────────┼──────────┼──────────┼──────────┤  TOKEN       │
  │                                                                       EXPIRES    │
  │  ╠══╗                                                                            │
  │  ║  ║ Node 1+2: Webhook + Parse (~100ms)                                         │
  │  ╠══╝                                                                            │
  │  ║  ╠════════════╗                                                               │
  │  ║  ║            ║ Node 4: Claude API (2-5s typical)                              │
  │  ║  ╠════════════╝                                                               │
  │  ║  ║ ╠════╗                                                                     │
  │  ║  ║ ║    ║ Node 7: Google Sheets (1-2s)                                        │
  │  ║  ║ ╠════╝                                                                     │
  │  ║  ║ ║ ╠╗                                                                       │
  │  ║  ║ ║ ║║ Node 8: LINE Reply (~200ms)                                           │
  │  ║  ║ ║ ╠╝                                                                       │
  │  ║  ║ ║ ║                                                                        │
  │  ╠══╩═╩═╩─ TOTAL: ~4-8 seconds (safe) ──────────────────────────────────────── │
  │            ▲                                                                     │
  │            │                                                                     │
  │     typical finish                                                               │
  │                                                                                  │
  │     DANGER ZONE: if Claude takes > 20s ─────────────────▶ ████████ risk ████     │
  └──────────────────────────────────────────────────────────────────────────────────┘
```

### Critical: Reply Token Timing

The LINE reply token **expires approximately 30 seconds** after the webhook event is generated. Your entire workflow — from webhook receipt through Claude API call to this reply — must complete within that window.

Typical timing breakdown:
- Webhook receipt + parsing: ~100ms
- Claude API call: 2-5 seconds
- Google Sheets append: 1-2 seconds
- LINE reply: ~200ms
- **Total: ~4-8 seconds** (well within the 30-second limit under normal conditions)

**If Claude API is slow:** If response times exceed 15 seconds, consider:
1. Switching to `claude-haiku-4-20250414` (faster, slightly less accurate)
2. Running the Google Sheets append and LINE reply in parallel (both only depend on the Claude parse, not each other) — connect both nodes to the output of the Confidence Check node
3. Sending the LINE reply before the Sheets append (reply first, then store)

**If the token expires:** The message will still be parsed and stored in Sheets. Only the confirmation reply to the group will fail. This is acceptable — the data is captured. You can switch to a **Push Message** instead of Reply (does not require a reply token) but Push Messages count against your monthly free message quota.

---

## 12. Node 9: Low Confidence Handler

**Node type:** HTTP Request

When Claude's confidence score is below 0.7, send a clarification request back to the LINE group instead of storing potentially incorrect data.

### Configuration

Same as Node 8 (LINE Reply), but with a different message body:

### Body (JSON)

```json
{
  "replyToken": "{{ $json.reply_token }}",
  "messages": [
    {
      "type": "text",
      "text": "🤔 ขอโทษครับ ไม่แน่ใจข้อมูลจากข้อความนี้\n\nเข้าใจว่า:\n👤 ลูกค้า: {{ $json.customer_name || '(ไม่ทราบ)' }}\n📦 สินค้า: {{ $json.product_brand || '(ไม่ทราบ)' }} {{ $json.product_name || '' }}\n📊 กิจกรรม: {{ $json.activity_type || '(ไม่ทราบ)' }}\n\nช่วยส่งข้อมูลเพิ่มเติมได้ไหมครับ เช่น:\n- ชื่อลูกค้า\n- สินค้าอะไร\n- เยี่ยม/โทร/ส่งใบเสนอราคา?"
    }
  ]
}
```

### Optional: Still Log Low-Confidence Data

You may want to log low-confidence messages to a separate sheet or a "Pending Review" tab for manual review. To do this:

1. Add a **Google Sheets** node after the Low Confidence reply
2. Append to a sheet named `Pending Review` with the same columns plus the `confidence_score`
3. A team member can review these weekly and either correct and move them to `Sales Activities` or discard them

---

## 13. Error Handling

### Visual: Error Handling Flow for Each Critical Node

```
  ┌──────────────────────────────────────────────────────────────────────────────────────┐
  │                         ERROR HANDLING ARCHITECTURE                                   │
  └──────────────────────────────────────────────────────────────────────────────────────┘

  ┌────────────────────────────────────────────────────────────────────────────────────┐
  │  WORKFLOW-LEVEL: Error Workflow (catches any unhandled node failure)                │
  │  ┌──────────────────────────────────────────────────────────────────────────────┐  │
  │  │  On ANY failure ───▶ Push message to admin LINE account with error details   │  │
  │  └──────────────────────────────────────────────────────────────────────────────┘  │
  └────────────────────────────────────────────────────────────────────────────────────┘

  NODE-LEVEL ERROR HANDLING:
  ═══════════════════════════

  Node 1: Webhook                Node 4: Claude API
  ┌──────────────┐               ┌───────────────────────┐
  │  LINE sends  │               │  POST to Claude API   │
  │  webhook     │               │                       │
  └──────┬───────┘               └───────────┬───────────┘
         │                                   │
         ▼                                   ▼
  ┌──────────────┐               ┌───────────────────────┐
  │ Always 200   │               │ On Error: CONTINUE    │
  │ (LINE needs  │               │ (with error output)   │
  │  instant ACK)│               └───────────┬───────────┘
  └──────────────┘                           │
  No error handling                          ▼
  needed — n8n auto-               ┌─────────────────────┐     ┌─────────────────────────┐
  responds 200.                    │ IF: has error?       │────▶│ YES: Send generic reply  │
                                   └─────────┬───────────┘     │ "ได้รับข้อความแล้วครับ"     │
                                             │ No              │ + log error to n8n       │
                                             ▼                 └─────────────────────────┘
                                   (continue normal flow)

  Node 7: Google Sheets          Node 8 / 9: LINE Reply
  ┌──────────────────────┐       ┌───────────────────────────┐
  │  Append row to sheet │       │  POST to LINE Reply API   │
  └──────────┬───────────┘       └───────────┬───────────────┘
             │                               │
             ▼                               ▼
  ┌──────────────────────┐       ┌───────────────────────────┐
  │ On Error: CONTINUE   │       │ On Error: CONTINUE        │
  │ (with error output)  │       │ (ignore — data already    │
  └──────────┬───────────┘       │  saved in Sheets)         │
             │                   └───────────────────────────┘
             ▼                   Most common cause:
  ┌──────────────────────┐       reply token expired (>30s).
  │ STILL send LINE      │       Non-critical.
  │ reply (Node 8) so    │
  │ rep gets feedback.   │
  │ Log failed row data  │
  │ to execution history │
  │ for manual retry.    │
  └──────────────────────┘


  COMMON ERRORS QUICK REFERENCE:
  ┌──────────────┬────────────────────────┬──────────────────────────────────────┐
  │ Error Code   │ Node / Service         │ What To Do                           │
  ├──────────────┼────────────────────────┼──────────────────────────────────────┤
  │ 401          │ Claude API             │ Invalid API key — check credential   │
  │ 429          │ Claude API             │ Rate limit — retry with backoff      │
  │ 500          │ Claude API             │ Service issue — retry once after 2s  │
  │ Timeout      │ Claude API             │ Switch to Haiku model                │
  │ 403          │ Google Sheets          │ Sheet not shared with svc account    │
  │ 404          │ Google Sheets          │ Wrong spreadsheet ID or sheet name   │
  │ Token expire │ LINE Reply             │ Non-critical — data already saved    │
  └──────────────┴────────────────────────┴──────────────────────────────────────┘
```

### Workflow-Level Error Handling

1. In the workflow settings (gear icon), enable **Error Workflow**
2. Create a simple error workflow that sends a LINE push message to the admin/developer when any node fails

### Node-Level Error Handling

For the most critical nodes, add error handling:

#### Claude API Node (Node 4)

- **On Error:** Continue (with error output)
- Add an **IF** node after it to check if the response contains an error
- If error: send a generic "ได้รับข้อความแล้วครับ" reply to LINE (acknowledge receipt without parsed data) and log the error

Common Claude API errors:
| Error | Cause | Fix |
|---|---|---|
| 401 | Invalid API key | Check credential |
| 429 | Rate limit exceeded | Add retry with backoff; or upgrade plan |
| 500 | Claude service issue | Retry once after 2 seconds |
| Timeout | Response too slow | Switch to Haiku model |

#### Google Sheets Node (Node 7)

- **On Error:** Continue (with error output)
- If Sheets append fails, still send the LINE reply (so the rep gets confirmation)
- Log the failed row data to n8n's execution history for manual re-processing

#### LINE Reply Node (Node 8)

- **On Error:** Continue (ignore)
- If the reply fails (expired token), the data is already in Sheets. No action needed.
- This is the most common "failure" and is non-critical.

### Rate Limits to Be Aware Of

| Service | Limit | Impact |
|---|---|---|
| LINE Messaging API (free) | 500 reply messages/month (push messages cost extra) | Unlikely to hit with 11 reps |
| Claude API | Varies by tier — typically 60 requests/minute | Sufficient for PoC |
| Google Sheets API | 300 requests/minute per project | Sufficient for PoC |
| n8n Cloud (free tier) | 300 executions/month | Could be tight with 11 reps; consider self-hosting |

---

## 14. Testing Checklist

### Visual: Testing Phase Diagram

```
  ┌──────────────────────────────────────────────────────────────────────────────┐
  │                     TESTING ROADMAP (3 Phases)                               │
  └──────────────────────────────────────────────────────────────────────────────┘

  PHASE 1                     PHASE 2                     PHASE 3
  Individual Nodes            End-to-End                  Pilot (Real Users)
  ──────────────              ──────────                  ──────────────────
  Duration: 1-2 hours         Duration: 1-2 hours         Duration: 1 week
  Who: Developer              Who: Developer              Who: 2-3 reps + dev

  ┌─────────────────┐   ┌────────────────────┐   ┌────────────────────────┐
  │                 │   │                    │   │                        │
  │  Test each node │   │  Send real LINE    │   │  Deploy to 2-3 pilot   │
  │  individually   │   │  messages, verify  │   │  reps for 1 week.      │
  │  with mock data │   │  entire flow works │   │  Review accuracy,      │
  │                 │   │  end-to-end        │   │  gather feedback.      │
  │  ┌───────────┐  │   │                    │   │                        │
  │  │ Webhook   │──┼──▶│  Test scenarios:   │──▶│  Checklist:            │
  │  │ Parse     │  │   │  ┌──────────────┐  │   │  ┌────────────────┐    │
  │  │ Filter    │  │   │  │ Clear report │  │   │  │ Review Sheets  │    │
  │  │ Claude    │  │   │  │ Short msg    │  │   │  │ Check scores   │    │
  │  │ Parse Resp│  │   │  │ Non-sales    │  │   │  │ Rep feedback   │    │
  │  │ IF check  │  │   │  │ Thai numbers │  │   │  │ Monitor logs   │    │
  │  │ Sheets    │  │   │  │ Multi-product│  │   │  │ Tune prompt    │    │
  │  │ LINE Reply│  │   │  │ Relative date│  │   │  │ Adjust 0.7     │    │
  │  └───────────┘  │   │  │ Error case   │  │   │  │  threshold     │    │
  │                 │   │  └──────────────┘  │   │  └────────────────┘    │
  └─────────────────┘   └────────────────────┘   └────────────────────────┘
        │                        │                         │
        ▼                        ▼                         ▼
  ┌──────────┐            ┌──────────┐              ┌──────────┐
  │  PASS?   │            │  PASS?   │              │  PASS?   │
  │  All 8   │            │  All     │              │  Accuracy│
  │  nodes   │            │  scenar- │              │  > 80%?  │
  │  work    │            │  ios OK  │              │  Reps OK?│
  └──────────┘            └──────────┘              └──────────┘
       │                       │                         │
       Yes                     Yes                       Yes
       │                       │                         │
       ▼                       ▼                         ▼
  ┌──────────────────────────────────────────────────────────┐
  │                READY FOR FULL ROLLOUT                     │
  │            (all 11 reps, production mode)                 │
  └──────────────────────────────────────────────────────────┘
```

### Phase 1: Individual Node Testing

- [ ] **Webhook:** Send a test POST request using cURL or Postman with a sample LINE payload (see Section 15). Verify n8n receives it.
- [ ] **Parse LINE Payload:** Verify the Code node extracts `messageText`, `userId`, `groupId`, `replyToken`, and `messageId` correctly.
- [ ] **Filter:** Test with correct group ID (should pass) and a random group ID (should stop).
- [ ] **Claude API:** Send a sample Thai message and verify Claude returns valid JSON with all expected fields.
- [ ] **Parse Claude Response:** Verify JSON extraction works for direct JSON, markdown-wrapped JSON, and mixed-text responses.
- [ ] **Confidence Check:** Test with scores of 0.5 (should route to low-confidence) and 0.9 (should route to Sheets).
- [ ] **Google Sheets:** Verify a row is appended with all 17 columns populated correctly.
- [ ] **LINE Reply:** Verify the confirmation message appears in the LINE group.

### Phase 2: End-to-End Testing

- [ ] Send a real message in the LINE group. Verify the full flow: message parsed, row in Sheets, confirmation in LINE.
- [ ] Test with various message types:
  - Clear visit report with all details
  - Short message (e.g., "โทรหา ปตท.") — should still parse with lower confidence
  - Non-sales message (e.g., "สวัสดีครับ") — should get low confidence and request clarification
  - Message with Thai number abbreviations (e.g., "150k", "1.5 ล้าน")
  - Message mentioning multiple products (should capture the primary one)
  - Message with relative dates ("สัปดาห์หน้า", "วันศุกร์")
- [ ] Verify reply token timing — all replies should arrive within 30 seconds
- [ ] Test error scenario: temporarily use an invalid Claude API key and verify error handling works

### Phase 3: Pilot Testing

- [ ] Deploy with 2-3 pilot reps for 1 week
- [ ] Review all rows in Google Sheets for parsing accuracy
- [ ] Check confidence scores — are most above 0.7?
- [ ] Get feedback from pilot reps: is the confirmation message helpful? Any confusion?
- [ ] Monitor n8n execution logs for errors or slow executions

---

## 15. LINE Webhook Payload Reference

When a user sends a text message in a LINE group, the webhook payload looks like this:

```json
{
  "destination": "U1234567890abcdef1234567890abcdef",
  "events": [
    {
      "type": "message",
      "message": {
        "type": "text",
        "id": "17432856901234",
        "text": "ไปเยี่ยม กฟผ. วันนี้ เจอคุณวิทยา เสนอ Megger MTO330 2 เครื่อง 285,000 รอ PO สัปดาห์หน้า"
      },
      "webhookEventId": "01HZXYZ1234567890ABCDEF",
      "deliveryContext": {
        "isRedelivery": false
      },
      "timestamp": 1741569300000,
      "source": {
        "type": "group",
        "groupId": "C4af4980629a1bc2d3e4f5a6b7c8d9e0f",
        "userId": "U4af4980629a1bc2d3e4f5a6b7c8d9e0f"
      },
      "replyToken": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
      "mode": "active"
    }
  ]
}
```

### Key Fields

| Field | Path | Description |
|---|---|---|
| Event type | `events[].type` | `message`, `follow`, `unfollow`, `join`, `leave`, etc. We only process `message`. |
| Message type | `events[].message.type` | `text`, `image`, `video`, `audio`, `file`, `location`, `sticker`. We only process `text` for PoC. |
| Message ID | `events[].message.id` | Unique identifier for the message. Use for deduplication. |
| Message text | `events[].message.text` | The actual message content. Only present when `message.type` is `text`. |
| Timestamp | `events[].timestamp` | Unix timestamp in milliseconds. |
| Source type | `events[].source.type` | `user` (1:1 chat), `group`, or `room`. We filter for `group`. |
| Group ID | `events[].source.groupId` | Unique ID of the LINE group. Use this to filter for the sales reporting group. |
| User ID | `events[].source.userId` | Unique ID of the message sender. Map this to rep name via the Reps lookup. |
| Reply token | `events[].replyToken` | Token required to send a reply. **Expires in ~30 seconds.** Single-use — can only be used once. |
| Is redelivery | `events[].deliveryContext.isRedelivery` | `true` if LINE is retrying delivery. Check this to avoid processing duplicates. |

### Important Notes

- LINE may send **multiple events** in a single webhook call (the `events` array can have more than one item). The Parse LINE Payload node handles this by looping through all events.
- The `userId` may be `null` if the user has not added the bot as a friend. In group chats, this is rare but possible. Handle gracefully by using "Unknown Rep" as the name.
- If `isRedelivery` is `true`, the message was already processed. You should check against the `message_id` in your Sheets to avoid duplicate rows. For the PoC, this is a minor risk and can be handled manually.
- LINE sends non-message events (user joins group, bot joins group, etc.) to the same webhook. The Parse LINE Payload node filters these out by checking `event.type === 'message'`.

---

## Visual: Complete Data Transformation Pipeline

This diagram traces one real message through every stage of the workflow, showing exactly how the data shape changes at each step.

```
  ══════════════════════════════════════════════════════════════════════════════════════
   STAGE 1: Raw LINE Webhook JSON (what n8n receives)
  ══════════════════════════════════════════════════════════════════════════════════════

  {
    "events": [{
      "type": "message",
      "message": {
        "type": "text",
        "id": "17432856901234",
        "text": "ไปเยี่ยม กฟผ. วันนี้ เจอคุณวิทยา เสนอ Megger MTO330 2 เครื่อง 285,000 รอ PO สัปดาห์หน้า"
      },
      "source": { "type":"group", "groupId":"C4af49...", "userId":"U4af49..." },
      "replyToken": "a1b2c3d4...",
      "timestamp": 1741569300000
    }]
  }

                            │
                   Node 2   │  Parse LINE Payload (Code node)
                            │  Extracts only what we need
                            ▼
  ══════════════════════════════════════════════════════════════════════════════════════
   STAGE 2: Cleaned Message Object (output of Node 2)
  ══════════════════════════════════════════════════════════════════════════════════════

  {
    "replyToken":   "a1b2c3d4...",
    "messageId":    "17432856901234",
    "messageText":  "ไปเยี่ยม กฟผ. วันนี้ เจอคุณวิทยา เสนอ Megger MTO330 2 เครื่อง 285,000 รอ PO สัปดาห์หน้า",
    "userId":       "U4af49...",
    "groupId":      "C4af49...",
    "timestamp":    "2026-03-10T09:15:00.000Z",
    "sourceType":   "group"
  }

                            │
                   Node 3   │  Filter: Is Sales Group?
                            │  groupId matches ──▶ PASS
                            ▼
                            │
                   Node 4   │  HTTP Request to Claude API
                            │  Sends messageText inside prompt
                            ▼
  ══════════════════════════════════════════════════════════════════════════════════════
   STAGE 3: Claude API Request Body (what gets sent to Anthropic)
  ══════════════════════════════════════════════════════════════════════════════════════

  {
    "model": "claude-sonnet-4-20250514",
    "max_tokens": 1024,
    "messages": [{
      "role": "user",
      "content": "You are a data extraction assistant for ATE...
                  ...
                  Message:
                  \"ไปเยี่ยม กฟผ. วันนี้ เจอคุณวิทยา เสนอ Megger MTO330
                   2 เครื่อง 285,000 รอ PO สัปดาห์หน้า\""
    }]
  }

                            │
                   Claude   │  AI processes the Thai text
                            │  Returns structured JSON
                            ▼
  ══════════════════════════════════════════════════════════════════════════════════════
   STAGE 4: Claude API Response (raw response from Anthropic)
  ══════════════════════════════════════════════════════════════════════════════════════

  {
    "content": [{
      "type": "text",
      "text": "{\"customer_name\":\"การไฟฟ้าฝ่ายผลิตแห่งประเทศไทย (EGAT)\",
                \"contact_person\":\"คุณวิทยา\",
                \"product_brand\":\"Megger\",
                \"product_name\":\"MTO330\",
                \"quantity\":2,
                \"deal_value_thb\":285000,
                \"activity_type\":\"visit\",
                \"sales_stage\":\"quotation_sent\",
                \"payment_status\":\"n/a\",
                \"follow_up_date\":\"2026-03-17\",
                \"follow_up_notes\":\"รอ PO จากลูกค้า\",
                \"daily_summary\":\"เยี่ยม กฟผ. เสนอ Megger MTO330 2 เครื่อง 285K รอ PO\",
                \"confidence_score\":0.92}"
    }],
    "model": "claude-sonnet-4-20250514",
    "usage": { "input_tokens": 487, "output_tokens": 215 }
  }

                            │
                   Node 5   │  Parse Claude Response (Code node)
                            │  Extracts JSON + merges metadata
                            ▼
  ══════════════════════════════════════════════════════════════════════════════════════
   STAGE 5: Merged Data Object (output of Node 5 — ready for Sheets)
  ══════════════════════════════════════════════════════════════════════════════════════

  {
    "timestamp":        "2026-03-10T09:15:00.000Z",      ◀── from LINE
    "message_id":       "17432856901234",                 ◀── from LINE
    "reply_token":      "a1b2c3d4...",                    ◀── from LINE
    "user_id":          "U4af49...",                      ◀── from LINE
    "raw_message":      "ไปเยี่ยม กฟผ...",                  ◀── from LINE
    "customer_name":    "การไฟฟ้าฝ่ายผลิตฯ (EGAT)",        ◀── from Claude
    "contact_person":   "คุณวิทยา",                        ◀── from Claude
    "product_brand":    "Megger",                         ◀── from Claude
    "product_name":     "MTO330",                         ◀── from Claude
    "quantity":         2,                                ◀── from Claude
    "deal_value_thb":   285000,                           ◀── from Claude
    "activity_type":    "visit",                          ◀── from Claude
    "sales_stage":      "quotation_sent",                 ◀── from Claude
    "payment_status":   "n/a",                            ◀── from Claude
    "follow_up_date":   "2026-03-17",                     ◀── from Claude
    "follow_up_notes":  "รอ PO จากลูกค้า",                  ◀── from Claude
    "daily_summary":    "เยี่ยม กฟผ. เสนอ Megger...",       ◀── from Claude
    "confidence_score": 0.92                              ◀── from Claude
  }

                            │
                   Node 6   │  Confidence Check: 0.92 >= 0.7 ──▶ YES
                            ▼
                            │
                   Node 7   │  Google Sheets: Append Row
                            ▼
  ══════════════════════════════════════════════════════════════════════════════════════
   STAGE 6: Google Sheets Row (what gets written — one row, 17 columns)
  ══════════════════════════════════════════════════════════════════════════════════════

  ┌────────────┬────────────┬─────────┬──────────┬──────────┬─────────┬────────┬─────┐
  │ timestamp  │ message_id │rep_name │ customer │ contact  │ brand   │product │ qty │
  ├────────────┼────────────┼─────────┼──────────┼──────────┼─────────┼────────┼─────┤
  │ 2026-03-10 │ 174328...  │ สมชาย   │ EGAT     │ คุณวิทยา  │ Megger  │ MTO330 │  2  │
  │ T09:15:00Z │            │         │          │          │         │        │     │
  └────────────┴────────────┴─────────┴──────────┴──────────┴─────────┴────────┴─────┘
  ┌──────────┬──────────┬─────────┬─────────────┬──────────────┬────────────┬─────────┐
  │deal_value│ activity │ stage   │ payment     │ follow_up    │ follow_up  │ daily   │
  │ _thb     │ _type    │         │ _status     │ _date        │ _notes     │_summary │
  ├──────────┼──────────┼─────────┼─────────────┼──────────────┼────────────┼─────────┤
  │ 285000   │ visit    │quotation│ n/a         │ 2026-03-17   │ รอ PO      │ เยี่ยม   │
  │          │          │ _sent   │             │              │ จากลูกค้า   │ กฟผ...  │
  └──────────┴──────────┴─────────┴─────────────┴──────────────┴────────────┴─────────┘
  ┌────────────┬──────────────────────────────────────────────────────────────┐
  │ confidence │ raw_message                                                 │
  │ _score     │                                                             │
  ├────────────┼──────────────────────────────────────────────────────────────┤
  │ 0.92       │ ไปเยี่ยม กฟผ. วันนี้ เจอคุณวิทยา เสนอ Megger MTO330 2 เครื่อง... │
  └────────────┴──────────────────────────────────────────────────────────────┘

                            │
                   Node 8   │  LINE Reply — Confirmation
                            ▼
  ══════════════════════════════════════════════════════════════════════════════════════
   STAGE 7: LINE Reply Message (what the rep sees in the group)
  ══════════════════════════════════════════════════════════════════════════════════════

  ┌──────────────────────────────────────────────┐
  │  ATE Sales Bot                               │
  │  ──────────────────────────────────────────  │
  │  ✅ บันทึกแล้ว                                  │
  │  📋 เยี่ยม กฟผ. เสนอ Megger MTO330 2 เครื่อง     │
  │     285K รอ PO                               │
  │                                              │
  │  👤 ลูกค้า: EGAT                               │
  │  📦 สินค้า: Megger MTO330                      │
  │  💰 มูลค่า: ฿285,000                          │
  │  📊 สถานะ: quotation_sent                     │
  │  📅 ติดตาม: 2026-03-17                         │
  └──────────────────────────────────────────────┘
```

---

## Visual: Message Lifecycle — Happy Path vs. Low Confidence Path

```
  ┌──────────────────────────────────────────────────────────────────────────────┐
  │  HAPPY PATH (confidence >= 0.7)          LOW CONFIDENCE PATH (< 0.7)        │
  │  ═══════════════════════════════          ════════════════════════════        │
  │                                                                              │
  │  Rep sends:                              Rep sends:                          │
  │  "ไปเยี่ยม กฟผ วันนี้                       "โทรหา ปตท."                        │
  │   เสนอ Megger MTO330                     (too short / ambiguous)             │
  │   2 เครื่อง 285,000                                                           │
  │   รอ PO สัปดาห์หน้า"                        │                                  │
  │        │                                    │                                │
  │        ▼                                    ▼                                │
  │  ┌──────────────┐                    ┌──────────────┐                        │
  │  │ Claude parses│                    │ Claude parses│                        │
  │  │ score: 0.92  │                    │ score: 0.45  │                        │
  │  └──────┬───────┘                    └──────┬───────┘                        │
  │         │                                   │                                │
  │         ▼                                   ▼                                │
  │  ┌──────────────┐                    ┌───────────────────┐                   │
  │  │  Save to     │                    │  DO NOT save      │                   │
  │  │  Google      │                    │  Ask rep to       │                   │
  │  │  Sheets      │                    │  clarify          │                   │
  │  └──────┬───────┘                    └──────┬────────────┘                   │
  │         │                                   │                                │
  │         ▼                                   ▼                                │
  │  ┌──────────────────┐              ┌─────────────────────────┐               │
  │  │ Reply:           │              │ Reply:                  │               │
  │  │ "✅ บันทึกแล้ว     │              │ "🤔 ไม่แน่ใจข้อมูล        │               │
  │  │  📋 เยี่ยม กฟผ..." │              │  ช่วยส่งข้อมูลเพิ่มเติม     │               │
  │  └──────────────────┘              │  ได้ไหมครับ"              │               │
  │                                    └─────────────────────────┘               │
  │         │                                   │                                │
  │         ▼                                   ▼                                │
  │  Data safely in                      Rep sends a clearer                     │
  │  Sheets. Done.                       message. Workflow                       │
  │                                      runs again.                             │
  └──────────────────────────────────────────────────────────────────────────────┘
```

---

## Visual: System Architecture Overview (How Services Connect)

```
  ┌───────────────────────────────────────────────────────────────────────────────────┐
  │                         SYSTEM ARCHITECTURE                                       │
  └───────────────────────────────────────────────────────────────────────────────────┘

       FIELD                        AUTOMATION                      DATA / REPORTING
    ┌──────────┐               ┌─────────────────┐               ┌──────────────────┐
    │          │   Webhook     │                 │   API call    │                  │
    │  LINE    │──────────────▶│     n8n         │──────────────▶│  Anthropic       │
    │  Group   │   (POST)      │   Workflow      │◀──────────────│  Claude API      │
    │          │               │                 │   JSON resp   │                  │
    │  11 sales│               │  ┌───────────┐  │               └──────────────────┘
    │  reps    │◀──────────────│  │ 9 nodes   │  │
    │          │  Reply API    │  │ (see above│  │   Append row  ┌──────────────────┐
    │  Thai    │  (POST)       │  │  diagram) │  │──────────────▶│  Google Sheets   │
    │  messages│               │  └───────────┘  │               │                  │
    └──────────┘               └─────────────────┘               │  "Sales          │
                                                                 │   Activities"    │
                                                                 │   sheet          │
                                                                 └────────┬─────────┘
                                                                          │
                                                                          │ Data source
                                                                          ▼
                                                                 ┌──────────────────┐
                                                                 │  Google Looker   │
                                                                 │  Studio          │
                                                                 │                  │
                                                                 │  Dashboard for   │
                                                                 │  management      │
                                                                 └──────────────────┘
```

---

## Appendix A: Full Workflow JSON Export

After building and testing the workflow, export it via **Workflow > Download** in n8n. Store the JSON file alongside this document for version control and disaster recovery. The workflow can be re-imported into any n8n instance via **Workflow > Import from File**.

---

## Appendix B: Claude Prompt Tuning Tips

The prompt in Node 4 is the most important configuration in the entire system. Here are tips for improving it during the pilot:

1. **Collect misparse examples.** When Claude gets something wrong, note the original message and what went wrong. Use these to add specific instructions to the prompt.

2. **Add product name aliases.** Reps might say "MIT" instead of "MIT1025" or "มิเตอร์เมกเกอร์" instead of "Megger MIT1025." Add common aliases to the prompt:
   ```
   Common product aliases:
   - MIT = Megger MIT1025 Insulation Tester
   - 87V, 87 five = Fluke 87V Multimeter
   - ถุงมือ Salisbury = Salisbury Insulating Gloves
   - สเปรย์ CRC = CRC Contact Cleaner (unless specified otherwise)
   ```

3. **Add customer aliases.** Thai speakers use many abbreviations:
   ```
   - กฟผ, EGAT = การไฟฟ้าฝ่ายผลิตแห่งประเทศไทย
   - กฟภ, PEA = การไฟฟ้าส่วนภูมิภาค
   - กฟน, MEA = การไฟฟ้านครหลวง
   - ปตท, PTT = บริษัท ปตท. จำกัด (มหาชน)
   ```

4. **Test with real messages.** After the first week of pilot, take 20 real messages and run them through the Claude prompt manually (via the Anthropic Console playground). Review the outputs and refine the prompt.

5. **Consider few-shot examples.** Adding 2-3 example input/output pairs to the prompt can significantly improve accuracy. However, this increases token usage and cost.

---

## Appendix C: Estimated Costs (Lean Tier)

| Service | Calculation | Monthly Cost |
|---|---|---|
| LINE Official Account | Free plan (500 reply messages/month) | ฿0 |
| n8n | Self-hosted on VPS (~$5/mo) or Cloud free tier | ฿0–200 |
| Claude API (Sonnet) | ~30 msgs/day x 30 days = 900 calls. ~500 input + 300 output tokens per call. 900 x 800 tokens = 720K tokens/month. Sonnet: ~$2.16 input + $4.32 output = ~$6.50/month | ฿230 |
| Google Sheets | Free | ฿0 |
| Google Looker Studio | Free | ฿0 |
| **Total** | | **฿200–430/month** |

> Costs increase if you use Claude Opus for higher accuracy or process image/voice messages. For the PoC with text-only messages, the above estimate is conservative.
