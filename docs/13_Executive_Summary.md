# ATE Sales Report System — Executive Summary

> **Prepared for:** ATE Management & Directors
> **Date:** April 5, 2026
> **Prepared by:** Engineering Team
> **Document type:** Executive Summary — non-technical overview for decision-makers

---

## The Problem

ATE has 11 field sales representatives visiting customers across Thailand daily — selling Megger testers, Fluke meters, CRC products, Salisbury safety gear, and other industrial equipment. These reps generate valuable sales intelligence every day: who they visited, what products were discussed, deal values, next steps.

**Today, most of this intelligence is lost.**

Reps may jot notes in personal notebooks, send occasional LINE messages to their manager, or fill in spreadsheets at the end of the week — if at all. The result:

- Management has **no real-time visibility** into the sales pipeline
- Deal values, customer contacts, and follow-up commitments live in individual reps' heads
- There is **no centralized record** of which customers were visited, which products were quoted, or which deals are stalling
- Monthly reporting to directors is assembled manually from fragmented, outdated information
- When a rep is absent or leaves, their customer relationships and deal history go with them

---

## The Solution

We built an AI-powered sales reporting system that turns LINE chat messages into structured business data — automatically, in real time, at near-zero cost.

### How it works (30-second version)

```
Rep sends a LINE message:
   "ไปเยี่ยม PTT คุณวีระ 081-234-5678 เสนอ Megger MTO330 ราคา 150,000 สถานะเจรจา"

The bot instantly:
   1. Parses the Thai text using AI (Google Gemini)
   2. Extracts: customer, contact, phone, product, value, stage
   3. Saves to Google Sheets (24 structured columns)
   4. Replies with a Thai confirmation
   5. Updates the live dashboard automatically
```

**No app to install. No form to fill. No training needed.** Reps just text in LINE — the way they already communicate every day.

---

## What the System Delivers

### For Sales Reps

| Benefit | How |
|---------|-----|
| **Report in 10 seconds** | Send a LINE message in natural Thai — no forms, no apps, no laptop needed |
| **Automatic data entry** | AI extracts customer name, product, value, stage, contact info — rep doesn't fill in fields |
| **Confirmation receipt** | Bot replies immediately confirming what was recorded — rep can correct if wrong |
| **Update existing deals** | Type "อัพเดท MSG-XXXXXXXX" to update status, price, or stage of a previous deal |
| **Pipeline summary on demand** | Type "สรุป" to see total pipeline value, deals by stage, and segment breakdown |

### For Sales Management

| Benefit | How |
|---------|-----|
| **Real-time pipeline visibility** | Looker Studio dashboard shows total pipeline value, deal stages, product segments — updated automatically |
| **Complete activity history** | Every customer visit, call, quotation, and deal closure is recorded with timestamp and rep name |
| **Stale deal detection** | Weekly automated alerts push to reps when deals have no activity for 7+ days |
| **Product segment analytics** | 431 Megger products automatically mapped to 7 business segments (CI, GET, LVI, MRM, PDIX, PP, PT) |
| **Win/loss analysis** | Close reasons are captured for every won and lost deal — identify patterns |
| **Government bid tracking** | Bidding stage with bid opening dates tracked separately |
| **Monthly summary reports** | Auto-generated Thai-language pipeline summary pushed to management |

### For the Company

| Benefit | How |
|---------|-----|
| **Institutional memory** | Customer relationships, deal history, and contact information are company assets — not locked in reps' heads |
| **Data-driven decisions** | Pipeline forecasting, segment performance, rep productivity — all from real data |
| **Minimal disruption** | Reps report via LINE (already their primary communication tool). No new app, no new habit. |
| **Near-zero cost** | ~700 THB/month ($20 USD) total infrastructure cost |

---

## Current Status

### What has been built and proven

The system has been developed, tested, and demonstrated as a fully functional prototype. A comprehensive security and reliability review was conducted by a 6-expert panel, and 17 hardening improvements were implemented.

| Component | Status |
|-----------|--------|
| LINE bot (receives Thai messages, replies with confirmation) | Built and tested |
| AI parsing (Gemini primary + Groq fallback) | Built and tested |
| Google Sheets integration (24-column schema, dual-write) | Built and tested |
| Looker Studio dashboard | Built and connected |
| Update command (modify existing deals) | Built and tested |
| Smart match detection (finds existing deals with same customer/product) | Built and tested |
| Weekly stale deal push notifications | Built and tested |
| Rich Menu (3-button interface) | Built and deployed |
| Security hardening (17 fixes: formula injection, auth, validation) | Completed |
| Product segment auto-matching (431 products, 7 segments) | Built and tested |

### What remains before production launch

The system works. The remaining work is **organizational** (moving accounts to company ownership, PDPA compliance) and **operational** (monitoring, alerting, production configuration). A detailed migration plan has been prepared with a 4-week timeline.

---

## The Migration — What We're Asking For

### Approval needed for:

