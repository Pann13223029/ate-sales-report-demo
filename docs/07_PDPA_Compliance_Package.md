# ATE Sales Report System — PDPA Compliance Package

> Legacy note:
> This compliance package was drafted against the older `LINE + Python + Google Sheets` system shape.
> It should be treated as reference material and re-reviewed against the current `Telegram + Postgres + TypeScript` architecture before operational use.

> **Version:** 1.2 | **Date:** April 5, 2026 | **Classification:** Confidential
> **Data Controller:** Advanced Technology Equipment Co., Ltd. (ATE)
> **Legal Framework:** PDPA B.E. 2562 (2019)

---

## 1. Overview

PDPA compliance documentation for ATE's LINE-based AI sales reporting system. Covers data collected via LINE Messaging API, processed by Google Gemini AI, stored in Google Sheets, and visualized in Looker Studio.

**Data subjects:** (1) ATE sales representatives (11 employees), (2) Customer contacts (natural persons whose names, phones, emails are reported by reps).

> Company names and deal values are business information about juristic persons — not personal data under PDPA.

---

## 2. Privacy Policy (Bilingual)

*For publication on ate.co.th*

#### นโยบายความเป็นส่วนตัว — ระบบรายงานการขาย ATE
#### Privacy Policy — ATE Sales Report System

**ผู้ควบคุมข้อมูล / Data Controller:** บริษัท แอดวานซ์ เทคโนโลยี อิควิปเม้นท์ จำกัด (ATE)
**วันที่มีผลบังคับใช้ / Effective Date:** [INSERT DATE]

**1. ข้อมูลที่เก็บรวบรวม / Data We Collect**

| ประเภท / Type | รายละเอียด / Details |
|---|---|
| ชื่อผู้ติดต่อ / Contact name | ชื่อผู้ติดต่อทางธุรกิจ / Business contact person name |
| ข้อมูลติดต่อ / Contact info | เบอร์โทร อีเมล / Phone, email |
| ข้อมูลการขาย / Sales data | สินค้า มูลค่า สถานะ / Product, value, stage |

ระบบไม่เก็บข้อมูลส่วนบุคคลที่มีความอ่อนไหว (sensitive data)
The system does not collect sensitive personal data.

**2. วัตถุประสงค์ / Purpose**

| วัตถุประสงค์ / Purpose | ฐานกฎหมาย / Lawful Basis |
|---|---|
| บริหารท่อส่งการขาย / Sales pipeline management | ประโยชน์โดยชอบ ม.24(5) / Legitimate interest |
| รายงานผู้บริหาร / Management reporting | ประโยชน์โดยชอบ ม.24(5) / Legitimate interest |
| ดูแลลูกค้า / Customer follow-up | ความจำเป็นตามสัญญา ม.24(3) / Contractual necessity |

**3. ระยะเวลาเก็บรักษา / Retention**

| ข้อมูล / Data | ระยะเวลา / Period |
|---|---|
| ข้อมูลการขาย / Sales data | 2 ปี + 3 ปีเก็บถาวร = รวม 5 ปี / 2 years active + 3 years archive = 5 years total |
| ข้อมูลพนักงาน / Rep data | ตลอดการจ้างงาน + 1 ปี / Employment + 1 year |

**4. การเปิดเผยข้อมูล / Disclosure**

| ผู้รับ / Recipient | วัตถุประสงค์ / Purpose | ที่ตั้ง / Location |
|---|---|---|
| Google LLC (Gemini AI, Sheets) | ประมวลผล AI, จัดเก็บ / AI processing, storage | US |
| Vercel Inc. | โฮสต์ระบบ / System hosting | US |
| LINE Corporation | รับ-ส่งข้อความ / Messaging | Japan |

การส่งข้อมูลต่างประเทศอยู่ภายใต้มาตรการคุ้มครองตามมาตรา 28
Cross-border transfers are protected under PDPA Section 28.

**5. สิทธิของท่าน / Your Rights**

| สิทธิ / Right | มาตรา / Section |
|---|---|
| เข้าถึงข้อมูล / Access | 30 |
| แก้ไขข้อมูล / Rectification | 35 |
| ลบข้อมูล / Erasure | 33(1) |
| ระงับการประมวลผล / Restriction | 34 |
| โอนย้ายข้อมูล / Portability | 31 |
| คัดค้าน / Object | 32 |
| ร้องเรียนต่อ PDPC / Complain to PDPC | 73 |

**6. ติดต่อ / Contact**

- อีเมล / Email: [INSERT CONTACT EMAIL]
- โทร / Phone: [INSERT PHONE]
- ที่อยู่ / Address: [INSERT ADDRESS]

