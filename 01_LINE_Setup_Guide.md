# LINE Official Account & Messaging API Setup Guide

**Company:** ATE (Advanced Technology Equipment)
**Purpose:** Receive messages from a LINE group via webhook (Vercel serverless integration)
**Date:** 2026-03-10

---

## Setup Journey Overview

Follow each part in order. You can take breaks between parts — just bookmark where you stopped.

```
  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
  │ Part 1  │───→│ Part 2  │───→│ Part 3  │───→│ Part 4  │
  │ Create  │    │Register │    │ Create  │    │  Get    │
  │Official │    │Developer│    │Messaging│    │ Tokens  │
  │ Account │    │ Console │    │   API   │    │& Secret │
  └─────────┘    └─────────┘    └─────────┘    └─────────┘
       ↓                                            │
  ┌─────────┐    ┌─────────┐    ┌─────────┐        │
  │ Part 7  │←───│ Part 6  │←───│ Part 5  │←───────┘
  │  Test   │    │Configure│    │  Set Up │
  │ in LINE │    │Settings │    │ Webhook │
  │  Group  │    │         │    │   URL   │
  └─────────┘    └─────────┘    └─────────┘
       │
       ↓
  ╔═════════╗
  ║  Done!  ║
  ║ Bot is  ║
  ║ working ║
  ╚═════════╝
```

**Estimated time:** 30-45 minutes (first time) / 10 minutes (if you have done it before)

---

## How Everything Connects — The Big Picture

Before we start, here is how all the pieces fit together once setup is complete:

```
 ┌──────────────────────────────────────────────────────────────────────┐
 │                         YOUR LINE GROUP                             │
 │                                                                     │
 │   Salesperson A  ·  Salesperson B  ·  ATE Sales Bot                 │
 │                                                                     │
 │   A salesperson types a message in the group...                     │
 └────────────────────────────────┬─────────────────────────────────────┘
                                  │
                         message event
                                  │
                                  ▼
 ┌──────────────────────────────────────────────────────────────────────┐
 │                     LINE PLATFORM (cloud)                           │
 │                                                                     │
 │   LINE sees the message belongs to a group with a linked            │
 │   Messaging API channel, so it forwards it to your webhook.         │
 └────────────────────────────────┬─────────────────────────────────────┘
                                  │
                     HTTPS POST (JSON payload)
                                  │
                                  ▼
 ┌──────────────────────────────────────────────────────────────────────┐
 │             YOUR VERCEL SERVER (webhook endpoint)                   │
 │                                                                     │
 │   https://your-project.vercel.app/api/webhook                       │
 │                                                                     │
 │   Vercel receives the message, sends it to Gemini AI for parsing,   │
 │   writes structured data to Google Sheets, and replies via LINE.    │
 └──────────────────────────────────────────────────────────────────────┘
```

---

## Prerequisites

- A LINE personal account (used to manage the Official Account)
- Access to a computer (some settings are only available on desktop)
- Your Vercel webhook URL (can be added later — the format is `https://your-project.vercel.app/api/webhook`)

---

## Part 1: Create a LINE Official Account

1. Go to **LINE Official Account Manager**: https://manager.line.biz/
2. Click **Create a LINE Official Account** (or "สร้างบัญชี" if the page is in Thai).
3. Log in with your personal LINE account credentials.
4. Fill in the account information:
   - **Account name:** ATE Sales Report (or your preferred name)
   - **Company/Business name:** Advanced Technology Equipment
   - **Business type:** Select the appropriate category (e.g., "Retail" or "Technology")
   - **Region:** Thailand
5. Agree to the terms of service and complete the creation.
6. You now have a LINE Official Account. Note the **Basic ID** (looks like `@xxx`) shown on the dashboard.

> **Gotcha:** LINE Official Account Manager (manager.line.biz) and LINE Developers Console (developers.line.biz) are two separate portals. You need both. The Official Account Manager is for business settings (auto-reply, greeting, etc.). The Developers Console is for API credentials (tokens, secrets, webhook URL).

---

## Two Portals — Do Not Confuse Them!