**1. Budget: 700 THB/month (~$20 USD)**

| Item | Cost | Why |
|------|------|-----|
| Vercel Pro hosting | 700 THB/month | Required: current free tier prohibits commercial use. Pro provides production-grade reliability, 60-second processing time, team access, and data privacy agreement needed for PDPA compliance. |
| Everything else | 0 THB/month | AI (Gemini, Groq), database (Google Sheets), dashboard (Looker Studio), automation (GitHub Actions), monitoring (Axiom) — all remain on free tiers, which are more than sufficient for 11 reps. |

**Annual total: ~8,400 THB.** For context, this is less than 6% of the smallest deal tracked in the system (150,000 THB). One closed deal pays for 17 years of operation.

**2. Account ownership transfer**

All system accounts must move from the developer's personal ownership to ATE company ownership. This eliminates the risk of losing the entire system if the developer is unavailable.

| Account | Action |
|---------|--------|
| GitHub (code repository) | Transfer to ATE company organization |
| Vercel (hosting) | Create ATE team account |
| Google Cloud (AI + Sheets access) | Create ATE company project |
| LINE Official Account | Register under ATE business identity |

**3. PDPA compliance preparation**

Thailand's Personal Data Protection Act (PDPA) requires documentation for systems that store personal data (customer names, phone numbers, emails). The compliance work is straightforward:

- Update the company privacy policy on ate.co.th (2 hours)
- Create a Record of Processing Activities document (2 hours)
- Define a data retention policy — recommended: 2 years active (1 hour)
- Distribute a brief data processing notice to the 11 reps (15 minutes)

**Non-compliance penalty: up to 5 million THB per offense.** The compliance cost (a few hours of documentation) is negligible compared to the risk.

**4. Sales Manager commitment to champion the rollout**

The single most important factor for adoption is the sales manager's visible endorsement. This means:

- Being the first person to test the bot with real data
- Demonstrating the system to the team in a 15-minute meeting
- Using dashboard data in weekly meetings to celebrate pipeline wins
- Never using the data to criticize individual reps in front of the group
- Handling non-reporters privately, framing it as "making your hard work visible to directors"

---

## Rollout Timeline

| When | What | Who |
|------|------|-----|
| **Week -1** | Set up company accounts, PDPA docs, deploy code changes to staging, full test | IT Admin, Developer, Legal |
| **Week 0 Monday** | Production launch. Manager + 2-3 champion reps test with real data. | Sales Manager, Developer |
| **Week 0 Tuesday** | Full team announcement. 15-minute meeting. Everyone sends first report. | Sales Manager, All Reps |
| **Weeks 1-2** | Monitor, fix AI parsing edge cases, add monitoring/alerting | Developer |
| **Weeks 3-4** | Enhancements: monthly auto-summary, dashboard views, backup automation | Developer |
| **Month 2+** | Steady state. Weekly stale deal alerts. Monthly summary pushes. | Automatic |

---

## Architecture at a Glance

```
                         ATE Sales Report System
    ┌─────────────────────────────────────────────────────────┐
    │                                                         │
    │   📱 Sales Rep                                          │
    │   sends LINE message                                    │
    │   (natural Thai text)                                   │
    │         │                                               │
    │         ▼                                               │
    │   ⚡ Vercel Serverless (Python)                         │
    │   validates signature, checks message type              │
    │         │                                               │
    │         ▼                                               │
    │   🤖 Google Gemini AI                                   │
    │   parses Thai → structured JSON                         │
    │   (Groq Llama 3.3 as automatic backup)                  │
    │         │                                               │
    │         ▼                                               │
    │   📊 Google Sheets (24 columns, 4 tabs)                 │
    │   Combined (dashboard) + Live Data (audit trail)        │
    │         │                                               │
    │         ├──► 💬 LINE Reply (Thai confirmation)           │
    │         │                                               │
    │         └──► 📈 Looker Studio Dashboard                 │
    │              (auto-refreshes every 15 minutes)          │
    │                                                         │
    │   ⏰ Weekly: Stale deal push notifications to reps      │
    │   📋 Monthly: Pipeline summary push to management       │
    │                                                         │
    └─────────────────────────────────────────────────────────┘
```

### Technology choices and why

| Layer | Technology | Why This Choice |
|-------|-----------|-----------------|
| Chat interface | LINE | Reps already use LINE daily. Zero adoption friction. |
| AI engine | Google Gemini 2.5 Flash | Best-in-class Thai language understanding. Free tier covers our volume. |
| AI backup | Groq Llama 3.3 70B | Automatic failover if Gemini is unavailable. Sub-second response time. |
| Database | Google Sheets | Free. Sales managers can view and edit directly. Looker Studio connects natively. |
| Dashboard | Looker Studio | Free. Auto-refreshes from Sheets. Shareable via link. |
| Hosting | Vercel | Serverless (no servers to manage). Auto-scales. $20/month Pro plan. |
| Automation | GitHub Actions | Free. Runs weekly stale checks and daily health monitors. |