ดำเนินการภายใน 30 วัน / Response within 30 days.

---

## 3. Record of Processing Activities (ROPA)

*Required under PDPA Section 39*

| Field | Details |
|-------|---------|
| **Data Controller** | Advanced Technology Equipment Co., Ltd. (ATE) |
| **Representative** | [INSERT NAME, TITLE] |
| **Contact** | [INSERT CONTACT EMAIL], [INSERT PHONE] |
| **DPO** | Not appointed — ATE processes limited-scope B2B contact data, does not process sensitive data at large scale, and does not conduct regular systematic monitoring. A designated privacy contact handles requests. |

### Activity 1: Sales Activity Recording

| Field | Details |
|-------|---------|
| **Purpose** | Record sales activities, track pipeline, generate reports |
| **Lawful Basis** | Legitimate Interest (Section 24(5)) — supported by LIA (Section 11.1) |
| **Data Subjects** | ATE sales reps (employees), customer business contacts |
| **Personal Data** | Names, phone numbers, emails, deal values |
| **Sensitive Data** | None |
| **Cross-Border Transfer** | Google (US), Vercel (US), LINE (Japan) — via provider DPAs (Section 28(4)) |
| **Retention** | 2 years active + 3 years archive = 5 years total |
| **Technical Measures** | HMAC-SHA256 auth, formula injection protection, constant-time comparison, event dedup, AI output validation, 1MB body limit, 2000-char message guard, pseudonymized logging |
| **Organizational Measures** | LINE user allowlist, ownership verification, quarterly secret rotation, annual review |

### Activity 2: Rep Registration

| Field | Details |
|-------|---------|
| **Purpose** | Map LINE user IDs to display names for notifications |
| **Lawful Basis** | Contractual Necessity (Section 24(3)) |
| **Data** | LINE user ID, display name, last active timestamp |
| **Retention** | Employment + 1 year |

### Activity 3: AI Natural Language Processing

| Field | Details |
|-------|---------|
| **Purpose** | Parse Thai text messages into structured sales data |
| **Lawful Basis** | Legitimate Interest (Section 24(5)) — supported by LIA (Section 11.1) |
| **Data Processors** | Google Gemini 2.5 Flash (primary). Groq: **disabled in production** (no DPA for free tier). |
| **Data Retention at Processor** | Verify Gemini free-tier terms before production. If data used for training, upgrade to paid Vertex AI. |

---

## 4. Internal Data Processing Notice

*For the 11 sales representatives — deliver via LINE group*

---

### เรื่องข้อมูลส่วนตัวในระบบรายงานขาย — สิ่งที่ทีมเซลล์ควรรู้

**ถึง:** ทีมขายทุกท่าน | **จาก:** ฝ่ายบริหาร ATE | **วันที่:** [INSERT DATE]

---

สวัสดีครับทีมขาย

**ทำไมถึงมีเอกสารนี้?**
กฎหมาย PDPA กำหนดให้บริษัทต้องแจ้งให้พนักงานทราบว่าระบบเก็บข้อมูลอะไรบ้าง ไม่ได้มีอะไรเปลี่ยนแปลง — แค่แจ้งให้ทราบตามกฎหมาย ระบบ bot ทำงานเหมือนเดิมทุกอย่าง ทุกคนมีสิทธิตามกฎหมายขอดู แก้ไข หรือลบข้อมูลได้ ไม่ใช่เรื่องเกี่ยวกับการตรวจสอบการทำงาน

**ข้อมูลที่ระบบเก็บ:**
- ชื่อ LINE, User ID, เวลาที่ส่ง, เนื้อหาข้อความ (เก็บ 2 ปี)
- ข้อมูลลูกค้าที่รายงาน: ชื่อบริษัท, ชื่อผู้ติดต่อ, เบอร์โทร/อีเมล, สินค้า, มูลค่า, สถานะ

**การจัดเก็บ:** Google Sheets ภายใต้บัญชีบริษัท เข้าถึงได้โดยฝ่ายบริหารและ IT เท่านั้น

**AI:** ข้อความถูกประมวลผลผ่าน Google Gemini AI (สหรัฐฯ) เพื่อแปลงเป็นข้อมูล ATE ตรวจสอบเงื่อนไข AI เป็นประจำ

**เก็บรักษา:** 2 ปี แล้วเก็บถาวร รวม 5 ปี แล้วลบ

**สิทธิ:** ขอดู แก้ไข ลบ หรือโอนย้ายข้อมูลได้ ติดต่อ [INSERT CONTACT EMAIL]

**รับทราบ:** ตอบ **"รับทราบ"** ในกลุ่ม LINE ภายใน [INSERT DATE]