This is the #1 source of confusion. You will go back and forth between these two websites.
Here is a map of which settings live where:

```
 ┌──────────────────────────────────┐     ┌──────────────────────────────────┐
 │  LINE OFFICIAL ACCOUNT MANAGER  │     │    LINE DEVELOPERS CONSOLE       │
 │  https://manager.line.biz/      │     │  https://developers.line.biz/    │
 │                                  │     │                                  │
 │  Think of this as the            │     │  Think of this as the            │
 │  "BUSINESS" side                 │     │  "TECHNICAL" side                │
 │                                  │     │                                  │
 │  ┌────────────────────────────┐  │     │  ┌────────────────────────────┐  │
 │  │ Account name & profile    │  │     │  │ Channel Secret             │  │
 │  │ QR code                   │  │     │  │ Channel Access Token       │  │
 │  │ Auto-reply ON/OFF         │  │     │  │ Webhook URL                │  │
 │  │ Greeting message ON/OFF   │  │     │  │ Webhook ON/OFF (again!)    │  │
 │  │ Response mode (Bot/Chat)  │  │     │  │ Bot join groups setting    │  │
 │  │ Webhook ON/OFF            │  │     │  │ Provider management        │  │
 │  └────────────────────────────┘  │     │  └────────────────────────────┘  │
 │                                  │     │                                  │
 │  You come here in:               │     │  You come here in:               │
 │    Part 1, Part 6                │     │    Part 2, Part 3, Part 4,       │
 │                                  │     │    Part 5, Part 6                │
 └──────────────────────────────────┘     └──────────────────────────────────┘
                  │                                      │
                  │          LINKED TOGETHER              │
                  └──────────────┬───────────────────────┘
                                 │
                                 ▼
                  ┌──────────────────────────┐
                  │  Same bot, same account  │
                  │  Two different websites  │
                  │  to manage it            │
                  └──────────────────────────┘

 IMPORTANT: Webhook must be enabled in BOTH portals.
    If you only enable it in one, it will NOT work.
```

---

## Part 2: Register on LINE Developers Console

1. Go to **LINE Developers Console**: https://developers.line.biz/console/
2. Log in with the **same LINE account** you used to create the Official Account.
3. If this is your first time, you will be asked to create a **Developer** profile:
   - Enter your name and email.
   - Accept the developer agreement.
4. Create a **Provider** (this represents your company):
   - Click **Create a New Provider**.
   - Provider name: `ATE` or `Advanced Technology Equipment`.
   - Click **Create**.

```
  What you are building (a mental model):

  ┌─────────────────────────────────────────────────┐
  │  Provider: "ATE"                                │
  │  (represents your company)                      │
  │                                                 │
  │   ┌───────────────────────────────────────────┐ │
  │   │  Channel: "ATE Sales Bot"                 │ │
  │   │  (the Messaging API channel you create    │ │
  │   │   in Part 3 — this is where tokens,       │ │
  │   │   secrets, and webhook URL live)           │ │
  │   └───────────────────────────────────────────┘ │
  │                                                 │
  │   You can add more channels later if needed.    │
  └─────────────────────────────────────────────────┘
```

---

## Part 3: Create a Messaging API Channel

1. Inside your newly created Provider on LINE Developers Console, click **Create a New Channel**.
2. Select **Messaging API** as the channel type.
3. Fill in the channel details:
   - **Channel name:** ATE Sales Bot (or your preferred name)
   - **Channel description:** Webhook bot for receiving LINE group messages
   - **Category:** Choose the closest match (e.g., "Shopping" or "Technology")
   - **Subcategory:** Choose the closest match
   - **Email address:** Your company email
4. Agree to the terms and click **Create**.
5. After creation, you will see your channel dashboard with tabs: Basic settings, Messaging API, etc.

> **Gotcha:** If you already created a LINE Official Account in Part 1, you may see an option to "Link an existing Official Account" instead of creating a brand new one. Choose to link the account you created earlier. This connects the Messaging API channel to your Official Account. If you do not see this option, you can link them later from the Messaging API tab by selecting your Official Account.

