# OpenClaw Gateway Setup Guide — ATE Sales Report System

> **Company:** Advanced Technology Equipment Co., Ltd. (ATE)
> **Purpose:** Self-hosted AI gateway that connects the LINE sales group to Claude for automated report parsing
> **Architecture Role:** Replaces both the LINE webhook wiring and n8n workflow engine (Alternative B in the proposal)
> **Date:** 2026-03-10

---

## Architecture Overview — OpenClaw as the Central Gateway

```
                        ATE Sales Report System — High-Level Architecture
  ┌─────────────────────────────────────────────────────────────────────────────────┐
  │                                                                                 │
  │   ┌──────────────┐         ┌──────────────────────────┐        ┌─────────────┐  │
  │   │              │  LINE   │                          │ Claude │             │  │
  │   │  Sales Reps  │ Webhook │   OpenClaw Gateway       │  API   │  Anthropic  │  │
  │   │  (LINE App)  ├────────►│                          ├───────►│  Claude AI  │  │
  │   │              │◄────────┤  - Receives messages     │◄───────┤             │  │
  │   │  11 field    │  Reply  │  - Routes to Claude      │  JSON  │  Sonnet 4   │  │
  │   │  reps in TH  │         │  - Manages sessions      │        │  (fallback: │  │
  │   │              │         │  - Sends confirmations    │        │   Haiku 3.5)│  │
  │   └──────────────┘         │                          │        └─────────────┘  │
  │                            └──────────┬───┬───────────┘                         │
  │                                       │   │                                     │
  │                           ┌───────────┘   └───────────┐                         │
  │                           │                           │                         │
  │                           ▼                           ▼                         │
  │                  ┌─────────────────┐        ┌──────────────────┐                │
  │                  │   Database      │        │   Control UI     │                │
  │                  │                 │        │                  │                │
  │                  │  Google Sheets  │        │  Browser-based   │                │
  │                  │  (Lean tier)    │        │  dashboard for   │                │
  │                  │       or        │        │  monitoring &    │                │
  │                  │  Supabase       │        │  configuration   │                │
  │                  │  (Mid tier)     │        │                  │                │
  │                  └─────────────────┘        └──────────────────┘                │
  │                                                                                 │
  └─────────────────────────────────────────────────────────────────────────────────┘
```

**How it works in one sentence:** A sales rep sends a Thai message in the LINE group, OpenClaw receives it via webhook, sends it to Claude for parsing, writes the structured data to the database, and replies with a Thai confirmation -- all automatically.

---

## Setup Roadmap

