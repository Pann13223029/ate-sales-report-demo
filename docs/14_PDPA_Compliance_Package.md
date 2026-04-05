# ATE Sales Report System — PDPA Compliance Package

> **Document Version:** 1.1
> **Date:** April 5, 2026
> **Classification:** Confidential — Internal Use Only
> **Legal Framework:** Thailand Personal Data Protection Act B.E. 2562 (2019), effective June 1, 2022
> **Data Controller:** Advanced Technology Equipment Co., Ltd. (ATE)
> **System:** ATE Sales Report Bot (LINE-based AI sales reporting system)

---

## Table of Contents

1. [Document Overview](#1-document-overview)
2. [Privacy Policy — Sales Activity Data Processing (Bilingual)](#2-privacy-policy)
3. [Record of Processing Activities (ROPA)](#3-record-of-processing-activities)
4. [Internal Data Processing Notice for Sales Representatives](#4-internal-data-processing-notice)
5. [Data Retention & Deletion Policy](#5-data-retention--deletion-policy)
6. [Data Subject Rights Request Procedure](#6-data-subject-rights-request-procedure)
7. [Data Breach Response Plan](#7-data-breach-response-plan)
8. [Data Processing Agreements (DPA) Register](#8-data-processing-agreements-register)
9. [Cross-Border Data Transfer Assessment](#9-cross-border-data-transfer-assessment)
10. [AI Data Processing Disclosure](#10-ai-data-processing-disclosure)
11. [Consent & Lawful Basis Register](#11-consent--lawful-basis-register)
12. [Annual Compliance Review Checklist](#12-annual-compliance-review-checklist)

---

## 1. Document Overview

### Purpose

This document package provides the complete set of PDPA compliance documentation required for ATE's AI-powered sales reporting system. It covers all obligations under Thailand's Personal Data Protection Act (PDPA / พ.ร.บ.คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562) as they apply to the collection, processing, storage, and transfer of personal data through the ATE Sales Report Bot.

### Scope

This package covers personal data processed through:
- The LINE Messaging API (message receipt and delivery)
- The ATE Sales Report Bot (Vercel serverless functions)
- Google Gemini AI and Groq AI (natural language processing)
- Google Sheets (data storage)
- Looker Studio (data visualization)
- GitHub Actions (automated notifications)

### Data Subjects Covered

1. **ATE Sales Representatives** (11 employees) — whose names, LINE user IDs, and message content are processed
2. **Customer Contacts** (natural persons) — whose names, phone numbers, and email addresses are reported by sales reps

> **Note:** Company names and deal values are business information about juristic persons, which are not "data subjects" under PDPA. Only natural-person contact information constitutes personal data.

### Applicable Law

- Thailand Personal Data Protection Act B.E. 2562 (2019), Sections 19-42
- PDPA Subordinate Legislation and Notifications issued by the Personal Data Protection Committee (PDPC)
- Royal Decree on Security Measures for Personal Data Processing Systems B.E. 2563

---

## 2. Privacy Policy

### Privacy Policy — Sales Activity Data Processing

*For publication on ate.co.th and communication to business partners*

---

#### นโยบายความเป็นส่วนตัว — การประมวลผลข้อมูลกิจกรรมการขาย
#### Privacy Policy — Sales Activity Data Processing

**ผู้ควบคุมข้อมูลส่วนบุคคล / Data Controller:**
บริษัท แอดวานซ์ เทคโนโลยี อิควิปเม้นท์ จำกัด (ATE)
Advanced Technology Equipment Co., Ltd. (ATE)

**วันที่มีผลบังคับใช้ / Effective Date:** [INSERT DATE]

---

**1. ข้อมูลส่วนบุคคลที่เราเก็บรวบรวม / Personal Data We Collect**

บริษัทฯ เก็บรวบรวมข้อมูลส่วนบุคคลต่อไปนี้ผ่านระบบรายงานการขาย:
ATE collects the following personal data through our sales reporting system:

| ประเภทข้อมูล / Data Type | รายละเอียด / Details | แหล่งที่มา / Source |
|---|---|---|
| ชื่อผู้ติดต่อลูกค้า / Customer contact name | ชื่อ-นามสกุลของผู้ติดต่อทางธุรกิจ / Name of business contact person | รายงานจากพนักงานขาย / Reported by sales representative |
| ข้อมูลการติดต่อ / Contact information | หมายเลขโทรศัพท์ อีเมล / Phone number, email address | รายงานจากพนักงานขาย / Reported by sales representative |
| ชื่อบริษัทลูกค้า / Customer company name | ชื่อองค์กรทางธุรกิจ / Business organization name | รายงานจากพนักงานขาย / Reported by sales representative |
| ข้อมูลการขาย / Sales information | สินค้า มูลค่าดีล สถานะ / Product, deal value, status | รายงานจากพนักงานขาย / Reported by sales representative |

**หมายเหตุ:** ระบบไม่เก็บรวบรวมข้อมูลส่วนบุคคลที่มีความอ่อนไหว (sensitive data) เช่น ข้อมูลสุขภาพ ข้อมูลชีวภาพ ศาสนา หรือความคิดเห็นทางการเมือง
**Note:** The system does not collect sensitive personal data such as health data, biometric data, religion, or political opinions.

---

**2. วัตถุประสงค์ในการประมวลผล / Purpose of Processing**

บริษัทฯ ประมวลผลข้อมูลส่วนบุคคลเพื่อวัตถุประสงค์ดังต่อไปนี้:
ATE processes personal data for the following purposes:

| # | วัตถุประสงค์ / Purpose | ฐานกฎหมาย / Lawful Basis |
|---|---|---|
| 1 | การบริหารจัดการกิจกรรมการขายและติดตามท่อส่ง (pipeline) / Sales activity management and pipeline tracking | ประโยชน์โดยชอบด้วยกฎหมาย (มาตรา 24(5)) / Legitimate interest (Section 24(5)) |
| 2 | การจัดทำรายงานการขายสำหรับผู้บริหาร / Sales reporting for management | ประโยชน์โดยชอบด้วยกฎหมาย (มาตรา 24(5)) / Legitimate interest (Section 24(5)) |
| 3 | การติดตามและดูแลความสัมพันธ์กับลูกค้า / Customer relationship management and follow-up | ความจำเป็นตามสัญญา (มาตรา 24(3)) / Contractual necessity (Section 24(3)) |
| 4 | การวิเคราะห์ประสิทธิภาพการขายตามกลุ่มสินค้า / Sales performance analysis by product segment | ประโยชน์โดยชอบด้วยกฎหมาย (มาตรา 24(5)) / Legitimate interest (Section 24(5)) |

---

**3. ระยะเวลาการเก็บรักษา / Retention Period**

| ประเภทข้อมูล / Data Type | ระยะเวลา / Period |
|---|---|
| ข้อมูลกิจกรรมการขายที่ใช้งาน / Active sales activity data | 2 ปีนับจากวันที่บันทึก / 2 years from recording date |
| ข้อมูลจัดเก็บถาวร (archived) / Archived data | 3 ปีเพิ่มเติม (รวม 5 ปี) แล้วลบ / 3 additional years (5 years total), then deleted |
| ข้อมูลพนักงานขาย (Rep Registry) / Sales rep data | ตลอดระยะเวลาการจ้างงาน + 1 ปี / Duration of employment + 1 year |

---

**4. การเปิดเผยข้อมูล / Data Disclosure**

บริษัทฯ อาจเปิดเผยข้อมูลส่วนบุคคลให้แก่บุคคลดังต่อไปนี้:
ATE may disclose personal data to the following parties:

| ผู้รับข้อมูล / Recipient | วัตถุประสงค์ / Purpose | ที่ตั้ง / Location |
|---|---|---|
| Google LLC (Gemini AI, Google Sheets, Looker Studio) | ประมวลผลภาษาธรรมชาติ และจัดเก็บข้อมูล / Natural language processing and data storage | สหรัฐอเมริกา / United States |
| Groq Inc. (Groq AI) | ประมวลผลภาษาธรรมชาติสำรอง / Backup natural language processing | สหรัฐอเมริกา / United States |
| Vercel Inc. | โฮสต์ระบบประมวลผล / System hosting | สหรัฐอเมริกา / United States |
| LINE Corporation | รับ-ส่งข้อความ / Message transmission | ญี่ปุ่น / Japan |

การส่งข้อมูลไปยังต่างประเทศอยู่ภายใต้มาตรการคุ้มครองที่เหมาะสม ตามมาตรา 28 แห่ง พ.ร.บ.คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562
Cross-border transfers are subject to adequate safeguards under PDPA Section 28.

---

**5. สิทธิของเจ้าของข้อมูล / Data Subject Rights**

ท่านมีสิทธิตาม พ.ร.บ.คุ้มครองข้อมูลส่วนบุคคล ดังนี้:
You have the following rights under the PDPA:

| สิทธิ / Right | มาตรา / Section | คำอธิบาย / Description |
|---|---|---|
| สิทธิในการเข้าถึง / Right of access | 30 | ขอสำเนาข้อมูลส่วนบุคคลที่เกี่ยวกับท่าน / Request a copy of your personal data |
| สิทธิในการแก้ไข / Right to rectification | 35 | ขอแก้ไขข้อมูลที่ไม่ถูกต้อง / Request correction of inaccurate data |
| สิทธิในการลบ / Right to erasure | 33(1) | ขอลบข้อมูลที่ไม่จำเป็นอีกต่อไป / Request deletion when data is no longer necessary |
| สิทธิในการระงับการประมวลผล / Right to restriction | 34 | ขอจำกัดการประมวลผลข้อมูล / Request restriction of processing |
| สิทธิในการโอนย้าย / Right to data portability | 31 | ขอรับข้อมูลในรูปแบบที่อ่านได้ด้วยเครื่อง / Request data in machine-readable format |
| สิทธิในการคัดค้าน / Right to object | 32 | คัดค้านการประมวลผลตามประโยชน์โดยชอบ / Object to legitimate interest processing |
| สิทธิในการร้องเรียน / Right to complain | 73 | ยื่นเรื่องร้องเรียนต่อคณะกรรมการคุ้มครองข้อมูลส่วนบุคคล / Lodge a complaint with the Personal Data Protection Committee (PDPC) at https://www.pdpc.or.th |

---

**6. ช่องทางการติดต่อ / Contact Information**

เจ้าหน้าที่คุ้มครองข้อมูลส่วนบุคคล / Data Protection Officer (or designated contact):

- อีเมล / Email: privacy@ate.co.th
- โทรศัพท์ / Phone: [INSERT PHONE NUMBER]
- ที่อยู่ / Address: [INSERT ATE REGISTERED ADDRESS]

ท่านสามารถยื่นคำร้องใช้สิทธิผ่านช่องทางข้างต้น บริษัทฯ จะดำเนินการภายใน 30 วันนับจากวันที่ได้รับคำร้อง
You may exercise your rights through the above channels. ATE will respond within 30 days of receipt.

---

**7. การเปลี่ยนแปลงนโยบาย / Policy Changes**

บริษัทฯ อาจแก้ไขนโยบายนี้เป็นครั้งคราว การเปลี่ยนแปลงจะประกาศผ่านเว็บไซต์ ate.co.th
ATE may update this policy from time to time. Changes will be published on ate.co.th.

---

## 3. Record of Processing Activities

*Required under PDPA Section 39*

### ROPA — ATE Sales Report System

| Field | Details |
|-------|---------|
| **Data Controller** | Advanced Technology Equipment Co., Ltd. (ATE) |
| **Representative** | [INSERT NAME, TITLE] |
| **Contact** | privacy@ate.co.th, [INSERT PHONE] |
| **DPO (if appointed)** | [INSERT NAME or "Not appointed — under 50 employees exemption consideration"] |

### Processing Activity 1: Sales Activity Recording

| Field | Details |
|-------|---------|
| **Activity Name** | Sales Activity Recording via LINE Chat Bot |
| **Purpose** | Record and track sales activities, customer interactions, pipeline management, and reporting |
| **Lawful Basis** | Legitimate Interest (PDPA Section 24(5)) — ATE has a legitimate business interest in managing its sales pipeline. This does not override data subjects' rights as the data is business contact information provided voluntarily in a B2B commercial context. |
| **Categories of Data Subjects** | (1) ATE sales representatives (employees), (2) Customer business contacts |
| **Categories of Personal Data** | Names, phone numbers, email addresses, job titles (inferred), company names, deal values |
| **Sensitive Data** | None collected |
| **Source of Data** | Sales representatives' LINE messages reporting their daily activities |
| **Recipients** | ATE sales management (Google Sheets, Looker Studio viewers), AI processing providers (Google Gemini, Groq — transient processing only) |
| **Cross-Border Transfer** | Yes — to Google (US), Groq (US), Vercel (US), LINE (Japan). Transfers are based on adequate safeguards including provider DPAs and standard contractual clauses. |
| **Retention Period** | 2 years active + 3 years archived = 5 years total from recording, then deleted |
| **Technical Measures** | HMAC-SHA256 webhook authentication, platform-managed encryption of environment variables, formula injection protection, constant-time auth comparison, event deduplication, AI output validation, 1MB request body size limit, 2000-character message length guard, Google Sheets tab protection. Logging uses pseudonymized user IDs (no customer PII in logs; rep names excluded from log output). |
| **Organizational Measures** | Access limited to sales management and authorized IT personnel. LINE user allowlist (`ALLOWED_USER_IDS`) restricts bot access to authorized reps only. Ownership verification prevents cross-rep data modification. Quarterly secret rotation. Annual compliance review. |

### Processing Activity 2: Sales Representative Registration

| Field | Details |
|-------|---------|
| **Activity Name** | LINE User Registration in Rep Registry |
| **Purpose** | Map LINE user IDs to display names for push notifications and access control |
| **Lawful Basis** | Contractual Necessity (PDPA Section 24(3)) — necessary for the employment relationship and use of company tools |
| **Categories of Data Subjects** | ATE sales representatives (employees) |
| **Categories of Personal Data** | LINE user ID (pseudonymous identifier), LINE display name, last active timestamp |
| **Retention Period** | Duration of employment + 1 year |
| **Storage Location** | Google Sheets (Rep Registry tab) |

### Processing Activity 3: Stale Deal Notifications

| Field | Details |
|-------|---------|
| **Activity Name** | Weekly Push Notifications for Stale Deals |
| **Purpose** | Notify sales reps of deals with no activity updates in 7+ days |
| **Lawful Basis** | Legitimate Interest (PDPA Section 24(5)) |
| **Categories of Data Subjects** | ATE sales representatives, customer companies (names mentioned in notifications) |
| **Categories of Personal Data** | Rep LINE user ID (for push delivery), customer company names, product names, deal values (aggregated in notification text) |
| **Retention Period** | Notifications are transient (not stored after delivery). Underlying deal data follows Activity 1 retention. |

### Processing Activity 4: AI-Powered Natural Language Processing

| Field | Details |
|-------|---------|
| **Activity Name** | Thai Language Parsing of Sales Messages |
| **Purpose** | Convert unstructured Thai text messages into structured data fields |
| **Lawful Basis** | Legitimate Interest (PDPA Section 24(5)) — automated data extraction is essential to the system's function and reduces manual data entry burden on employees |
| **Categories of Data Subjects** | Customer contacts (names, phone numbers, emails mentioned in messages), ATE sales reps (message content) |
| **Categories of Personal Data** | Customer names, phone numbers, email addresses, company names, deal values — as contained in the free-text message |
| **Data Processors** | Google LLC (Gemini 2.5 Flash API), Groq Inc. (Llama 3.3 70B API — fallback only) |
| **Data Retention at Processor** | Google Gemini API: ATE must verify current free-tier terms regarding training data use. If free-tier permits training, ATE must upgrade to paid tier (Vertex AI) which contractually prohibits training. **Action: Verify before production launch.** Groq: disabled in production (no DPA available for free tier). |
| **Cross-Border Transfer** | Yes — message text containing PII is sent to US-based AI providers for parsing |
| **Safeguards** | Provider DPAs, API terms prohibiting training on customer data, HTTPS encryption in transit |

---

## 4. Internal Data Processing Notice

*For distribution to the 11 sales representatives*

---

### แจ้งเตือนการประมวลผลข้อมูลส่วนบุคคล — ระบบรายงานการขาย ATE
### Personal Data Processing Notice — ATE Sales Report System

**ถึง:** พนักงานขายภาคสนามทุกท่าน
**To:** All Field Sales Representatives

**จาก:** ฝ่ายบริหาร บริษัท แอดวานซ์ เทคโนโลยี อิควิปเม้นท์ จำกัด
**From:** Management, Advanced Technology Equipment Co., Ltd.

**วันที่ / Date:** [INSERT DATE]

---

สวัสดีครับทีมขาย

**ทำไมถึงมีเอกสารนี้?**
กฎหมาย PDPA กำหนดให้บริษัทต้องแจ้งให้พนักงานทราบว่าระบบเก็บข้อมูลอะไรบ้าง ไม่ได้หมายความว่าบริษัทเพิ่งเริ่มเก็บข้อมูล หรือเก็บมากขึ้น — แค่แจ้งให้ทราบอย่างเป็นทางการ ระบบ bot ทำงานเหมือนเดิมทุกอย่าง สิ่งที่เปลี่ยนคือตอนนี้ทุกคนมีสิทธิตามกฎหมายที่จะรู้ว่าข้อมูลอะไรถูกเก็บ และมีสิทธิขอดู แก้ไข หรือลบข้อมูลได้ — ซึ่งเป็นสิทธิของทุกคน ไม่ใช่เรื่องเกี่ยวกับการตรวจสอบการทำงาน

**Why does this document exist?**
PDPA requires companies to inform employees about data collection. Nothing about the bot system has changed — this is a legal formality. Everyone now has a right to know what data is collected and to request access, correction, or deletion.

---

ขอแจ้งให้ทุกคนทราบเรื่องข้อมูลที่ระบบ bot เก็บนะครับ:

---

**ข้อมูลที่ระบบเก็บรวบรวมจากท่าน / Data Collected From You:**

| ข้อมูล / Data | รายละเอียด / Details |
|---|---|
| ชื่อที่แสดงใน LINE / LINE display name | ใช้ระบุผู้รายงานในระบบ / Used to identify the reporter |
| LINE User ID | ใช้ส่งการแจ้งเตือน (stale deal) / Used for push notifications |
| เนื้อหาข้อความ / Message content | ประมวลผลด้วย AI เพื่อสกัดข้อมูลการขาย / Processed by AI to extract sales data |
| เวลาที่ส่งข้อความ / Message timestamp | บันทึกเป็น timestamp ในระบบ / Recorded as system timestamp |

**ข้อมูลลูกค้าที่ท่านรายงาน / Customer Data You Report:**

| ข้อมูล / Data | รายละเอียด / Details |
|---|---|
| ชื่อบริษัทลูกค้า / Customer company name | บันทึกในระบบ / Recorded in system |
| ชื่อผู้ติดต่อ / Contact person name | บันทึกในระบบ / Recorded in system |
| เบอร์โทร/อีเมล / Phone/email | บันทึกในระบบ — ข้อมูลบังคับ / Recorded — mandatory field |
| มูลค่าดีล สินค้า สถานะ / Deal value, product, status | บันทึกในระบบ / Recorded in system |

---

**วัตถุประสงค์ / Purpose:**
เพื่อบริหารจัดการท่อส่งการขาย (sales pipeline) จัดทำรายงาน และติดตามกิจกรรมการขาย
For sales pipeline management, reporting, and activity tracking.

**การจัดเก็บ / Storage:**
ข้อมูลจัดเก็บใน Google Sheets ภายใต้บัญชี Google ของบริษัท เข้าถึงได้โดยฝ่ายบริหารการขายและเจ้าหน้าที่ IT ที่ได้รับอนุญาตเท่านั้น
Data is stored in Google Sheets under the company Google account, accessible only by sales management and authorized IT personnel.

**การเก็บข้อความต้นฉบับ / Raw Message Storage:**
ข้อความต้นฉบับที่ท่านส่งจะถูกเก็บไว้ในระบบเป็นเวลา 2 ปีเพื่อการตรวจสอบ (audit trail)
Your original message text is retained in the system for 2 years for audit purposes.

**การส่งข้อมูลไปต่างประเทศ / Cross-Border Transfer:**
ข้อความที่ท่านส่งจะถูกประมวลผลผ่าน Google Gemini AI (สหรัฐอเมริกา) เพื่อแปลงเป็นข้อมูลที่มีโครงสร้าง
Your messages are processed through Google Gemini AI (United States) for structured data extraction.

> หมายเหตุ: ATE จะตรวจสอบเงื่อนไขการใช้ข้อมูลของผู้ให้บริการ AI เป็นประจำทุกปี เพื่อให้แน่ใจว่าข้อมูลไม่ถูกนำไปใช้ฝึกสอนโมเดล
> Note: ATE verifies AI provider data usage terms annually to ensure data is not used for model training.

**ระยะเวลาเก็บรักษา / Retention:**
2 ปีในระบบหลัก จากนั้นจัดเก็บเป็นข้อมูลเก่า 5 ปี แล้วลบ
2 years in the active system, then archived for 5 years, then deleted.

**สิทธิของท่าน / Your Rights:**
ท่านมีสิทธิขอเข้าถึง แก้ไข ลบ หรือโอนย้ายข้อมูลส่วนบุคคลของท่านได้ โดยติดต่อ privacy@ate.co.th
You have the right to access, rectify, delete, or transfer your personal data by contacting privacy@ate.co.th.

---

**การรับทราบ / Acknowledgment:**

ท่านสามารถรับทราบได้โดยตอบ **"รับทราบ"** ในกลุ่ม LINE ของทีมขาย ภายในวันที่ [INSERT DATE]
You may acknowledge by replying **"รับทราบ"** in the sales team LINE group by [INSERT DATE].

> ระบบจะ screenshot คำตอบเพื่อเก็บเป็นหลักฐาน / LINE replies will be screenshotted as the acknowledgment record.

**ทางเลือก (สำหรับเก็บเอกสาร) / Alternative (for filing):**

| | |
|---|---|
| ชื่อ-นามสกุล / Full Name | _____________________________ |
| ลายมือชื่อ / Signature | _____________________________ |
| วันที่ / Date | _____________________________ |

---

## 5. Data Retention & Deletion Policy

### Policy Statement

ATE retains personal data processed through the Sales Report System only for as long as necessary to fulfill the purposes for which it was collected, and in compliance with PDPA Section 37(3).

### Retention Schedule

| Data Category | Active Retention | Archive Retention | Total | Deletion Method |
|---------------|-----------------|-------------------|-------|----------------|
| **Sales activity data** (Combined tab) | 2 years from recording date | 3 additional years in archive tab | 5 years total | Anonymization + row removal from active sheet. Archive workbook deleted entirely after retention period. |
| **Audit trail** (Live Data tab) | 2 years | 3 additional years in archive workbook | 5 years total | Same as above |
| **Raw message text** (column T) | 2 years | Deleted at archival (not carried to archive) | 2 years | Overwritten with "[archived]" at archival |
| **Rep Registry** (user IDs, names) | Duration of employment | 1 year after departure | Employment + 1 year | Row deletion |
| **System logs** (Vercel/Axiom) | 30 days (Axiom free tier) | Not archived | 30 days | Automatic expiry |
| **Weekly CSV backups** | 8 weeks rolling | Not archived beyond 8 weeks | 8 weeks | Oldest backup deleted when new one is created |

### Archival Procedure (Annual — January)

1. Export all rows from the "Combined" tab where Timestamp is older than 2 years
2. Move exported rows to an "Archive_[YEAR]" tab in a separate Google Sheets workbook ("ATE Sales Report — Archive")
3. In the archive copy, overwrite the "Raw Message" column (T) with "[archived]" to reduce PII retention
4. Delete the original archived rows from the "Combined" tab
5. The "Live Data" tab follows the same procedure on the same schedule
6. Log the archival action with date, row count, and operator name

### Deletion Procedure (5 Years After Recording)

1. Delete the relevant "Archive_[YEAR]" tab from the archive workbook
2. Empty the Google Sheets trash (Sheets retains deleted sheets for 30 days)
3. Document the deletion in the compliance log

### Ad-Hoc Deletion (Data Subject Requests)

When a data subject (customer contact) requests deletion under PDPA Section 33(1):

1. Search all tabs (Combined, Live Data, Archive) for rows containing the requester's name, phone number, or email
2. Delete or anonymize the personal data fields (columns C, D, E) in matching rows
3. Retain anonymized rows for aggregate reporting (replace PII with "[deleted per PDPA request]")
4. Respond to the data subject within 30 days confirming deletion
5. Document the request and action in the compliance log

---

## 6. Data Subject Rights Request Procedure

### Overview

Under PDPA Sections 30-36, data subjects have the right to access, rectify, delete, restrict, port, and object to the processing of their personal data.

### Contact Channel

- **Email:** privacy@ate.co.th
- **Response deadline:** 30 days from receipt of a valid request
- **Responsible person:** [INSERT NAME/TITLE — e.g., IT Manager or designated DPO]

### Request Types and Handling

#### 6.1 Right of Access (Section 30)

| Step | Action | Timeline |
|------|--------|----------|
| 1 | Receive request via privacy@ate.co.th | Day 0 |
| 2 | Verify identity of requester (request copy of ID or business card) | Days 1-3 |
| 3 | Search Google Sheets (Combined + Live Data + Archive) for requester's data | Days 3-5 |
| 4 | Compile a summary of all personal data held | Days 5-10 |
| 5 | Send response to requester with data summary | Within 30 days |

**Format:** Export matching rows from Google Sheets as CSV or PDF. Redact other data subjects' PII in the same rows before providing.

#### 6.2 Right to Rectification (Section 35)

| Step | Action | Timeline |
|------|--------|----------|
| 1 | Receive request identifying incorrect data | Day 0 |
| 2 | Verify identity and verify the correction is factually accurate | Days 1-5 |
| 3 | Update the relevant cells in Combined, Live Data, and Archive tabs | Days 5-10 |
| 4 | Confirm correction to the requester | Within 30 days |

#### 6.3 Right to Erasure (Section 33(1))

| Step | Action | Timeline |
|------|--------|----------|
| 1 | Receive deletion request | Day 0 |
| 2 | Verify identity | Days 1-3 |
| 3 | Assess whether deletion is permitted (check for legal retention obligations, ongoing disputes) | Days 3-7 |
| 4 | If permitted: anonymize PII in all matching rows (replace with "[deleted per PDPA request]") | Days 7-15 |
| 5 | Retain anonymized rows for aggregate business reporting | — |
| 6 | Confirm deletion to the requester | Within 30 days |

**Grounds for refusal:**
- Data is required for compliance with a legal obligation
- Data is necessary for the establishment, exercise, or defense of legal claims
- Data is used for archiving in the public interest, scientific/historical research, or statistics (with appropriate safeguards)

#### 6.4 Right to Data Portability (Section 31)

| Step | Action | Timeline |
|------|--------|----------|
| 1 | Receive portability request | Day 0 |
| 2 | Verify identity | Days 1-3 |
| 3 | Export requester's data from Google Sheets as CSV | Days 3-10 |
| 4 | Provide data file to requester (or transmit to another controller if technically feasible) | Within 30 days |

#### 6.5 Right to Object (Section 32)

| Step | Action | Timeline |
|------|--------|----------|
| 1 | Receive objection to processing based on legitimate interest | Day 0 |
| 2 | Assess whether ATE's legitimate interest overrides the data subject's rights | Days 1-15 |
| 3 | If objection upheld: cease processing the requester's data and anonymize existing records | Days 15-25 |
| 4 | Inform the requester of the decision | Within 30 days |

### Request Log

All data subject requests must be logged in a dedicated register:

| Date Received | Requester Name | Request Type | Data Affected | Decision | Completion Date | Handler |
|---|---|---|---|---|---|---|

This log is maintained at: [INSERT LOCATION — e.g., a dedicated Google Sheet or internal system]

---

## 7. Data Breach Response Plan

### Definition

A personal data breach is a security incident that leads to the accidental or unlawful destruction, loss, alteration, unauthorized disclosure of, or access to personal data.

### Severity Classification

| Level | Description | Examples |
|-------|-------------|---------|
| **Critical** | Large-scale exposure of customer PII (names + phone numbers + deal values) to unauthorized parties | Google Sheet shared publicly by mistake. Service account key published on GitHub. Database export sent to wrong email. |
| **High** | Limited exposure of PII or compromise of system credentials | Single API key leaked in logs. Unauthorized person gains LINE bot access. |
| **Medium** | Potential exposure with no confirmed unauthorized access | Vercel dashboard accessed by unauthorized person but no data downloaded. Suspicious login to GCP project. |
| **Low** | Technical vulnerability identified but not exploited | Misconfigured permissions detected during audit. Outdated dependency with known CVE. |

### Response Procedure

#### Phase 1: Detection & Containment (0-4 hours)

| Step | Action | Who |
|------|--------|-----|
| 1 | Identify the breach: what data, how many records, what caused it | Developer / IT |
| 2 | Contain the breach immediately: revoke compromised credentials, disable access, change passwords | Developer / IT |
| 3 | Preserve evidence: screenshot logs, export affected records, document timeline | Developer |
| 4 | Notify internal stakeholders: IT Manager, Management | Developer |

#### Phase 2: Assessment (4-24 hours)

| Step | Action | Who |
|------|--------|-----|
| 5 | Determine scope: how many data subjects affected, what types of PII exposed | Developer / IT |
| 6 | Assess risk: is the breach likely to cause serious harm to data subjects? | Management / Legal |
| 7 | Document the assessment in the breach register | IT |

#### Phase 3: Notification (24-72 hours)

**PDPA Section 37(4) requires notification to the PDPC within 72 hours** if the breach is likely to result in high risk to the rights and freedoms of data subjects.

| Condition | Action Required |
|-----------|----------------|
| Breach affects >100 data subjects with full PII (name + phone/email) | Notify PDPC within 72 hours. Notify affected data subjects without undue delay. |
| Breach affects <100 data subjects with limited PII | Notify PDPC within 72 hours. Consider notifying affected data subjects. |
| Breach involves credential compromise but no confirmed data access | Notify PDPC if there is a reasonable likelihood of data access. |
| Technical vulnerability with no exploitation | No notification required. Document and remediate. |

**PDPC Notification Channel:**
- Website: https://www.pdpc.or.th
- Email: [CHECK CURRENT PDPC CONTACT]
- The notification must include: nature of breach, categories and approximate number of data subjects, likely consequences, measures taken to address the breach

#### Phase 4: Remediation (1-30 days)

| Step | Action | Who |
|------|--------|-----|
| 8 | Implement permanent fix for the root cause | Developer |
| 9 | Rotate all potentially compromised credentials | Developer / IT |
| 10 | Review and update security measures | Developer / IT |
| 11 | Update this response plan if gaps were identified | IT |
| 12 | Conduct post-incident review with lessons learned | All stakeholders |

### Breach Register

All breaches (including near-misses) must be logged:

| Date | Description | Severity | Data Affected | Subjects Affected | PDPC Notified? | Subjects Notified? | Remediation | Lessons Learned |
|---|---|---|---|---|---|---|---|---|

---

## 8. Data Processing Agreements Register

### Overview

Under PDPA Section 40, ATE must ensure that all data processors have adequate data protection measures. This register tracks the DPA status with each provider.

| # | Provider | Role | Data Processed | DPA Status | DPA Location | Review Date |
|---|----------|------|---------------|-----------|-------------|-------------|
| 1 | **Google LLC** (Sheets, Gemini, Looker) | Data Processor | All 24-column sales data, message text for AI parsing, dashboard visualization | Google Cloud DPA (automatic for Workspace accounts). For consumer accounts: Google ToS includes data processing terms. | https://cloud.google.com/terms/data-processing-addendum | [INSERT] |
| 2 | **Vercel Inc.** | Data Processor | Message payloads in transit, function execution logs | DPA available on Pro and Enterprise plans. **NOT available on Hobby plan.** | https://vercel.com/legal/dpa | [INSERT] |
| 3 | **LINE Corporation** | Data Processor | Message content in transit, LINE user IDs, display names | LINE for Business Terms of Service include data processing provisions. LINE has a Thailand entity (LINE Company (Thailand) Limited). | LINE Developer Agreement + LINE Official Account Terms | [INSERT] |
| 4 | **Groq Inc.** | Data Processor | Message text for AI parsing (fallback only) | **DISABLED in production** — no DPA available for free tier. `GROQ_API_KEY` set to empty in production environment. May re-enable with paid plan + DPA in future. | N/A (disabled) | N/A |
| 5 | **GitHub (Microsoft)** | Data Processor | Source code, GitHub Actions logs (no customer PII in code) | GitHub DPA available. Low risk — no customer PII in the repository. | https://github.com/customer-terms | [INSERT] |
| 6 | **Axiom** (planned) | Data Processor | Structured function logs (no customer PII if logging policy followed) | **VERIFY before onboarding.** Free tier DPA availability. | [CHECK] | [INSERT] |

### Action Items

- [ ] Verify Vercel Pro DPA is activated upon upgrade
- [x] Groq fallback disabled in production (no DPA available for free tier). Re-enable only with paid plan + formal DPA.
- [ ] Verify Axiom DPA before connecting log drain
- [ ] Set annual DPA review calendar reminder

---

## 9. Cross-Border Data Transfer Assessment

### PDPA Section 28 Requirements

Cross-border transfers of personal data are permitted when:
1. The destination country has adequate data protection standards, OR
2. The transfer is necessary for contract performance, OR
3. The data subject has given explicit consent, OR
4. The transfer is subject to appropriate safeguards (binding corporate rules, standard contractual clauses, etc.)

### Transfer Assessment

| # | Transfer | From | To | Data Transferred | Lawful Basis for Transfer | Safeguards |
|---|----------|------|-----|-----------------|--------------------------|------------|
| 1 | Sales message → Gemini AI | Thailand (LINE user) → US (Vercel) → US (Google) | Customer names, phones, emails, deal values embedded in Thai text | **Rep data:** Contractual necessity, Section 28(3). **Customer data:** Appropriate safeguards, Section 28(4) — via Google Cloud DPA and standard contractual clauses. | Google Cloud DPA, HTTPS encryption in transit |
| 2 | Sales message → Groq AI (fallback) | Thailand → US (Groq) | Same as above (fallback only) | **DISABLED in production** — Groq fallback not active. No cross-border transfer occurs. | N/A (disabled) |
| 3 | Parsed data → Google Sheets | Thailand → US/Global (Google) | 24-column structured data including PII | **Rep data:** Contractual necessity, Section 28(3). **Customer data:** Appropriate safeguards, Section 28(4) — via Google DPA. | Google Workspace DPA, platform-managed encryption at rest |
| 4 | LINE messages | Thailand → Japan/Global (LINE) | Message content in transit | Contractual necessity, Section 28(3) — LINE is the communication platform contracted for business use | LINE for Business terms |
| 5 | Function logs → Axiom (planned) | US (Vercel) → US (Axiom) | Structured logs — NO customer PII if logging policy followed | Legitimate interest (system operations) | Axiom DPA (verify), HTTPS |
| 6 | Stale deal notifications → LINE Push | US (Vercel) → Japan (LINE) → Thailand (rep) | Customer names, deal values (aggregated in notification text) | Legitimate interest | LINE for Business terms |

### Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| AI provider uses customer data for model training | Low (prohibited by current API terms) | High | Verify API terms annually. Consider PII masking before AI submission (future enhancement). |
| Data exposed during transit | Very Low | High | All transfers use HTTPS/TLS encryption |
| Foreign government data access request | Very Low | Medium | Google and Vercel comply with court orders in their jurisdictions. ATE's B2B sales data is unlikely to be targeted. |
| Provider data breach | Low | High | DPAs require breach notification. ATE's breach response plan (Section 7) covers this. |

---

## 10. AI Data Processing Disclosure

### Purpose

This section documents how personal data is processed by third-party AI providers, as required for transparency under PDPA Section 23.

### Google Gemini 2.5 Flash (Primary AI Provider)

| Aspect | Details |
|--------|---------|
| **Provider** | Google LLC, via Generative Language API |
| **API endpoint** | `generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash` |
| **Data sent** | Complete LINE message text from sales reps. This may include: customer names, phone numbers, email addresses, company names, product names, deal values, and free-text notes — all in Thai or mixed Thai/English. |
| **Data returned** | Structured JSON with extracted fields (customer, product, value, stage, etc.) and a Thai confirmation message. |
| **Data retention by Google** | Per Google Gemini API Terms of Service: API inputs and outputs are NOT used for model training. Data is processed transiently and not retained beyond the API call. **VERIFY: this applies to the free tier as of current date.** |
| **Data location** | Processed on Google's infrastructure (primarily US). |
| **Encryption** | HTTPS/TLS in transit. Google's infrastructure encryption at rest. |

### Groq Llama 3.3 70B (Fallback AI Provider)

| Aspect | Details |
|--------|---------|
| **Provider** | Groq Inc., via OpenAI-compatible API |
| **API endpoint** | `api.groq.com/openai/v1/chat/completions` |
| **Data sent** | Same as Gemini (complete LINE message text) — only when Gemini fails. |
| **Data returned** | Same structured JSON format. |
| **Data retention by Groq** | Per Groq Terms of Service: **VERIFY current terms regarding data retention and training data usage for free-tier accounts.** |
| **Usage frequency** | Fallback only — estimated <5% of total API calls under normal operation. |

### Recommendations

1. **Annual verification:** Review both providers' Terms of Service annually (January) to confirm data processing terms have not changed.
2. **PII masking (future enhancement):** Consider masking phone numbers and email addresses in the message text before sending to AI providers. The AI prompt could use placeholders: "contacted customer at [PHONE]" → AI extracts the placeholder → system re-injects the real value from the original message. This eliminates PII exposure to third-party AI entirely.
3. **Paid tier consideration:** If either provider changes free-tier terms to allow training on API data, upgrading to a paid tier (which typically includes stronger data processing commitments) is recommended.

---

## 11. Consent & Lawful Basis Register

### Overview

PDPA requires a lawful basis for each processing activity. This register documents the lawful basis chosen and the justification for each.

| # | Processing Activity | Lawful Basis | PDPA Section | Justification | Consent Required? |
|---|---------------------|-------------|-------------|---------------|-------------------|
| 1 | Recording sales activities from rep LINE messages | **Legitimate Interest** | 24(5) | ATE has a legitimate business interest in tracking sales pipeline. Processing is proportionate (only business contact data). Does not override data subjects' fundamental rights — the data is B2B commercial contact information voluntarily shared in business relationships. | No |
| 2 | Storing customer contact information (phone, email) | **Legitimate Interest** | 24(5) | Contact information is collected in the course of normal B2B business relationships. Customers reasonably expect their business contact details to be recorded by their suppliers/vendors. | No |
| 3 | Registering rep LINE user IDs | **Contractual Necessity** | 24(3) | Necessary for the performance of the employment relationship. Reps use the system as part of their job duties. | No |
| 4 | Sending stale deal push notifications | **Legitimate Interest** | 24(5) | Internal business communication. Only sent to ATE employees about their own deals. | No |
| 5 | AI processing of message content | **Legitimate Interest** | 24(5) | Automated data extraction is the core function of the system. Without AI processing, the system cannot operate. The processing is proportionate and data is not retained by AI providers. | No |
| 6 | Cross-border transfer to AI providers | **Appropriate Safeguards** (customer data) / **Contractual Necessity** (rep data) | 28(4) / 28(3) | Customer data transfers protected by Google Cloud DPA and standard contractual clauses. Rep data transfers necessary for employment tool use. | No |
| 7 | Dashboard visualization (Looker Studio) | **Legitimate Interest** | 24(5) | Business intelligence for sales management. Data is aggregated and access is restricted to authorized management personnel. | No |

### 11.1 Legitimate Interest Assessment (LIA)

*Required to support the use of Section 24(5) as a lawful basis*

#### LIA for Processing Activity 1: Sales Activity Recording

| Element | Assessment |
|---------|-----------|
| **What is ATE's legitimate interest?** | Managing ATE's B2B sales pipeline — tracking customer interactions, forecasting revenue, ensuring timely follow-up on deals, and providing visibility to management for strategic decisions. Without structured sales activity data, ATE cannot effectively manage its 11-person field sales team across hundreds of customer accounts. |
| **Is the processing necessary for that interest?** | Yes. The alternative (manual spreadsheet entry, email reports) has been tried and fails due to low compliance and incomplete data. Automated AI parsing of LINE messages is the minimum-friction approach that achieves adequate data completeness. Collecting customer contact information (name, phone, email) is necessary to identify the business contact, enable follow-up, and prevent duplicate reporting for the same customer. |
| **Could the purpose be achieved with less data?** | Partially. Company name and product/deal information could stand alone. However, contact person name and phone/email serve a critical business function: identifying the decision-maker, enabling follow-up if the sales rep is absent, and preventing confusion between contacts at the same company. These fields are proportionate to the business purpose. |
| **What are the data subjects' reasonable expectations?** | Customer contacts voluntarily provide their business card, phone number, or email to ATE's sales representatives during normal B2B commercial interactions. They reasonably expect this contact information to be recorded in ATE's internal sales management system. The use of AI to automate data entry does not change the nature of the processing — it replaces manual typing, not the business purpose. |
| **What is the impact on data subjects?** | Low. The data processed is standard B2B business contact information (not sensitive/private personal data). Data subjects are not profiled, scored, or subjected to automated decisions that affect them. The data is used solely for ATE's internal sales management. There is no risk of discrimination, financial loss, or reputational damage to data subjects from this processing. |
| **What safeguards are in place?** | (1) Data retention limited to 5 years total. (2) User allowlist restricts who can submit data. (3) Ownership checks prevent unauthorized modification. (4) Data subject rights (access, rectification, erasure, objection) are honored within 30 days. (5) Cross-border transfers protected by provider DPAs. (6) PII masking before AI submission planned as near-term enhancement. |
| **Balancing conclusion** | ATE's legitimate interest in sales pipeline management **does not override** data subjects' fundamental rights. The processing is proportionate (B2B contact data only), expected (normal business relationship), and safeguarded (retention limits, access controls, data subject rights). Legitimate interest under PDPA Section 24(5) is the appropriate lawful basis. |

#### LIA for Processing Activity 4: AI-Powered Natural Language Processing

| Element | Assessment |
|---------|-----------|
| **What is ATE's legitimate interest?** | Automated extraction of structured data from unstructured Thai-language sales reports, eliminating the need for manual data entry and enabling real-time pipeline visibility. |
| **Is the processing necessary?** | Yes. The system cannot function without AI parsing — the core value proposition is converting natural Thai text into structured fields. Manual data entry would negate the system's purpose and reduce adoption to near-zero. |
| **What is the impact on data subjects?** | Customer PII (names, phone numbers, emails) is transmitted to Google's Gemini AI API for transient processing. The data is not stored by the AI provider beyond the API call (subject to verification of current terms). The AI does not make decisions about data subjects — it only extracts data fields. |
| **Balancing conclusion** | The interest is legitimate, the processing is necessary, and the impact is low (transient processing with no retention or decisions). ATE commits to implementing PII masking before AI submission as a near-term enhancement to further reduce data subject exposure. |

---

### Why Consent Is Not Used

PDPA does not require consent for all processing — it provides multiple lawful bases. For this system:

- **Legitimate Interest** is the appropriate basis for B2B sales management because:
  - The data is business contact information (not personal/private data)
  - Data subjects (customer contacts) reasonably expect their business details to be recorded by suppliers
  - The processing is proportionate to the business purpose
  - Data subjects retain full PDPA rights (access, deletion, objection)

- **Consent** would be impractical and unnecessary because:
  - Reps cannot pause mid-customer-visit to obtain PDPA consent for recording the meeting
  - B2B contact information is exchanged voluntarily in commercial relationships
  - Consent can be withdrawn at any time, which would make the system unreliable
  - PDPA's legitimate interest provision was specifically designed for this type of routine business processing

- **However:** If ATE's legal counsel determines that consent is preferable (e.g., for enhanced customer trust or additional protection), a consent mechanism can be added as an optional layer without changing the system architecture.

---

## 12. Annual Compliance Review Checklist

*To be completed every January*

### Data Processing Review

- [ ] Review all processing activities in the ROPA — are they still accurate?
- [ ] Have any new data types been added to the system?
- [ ] Have any new third-party processors been added?
- [ ] Is the data retention schedule being followed? Were archival actions completed?
- [ ] Were any data subject requests received? Were they handled within 30 days?

### Legal & Terms Review

- [ ] Review Google Gemini API Terms of Service — any changes to data processing terms?
- [ ] Review Groq API Terms of Service — any changes?
- [ ] Review Vercel DPA — still valid and applicable?
- [ ] Review LINE for Business terms — any changes?
- [ ] Review PDPA regulations — any new subordinate legislation or PDPC guidance?
- [ ] Has the PDPC issued any enforcement actions relevant to similar systems?

### Technical Security Review

- [ ] All API keys and secrets rotated per schedule (Appendix B of Migration Plan)?
- [ ] Access controls reviewed — are only authorized users on the allowlist?
- [ ] Are structured logs being captured and retained (30 days)?
- [ ] Has the system been tested for common vulnerabilities?
- [ ] Are all dependencies up to date?

### Organizational Review

- [ ] Are all account ownership records up to date?
- [ ] Are at least 2 people authorized to manage each critical system?
- [ ] Has the incident response plan been reviewed and tested?
- [ ] Is the privacy policy on ate.co.th up to date?
- [ ] Have new employees been given the data processing notice?
- [ ] Have departing employees' access been revoked?

### Sign-off

| Role | Name | Signature | Date |
|------|------|-----------|------|
| IT Manager | | | |
| Sales Manager | | | |
| Management Representative | | | |

---

*End of PDPA Compliance Package*

*This document should be reviewed by ATE's legal counsel before formal adoption.*
*Next review date: January 2027*