```
  After Part 3, your channel dashboard looks like this:

  ┌─────────────────────────────────────────────────────────┐
  │  ATE Sales Bot — Channel Dashboard                      │
  │                                                         │
  │  ┌──────────────┐  ┌───────────────┐  ┌─────────────┐  │
  │  │    Basic      │  │  Messaging    │  │   LINE       │  │
  │  │   settings    │  │     API       │  │  Login       │  │
  │  │              │  │              │  │              │  │
  │  │ Channel ID   │  │ Webhook URL  │  │ (not needed) │  │
  │  │ Channel      │  │ Bot info     │  │              │  │
  │  │  secret  <───┼──┼── Part 4     │  │              │  │
  │  │              │  │ Access       │  │              │  │
  │  │              │  │  token <─────┼──┼── Part 4     │  │
  │  │              │  │ Webhook <────┼──┼── Part 5     │  │
  │  └──────────────┘  └───────────────┘  └─────────────┘  │
  └─────────────────────────────────────────────────────────┘
```

---

## Part 4: Get Channel Access Token and Channel Secret

### Channel Secret

1. In the LINE Developers Console, go to your channel.
2. Click the **Basic settings** tab.
3. Scroll down to **Channel secret** — copy and save this value securely.

### Channel Access Token (Long-lived)

1. Click the **Messaging API** tab.
2. Scroll down to **Channel access token (long-lived)**.
3. Click **Issue** to generate a token.
4. Copy and save this token securely.

> **Important:** Keep both the Channel Secret and Channel Access Token private. Do not commit them to version control or share them publicly.

| Credential | Where to Find | Used For |
|---|---|---|
| Channel Secret | Basic settings tab | Verifying webhook signatures |
| Channel Access Token | Messaging API tab | Authenticating API calls (sending replies, getting group info) |

### Where Each Credential Comes From and Where It Goes

```
  ┌──────────────────────────────────────────────────────────────────┐
  │                   LINE DEVELOPERS CONSOLE                       │
  │                                                                  │
  │  ┌─────────────────────┐      ┌──────────────────────────────┐  │
  │  │  "Basic settings"   │      │     "Messaging API" tab      │  │
  │  │       tab            │      │                              │  │
  │  │                     │      │                              │  │
  │  │   Channel Secret    │      │   Channel Access Token       │  │
  │  │   ════════════      │      │   ════════════════════       │  │
  │  │   (auto-generated)  │      │   (click "Issue" to create)  │  │
  │  │                     │      │                              │  │
  │  └─────────┬───────────┘      └──────────────┬───────────────┘  │
  │            │                                  │                  │
  └────────────┼──────────────────────────────────┼──────────────────┘
               │                                  │
               │    Copy both values carefully    │
               │                                  │
               ▼                                  ▼
  ┌──────────────────────────────────────────────────────────────────┐
  │              VERCEL ENVIRONMENT VARIABLES                        │
  │                                                                  │
  │  ┌──────────────────────────────────────────────────────────┐   │
  │  │  In your Vercel project dashboard > Settings > Env Vars: │   │
  │  │                                                          │   │
  │  │   LINE_CHANNEL_SECRET <──── Channel Secret               │   │
  │  │   LINE_CHANNEL_ACCESS_TOKEN <──── Channel Access Token   │   │
  │  └──────────────────────────────────────────────────────────┘   │
  │                                                                  │
  │  Channel Secret:       Used to VERIFY incoming webhook          │
  │                        messages are really from LINE             │
  │                        (like a password handshake)               │
  │                                                                  │
  │  Channel Access Token: Used when YOUR system wants to           │
  │                        TALK BACK to LINE (send replies,         │
  │                        get user profiles, etc.)                  │
  └──────────────────────────────────────────────────────────────────┘
```

---

## Part 5: Set Up the Webhook URL

1. In the LINE Developers Console, go to your channel's **Messaging API** tab.
2. Scroll to the **Webhook settings** section.
3. Click **Edit** next to Webhook URL.
4. Enter your Vercel webhook URL:
   ```
   https://your-project.vercel.app/api/webhook
   ```
   (Replace `your-project` with your actual Vercel project name.)