> Screenshot คำตอบเก็บเป็นหลักฐาน ทางเลือก: เซ็นเอกสารกระดาษสำหรับเก็บในแฟ้ม

---

## 5. Data Retention & Deletion Policy

| Data | Active | Archive | Total | Method |
|------|--------|---------|-------|--------|
| Sales data (Combined) | 2 years | +3 years | 5 years | Anonymize + remove rows. Delete archive workbook after period. |
| Audit trail (Live Data) | 2 years | +3 years | 5 years | Same |
| Raw message text | 2 years | Not archived | 2 years | Overwrite with "[archived]" |
| Rep Registry | Employment | +1 year | Emp+1yr | Row deletion |
| System logs | 30 days | None | 30 days | Auto-expiry |

**Annual archival (January):** Export rows >2 years old to archive workbook, overwrite raw messages with "[archived]", delete from active sheet.

**Ad-hoc deletion (PDPA requests):** Anonymize PII fields with "[deleted per PDPA request]". Retain anonymized rows for aggregate reporting. Respond within 30 days.

> Note: Google Sheets version history retains earlier versions. For complete elimination, archive workbooks are deleted entirely after the retention period.

---

## 6. Data Subject Rights Procedure

**Contact:** [INSERT CONTACT EMAIL] | **Deadline:** 30 days | **Handler:** [INSERT NAME/TITLE]

**For all request types** (access, rectification, erasure, portability, objection):

| Step | Action | Timeline |
|------|--------|----------|
| 1 | Receive request via any channel (email, phone, LINE, in-person) | Day 0 |
| 2 | Verify requester identity (confirm business details they would know) | Days 1-3 |
| 3 | Search Google Sheets (Combined + Live Data + Archive) | Days 3-7 |
| 4 | Process request: provide data / correct / anonymize / export as CSV | Days 7-20 |
| 5 | Respond to requester confirming completion | Within 30 days |
| 6 | Log in request register | Same day |

**Erasure specifics:** Anonymize PII (replace with "[deleted per PDPA request]"), retain rows for aggregate data. May refuse if data is needed for legal compliance or defense of claims.

**Request log:** Maintain a register with: date, requester, request type, decision, completion date, handler.

---

## 7. Data Breach Response Plan

**Quick-reference (1-page version for the response team)**

### Step 1: Contain (0-4 hours)
- Revoke compromised credentials immediately
- Screenshot logs, document what happened
- Post to the incident LINE group: Developer + IT Manager + Management

### Step 2: Assess (4-24 hours)
- How many data subjects affected? What PII exposed?
- Was data actually accessed by unauthorized parties?

### Step 3: Notify (24-72 hours)
**PDPA Section 37(4): Notify PDPC within 72 hours** of becoming aware if the breach affects data subjects' rights.
- PDPC: https://www.pdpc.or.th | [CHECK CURRENT CONTACT EMAIL]
- Notify affected data subjects without undue delay if high risk
- Include: nature of breach, data affected, approximate number of subjects, consequences, measures taken

### Step 4: Fix (1-30 days)
- Fix root cause, rotate credentials, update security measures
- Post-incident review with lessons learned

### Emergency contacts
| Role | Name | Phone |
|------|------|-------|
| Developer | [INSERT] | [INSERT] |
| IT Manager | [INSERT] | [INSERT] |
| Management | [INSERT] | [INSERT] |

### Breach register
Log all incidents: date, description, severity, data affected, PDPC notified?, remediation.

---

## 8. Data Processing Agreements (DPA) Register

| Provider | Data Processed | DPA Status |
|----------|---------------|-----------|
| **Google LLC** (Sheets, Gemini, Looker) | Sales data, AI parsing | Google Cloud DPA. Verify activation in GCP console. |
| **Vercel Inc.** | Message payloads in transit | DPA on Pro plan. **Requires Pro upgrade.** |
| **LINE Corporation** | Messages, user IDs | LINE for Business terms. Thailand entity exists. |
| **Groq Inc.** | AI parsing (fallback) | **DISABLED in production** — no free-tier DPA. |
| **GitHub** | Code, Actions logs | GitHub DPA. No customer PII in repo. |

**Action items:**
- [ ] Activate Vercel Pro DPA upon upgrade
- [x] Groq disabled in production
- [ ] Verify Google Cloud DPA accepted in GCP console
- [ ] Annual DPA review (January)

---

## 9. Cross-Border Data Transfer Assessment