**Total dependencies: 2 Python packages** (gspread, google-auth). All AI and messaging APIs use Python's built-in HTTP library — no SDK version conflicts, minimal maintenance surface.

---

## Security & Data Privacy Summary

### What we protect

| Data | Protection |
|------|-----------|
| Customer names, phones, emails | Stored in Google Sheets (encrypted at rest). Access limited to service account + shared users. |
| Sales rep messages | Processed by AI for parsing only. Not stored in AI provider systems (verified per API terms). |
| API credentials | Stored in Vercel encrypted environment variables. Never in code. Rotated quarterly. |
| Deal values and pipeline data | Accessible only to authorized Sheets users and Looker Studio viewers. |

### Security measures implemented

| Measure | Description |
|---------|-------------|
| Webhook signature validation | Every LINE message is cryptographically verified (HMAC-SHA256) |
| API key protection | Gemini key passed via HTTP header (not URL) to prevent log exposure |
| Formula injection defense | All cell values sanitized before writing to prevent spreadsheet attacks |
| User allowlist | Only approved LINE user IDs can submit reports |
| Timing-safe authentication | Stale check endpoint uses constant-time comparison to prevent attacks |
| Event deduplication | Prevents duplicate records from LINE message retries |
| AI output validation | Parsed values validated against known enums before saving |
| Error sanitization | Internal system details never exposed in error responses |
| Body size limits | 1MB webhook body limit, 2000-character message limit |

### PDPA compliance

| Requirement | Status |
|-------------|--------|
| Lawful basis for processing | Legitimate interest (B2B sales management) — to be documented |
| Privacy notice | To be added to company website and communicated to reps |
| Record of Processing Activities | To be created before launch |
| Data retention policy | 2 years active, then archive — to be formalized |
| Data subject rights process | privacy@ate.co.th for access/deletion requests — to be established |
| Cross-border transfer safeguards | Vercel Pro DPA, Google standard DPA, LINE business terms |

---

## Risk Summary

| Risk | Likelihood | Impact | Our Mitigation |
|------|-----------|--------|----------------|
| Reps don't adopt the system | Medium | High | Phased rollout. Manager champions visibly. Positioned as "making your work visible," not surveillance. |
| AI misparsing Thai shorthand | High (week 1) | Medium | Monitor first 100 messages. Add training examples for edge cases. Self-improving over time. |
| Developer unavailable | Medium | Critical | Company-owned accounts. Shared credentials. Comprehensive documentation. Identified backup person. |
| PDPA complaint | Low | Very High | Compliance docs prepared before launch. Privacy notice, ROPA, retention policy. |
| System outage | Low | Medium | Dual AI failover. Auto-retry on failures. Instant rollback. Daily health check with alerts. |

---

## Expected Outcomes

### Month 1

- 8+ of 11 reps actively reporting (73%+ adoption)
- 70%+ of reports include all key fields (customer, contact, product, value, stage)
- Management has real-time pipeline visibility for the first time
- Stale deals surface automatically instead of being forgotten

### Month 3

- Complete pipeline data: every customer interaction recorded
- Win/loss patterns visible by product segment and competitor
- Monthly board reports generated from real data, not guesswork
- Estimated time savings: ~30 minutes/rep/week on manual reporting

### Month 6+

- Historical data enables deal cycle analysis and forecasting
- Product segment performance drives inventory and marketing decisions
- Customer visit frequency data improves territory planning
- System becomes institutional memory — resilient to staff turnover

---

## Investment Summary

| | |
|---|---|
| **Monthly cost** | 700 THB ($20 USD) |
| **Annual cost** | 8,400 THB ($240 USD) |
| **One-time setup effort** | ~2 weeks (developer + IT admin) |
| **Ongoing maintenance** | ~2 hours/month (developer) |
| **Break-even** | Less than 1% of one small deal (150,000 THB) |
| **Pipeline at risk without this** | Every deal that slips through cracks due to no follow-up, no visibility, no accountability |

---

## Decision Requested

| Item | Approval |
|------|----------|
| 1. Budget: 700 THB/month for Vercel Pro hosting | [ ] Approved |
| 2. Transfer accounts to company ownership (GitHub, Vercel, GCP, LINE) | [ ] Approved |
| 3. PDPA compliance documentation (privacy notice, ROPA, retention policy) | [ ] Approved |
| 4. Sales Manager to champion rollout (demonstrate to team, use data in meetings) | [ ] Committed |
| 5. Begin 4-week migration and rollout per the plan | [ ] Approved |

---

*Upon approval, the engineering team will begin execution immediately, targeting production launch within 2 weeks.*

*Full technical details: [`docs/12_Production_Migration_Plan.md`](12_Production_Migration_Plan.md)*
*System architecture: [`ARCHITECTURE.md`](../ARCHITECTURE.md)*
*Feature roadmap: [`docs/08_Roadmap.md`](08_Roadmap.md)*