5. Click **Update**.
6. Click **Verify** to test the connection. You should see a success message if your Vercel function is deployed and returns HTTP 200.
7. Toggle **Use webhook** to **Enabled** (this is critical — the webhook will not fire if this is off).

> **Gotcha:** The webhook URL must be HTTPS. LINE will not accept HTTP URLs. Vercel provides HTTPS by default, so this is handled automatically.

```
  How the webhook connection works step by step:

            LINE Developers Console
           ┌──────────────────────┐
           │  Webhook URL:        │
           │  https://your-proj.. │ ── You type this in (step 4)
           │                      │
           │  [Verify] button     │ ── LINE sends a test ping (step 6)
           │                      │
           │  Use webhook: [ON]   │ ── Flip this switch! (step 7)
           └──────────┬───────────┘
                      │
         When someone sends a message in a
         LINE group where the bot is a member...
                      │
                      ▼
           ┌──────────────────────┐
           │  LINE Platform sends │
           │  HTTPS POST request  │──────────────────────┐
           │  to your webhook URL │                      │
           └──────────────────────┘                      │
                                                         ▼
                                              ┌──────────────────────┐
                                              │  Vercel serverless   │
                                              │  function            │
                                              │                      │
                                              │  Receives JSON:      │
                                              │  - who sent it       │
                                              │  - what group        │
                                              │  - message text      │
                                              │  - timestamp         │
                                              │                      │
                                              │  Then: AI parse →    │
                                              │  Sheets → LINE reply │
                                              └──────────────────────┘
```

---

## Part 6: Configure Important Account Settings

These settings are done in the **LINE Official Account Manager** (not the Developers Console).

```
  You are now switching websites!

  FROM: developers.line.biz  (Developers Console)
    TO: manager.line.biz     (Official Account Manager)

  ┌──────────────────────┐         ┌──────────────────────┐
  │ Developers Console   │  ──→    │ Official Account Mgr │
  │ (technical settings) │  SWITCH │ (business settings)  │
  └──────────────────────┘         └──────────────────────┘
```

### Disable Auto-Reply Messages

1. Go to https://manager.line.biz/ and select your account.
2. Click **Settings** (gear icon) in the sidebar, or go to **Response settings**.
3. Under **Response mode**, select **Bot** (not Chat).
4. Set **Auto-response** to **Disabled**.
5. Set **Greeting message** to **Disabled** — unless you want a welcome message.

> **Why:** If auto-reply is on, every message to the group will trigger a canned response from the bot, which is annoying and confusing for group members. The Vercel webhook function handles all replies itself.

```
  What happens if you forget to disable auto-reply:

  ┌───────────────────────────────────────────────┐
  │  LINE Group Chat                              │
  │                                               │
  │  Somchai:  Sold 5 units of Model X today      │
  │  Bot:  ขอบคุณสำหรับข้อความ!                    │  <- annoying!
  │  Somchai:  Customer: ABC Co., Ltd.            │
  │  Bot:  ขอบคุณสำหรับข้อความ!                    │  <- very annoying!
  │  Somchai:  ...                                │
  │  Bot:  ขอบคุณสำหรับข้อความ!                    │  <- everyone leaves
  │                                               │
  └───────────────────────────────────────────────┘

  What it should look like (auto-reply OFF, Vercel webhook active):

  ┌───────────────────────────────────────────────┐
  │  LINE Group Chat                              │
  │                                               │
  │  Somchai:  ไปเยี่ยม PTT เสนอ Megger 150K      │
  │  Bot:  รับทราบครับ บันทึกแล้ว:                  │
  │        - ลูกค้า: PTT                           │
  │        - สินค้า: Megger                        │
  │        - มูลค่า: 150,000                       │
  │                                               │
  └───────────────────────────────────────────────┘
```

### Enable Webhooks (Double-Check)

1. Still in LINE Official Account Manager > **Settings** > **Response settings**.
2. Ensure **Webhook** is set to **Enabled**.

> **Gotcha:** There are TWO places to enable webhooks — one in the LINE Developers Console (Part 5, step 7) and one in the LINE Official Account Manager (here). Both must be enabled for webhooks to work. This is the most common cause of "webhook not receiving events."