| Transfer | Data | Basis |
|----------|------|-------|
| Message → Gemini AI (US) | Customer names, phones, emails in text | **Rep data:** Section 28(3) contractual necessity. **Customer data:** Section 28(4) appropriate safeguards via Google DPA. |
| Parsed data → Google Sheets (US) | 24-column structured data | Same as above |
| Messages → LINE (Japan) | Message content in transit | Section 28(3) contractual necessity |
| Groq AI (US) | **DISABLED** | N/A |

> Note: No PDPC adequacy determination exists for US or Japan as of 2026. ATE relies on provider DPAs and standard contractual clauses as appropriate safeguards under Section 28(4).

---

## 10. AI Data Processing Disclosure

**Google Gemini 2.5 Flash (Primary)**

| Aspect | Details |
|--------|---------|
| Data sent | LINE message text (may contain customer names, phones, emails) |
| Data returned | Structured JSON with extracted fields |
| Training use | **Verify free-tier terms before production.** Paid tier (Vertex AI) contractually prohibits training. |
| Location | US (Google infrastructure) |

**Groq Llama 3.3 70B:** Disabled in production. No data transferred.

**Near-term action:** Implement PII masking (regex-replace phone/email with tokens before AI call, re-inject after parsing) to eliminate PII exposure to third-party AI.

---

## 11. Consent & Lawful Basis Register

| # | Activity | Basis | PDPA Section | Consent? |
|---|----------|-------|-------------|----------|
| 1 | Sales activity recording | Legitimate Interest | 24(5) | No |
| 2 | Customer contact storage | Legitimate Interest | 24(5) | No |
| 3 | Rep LINE ID registration | Contractual Necessity | 24(3) | No |
| 4 | Stale deal notifications | Legitimate Interest | 24(5) | No |
| 5 | AI message parsing | Legitimate Interest | 24(5) | No |
| 6 | Cross-border transfer | Safeguards (customer) / Contract (rep) | 28(4) / 28(3) | No |
| 7 | Dashboard visualization | Legitimate Interest | 24(5) | No |

### 11.1 Legitimate Interest Assessment (LIA)

#### Sales Activity Recording (Activities 1-2)

| Element | Assessment |
|---------|-----------|
| **ATE's interest** | Managing B2B sales pipeline — tracking interactions, forecasting revenue, ensuring follow-up across 11 reps and hundreds of accounts. |
| **Necessity** | Yes. Manual entry fails due to low compliance. AI parsing of LINE messages is minimum-friction. Contact info needed to identify decision-makers and enable follow-up. |
| **Data minimization** | All fields directly support pipeline management. No excess collection. |
| **Data subject expectations** | Customers voluntarily provide business cards/phone/email in B2B interactions. They expect this to be recorded by suppliers. AI automates data entry, not the business purpose. |
| **Impact on subjects** | Low. Standard B2B contact data. No profiling, scoring, or automated decisions about subjects. No sensitive data. |
| **Safeguards** | 5-year retention limit, user allowlist, ownership checks, data subject rights honored within 30 days, DPA-protected transfers, PII masking planned. |
| **Conclusion** | ATE's interest **does not override** subjects' rights. Processing is proportionate, expected, and safeguarded. Legitimate interest is appropriate. |

#### AI Processing (Activity 5)

| Element | Assessment |
|---------|-----------|
| **ATE's interest** | Automated extraction of structured data from Thai text. System cannot function without it. |
| **Necessity** | Yes. Core value proposition. Manual entry would negate the system. |
| **Impact** | Low. Transient processing, no retention by AI provider (verify terms), no decisions about subjects. |
| **Conclusion** | Legitimate, necessary, low impact. ATE commits to PII masking as near-term enhancement. |

### Why Not Consent?

- Reps cannot pause customer visits to obtain consent for recording the meeting
- B2B contact info is exchanged voluntarily in commercial relationships
- Consent withdrawal would make the system unreliable
- PDPA's legitimate interest provision covers this type of routine B2B processing
- If legal counsel prefers consent, it can be added as an optional layer

---

## 12. Annual Compliance Review

*Complete every January. Tie to an existing management meeting.*

- [ ] ROPA still accurate? New data types or processors?
- [ ] Data archival completed per schedule?
- [ ] Any data subject requests received and handled?
- [ ] Google Gemini, Vercel, LINE terms changed?
- [ ] New PDPC guidance or enforcement actions?
- [ ] API keys and secrets rotated per schedule?
- [ ] User allowlist current? Departed reps removed?
- [ ] Privacy policy on ate.co.th up to date?
- [ ] New employees given data processing notice?
- [ ] Incident response plan reviewed?

**Sign-off:**

| Role | Name | Date |
|------|------|------|
| IT Manager | | |
| Sales Manager | | |
| Management | | |

---

*This document should be reviewed by legal counsel before formal adoption.*
*Next review: January 2027*