```
  ┌──────────────────────────────────────────────────────────────────────────────┐
  │                         OpenClaw Setup Roadmap                               │
  │                                                                              │
  │  STEP 1          STEP 2          STEP 3          STEP 4                     │
  │ ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────────┐              │
  │ │Prereq-   │   │Install & │   │LINE      │   │Agent Config  │              │
  │ │uisites   │──►│Initial   │──►│Channel   │──►│Claude +      │              │
  │ │          │   │Setup     │   │Config    │   │System Prompt │              │
  │ │- Node 22 │   │          │   │          │   │              │              │
  │ │- VPS     │   │- npm     │   │- Plugin  │   │- Model setup │              │
  │ │- API key │   │- onboard │   │- Creds   │   │- Skills      │              │
  │ │- LINE OA │   │- verify  │   │- Webhook │   │- Sessions    │              │
  │ │- Domain  │   │- daemon  │   │- Access  │   │- Rich msgs   │              │
  │ └──────────┘   └──────────┘   └──────────┘   └──────┬───────┘              │
  │                                                      │                      │
  │                                                      ▼                      │
  │                 STEP 6          STEP 5                                       │
  │               ┌──────────┐   ┌──────────────┐                               │
  │               │Test &    │   │Database      │                               │
  │               │Go Live   │◄──│Integration   │                               │
  │               │          │   │              │                               │
  │               │- Control │   │- Sheets or   │                               │
  │               │  UI test │   │  Supabase    │                               │
  │               │- LINE    │   │- Writer      │                               │
  │               │  group   │   │  scripts     │                               │
  │               │- DB rows │   │- Skill       │                               │
  │               │- Deploy  │   │  registration│                               │
  │               └──────────┘   └──────────────┘                               │
  │                                                                              │
  │  Estimated time: 2-4 hours for a developer familiar with Node.js             │
  └──────────────────────────────────────────────────────────────────────────────┘
```

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Installation & Initial Setup](#2-installation--initial-setup)
3. [LINE Channel Configuration](#3-line-channel-configuration)
4. [Agent Configuration — Claude for Sales Parsing](#4-agent-configuration--claude-for-sales-parsing)
5. [Database Integration](#5-database-integration)
6. [Hosting & Deployment](#6-hosting--deployment)
7. [Testing](#7-testing)
8. [Monitoring & Maintenance](#8-monitoring--maintenance)
9. [Comparison: OpenClaw vs n8n](#9-comparison-openclaw-vs-n8n)

---

## A Note on Documentation Sources

This guide is based on information retrieved from the official OpenClaw documentation at https://docs.openclaw.ai, including the main overview, LINE channel plugin reference, getting started guide, configuration reference, installation guide, Docker deployment guide, skills system, and Anthropic provider pages. Where the docs are unclear or where implementation details must be inferred, those sections are marked with:

> **[Assumption]** — This detail is inferred from the general architecture and may differ. Check the latest docs.

The `llms.txt` index at `https://docs.openclaw.ai/llms.txt` provides a comprehensive page listing of all available documentation.

---

## 1. Prerequisites

Before starting, ensure you have:

- [ ] **Node.js 22 or later** — verify with `node --version`
  - Install via: `curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -` or your package manager
- [ ] **A VPS or server** with a public IP and HTTPS capability (see [Section 6](#6-hosting--deployment) for recommendations)
- [ ] **Anthropic API key** from [Anthropic Console](https://console.anthropic.com/)
  - At least $5 credit loaded
  - Note your API key (`sk-ant-...`)
- [ ] **LINE Official Account + Messaging API channel** — already created per [01_LINE_Setup_Guide.md](./01_LINE_Setup_Guide.md)
  - Channel Access Token (long-lived) generated
  - Channel Secret noted
  - Webhook URL ready to update (you will get the URL from OpenClaw)
- [ ] **Claude prompt design** ready per [02_Claude_API_Prompt_Design.md](./02_Claude_API_Prompt_Design.md)
- [ ] **Domain name or static IP** with SSL certificate (LINE requires HTTPS for webhooks)
  - Free option: [Let's Encrypt](https://letsencrypt.org/) via Certbot or Caddy reverse proxy
- [ ] **Google Sheets** set up per [03_Google_Sheets_Template.md](./03_Google_Sheets_Template.md) (for Lean tier)
  - Or **Supabase** project created (for Mid tier)

---

## 2. Installation & Initial Setup

### 2a. Install OpenClaw

**Option 1 — Installer script (recommended by OpenClaw docs):**

```bash
# macOS / Linux / WSL2
curl -fsSL https://openclaw.ai/install.sh | bash
```

```powershell
# Windows (PowerShell)
iwr -useb https://openclaw.ai/install.ps1 | iex
```

**Option 2 — npm global install (if Node 22+ already installed):**

```bash
npm install -g openclaw@latest
```

> If you encounter sharp build errors during npm install, set:
> ```bash
> SHARP_IGNORE_GLOBAL_LIBVIPS=1 npm install -g openclaw@latest
> ```

**Option 3 — pnpm:**

```bash
pnpm add -g openclaw@latest
pnpm approve-builds -g   # Authorize build scripts
```

**Option 4 — Docker (for containerized deployments):**

See [Section 6c](#6c-docker-deployment) below.

### 2b. Run the Onboarding Wizard

The onboarding wizard configures authentication, gateway settings, and optional channels:

```bash
openclaw onboard --install-daemon
```

During onboarding, you will be prompted for:
- **Anthropic API key** — enter your `sk-ant-...` key
- **Gateway port** — accept the default `18789` or choose another
- **Channel setup** — you can skip channels during onboarding and configure LINE separately (next section)

The `--install-daemon` flag sets up OpenClaw as a background service so it survives terminal closure.

### 2c. Verify the Installation

```bash
# System diagnostics
openclaw doctor

# Check gateway status
openclaw gateway status

# Open the browser-based Control UI
openclaw dashboard
```

The Control UI opens at `http://127.0.0.1:18789/` — you can chat with the AI agent here to verify it works before connecting LINE. Per the docs, the Control UI provides immediate chat functionality without requiring any channel setup.

### 2d. Configuration File Location

OpenClaw stores its configuration at:

```
~/.openclaw/openclaw.json          # Main config (JSON5 format — comments & trailing commas OK)
~/.openclaw/workspace/             # Skills, prompts, memories
~/.openclaw/credentials/           # Channel credentials (auto-managed)
~/.openclaw/agents/<agentId>/      # Per-agent sessions and auth profiles
```

**Environment variables** for customizing paths:

| Variable | Purpose |
|----------|---------|
| `OPENCLAW_HOME` | Override home directory for all OpenClaw data |
| `OPENCLAW_STATE_DIR` | Override state directory location |
| `OPENCLAW_CONFIG_PATH` | Override config file path |

**Logs** are stored at `/tmp/openclaw/` by default.

---

## 3. LINE Channel Configuration

### How OpenClaw's LINE Plugin Replaces Manual Webhook + n8n Wiring

```
  BEFORE (n8n approach — Alternative A):
  ══════════════════════════════════════

  ┌─────────┐    ┌────────────────┐    ┌─────────────────────────────────────┐
  │  LINE   │    │   Your Server  │    │              n8n                    │
  │  Group  ├───►│   (webhook     ├───►│  ┌─────────┐  ┌──────────────────┐ │
  │         │    │    endpoint)   │    │  │Webhook  ├─►│Verify Signature  │ │
  └─────────┘    └────────────────┘    │  │Node     │  │(Code Node)       │ │
                                       │  └─────────┘  └────────┬─────────┘ │
       You must manually:              │                        │           │
       - Set up webhook server         │               ┌────────▼─────────┐ │
       - Verify HMAC signatures        │               │Parse Payload     │ │
       - Parse LINE event payloads     │               │(Code Node)       │ │
       - Build Claude API calls        │               └────────┬─────────┘ │
       - Format LINE reply JSON        │                        │           │
       - Handle errors & retries       │               ┌────────▼─────────┐ │
                                       │               │Call Claude API   │ │
                                       │               │(HTTP Request)    │ │
                                       │               └────────┬─────────┘ │
                                       │                        │           │
                                       │               ┌────────▼─────────┐ │
                                       │               │Write to Sheets   │ │
                                       │               │(Google Sheets)   │ │
                                       │               └────────┬─────────┘ │
                                       │                        │           │
                                       │               ┌────────▼─────────┐ │
                                       │               │Reply to LINE     │ │
                                       │               │(HTTP Request)    │ │
                                       │               └──────────────────┘ │
                                       └─────────────────────────────────────┘
                                       5-8 nodes to configure manually


  AFTER (OpenClaw approach — Alternative B):
  ══════════════════════════════════════════

  ┌─────────┐    ┌──────────────────────────────────────────────────┐
  │  LINE   │    │              OpenClaw Gateway                    │
  │  Group  ├───►│                                                  │
  │         │◄───┤  All handled automatically:                      │
  └─────────┘    │   - Webhook endpoint      ─┐                    │
                 │   - HMAC verification       │                    │
                 │   - Payload parsing          ├─ LINE Plugin      │
                 │   - Reply formatting         │  (1 install)      │
                 │   - Flex Messages           ─┘                    │
                 │   - Claude API routing     ── Agent Config       │
                 │   - Session memory         ── Built-in           │
                 │   - DB writes              ── Skill Script       │
                 │                                                  │
                 └──────────────────────────────────────────────────┘
                 1 tool, config-driven — no workflow nodes to wire
```

### 3a. Install the LINE Plugin

LINE is a plugin channel in OpenClaw (not bundled by default like WhatsApp/Telegram/Discord). Install it:

```bash
openclaw plugins install @openclaw/line
```

Or from a local git checkout:

```bash
openclaw plugins install ./extensions/line
```

### 3b. LINE Prerequisites (from the OpenClaw LINE docs)

These steps align with what you have already done in [01_LINE_Setup_Guide.md](./01_LINE_Setup_Guide.md):

1. Create a LINE Developers account and access the Console at https://developers.line.biz/console/
2. Create a Provider and add a Messaging API channel
3. Retrieve the **Channel Access Token** and **Channel Secret** from channel settings
4. Enable webhook functionality in Messaging API settings
5. Configure the webhook URL pointing to your gateway (HTTPS mandatory): `https://your-server-domain.com/line/webhook`

The gateway handles both webhook verification requests (GET) and incoming events (POST).

### 3c. Configure LINE Credentials

Edit `~/.openclaw/openclaw.json` to add the LINE channel configuration:

**Minimal setup** (from the official docs):

```json5
{
  channels: {
    line: {
      enabled: true,
      channelAccessToken: "TOKEN",
      channelSecret: "SECRET",
      dmPolicy: "pairing",
    },
  },
}
```

**Full ATE configuration** with access control:

```json5
{
  channels: {
    line: {
      enabled: true,
      channelAccessToken: "YOUR_LINE_CHANNEL_ACCESS_TOKEN",
      channelSecret: "YOUR_LINE_CHANNEL_SECRET",

      // DM policy — who can message the bot directly
      dmPolicy: "disabled",        // No DMs — group only for ATE

      // Group policy — accept messages from LINE groups
      groupPolicy: "allowlist",    // Only designated groups

      // Group allowlist — restrict to your ATE sales group only
      groupAllowFrom: [
        "Cxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"  // Your ATE sales group ID
      ],

      // Max media download size (for photos of quotations)
      mediaMaxMb: 10,  // Default is 10 MB
    },
  },
}
```

**Alternative: Use environment variables** instead of hardcoding secrets:

```json5
{
  channels: {
    line: {
      enabled: true,
      channelAccessToken: "${LINE_CHANNEL_ACCESS_TOKEN}",
      channelSecret: "${LINE_CHANNEL_SECRET}",
      dmPolicy: "disabled",
      groupPolicy: "allowlist",
    },
  },
}
```

Then set the environment variables in your shell profile or `.env` file:

```bash
export LINE_CHANNEL_ACCESS_TOKEN="your-token-here"
export LINE_CHANNEL_SECRET="your-secret-here"
```

**Alternative: Use file-based secrets** (most secure for production, per the docs):

```json5
{
  channels: {
    line: {
      tokenFile: "/etc/openclaw/secrets/line-token.txt",
      secretFile: "/etc/openclaw/secrets/line-secret.txt",
    },
  },
}
```

### 3d. Set the Webhook URL in LINE Developers Console

1. Go to [LINE Developers Console](https://developers.line.biz/console/)
2. Navigate to your Provider > Messaging API channel > Messaging API tab
3. Set the **Webhook URL** to:

```
https://your-server-domain.com/line/webhook
```

> **IMPORTANT:** LINE requires HTTPS. If using a reverse proxy like Caddy or Nginx, ensure SSL termination is configured before the OpenClaw gateway port. See [Section 6](#6-hosting--deployment).

4. Click **Verify** to confirm the webhook is reachable
5. Enable **Use webhook** toggle

LINE uses HMAC-based signature verification on the raw request body using your Channel Secret. OpenClaw handles this verification automatically.

> **Multiple LINE accounts** — if you want separate testing and production accounts, OpenClaw supports multi-account config:
>
> ```json5
> {
>   channels: {
>     line: {
>       accounts: {
>         production: {
>           channelAccessToken: "...",
>           channelSecret: "...",
>           webhookPath: "/line/production",
>         },
>         testing: {
>           channelAccessToken: "...",
>           channelSecret: "...",
>           webhookPath: "/line/testing",
>         },
>       },
>     },
>   },
> }
> ```

### 3e. Access Control — Securing the Bot

For ATE, the bot should only respond in the designated sales reporting group.

**DM Policies** (`dmPolicy`) — per the OpenClaw LINE docs:

| Policy | Behavior | ATE Recommendation |
|--------|----------|-------------------|
| `pairing` | Unknown senders receive a pairing code; messages ignored until approved | Good for controlled rollout |
| `allowlist` | Only specified USER_IDs can DM | Use if you want reps to DM the bot too |
| `open` | Anyone can DM | Not recommended for production |
| `disabled` | DMs blocked entirely | **Recommended for ATE** — group-only |

**Group Policies** (`groupPolicy`):

| Policy | Behavior | ATE Recommendation |
|--------|----------|-------------------|
| `allowlist` | Only messages from allowlisted groups | **Recommended for ATE** |
| `open` | All group messages accepted | Not recommended |
| `disabled` | Group messages blocked | Use if DM-only |

```
  Access Control Policy Decision Tree
  ════════════════════════════════════

  Should the bot respond to Direct Messages (DMs)?
  │
  ├── NO (group-only operation)
  │   └── dmPolicy: "disabled"  ◄── RECOMMENDED FOR ATE
  │
  └── YES
      │
      ├── Only known users?
      │   ├── YES, specific USER_IDs ──► dmPolicy: "allowlist"
      │   └── YES, via approval flow ──► dmPolicy: "pairing"
      │
      └── Anyone can DM?
          └── dmPolicy: "open"  (not recommended)


  Should the bot respond in LINE Groups?
  │
  ├── YES
  │   ├── Only specific groups?
  │   │   └── groupPolicy: "allowlist"  ◄── RECOMMENDED FOR ATE
  │   │       + groupAllowFrom: ["Cxxx..."]
  │   │
  │   └── Any group it is added to?
  │       └── groupPolicy: "open"  (not recommended)
  │
  └── NO (DM-only)
      └── groupPolicy: "disabled"


  ATE Recommended Configuration:
  ┌─────────────────────────────────────────────────────────┐
  │  dmPolicy:    "disabled"    ── Block all DMs            │
  │  groupPolicy: "allowlist"   ── Only ATE sales group     │
  │  groupAllowFrom: ["Cxxx"]  ── Your group ID            │
  └─────────────────────────────────────────────────────────┘
```

**Access control configuration options** (from the docs):

| Config Key | Purpose |
|-----------|---------|
| `channels.line.allowFrom` | USER_IDs allowed for DM allowlist |
| `channels.line.groupAllowFrom` | USER_IDs allowed for group messages |
| `channels.line.groups.<groupId>.allowFrom` | Per-group overrides |
| `channels.line.groups."*".requireMention` | Require @mention in all groups |

**Managing pairing codes** (if using `pairing` policy):

```bash
# List pending pairing requests
openclaw pairing list line

# Approve a specific pairing code
openclaw pairing approve line <CODE>
```

**LINE ID format reference** (from the docs — IDs are case-sensitive):

| Type | Format | Example |
|------|--------|---------|
| User ID | U + 32 hex characters | `U1234567890abcdef1234567890abcdef` |
| Group ID | C + 32 hex characters | `C1234567890abcdef1234567890abcdef` |
| Room ID | R + 32 hex characters | `R1234567890abcdef1234567890abcdef` |

### 3f. LINE Message Handling Details

Key behaviors documented in the LINE plugin reference:

| Feature | Detail |
|---------|--------|
| **Text chunking** | Long responses are chunked at 5,000 characters |
| **Markdown** | Formatting stripped; code blocks and tables convert to Flex cards when feasible |
| **Streaming** | Responses buffered with loading animation during agent processing |
| **Media** | Downloads capped by `channels.line.mediaMaxMb` (default: 10 MB) |
| **Supported** | Direct messages, group chats, media (images/video/audio), locations, Flex messages, template messages, quick replies |
| **Not supported** | Reactions, threads |

---

## 4. Agent Configuration — Claude for Sales Parsing

This is the core of the system: configuring the OpenClaw agent to receive LINE messages, route them to Claude for parsing, extract structured JSON, and send a confirmation reply back to the LINE group.

### Multi-Agent Routing — Specialized Agents for Different Tasks

```
  ┌─────────────────────────────────────────────────────────────────────────┐
  │                     Multi-Agent Routing (Future)                        │
  │                                                                         │
  │  For Phase 1 (PoC), a single agent handles everything.                 │
  │  For Phase 2+, you can split into specialized agents:                  │
  │                                                                         │
  │                    ┌──────────────────────┐                             │
  │                    │   Incoming LINE Msg  │                             │
  │                    └──────────┬───────────┘                             │
  │                               │                                         │
  │                    ┌──────────▼───────────┐                             │
  │                    │   OpenClaw Router    │                             │
  │                    │   (message analysis) │                             │
  │                    └───┬──────┬───────┬───┘                             │
  │                        │      │       │                                 │
  │              ┌─────────▼┐  ┌──▼─────┐ ┌▼──────────┐                    │
  │              │  Visit   │  │ Sales  │ │ Follow-up │                    │
  │              │  Agent   │  │ Agent  │ │ Agent     │                    │
  │              │          │  │        │ │           │                    │
  │              │ Handles: │  │Handles:│ │ Handles:  │                    │
  │              │ - Site   │  │- Quotes│ │ - PO      │                    │
  │              │   visits │  │- Deals │ │   tracking│                    │
  │              │ - Demos  │  │- Orders│ │ - Remind  │                    │
  │              │ - Photos │  │- Close │ │   reps    │                    │
  │              └─────┬────┘  └───┬────┘ └────┬──────┘                    │
  │                    │           │            │                           │
  │                    └─────┬─────┘────────────┘                           │
  │                          │                                              │
  │                          ▼                                              │
  │               ┌─────────────────────┐                                  │
  │               │   Shared Database   │                                  │
  │               │  (Sheets/Supabase)  │                                  │
  │               └─────────────────────┘                                  │
  │                                                                         │
  │  Phase 1 (NOW): Single "ate-sales-parser" agent handles all types      │
  │  Phase 2: Split into specialized agents for better accuracy            │
  └─────────────────────────────────────────────────────────────────────────┘
```

### 4a. Set Claude as the Primary Model

**Option A — API Key authentication:**

```bash
openclaw onboard --anthropic-api-key "$ANTHROPIC_API_KEY"
```

Or configure directly in `~/.openclaw/openclaw.json`:

```json5
{
  env: { ANTHROPIC_API_KEY: "sk-ant-..." },
  agents: {
    defaults: {
      model: {
        primary: "anthropic/claude-sonnet-4-20250514",
        fallbacks: ["anthropic/claude-haiku-3-5-20241022"],
      },
    },
  },
}
```

**Option B — Setup Token authentication** (for Claude subscription users):

Generate a token on any machine with Claude Code CLI:

```bash
claude setup-token
```

Then paste during onboarding, or use:

```bash
openclaw models auth setup-token --provider anthropic
```

**Model recommendations for ATE:**

| Model | Use Case | Cost | Thai Accuracy |
|-------|----------|------|---------------|
| `anthropic/claude-sonnet-4-20250514` | Primary — best accuracy for Thai/English mixed messages | ~$3/M input tokens | Excellent |
| `anthropic/claude-haiku-3-5-20241022` | Fallback — faster, cheaper | ~$0.25/M input tokens | Good |

### 4b. Model Optimization — Prompt Caching and Thinking

**Prompt caching** (reduces cost when the system prompt is repeated across calls):

```json5
{
  agents: {
    defaults: {
      models: {
        "anthropic/claude-sonnet-4-20250514": {
          params: {
            // Cache the system prompt for 5 minutes (default for API key auth)
            cacheRetention: "short",
            // Options: "none" (disabled), "short" (5 min), "long" (1 hour, requires beta)
          },
        },
      },
    },
  },
}
```

**Thinking levels** — Claude 4.6 defaults to `"adaptive"` thinking. Override if needed:

```json5
{
  agents: {
    defaults: {
      models: {
        "anthropic/claude-sonnet-4-20250514": {
          params: {
            thinking: "adaptive",  // or use /think:<level> in chat
          },
        },
      },
    },
  },
}
```

**1M context window** (beta, for handling very long message histories):

```json5
{
  params: {
    context1m: true,  // Requires Anthropic account permissions
  },
}
```

### 4c. Configure the Agent Workspace and System Prompt

The agent's behavior is defined by skill files in its workspace. Create the workspace structure:

```bash
mkdir -p ~/.openclaw/workspace/skills/ate-sales-parser
```

Create the skill file at `~/.openclaw/workspace/skills/ate-sales-parser/SKILL.md`:

```markdown
---
name: ate-sales-parser
description: Parse LINE messages from ATE field sales reps into structured sales report JSON
---

You are a sales report data extraction assistant for ATE (Advanced Technology Equipment Co., Ltd.), a Thai B2B distributor of industrial equipment.

ATE distributes the following brands:
- Megger — electrical testing equipment (insulation testers, cable fault locators, transformer testers)
- Fluke — electronic test tools, digital multimeters, thermal imagers, power quality analyzers
- CRC — industrial chemicals (contact cleaners, lubricants, degreasers, corrosion inhibitors)
- Salisbury — electrical safety equipment (insulating gloves, arc flash protection, hot sticks)
- SmartWasher — parts washing systems (bioremediating parts washers, OzzyJuice solutions)
- IK Sprayer — industrial sprayers (pressure sprayers, foam sprayers, acid-resistant sprayers)

When you receive a message from the LINE group, analyze it and determine if it is a sales-related report. If it is, extract structured data and respond with a brief Thai confirmation message summarizing what was logged.

IMPORTANT RULES:

1. LANGUAGE: Messages will be in Thai, English, or a mix of both (code-switching). Thai sales reps commonly write brand names, model numbers, and company abbreviations in English within Thai sentences. Parse regardless of language.

2. CLASSIFICATION: Determine if the message is sales-related. Sales-related includes: customer visits, phone calls, quotations, deal updates, follow-ups, order confirmations, payment updates, daily summaries, product inquiries. If NOT sales-related (casual chat, jokes, lunch plans), respond briefly or ignore.

3. EXTRACTION: Extract all fields you can confidently identify. Leave fields as null if not present. NEVER fabricate data.

4. MULTIPLE ACTIVITIES: If a message describes multiple activities, extract each separately.

5. DEAL VALUES: Parse Thai currency flexibly: "150K" = 150000, "150,000" = 150000, "1.5 แสน" = 150000, "1.5M" = 1500000.

6. After extracting data, write it to the database using the sheets-writer tool (or supabase-writer for Mid tier).

7. Reply in Thai with a confirmation summary:
   "บันทึกแล้ว: เยี่ยม [customer], [brand] [product], ฿[value]"
```

> **NOTE:** The above is a condensed version. Copy the **full system prompt** from [02_Claude_API_Prompt_Design.md](./02_Claude_API_Prompt_Design.md) into this skill file for production use. The full prompt contains the complete JSON output schema, example input/output pairs, and edge case handling rules.

**Skill system details** (from the docs):

- Skills follow the AgentSkills specification with YAML frontmatter and instruction body
- Skills load from three locations with this precedence: (1) workspace skills `<workspace>/skills` — highest, (2) managed skills `~/.openclaw/skills`, (3) bundled skills — lowest
- OpenClaw snapshots eligible skills when a session starts. Changes take effect on the next new session
- Additional skill directories can be configured via `skills.load.extraDirs`
- Use `{baseDir}` in instructions to reference the skill folder path

### 4d. Session Configuration

Configure how OpenClaw manages conversation sessions for the LINE group:

```json5
{
  session: {
    // Each LINE user gets their own session context
    dmScope: "per-peer",

    // Reset sessions daily to keep context fresh
    reset: {
      mode: "daily",
      atHour: 0,  // Reset at midnight Bangkok time
    },

    // Optional: idle timeout
    reset: {
      idleMinutes: 60,  // Reset after 60 minutes of inactivity
    },
  },
}
```

**Session scope options:**

| Scope | Behavior | ATE Recommendation |
|-------|----------|-------------------|
| `main` | Single shared session for all messages | Not recommended — all reps share context |
| `per-peer` | One session per sender | **Recommended** — each sales rep isolated |
| `per-channel-peer` | One session per sender per channel | Use if you add more channels later |
| `per-account-channel-peer` | One session per sender per channel per LINE account | For multi-account setups |

### 4e. Rich Reply Messages — Flex Messages and Quick Replies

OpenClaw's LINE plugin supports rich message types for confirmation responses. From the docs, use `channelData.line` to send specialized messages:

**Quick replies** (give reps easy tap actions):

```json5
{
  text: "บันทึกแล้ว: เยี่ยม PTT, Megger MTO330, ใบเสนอราคา ฿150,000",
  channelData: {
    line: {
      quickReplies: ["แก้ไข", "ยืนยัน", "ดูสรุป"],
    },
  },
}
```

**Flex Message** (formatted sales report card):

```json5
{
  text: "Sales Report Logged",
  channelData: {
    line: {
      flexMessage: {
        altText: "Sales Report: Visit to PTT - Megger MTO330",
        contents: {
          type: "bubble",
          body: {
            type: "box",
            layout: "vertical",
            contents: [
              { type: "text", text: "Sales Report Logged", weight: "bold", size: "lg" },
              { type: "text", text: "Customer: PTT", size: "sm", color: "#666666" },
              { type: "text", text: "Product: Megger MTO330", size: "sm", color: "#666666" },
              { type: "text", text: "Value: ฿150,000", size: "sm", color: "#1DB446" },
              { type: "text", text: "Stage: Quotation", size: "sm", color: "#666666" },
            ],
          },
        },
      },
    },
  },
}
```

**Template message** (confirmation dialog):

```json5
{
  channelData: {
    line: {
      templateMessage: {
        type: "confirm",
        text: "ข้อมูลถูกต้องไหม?",
        confirmLabel: "ถูกต้อง",
        confirmData: "confirm_yes",
        cancelLabel: "แก้ไข",
        cancelData: "confirm_no",
      },
    },
  },
}
```

**Location sharing** (for visit logging):

```json5
{
  channelData: {
    line: {
      location: {
        title: "Customer Office",
        address: "123 Sukhumvit Road, Bangkok",
        latitude: 13.7563,
        longitude: 100.5018,
      },
    },
  },
}
```

**Preset card command:** `/card info "Welcome" "Thanks for joining!"`

### 4f. Group Chat Mention Gating

> **[Assumption]** — If you want the bot to only respond when @mentioned in the group (so it does not react to every message), configure mention requirements:

```json5
{
  channels: {
    line: {
      groups: {
        "*": {
          requireMention: true,  // Bot only responds when @mentioned
        },
      },
    },
  },

  // Optional: custom mention patterns for text-based mentions
  agents: {
    list: [{
      id: "default",
      default: true,
      groupChat: {
        mentionPatterns: ["@ATE", "@bot", "@รายงาน"],
      },
    }],
  },
}
```

> For ATE, you may want `requireMention: false` so the bot parses every message automatically — but this means it also sees casual chats. The AI agent's classification logic (from the system prompt) handles filtering non-sales messages.

### 4g. Complete Configuration File

Here is a complete `~/.openclaw/openclaw.json` for the ATE Sales Report system:

```json5
{
  // Environment variables (secrets read from shell environment)
  env: {
    ANTHROPIC_API_KEY: "${ANTHROPIC_API_KEY}",
    LINE_CHANNEL_ACCESS_TOKEN: "${LINE_CHANNEL_ACCESS_TOKEN}",
    LINE_CHANNEL_SECRET: "${LINE_CHANNEL_SECRET}",
    ATE_SPREADSHEET_ID: "${ATE_SPREADSHEET_ID}",
    GOOGLE_CREDENTIALS_PATH: "${GOOGLE_CREDENTIALS_PATH}",
  },

  // Gateway settings
  gateway: {
    port: 18789,
    reload: {
      mode: "hybrid",      // Hot-reload config changes without restart
      debounceMs: 300,     // File watch debounce (default)
    },
  },

  // AI model configuration
  agents: {
    defaults: {
      model: {
        primary: "anthropic/claude-sonnet-4-20250514",
        fallbacks: ["anthropic/claude-haiku-3-5-20241022"],
      },
      models: {
        "anthropic/claude-sonnet-4-20250514": {
          params: {
            cacheRetention: "short",   // 5-minute prompt cache
          },
        },
      },
      // Image processing — relevant for photos of quotations
      imageMaxDimensionPx: 1200,  // Default downscaling threshold for vision
    },
  },

  // Session management
  session: {
    dmScope: "per-peer",       // Each sales rep gets isolated context
    reset: {
      mode: "daily",
      atHour: 0,               // Reset at midnight
    },
  },

  // LINE channel
  channels: {
    line: {
      enabled: true,
      channelAccessToken: "${LINE_CHANNEL_ACCESS_TOKEN}",
      channelSecret: "${LINE_CHANNEL_SECRET}",
      dmPolicy: "disabled",           // No DMs — group only
      groupPolicy: "allowlist",       // Only designated groups
      groupAllowFrom: [
        "Cxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",  // ATE Sales Report group ID
      ],
      mediaMaxMb: 10,                 // Allow photos up to 10 MB
    },
  },
}
```

---

## 5. Database Integration

The agent needs to write parsed sales data to a database. The approach differs by tier.

```
  Data Flow: Message to Database
  ══════════════════════════════

  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌─────────────┐    ┌──────────┐
  │  LINE    │    │ OpenClaw │    │  Claude  │    │  Writer     │    │ Database │
  │  Message ├───►│  Gateway ├───►│  Sonnet  ├───►│  Skill      ├───►│          │
  │          │    │          │    │          │    │             │    │  Sheets  │
  │ Thai msg │    │ Receives │    │ Extracts │    │ write-to-   │    │    or    │
  │ from rep │    │ & routes │    │ JSON     │    │ sheets.mjs  │    │ Supabase │
  └──────────┘    └──────────┘    └──────────┘    └─────────────┘    └──────────┘
                                        │
                                        │ Also generates
                                        ▼
                                  ┌──────────────┐    ┌──────────┐
                                  │ Thai confirm │    │  LINE    │
                                  │ message      ├───►│  Group   │
                                  │ "บันทึกแล้ว" │    │  (reply) │
                                  └──────────────┘    └──────────┘
```

### 5a. Lean Tier — Google Sheets

For the Lean/PoC tier, the agent writes data to Google Sheets using the Google Sheets API via a custom skill + script.

**Step 1: Set up Google Sheets API credentials**

1. Create a Google Cloud service account with Sheets API enabled (per [03_Google_Sheets_Template.md](./03_Google_Sheets_Template.md))
2. Download the JSON key file
3. Place it on the server: `/etc/openclaw/secrets/google-service-account.json`
4. Share your Google Sheet with the service account email (Editor access)

**Step 2: Create a database writer script**

```bash
mkdir -p ~/.openclaw/workspace/tools
cd ~/.openclaw/workspace/tools
npm init -y
npm install googleapis
```

Create `~/.openclaw/workspace/tools/write-to-sheets.mjs`:

```javascript
// write-to-sheets.mjs
// Called by the OpenClaw agent to append a parsed sales report row to Google Sheets
import { google } from 'googleapis';
import { readFileSync } from 'fs';

const SPREADSHEET_ID = process.env.ATE_SPREADSHEET_ID;
const SHEET_NAME = 'SalesReports';
const CREDENTIALS_PATH = process.env.GOOGLE_CREDENTIALS_PATH
  || '/etc/openclaw/secrets/google-service-account.json';

async function appendRow(data) {
  const credentials = JSON.parse(readFileSync(CREDENTIALS_PATH, 'utf8'));
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });

  const values = [[
    new Date().toISOString(),           // timestamp
    data.rep_name || '',                 // sales rep
    data.customer_name || '',            // customer
    data.contact_person || '',           // contact
    data.brand || '',                    // brand
    data.product || '',                  // product/model
    data.activity_type || '',            // activity type
    data.deal_value || '',               // deal value (THB)
    data.sales_stage || '',              // pipeline stage
    data.next_steps || '',               // follow-up
    data.confidence_score || '',         // AI confidence
    data.raw_message || '',              // original message
  ]];

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A:L`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values },
  });

  return { success: true, rows_added: 1 };
}

// Read JSON from stdin
const input = JSON.parse(readFileSync('/dev/stdin', 'utf8'));
appendRow(input).then(r => console.log(JSON.stringify(r))).catch(e => {
  console.error(e.message);
  process.exit(1);
});
```

**Step 3: Register the tool as a skill**

Create the skill directory and file:

```bash
mkdir -p ~/.openclaw/workspace/skills/sheets-writer
```

Create `~/.openclaw/workspace/skills/sheets-writer/SKILL.md`:

```markdown
---
name: sheets-writer
description: Write parsed sales report data to Google Sheets
command-dispatch: tool
command-tool: exec
---

To log a parsed sales report to Google Sheets, pipe the JSON data to the writer script:

echo '<json_data>' | node {baseDir}/../../tools/write-to-sheets.mjs

The JSON should contain these fields:
- rep_name, customer_name, contact_person, brand, product
- activity_type, deal_value, sales_stage, next_steps
- confidence_score, raw_message
```

**Step 4: Configure the skill in openclaw.json** (for secrets injection):

```json5
{
  skills: {
    entries: {
      "sheets-writer": {
        enabled: true,
        env: {
          ATE_SPREADSHEET_ID: "your-spreadsheet-id",
          GOOGLE_CREDENTIALS_PATH: "/etc/openclaw/secrets/google-service-account.json",
        },
      },
    },
  },
}
```

> **[Assumption]** The exact mechanism for the agent to invoke shell scripts depends on the `exec` tool being available and approved. Per the docs, the exec tool has approval gates. For automated operation in a trusted environment, configure `agents.defaults.sandbox.mode: "off"`. In production, consider pre-approving specific tools or using a more restricted sandbox configuration.

### 5b. Mid Tier — Supabase (PostgreSQL)

For the Mid tier, replace Google Sheets with Supabase for a proper relational database.

**Step 1: Create Supabase tables**

In your Supabase project SQL Editor:

```sql
CREATE TABLE sales_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now(),
  rep_name TEXT,
  customer_name TEXT,
  contact_person TEXT,
  brand TEXT,
  product TEXT,
  activity_type TEXT,
  deal_value NUMERIC,
  sales_stage TEXT,
  next_steps TEXT,
  follow_up_date DATE,
  confidence_score NUMERIC,
  raw_message TEXT,
  line_user_id TEXT,
  line_group_id TEXT
);

-- Index for common queries
CREATE INDEX idx_sales_reports_created_at ON sales_reports(created_at);
CREATE INDEX idx_sales_reports_rep_name ON sales_reports(rep_name);
CREATE INDEX idx_sales_reports_brand ON sales_reports(brand);
```

**Step 2: Create a Supabase writer script**

```bash
cd ~/.openclaw/workspace/tools
npm install @supabase/supabase-js
```

Create `~/.openclaw/workspace/tools/write-to-supabase.mjs`:

```javascript
// write-to-supabase.mjs
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function insertReport(data) {
  const { data: result, error } = await supabase
    .from('sales_reports')
    .insert([{
      rep_name: data.rep_name,
      customer_name: data.customer_name,
      contact_person: data.contact_person,
      brand: data.brand,
      product: data.product,
      activity_type: data.activity_type,
      deal_value: data.deal_value,
      sales_stage: data.sales_stage,
      next_steps: data.next_steps,
      follow_up_date: data.follow_up_date,
      confidence_score: data.confidence_score,
      raw_message: data.raw_message,
      line_user_id: data.line_user_id,
      line_group_id: data.line_group_id,
    }])
    .select();

  if (error) throw new Error(error.message);
  return { success: true, id: result[0].id };
}

const input = JSON.parse(readFileSync('/dev/stdin', 'utf8'));
insertReport(input).then(r => console.log(JSON.stringify(r))).catch(e => {
  console.error(e.message);
  process.exit(1);
});
```

**Step 3: Create a corresponding skill and configure secrets:**

```json5
// In openclaw.json
{
  skills: {
    entries: {
      "supabase-writer": {
        enabled: true,
        env: {
          SUPABASE_URL: "https://your-project.supabase.co",
          SUPABASE_SERVICE_KEY: { source: "env", provider: "default", id: "SUPABASE_SERVICE_KEY" },
        },
      },
    },
  },
}
```

> Per the docs, `env` and `apiKey` values in skill entries are "injected into the host process for that agent turn (not the sandbox)."

---

## 6. Hosting & Deployment

### Hosting Architecture Overview

```
  ┌─────────────────────────────────────────────────────────────────────────┐
  │                     VPS (Singapore Region)                              │
  │                     Ubuntu 24.04 / 1-2 GB RAM                          │
  │                                                                         │
  │  ┌──────────────────────────────────────────────────────────────────┐   │
  │  │  Caddy (or Nginx) — Reverse Proxy                               │   │
  │  │  - Listens on :443 (HTTPS)                                      │   │
  │  │  - Auto SSL via Let's Encrypt                                   │   │
  │  │  - Proxies to localhost:18789                                   │   │
  │  └──────────────────────────┬───────────────────────────────────────┘   │
  │                             │                                           │
  │         ┌───────────────────┼───────────────────┐                       │
  │         │                   │                   │                       │
  │         ▼                   ▼                   ▼                       │
  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐              │
  │  │  OpenClaw    │  │  Control UI  │  │  Metabase         │              │
  │  │  Gateway     │  │  (built-in)  │  │  (Mid tier only)  │              │
  │  │              │  │              │  │                    │              │
  │  │  :18789      │  │  :18789/ui   │  │  :3000             │              │
  │  │              │  │              │  │                    │              │
  │  │  - LINE      │  │  - Chat test │  │  - Dashboards     │              │
  │  │    webhook   │  │  - Config    │  │  - Charts         │              │
  │  │  - Agent     │  │  - Sessions  │  │  - Reports        │              │
  │  │  - Sessions  │  │  - Monitor   │  │                    │              │
  │  └──────┬───────┘  └──────────────┘  └─────────┬────────┘              │
  │         │                                       │                       │
  │         │              ┌────────────────────────┘                       │
  │         │              │                                                │
  │         ▼              ▼                                                │
  │  ┌──────────────────────────┐                                          │
  │  │  systemd services        │                                          │
  │  │  - openclaw.service      │                                          │
  │  │  - caddy.service         │                                          │
  │  │  - metabase.service      │    (auto-restart on crash)               │
  │  └──────────────────────────┘                                          │
  │                                                                         │
  └─────────────────────────────────────────────────────────────────────────┘

  External connections:
  ┌──────────┐                           ┌──────────────┐
  │  LINE    │──── HTTPS :443 ──────────►│  VPS :443    │
  │  Servers │◄── Reply ────────────────│  (Caddy)     │
  └──────────┘                           └──────────────┘

  ┌──────────┐                           ┌──────────────┐
  │ Anthropic│◄── API call (outbound) ──│  OpenClaw    │
  │ Claude   │──── Response ───────────►│  :18789      │
  └──────────┘                           └──────────────┘

  ┌──────────┐                           ┌──────────────┐
  │ Google   │◄── Sheets API ───────────│  Writer      │
  │ Sheets   │──── OK ─────────────────►│  Skill       │
  └──────────┘                           └──────────────┘
```

### 6a. VPS Recommendations

For lowest latency to Thailand (where all 11 sales reps are located):

| Provider | Region | Monthly Cost | Specs | Notes |
|----------|--------|-------------|-------|-------|
| **DigitalOcean** | Singapore (SGP1) | $6/mo (~฿200) | 1 vCPU, 1 GB RAM, 25 GB SSD | **Recommended for Lean tier** — low latency to Bangkok |
| **DigitalOcean** | Singapore (SGP1) | $12/mo (~฿400) | 1 vCPU, 2 GB RAM, 50 GB SSD | **Recommended for Mid tier** — room for OpenClaw + Metabase |
| Hetzner | Singapore | $4.50/mo (~฿150) | 2 vCPU, 2 GB RAM, 20 GB SSD | Cheapest option, good performance |
| Vultr | Singapore/Tokyo | $6/mo (~฿200) | 1 vCPU, 1 GB RAM, 25 GB SSD | Alternative to DigitalOcean |

> **Why Singapore?** Bangkok to Singapore has ~30ms network latency. LINE's servers are in Tokyo/Singapore. This gives excellent round-trip times for webhook delivery and API responses.

> The OpenClaw docs list DigitalOcean, Hetzner, Oracle, GCP, Fly.io, Railway, Render, and Northflank among supported deployment targets.

### 6b. Manual Server Setup (VPS)

**Step 1: Provision the VPS** (Ubuntu 24.04 recommended)

```bash
# SSH into your new server
ssh root@your-server-ip

# Create a non-root user
adduser openclaw
usermod -aG sudo openclaw
su - openclaw
```

**Step 2: Install Node.js 22**

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version  # Should show v22.x.x
```

**Step 3: Install OpenClaw**

```bash
npm install -g openclaw@latest
openclaw onboard --install-daemon
```

**Step 4: Set up HTTPS with Caddy** (simplest reverse proxy with automatic SSL)

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install caddy
```

Create `/etc/caddy/Caddyfile`:

```
your-domain.com {
    reverse_proxy localhost:18789
}
```

```bash
sudo systemctl restart caddy
```

Caddy automatically obtains and renews Let's Encrypt SSL certificates.

**Step 5: Configure systemd service for auto-restart**

If `openclaw onboard --install-daemon` did not create a systemd service, create one manually.

Create `/etc/systemd/system/openclaw.service`:

```ini
[Unit]
Description=OpenClaw AI Gateway
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=openclaw
Group=openclaw
WorkingDirectory=/home/openclaw
ExecStart=/usr/bin/node /usr/lib/node_modules/openclaw/openclaw.mjs gateway --port 18789
Restart=always
RestartSec=5
EnvironmentFile=/etc/openclaw/openclaw.env

[Install]
WantedBy=multi-user.target
```

Create `/etc/openclaw/openclaw.env`:

```bash
NODE_ENV=production
ANTHROPIC_API_KEY=sk-ant-your-key-here
LINE_CHANNEL_ACCESS_TOKEN=your-token
LINE_CHANNEL_SECRET=your-secret
ATE_SPREADSHEET_ID=your-sheets-id
GOOGLE_CREDENTIALS_PATH=/etc/openclaw/secrets/google-service-account.json
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable openclaw
sudo systemctl start openclaw
sudo systemctl status openclaw
```

> **IMPORTANT (from the OpenClaw docs):** On Linux, systemd stops user services on logout/idle, which kills the gateway. Enable lingering to prevent this:
> ```bash
> sudo loginctl enable-linger openclaw
> ```

### 6c. Docker Deployment

OpenClaw provides Docker support with an automated setup script and Docker Compose configuration.

**Quick start (from the docs):**

```bash
# Clone the OpenClaw repo (for Docker files)
git clone https://github.com/openclaw/openclaw.git
cd openclaw

# Run the automated Docker setup
./docker-setup.sh
```

The setup script handles image building (or pulling), runs the onboarding wizard, and starts the gateway via Docker Compose.

**Manual Docker Compose workflow:**

```bash
# Build the image locally
docker build -t openclaw:local -f Dockerfile .

# Run onboarding
docker compose run --rm openclaw-cli onboard

# Start the gateway
docker compose up -d openclaw-gateway
```

**Docker architecture** (from the docs):

| Detail | Value |
|--------|-------|
| **Base image** | `node:22-bookworm` |
| **User** | `node` (uid 1000) — security-first |
| **Default port** | `18789` |
| **Bind mode** | `lan` (default for container deployments) |

**Persistent volumes:**

```
~/.openclaw/          → /home/node/.openclaw          (config & credentials)
~/.openclaw/workspace → /home/node/.openclaw/workspace (skills & prompts)
```

**Named volumes** (optional, persists entire home directory):

```bash
export OPENCLAW_HOME_VOLUME="openclaw_home"
./docker-setup.sh
```

**Extra mounts** (mount additional host directories):

```bash
export OPENCLAW_EXTRA_MOUNTS="$HOME/secrets:/home/node/secrets:ro"
./docker-setup.sh
```

**Docker environment variables** (from the docs):

| Variable | Purpose |
|----------|---------|
| `OPENCLAW_IMAGE` | Use remote image (e.g., `ghcr.io/openclaw/openclaw:latest`) instead of building |
| `OPENCLAW_GATEWAY_BIND` | Network binding: `lan` (default), `loopback`, `custom`, `tailnet`, `auto` |
| `OPENCLAW_HOME_VOLUME` | Named Docker volume for home directory |
| `OPENCLAW_EXTRA_MOUNTS` | Comma-separated bind mount strings |
| `OPENCLAW_DOCKER_APT_PACKAGES` | Space-separated apt packages to install in build |
| `OPENCLAW_EXTENSIONS` | Pre-install extension npm dependencies (e.g., `line`) |
| `OPENCLAW_SANDBOX` | Enable agent sandbox: `1`, `true`, `yes`, or `on` |

**Permissions:** Ensure bind mount directories match the container user (uid 1000):

```bash
sudo chown -R 1000:1000 ~/.openclaw
```

**Health checks:**

```bash
# Liveness probe (unauthenticated)
curl -fsS http://127.0.0.1:18789/healthz

# Readiness probe (unauthenticated)
curl -fsS http://127.0.0.1:18789/readyz

# Authenticated deep snapshot (inside container)
docker compose exec openclaw-gateway node dist/index.js health --token "$TOKEN"
```

**CI/automation** (suppress TTY noise):

```bash
docker compose run -T --rm openclaw-cli gateway probe
docker compose run -T --rm openclaw-cli devices list --json
```

### 6d. Environment Variables Summary

Create a `.env` file on your server (referenced by systemd EnvironmentFile or Docker Compose):

```bash
# Anthropic
ANTHROPIC_API_KEY=sk-ant-your-key-here

# LINE (credentials from 01_LINE_Setup_Guide.md)
LINE_CHANNEL_ACCESS_TOKEN=your-long-lived-channel-access-token
LINE_CHANNEL_SECRET=your-channel-secret

# Google Sheets (Lean tier)
ATE_SPREADSHEET_ID=1AbC...your-spreadsheet-id
GOOGLE_CREDENTIALS_PATH=/etc/openclaw/secrets/google-service-account.json

# Supabase (Mid tier — use instead of Google Sheets)
# SUPABASE_URL=https://your-project.supabase.co
# SUPABASE_SERVICE_KEY=eyJ...
```

---

## 7. Testing

### Testing Flow Checklist

```
  ┌─────────────────────────────────────────────────────────────────────────┐
  │                     Testing Flow — Step by Step                         │
  │                                                                         │
  │  PHASE 1: Control UI (no LINE needed)                                  │
  │  ┌──────────────────────────────────────────────────────────────────┐   │
  │  │                                                                  │   │
  │  │  [ ] 1. Open Control UI: openclaw dashboard                     │   │
  │  │  [ ] 2. Send Thai test message in chat                          │   │
  │  │  [ ] 3. Verify: Agent classifies correctly (sales vs non-sales) │   │
  │  │  [ ] 4. Verify: JSON extraction is accurate                     │   │
  │  │  [ ] 5. Verify: Thai confirmation reply is generated            │   │
  │  │                                                                  │   │
  │  └──────────────────────────────────────────────────────────────────┘   │
  │         │ All pass?                                                     │
  │         ▼                                                               │
  │  PHASE 2: Private LINE Group                                           │
  │  ┌──────────────────────────────────────────────────────────────────┐   │
  │  │                                                                  │   │
  │  │  [ ] 6. Create test LINE group (you + bot only)                 │   │
  │  │  [ ] 7. Send message in group                                   │   │
  │  │  [ ] 8. Check logs for group ID (Cxxx...)                       │   │
  │  │  [ ] 9. Add group ID to groupAllowFrom                         │   │
  │  │  [ ] 10. Send Thai sales message                                │   │
  │  │  [ ] 11. Verify: Bot replies with confirmation                  │   │
  │  │  [ ] 12. Verify: Non-sales message is ignored                   │   │
  │  │                                                                  │   │
  │  └──────────────────────────────────────────────────────────────────┘   │
  │         │ All pass?                                                     │
  │         ▼                                                               │
  │  PHASE 3: Database Verification                                        │
  │  ┌──────────────────────────────────────────────────────────────────┐   │
  │  │                                                                  │   │
  │  │  [ ] 13. Check Google Sheets / Supabase for new rows            │   │
  │  │  [ ] 14. Verify all fields are populated correctly              │   │
  │  │  [ ] 15. Test with multiple activity types (visit, call, quote) │   │
  │  │  [ ] 16. Test edge cases (multi-activity, mixed language)       │   │
  │  │                                                                  │   │
  │  └──────────────────────────────────────────────────────────────────┘   │
  │         │ All pass?                                                     │
  │         ▼                                                               │
  │  PHASE 4: Production Readiness                                         │
  │  ┌──────────────────────────────────────────────────────────────────┐   │
  │  │                                                                  │   │
  │  │  [ ] 17. Switch to production LINE group ID                     │   │
  │  │  [ ] 18. Test with 2-3 real sales reps                          │   │
  │  │  [ ] 19. Monitor logs for errors                                │   │
  │  │  [ ] 20. Verify health endpoints (/healthz, /readyz)           │   │
  │  │  [ ] 21. Set up UptimeRobot monitoring                          │   │
  │  │  [ ] 22. Brief the full team of 11 reps                        │   │
  │  │                                                                  │   │
  │  └──────────────────────────────────────────────────────────────────┘   │
  │                                                                         │
  │  Total estimated testing time: 1-2 hours                               │
  └─────────────────────────────────────────────────────────────────────────┘
```

### 7a. Test with the Control UI First

Before connecting LINE, verify the AI agent works via the browser dashboard:

```bash
openclaw dashboard
```

Open `http://127.0.0.1:18789/` and send test messages like:

```
วันนี้ไปเยี่ยม PTT ที่มาบตาพุด เสนอ Megger MTO330 ราคา 150,000 บาท ลูกค้าสนใจมาก จะส่งใบเสนอราคาพรุ่งนี้
```

Verify that the agent:
1. Correctly identifies this as a sales report
2. Extracts: customer (PTT), location (มาบตาพุด), product (Megger MTO330), value (150,000), stage (quotation)
3. Returns a Thai confirmation summary

### 7b. Create a Private Test LINE Group

1. Create a new LINE group with just yourself and the LINE Official Account bot
2. Send test messages in both Thai and English
3. Verify the webhook is received by OpenClaw

**Sample test messages** (from [02_Claude_API_Prompt_Design.md](./02_Claude_API_Prompt_Design.md)):

| # | Test Message | Expected Extraction |
|---|-------------|-------------------|
| 1 | `วันนี้ไปเยี่ยมลูกค้า บ.สยามซีเมนต์ คุยเรื่อง Fluke 87V จำนวน 5 เครื่อง ราคารวม 75,000` | Customer: สยามซีเมนต์, Brand: Fluke, Product: 87V, Qty: 5, Value: 75,000 |
| 2 | `โทรติดตาม PTT เรื่อง PO Megger MIT515 ลูกค้าบอกจะออก PO สัปดาห์หน้า` | Customer: PTT, Brand: Megger, Product: MIT515, Stage: follow-up |
| 3 | `วันนี้กินข้าวกับทีมที่สีลม` | `is_sales_report: false` (casual chat — agent should ignore or respond briefly) |
| 4 | `Visited SCG today, demo CRC Contact Cleaner. They want 20 cans. Will send quotation tomorrow. About 8,500 baht.` | Customer: SCG, Brand: CRC, Product: Contact Cleaner, Qty: 20, Value: 8,500 |
| 5 | `เช้าไป IRPC เสนอ Salisbury ถุงมือ Class 2 ราคา 45K บ่ายไป Thai Oil ติดตาม Fluke 1587 FC` | Two activities extracted separately |

### 7c. Verify Database Writes

After sending test messages:

- **Google Sheets:** Open your spreadsheet and check that rows are appearing
- **Supabase:** Check the `sales_reports` table in the Supabase dashboard

### 7d. Verify Confirmation Replies

Check that the bot sends a Thai confirmation back to the LINE group after each sales report, e.g.:

```
บันทึกแล้ว: เยี่ยม สยามซีเมนต์, Fluke 87V x5, ฿75,000
```

### 7e. Finding Your LINE Group ID

When you first send a message in the test group, check the OpenClaw logs to find the group ID:

```bash
# Follow live logs (systemd)
journalctl -u openclaw -f

# Or run gateway in foreground with verbose logging
openclaw gateway --port 18789 --verbose

# Or check log files
ls /tmp/openclaw/
```

Look for the group ID (format: `Cxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`) in the incoming webhook event. Add this to your `groupAllowFrom` config.

### 7f. Send a Test Message via CLI

The OpenClaw CLI can send messages directly for testing:

```bash
openclaw message send --target "Cxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" --message "Test: ระบบพร้อมใช้งาน"
```

---

## 8. Monitoring & Maintenance

### 8a. Control UI Dashboard

Access the web-based Control UI for real-time monitoring:

```bash
openclaw dashboard
```

Available at `http://127.0.0.1:18789/` (or via your domain if exposed through the reverse proxy).

The Control UI provides (from the docs):
- **Chat interface** — interact with the agent directly
- **Configuration management** — edit settings without touching JSON files
- **Session overview** — see active sessions per sales rep
- **Node management** — monitor connected devices/channels

**Remote access options:**
- **Tailscale:** Connect your VPS to a Tailscale network for secure remote access without exposing the Control UI publicly. The docs explicitly mention Tailscale support.
- **SSH tunnel:** `ssh -L 18789:localhost:18789 openclaw@your-server-ip` then access locally at `http://127.0.0.1:18789/`

### 8b. Logs

```bash
# Follow live logs (systemd)
journalctl -u openclaw -f

# Check log directory
ls /tmp/openclaw/

# Run gateway in verbose mode for debugging
openclaw gateway --port 18789 --verbose
```

### 8c. Health Checks

Automate monitoring with these endpoints (unauthenticated, per the docs):

```bash
# Liveness — is the process running?
curl -fsS http://127.0.0.1:18789/healthz

# Readiness — is it ready to accept messages?
curl -fsS http://127.0.0.1:18789/readyz
```

Set up monitoring with:
- **UptimeRobot** (free tier) — ping your `/healthz` endpoint every 5 minutes
- **Cron-based check** — a simple script that restarts the service if unhealthy

### 8d. Updating OpenClaw

```bash
# Update to latest version
npm install -g openclaw@latest

# Restart the gateway
sudo systemctl restart openclaw

# Verify
openclaw doctor
openclaw gateway status
```

**Hot-reload behavior** (from the docs): Most configuration changes apply without restart — channels, agents, models, hooks, cron, session, tools, and UI settings all hot-reload. Gateway server and infrastructure changes require a restart. The `reload.mode: "hybrid"` setting handles this automatically.

> Config writes are rate-limited to 3 per 60 seconds per device. Pending restarts are coalesced with a 30-second cooldown.

### 8e. Diagnostics

```bash
# Full system check
openclaw doctor

# Check gateway status
openclaw gateway status

# Check model/API status
openclaw models status

# Detailed model status (JSON)
openclaw models status --json
```

**Common Anthropic API troubleshooting** (from the docs):
- Token expiration: Re-run `claude setup-token` (for setup token auth)
- Missing credentials: Run `openclaw models status`
- 401 errors: Check API key balance and validity
- Cooldown issues: Check `openclaw models status --json` for unavailable profiles

### 8f. Backup

Back up the OpenClaw configuration and workspace:

```bash
# Backup script — add to cron for daily backups
tar -czf /backup/openclaw-$(date +%Y%m%d).tar.gz \
  ~/.openclaw/openclaw.json \
  ~/.openclaw/workspace/ \
  ~/.openclaw/credentials/
```

Add to crontab (`crontab -e`):

```cron
# Daily backup at 2 AM
0 2 * * * tar -czf /backup/openclaw-$(date +\%Y\%m\%d).tar.gz ~/.openclaw/openclaw.json ~/.openclaw/workspace/ ~/.openclaw/credentials/
```

---

## 9. Comparison: OpenClaw vs n8n

For the ATE Sales Report System specifically:

| Aspect | OpenClaw (Alternative B) | n8n (Alternative A) |
|--------|--------------------------|---------------------|
| **LINE Integration** | Built-in plugin — native webhook, group chat, media, Flex messages, quick replies | Manual webhook node — you wire up signature verification, payload parsing |
| **AI Agent** | Native Claude integration with sessions, memory, model failover, prompt caching | HTTP Request node calling Claude API — no built-in session management |
| **Setup Complexity** | `npm install -g openclaw` + onboard + LINE plugin config | Install n8n + build 8-node workflow + configure each node |
| **Thai Message Parsing** | Agent handles directly — system prompt in workspace skill | Code/HTTP node with system prompt embedded |
| **Confirmation Reply** | Native LINE reply with Flex Messages, quick replies, templates | HTTP Request node calling LINE Reply API manually |
| **Session Memory** | Built-in per-sender session — agent remembers context within the day | No session memory — each message stateless unless you build it |
| **Visual Workflow** | No visual editor — config files + skills (developer-oriented) | Drag-and-drop visual workflow — great for non-developers |
| **Database Write** | Via exec tool / custom skill scripts (requires code) | Built-in Google Sheets and Supabase nodes (zero-code) |
| **Monitoring** | Control UI dashboard, CLI diagnostics, health endpoints | n8n dashboard with execution history, error logs, retry |
| **Multi-channel** | Add WhatsApp, Telegram, Discord trivially (40+ channels) | Each channel needs a separate workflow |
| **Rich Messages** | Native Flex Messages, quick replies, template messages, location | Manual JSON construction in HTTP Request node |
| **Media Handling** | Built-in media download with size limits, image processing | Manual handling in Code node |
| **Learning Curve** | Medium — config files + skill authoring, developer-oriented | Low — visual drag-and-drop, non-developer friendly |
| **Self-hosted Cost** | Same VPS (~฿200/mo for Lean) | Same VPS (~฿200/mo for Lean) |
| **Maturity** | Newer project — rapidly evolving, 40+ channel integrations | Mature — large community, extensive docs, hundreds of integrations |
| **License** | MIT (fully open source) | Fair-code (source-available, enterprise restrictions) |

### Architecture Comparison — Side by Side

```
  ┌─────────────────────────────────┐    ┌─────────────────────────────────┐
  │    OPENCLAW (Alternative B)     │    │       n8n (Alternative A)       │
  │                                 │    │                                 │
  │  ┌───────────┐                  │    │  ┌───────────┐                  │
  │  │   LINE    │                  │    │  │   LINE    │                  │
  │  │   Group   │                  │    │  │   Group   │                  │
  │  └─────┬─────┘                  │    │  └─────┬─────┘                  │
  │        │                        │    │        │                        │
  │        ▼                        │    │        ▼                        │
  │  ┌───────────────────────┐      │    │  ┌───────────────────────┐      │
  │  │                       │      │    │  │  Webhook Node         │      │
  │  │   OpenClaw Gateway    │      │    │  └───────────┬───────────┘      │
  │  │                       │      │    │              │                  │
  │  │  ┌─ LINE Plugin      │      │    │  ┌───────────▼───────────┐      │
  │  │  │  (auto webhook,   │      │    │  │  Code: Verify HMAC    │      │
  │  │  │   auto verify,    │      │    │  └───────────┬───────────┘      │
  │  │  │   auto parse)     │      │    │              │                  │
  │  │  │                   │      │    │  ┌───────────▼───────────┐      │
  │  │  ├─ Agent            │      │    │  │  Code: Parse Payload  │      │
  │  │  │  (Claude Sonnet,  │      │    │  └───────────┬───────────┘      │
  │  │  │   session memory, │      │    │              │                  │
  │  │  │   auto failover)  │      │    │  ┌───────────▼───────────┐      │
  │  │  │                   │      │    │  │  HTTP: Claude API     │      │
  │  │  ├─ Skills           │      │    │  │  (no session memory)  │      │
  │  │  │  (sheets-writer,  │      │    │  └───────────┬───────────┘      │
  │  │  │   supabase-writer)│      │    │              │                  │
  │  │  │                   │      │    │  ┌───────────▼───────────┐      │
  │  │  └─ Reply            │      │    │  │  Code: Parse JSON     │      │
  │  │     (Flex Messages,  │      │    │  └───────────┬───────────┘      │
  │  │      quick replies)  │      │    │              │                  │
  │  │                       │      │    │  ┌───────────▼───────────┐      │
  │  └───────────────────────┘      │    │  │  Google Sheets Node  │      │
  │                                 │    │  └───────────┬───────────┘      │
  │  Components: 1 (OpenClaw)       │    │              │                  │
  │  Config files: 1 (openclaw.json)│    │  ┌───────────▼───────────┐      │
  │  Custom code: 1 (writer script) │    │  │  HTTP: LINE Reply API │      │
  │                                 │    │  └───────────────────────┘      │
  │                                 │    │                                 │
  │                                 │    │  Components: 1 (n8n)           │
  │                                 │    │  Workflow nodes: 6-8           │
  │                                 │    │  Custom code: 2-3 (Code nodes)│
  └─────────────────────────────────┘    └─────────────────────────────────┘

  Summary:
  ┌────────────────────┬──────────────────┬──────────────────┐
  │                    │    OpenClaw       │      n8n         │
  ├────────────────────┼──────────────────┼──────────────────┤
  │ Moving parts       │  Fewer           │  More nodes      │
  │ Session memory     │  Built-in        │  Must build      │
  │ LINE features      │  Native          │  Manual API      │
  │ Visual editor      │  No (config)     │  Yes (drag-drop) │
  │ DB connectors      │  Custom scripts  │  Built-in nodes  │
  │ Non-dev friendly   │  Medium          │  High            │
  │ Multi-channel      │  Trivial         │  New workflow     │
  └────────────────────┴──────────────────┴──────────────────┘
```

### When to Choose OpenClaw

- You want the **simplest LINE-to-AI pipeline** — one tool handles messaging + AI routing
- You value **session memory** — the agent can reference earlier messages from the same rep within the day
- You plan to **add more messaging channels** later (WhatsApp, Telegram, etc.)
- You have a **developer on the team** comfortable with config files, CLI, and Node.js
- You want **model failover** — automatic fallback from Sonnet to Haiku if the primary is unavailable
- You want **rich LINE features** (Flex Messages, quick replies, templates) without manual API wiring

### When to Choose n8n

- You want a **visual, no-code workflow** that non-developers can maintain
- You need **built-in database connectors** — Google Sheets, Supabase, PostgreSQL with zero code
- You want **execution history and retry** — n8n tracks every execution with full input/output
- You are already familiar with n8n or similar tools (Zapier, Make)
- You want the **most mature and battle-tested** solution with the largest community

### Recommendation for ATE

**For the Lean/PoC tier:** Either works. n8n is simpler for the initial PoC if no developer is available. OpenClaw is simpler if you have a developer and want fewer moving parts.

**For the Mid tier and beyond:** OpenClaw's session memory and multi-channel support become significant advantages. The ability for the agent to "remember" a sales rep's earlier messages within the day enables natural follow-up conversations and context-aware parsing (e.g., a rep says "same customer, Fluke 87V x3" and the agent knows which customer from the earlier message).

**Hybrid approach (possible):** Use OpenClaw for LINE-to-AI messaging, and trigger an external webhook or script for database writes and email notifications. This gives you OpenClaw's native LINE handling with external tools for data operations.

---

## Appendix A: Quick Reference — CLI Commands

| Command | Purpose |
|---------|---------|
| `openclaw onboard --install-daemon` | Initial setup wizard with daemon |
| `openclaw gateway --port 18789` | Start gateway in foreground |
| `openclaw gateway --port 18789 --verbose` | Start with verbose logging |
| `openclaw gateway status` | Check gateway status |
| `openclaw dashboard` | Open Control UI in browser |
| `openclaw doctor` | System diagnostics |
| `openclaw plugins install @openclaw/line` | Install LINE plugin |
| `openclaw pairing list line` | List pending LINE pairing requests |
| `openclaw pairing approve line <CODE>` | Approve a LINE pairing request |
| `openclaw models status` | Check AI model/API status |
| `openclaw models status --json` | Detailed model status in JSON |
| `openclaw models auth setup-token --provider anthropic` | Set up Anthropic auth via token |
| `openclaw message send --target ID --message "text"` | Send a test message |
| `openclaw channels login` | Interactive channel login |
| `openclaw setup` | Re-run setup |
| `openclaw status` | General status check |

## Appendix B: Troubleshooting

| Problem | Solution |
|---------|----------|
| **LINE webhook verification fails** | Confirm HTTPS is working and `channelSecret` matches. Check Caddy/Nginx is proxying to port 18789. The docs note: "Confirm HTTPS protocol and matching `channelSecret`." |
| **No inbound LINE messages** | Verify webhook URL path (`/line/webhook`), gateway is internet-accessible, and group ID is in `groupAllowFrom`. The docs note: "Verify webhook path alignment and gateway accessibility from LINE." |
| **Media errors (photos)** | Increase `channels.line.mediaMaxMb` if files exceed 10 MB default. |
| **Claude API 401 errors** | Re-check `ANTHROPIC_API_KEY`. Run `openclaw models status`. The docs note: "Claude subscription auth can expire or be revoked." |
| **Gateway dies on SSH disconnect** | Ensure systemd service is enabled, or enable lingering: `sudo loginctl enable-linger openclaw`. |
| **Config changes not applying** | Most changes hot-reload. Gateway/infrastructure changes need restart: `sudo systemctl restart openclaw`. |
| **High latency on replies** | Check VPS region (Singapore recommended). Consider Haiku for faster responses. |
| **Config validation error on startup** | OpenClaw uses strict validation — unknown keys cause startup failure. Remove any unrecognized fields. |

## Appendix C: File Locations Reference

```
~/.openclaw/
├── openclaw.json                          # Main configuration (JSON5)
├── workspace/
│   ├── skills/
│   │   ├── ate-sales-parser/
│   │   │   └── SKILL.md                   # Sales parsing agent prompt
│   │   └── sheets-writer/
│   │       └── SKILL.md                   # Google Sheets writer skill
│   └── tools/
│       ├── write-to-sheets.mjs            # Google Sheets API script
│       ├── write-to-supabase.mjs          # Supabase writer script
│       └── package.json                   # Node.js dependencies
├── credentials/
│   ├── line/                              # LINE credentials (auto-managed)
│   └── line-allowFrom.json               # LINE allowlist (if used)
├── agents/
│   └── default/
│       ├── sessions/                      # Per-sender session data
│       └── agent/
│           └── auth-profiles.json         # Model auth profiles
└── skills/                                # Managed/shared skills (lower precedence)
```

## Appendix D: OpenClaw Configuration Reference (Key Fields)

From the official configuration reference:

| Config Path | Type | Purpose |
|------------|------|---------|
| `gateway.port` | number | Server port (default: 18789) |
| `gateway.reload.mode` | string | `hybrid`, `hot`, `restart`, or `off` |
| `gateway.auth.token` | string | API authentication token |
| `agents.defaults.model.primary` | string | Primary LLM model |
| `agents.defaults.model.fallbacks` | array | Fallback models |
| `agents.defaults.imageMaxDimensionPx` | number | Vision image downscale (default: 1200) |
| `agents.defaults.sandbox.mode` | string | `off`, `non-main`, or `all` |
| `session.dmScope` | string | Session isolation scope |
| `session.reset.mode` | string | `daily` with `atHour` |
| `session.reset.idleMinutes` | number | Inactivity timeout |
| `channels.line.enabled` | boolean | Enable LINE channel |
| `channels.line.dmPolicy` | string | `pairing`, `allowlist`, `open`, `disabled` |
| `channels.line.groupPolicy` | string | `allowlist`, `open`, `disabled` |
| `channels.line.allowFrom` | array | USER_IDs for DM allowlist |
| `channels.line.groupAllowFrom` | array | USER_IDs / Group_IDs for group allowlist |
| `channels.line.mediaMaxMb` | number | Max media download (default: 10) |
| `skills.entries.<id>.enabled` | boolean | Enable/disable a skill |
| `skills.entries.<id>.env` | object | Inject env vars for the skill |
| `env.vars` | object | Global inline environment variables |
| `$include` | string/array | External config file inclusion |

## Appendix E: Visual Quick Reference — End-to-End Message Flow

```
  Complete Message Lifecycle (what happens when a rep sends a message)
  ════════════════════════════════════════════════════════════════════

  Time ──────────────────────────────────────────────────────────────►

  ┌─────┐  ┌──────┐  ┌────────┐  ┌───────┐  ┌───────┐  ┌────────┐  ┌─────┐
  │ Rep │  │ LINE │  │OpenClaw│  │Claude │  │Writer │  │  DB    │  │ Rep │
  │sends│─►│Server│─►│Gateway │─►│Sonnet │─►│Skill  │─►│Sheets/ │  │sees │
  │ msg │  │      │  │        │  │  4    │  │       │  │Supabase│  │reply│
  └─────┘  └──────┘  └────────┘  └───────┘  └───────┘  └────────┘  └─────┘
    │         │          │           │          │           │          ▲
    │         │          │           │          │           │          │
    │    Webhook     Verify      Parse      Execute     Insert     Reply
    │    POST        HMAC +      Thai       writer      row        via
    │    event       route to    message,   script                 LINE
    │                agent       extract                           Push
    │                            JSON                              API
    │                                                                │
    └────────────────────────────────────────────────────────────────┘
              Typical round-trip: 2-5 seconds
```

---

> **Document Version:** 1.0
> **Last Updated:** 2026-03-10
> **Related Documents:**
> - [01_LINE_Setup_Guide.md](./01_LINE_Setup_Guide.md) — LINE Official Account and Messaging API setup
> - [02_Claude_API_Prompt_Design.md](./02_Claude_API_Prompt_Design.md) — System prompt and JSON schema for sales data extraction
> - [03_Google_Sheets_Template.md](./03_Google_Sheets_Template.md) — Google Sheets template structure
> - [04_n8n_Workflow_Guide.md](./04_n8n_Workflow_Guide.md) — Alternative A: n8n workflow configuration
> - [ATE_Sales_Report_System_Proposal.md](./ATE_Sales_Report_System_Proposal.md) — Overall system proposal with tier plans