```
  Both switches must be ON for webhooks to work:

  ┌─────────────────────────────┐    ┌─────────────────────────────┐
  │  LINE Developers Console    │    │  LINE Official Account Mgr  │
  │                             │    │                             │
  │  Webhook: [ON]              │    │  Webhook: [ON]              │
  └──────────────┬──────────────┘    └──────────────┬──────────────┘
                 │                                  │
                 └───────────┬──────────────────────┘
                             │
                     BOTH must be ON
                             │
                 ┌───────────┴───────────┐
                 │                       │
           ┌─────┴─────┐          ┌─────┴─────┐
           │ Both ON   │          │ One or    │
           │ = works!  │          │ both OFF  │
           │           │          │ = broken! │
           └───────────┘          └───────────┘
```

### Allow Bot to Join Groups

1. In the LINE Developers Console, go to your channel's **Messaging API** tab.
2. Scroll to **LINE Official Account features**.
3. Click the link to open the feature settings in LINE Official Account Manager.
4. Find **Allow bot to join groups and multi-person chats**.
5. Set this to **Enabled**.

> **Gotcha:** This setting defaults to disabled. If you skip this, you will not be able to add the bot to any group.

---

## Part 7: Add the Bot to a LINE Group for Testing

1. Open the LINE app on your phone.
2. Add the bot as a friend:
   - Search for the bot by its **Basic ID** (e.g., `@xxx`), or
   - Scan the **QR code** from the LINE Official Account Manager dashboard.
3. Create a test LINE group (or use an existing one).
4. Open the group > tap the group name at the top > **Invite** > search for your bot's name > **Add**.
5. The bot should now appear as a member of the group.

```
  Step-by-step on your phone:

  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐
  │  Step 1  │   │  Step 2  │   │  Step 3  │   │  Step 4  │
  │          │   │          │   │          │   │          │
  │ Add bot  │──→│ Open or  │──→│ Tap      │──→│ Search & │
  │ as friend│   │ create a │   │ "Invite" │   │ add the  │
  │ (via QR  │   │ LINE     │   │ in group │   │ bot to   │
  │  or @ID) │   │ group    │   │ settings │   │ group    │
  │          │   │          │   │          │   │          │
  └──────────┘   └──────────┘   └──────────┘   └──────────┘
```

### Verify the Webhook Is Working

1. Send a test message in the LINE group (e.g., a simple sales report in Thai).
2. Check if the bot replies with a confirmation message — this means the full pipeline is working (LINE → Vercel → Gemini → Sheets → LINE reply).
3. Check your Google Sheet — you should see a new row with the parsed data.
4. If you need to debug, check the Vercel function logs: go to your Vercel dashboard > your project > **Deployments** > click the latest deployment > **Functions** > **Logs**.

The webhook payload from LINE includes:
   - `events[0].type` — should be `message`
   - `events[0].source.groupId` — the LINE group ID (save this, you will need it)
   - `events[0].source.userId` — the sender's user ID
   - `events[0].message.text` — the message content

> **Note:** The bot can read ALL messages in a group once it has joined — group message events are sent to the webhook automatically. However, the bot will not see messages sent before it joined.

```
  What the webhook payload looks like (simplified):

  ┌──────────────────────────────────────────────────────┐
  │  Incoming POST to your Vercel function               │
  │                                                      │
  │  {                                                   │
  │    "events": [                                       │
  │      {                                               │
  │        "type": "message",  <-- type of event         │
  │        "source": {                                   │
  │          "groupId": "C4af4...", <-- SAVE THIS!       │
  │          "userId": "U1a2b..."   <-- who sent it      │
  │        },                                            │
  │        "message": {                                  │
  │          "type": "text",                             │
  │          "text": "Sold 5 units..." <-- the message   │
  │        }                                             │
  │      }                                               │
  │    ]                                                 │
  │  }                                                   │
  └──────────────────────────────────────────────────────┘
```

---

## Part 8: Summary of URLs and Portals

| Portal | URL | Purpose |
|---|---|---|
| LINE Official Account Manager | https://manager.line.biz/ | Business settings, auto-reply, response mode |
| LINE Developers Console | https://developers.line.biz/console/ | API credentials, webhook URL, technical settings |
| Vercel Dashboard | https://vercel.com/dashboard | Function logs, environment variables, deployments |
| Messaging API Docs | https://developers.line.biz/en/docs/messaging-api/ | API reference and event documentation |
| Webhook Event Reference | https://developers.line.biz/en/reference/messaging-api/#webhook-event-objects | Payload structure for incoming events |

---

## Quick Reference: Credentials to Save

Record these values and store them securely (in Vercel environment variables and/or a password manager):

```
LINE_CHANNEL_SECRET=<from Part 4>
LINE_CHANNEL_ACCESS_TOKEN=<from Part 4>
LINE_GROUP_ID=<from Part 7 webhook test payload>
WEBHOOK_URL=https://your-project.vercel.app/api/webhook
```

```
  Where each credential comes from — a quick reminder:

  ┌────────────────────────┬────────────────────────────────────────────┐
  │  Credential            │  Where you got it                         │
  ├────────────────────────┼────────────────────────────────────────────┤
  │                        │                                            │
  │  LINE_CHANNEL_SECRET   │  Developers Console → Basic settings tab  │
  │                        │  (auto-generated, just copy it)           │
  │                        │                                            │
  │  LINE_CHANNEL_ACCESS   │  Developers Console → Messaging API tab   │
  │  _TOKEN                │  (click "Issue" first, then copy)         │
  │                        │                                            │
  │  LINE_GROUP_ID         │  From the webhook test payload in Part 7  │
  │                        │  (events[0].source.groupId)               │
  │                        │                                            │
  │  WEBHOOK_URL           │  Your Vercel deployment URL               │
  │                        │  (https://your-project.vercel.app/api/    │
  │                        │   webhook)                                │
  │                        │                                            │
  │   All credentials go   │                                            │
  │   into Vercel env vars │                                            │
  └────────────────────────┴────────────────────────────────────────────┘
```

---

## Common Pitfalls Checklist

- [ ] Webhook enabled in **both** LINE Developers Console AND LINE Official Account Manager
- [ ] Auto-reply is **disabled** (otherwise the bot spams the group)
- [ ] Bot is allowed to **join groups** (otherwise invite fails silently)
- [ ] Webhook URL is **HTTPS** (Vercel provides this by default)
- [ ] Channel Access Token has been **issued** (not just displayed as empty)
- [ ] Response mode is set to **Bot** (not Chat — Chat mode disables webhooks)
- [ ] Bot has been **added as a friend** before being invited to a group

### Visual Progress Tracker

Use this to track your progress. Mark each box when you have verified the setting.

```
  ╔═══════════════════════════════════════════════════════════════════════╗
  ║                     SETUP VERIFICATION CHECKLIST                    ║
  ║                                                                     ║
  ║  Go through each item after completing setup. ALL must pass.        ║
  ╠═══════════════════════════════════════════════════════════════════════╣
  ║                                                                     ║
  ║  1. WEBHOOK ENABLED (two places!)                                   ║
  ║     ┌────────────────────────────────┐                              ║
  ║     │ [ ] Developers Console         │  <- Part 5, step 7           ║
  ║     │ [ ] Official Account Manager   │  <- Part 6, "Enable Webhooks"║
  ║     └────────────────────────────────┘                              ║
  ║     Both must be ON, or nothing works.                              ║
  ║                                                                     ║
  ║  2. AUTO-REPLY DISABLED                                             ║
  ║     ┌────────────────────────────────┐                              ║
  ║     │ [ ] Auto-response = OFF        │  <- Part 6, step 4           ║
  ║     └────────────────────────────────┘                              ║
  ║     If ON, bot replies to every message with a default text.        ║
  ║                                                                     ║
  ║  3. BOT CAN JOIN GROUPS                                             ║
  ║     ┌────────────────────────────────┐                              ║
  ║     │ [ ] Join groups = Enabled      │  <- Part 6, "Allow Bot..."   ║
  ║     └────────────────────────────────┘                              ║
  ║     Default is OFF. Must turn ON or bot cannot join groups.         ║
  ║                                                                     ║
  ║  4. WEBHOOK URL IS HTTPS                                            ║
  ║     ┌────────────────────────────────┐                              ║
  ║     │ [ ] URL starts with https://   │  <- Part 5, step 4           ║
  ║     └────────────────────────────────┘                              ║
  ║     Vercel provides HTTPS by default.                               ║
  ║                                                                     ║
  ║  5. ACCESS TOKEN ISSUED                                             ║
  ║     ┌────────────────────────────────┐                              ║
  ║     │ [ ] Token is not blank/empty   │  <- Part 4, "Issue" button   ║
  ║     └────────────────────────────────┘                              ║
  ║     You must click "Issue" -- the field is empty by default.        ║
  ║                                                                     ║
  ║  6. RESPONSE MODE = BOT                                             ║
  ║     ┌────────────────────────────────┐                              ║
  ║     │ [ ] Response mode = "Bot"      │  <- Part 6, step 3           ║
  ║     └────────────────────────────────┘                              ║
  ║     "Chat" mode disables webhooks entirely.                         ║
  ║                                                                     ║
  ║  7. BOT ADDED AS FRIEND                                             ║
  ║     ┌────────────────────────────────┐                              ║
  ║     │ [ ] Bot is your LINE friend    │  <- Part 7, step 2           ║
  ║     └────────────────────────────────┘                              ║
  ║     Add as friend first, THEN invite to group.                      ║
  ║                                                                     ║
  ╠═══════════════════════════════════════════════════════════════════════╣
  ║                                                                     ║
  ║  ALL 7 CHECKED?  -->  Send a test message in the group.             ║
  ║                       If the bot replies with a confirmation        ║
  ║                       and data appears in Google Sheets, you        ║
  ║                       are done!                                     ║
  ║                                                                     ║
  ╚═══════════════════════════════════════════════════════════════════════╝
```

---

## Troubleshooting Quick Guide

If something is not working, use this diagram to narrow down the problem:

```
  Start here: "I sent a message in the LINE group but nothing happened."
                                    │
                                    ▼
                   ┌────────────────────────────────┐
                   │  Is the bot a member of the    │
                   │  group?                        │
                   └──────────┬─────────────────────┘
                              │
                    Yes       │        No
                  ┌───────────┴──────────────┐
                  │                          │
                  ▼                          ▼
    ┌──────────────────────┐    ┌──────────────────────────────┐
    │ Is webhook enabled   │    │ Did you enable "Allow bot    │
    │ in BOTH portals?     │    │ to join groups"? (Part 6)    │
    │ (Part 5 + Part 6)   │    │                              │
    └──────────┬───────────┘    │ Also: did you add the bot   │
               │                │ as a friend first? (Part 7)  │
     Yes       │       No      └──────────────────────────────┘
   ┌───────────┴──────────┐
   │                      │
   ▼                      ▼
  ┌──────────────────┐   ┌──────────────────────────────┐
  │ Is Response mode │   │ Turn on webhook in the       │
  │ set to "Bot"?    │   │ portal where it is off.      │
  │ (not "Chat")     │   │ See Part 5 step 7 and        │
  └────────┬─────────┘   │ Part 6 "Enable Webhooks."    │
           │              └──────────────────────────────┘
   Yes     │      No
  ┌────────┴──────────┐
  │                   │
  ▼                   ▼
 ┌──────────────────┐  ┌──────────────────────────────┐
 │ Check Vercel:    │  │ Change to "Bot" mode in      │
 │                  │  │ Official Account Manager     │
 │ 1. Is the       │  │ > Settings > Response mode.  │
 │ function        │  └──────────────────────────────┘
 │ deployed?       │
 │                  │
 │ 2. Check logs:  │
 │ Vercel dashboard│
 │ > Deployments   │
 │ > Functions     │
 │ > Logs          │
 │                  │
 │ 3. Are env vars │
 │ set correctly?  │
 │ (LINE_CHANNEL_  │
 │ SECRET, etc.)   │
 └──────────────────┘
```
