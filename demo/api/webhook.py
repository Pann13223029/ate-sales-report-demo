"""
ATE Sales Report Demo — Vercel Serverless Function
Receives LINE webhook → Gemini AI parses Thai message → Google Sheets → LINE reply
"""

import os
import sys
import json
import hashlib
import hmac
import base64
import re
import urllib.request
from http.server import BaseHTTPRequestHandler
from datetime import datetime, timezone, timedelta

# NOTE: google.generativeai, gspread, google.oauth2 are imported lazily
# inside functions to avoid module-level import errors on Vercel

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

LINE_CHANNEL_SECRET = os.environ.get("LINE_CHANNEL_SECRET", "")
LINE_CHANNEL_ACCESS_TOKEN = os.environ.get("LINE_CHANNEL_ACCESS_TOKEN", "")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
GOOGLE_SHEETS_ID = os.environ.get("GOOGLE_SHEETS_ID", "")
GOOGLE_SERVICE_ACCOUNT_JSON = os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON", "")

# Bangkok timezone (UTC+7)
BKK_TZ = timezone(timedelta(hours=7))

# ---------------------------------------------------------------------------
# Gemini prompt for Thai/English sales message parsing
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """You are a sales report data extraction assistant for ATE (Advanced Technology Equipment Co., Ltd.), a Thai B2B distributor of industrial equipment.

ATE distributes the following brands:
- Megger — electrical testing equipment (insulation testers, cable fault locators, transformer testers like MTO330, MIT525, MTO300, DLRO200, S1-1568)
- Fluke — electronic test tools (digital multimeters, thermal imagers, power quality analyzers like 1587 FC, 1770, 87V, Ti480 PRO, 435-II)
- CRC — industrial chemicals (contact cleaners like 2-26, Lectra Clean, lubricants, degreasers, Rust Remover)
- Salisbury — electrical safety equipment (insulating gloves, arc flash protection kits, hot sticks)
- SmartWasher — parts washing systems (bioremediating parts washers SW-28, OzzyJuice)
- IK Sprayer — industrial sprayers (pressure sprayers Pro 12, foam sprayers)
- HVOP (KATO tech) — high voltage operating products

Analyze the LINE message from a field sales rep and extract structured data.

RULES:
1. Messages will be in Thai, English, or mixed. Parse regardless of language.
2. If the message is NOT sales-related (casual chat, jokes, lunch plans), return is_sales_report: false.
3. Extract all fields you can identify. Use null for missing fields. NEVER fabricate data.
4. Parse Thai currency: "150K"=150000, "1.5ล้าน"=1500000, "แสนห้า"=150000, "สองแสน"=200000.
5. Parse Thai dates: "อังคารหน้า"=next Tuesday, "สัปดาห์หน้า"=next week, "25 มี.ค."=March 25. Output dates as YYYY-MM-DD.
6. Generate a Thai confirmation message (confirmation_th) to send back to the rep.
7. If the message is ambiguous, ask for clarification in the confirmation message.
8. For activity_type "sent_to_service" (warranty/repair), leave sales_stage as null.
9. If the rep mentions another person accompanying them (e.g. "กับน้องใหม่", "พาฝึกงาน", "ไปด้วยกัน"), extract accompanying_rep name and set is_training to true.
10. For closed deals (closed_won, closed_lost, job_expired, equipment_defect), extract close_reason: why won (discount given?), why lost (price? competitor?), why expired, or what defect occurred.

Return ONLY valid JSON matching this schema:
{
  "is_sales_report": boolean,
  "activities": [
    {
      "customer_name": "string or null",
      "contact_person": "string or null",
      "contact_channel": "phone|email|visit|null",
      "product_brand": "Megger|Fluke|CRC|Salisbury|SmartWasher|IK Sprayer|HVOP|Other|null",
      "product_name": "string or null",
      "quantity": number or null,
      "deal_value_thb": number or null,
      "activity_type": "visit|call|quotation|follow_up|closed_won|closed_lost|sent_to_service|other",
      "sales_stage": "lead|plan_to_visit|visited|negotiation|quotation_sent|bidding|closed_won|closed_lost|job_expired|equipment_defect|null",
      "payment_status": "pending|deposit|paid|null",
      "planned_visit_date": "YYYY-MM-DD or null — date of planned future visit",
      "bidding_date": "YYYY-MM-DD or null — government bid submission deadline",
      "accompanying_rep": "string or null — name of 2nd rep if mentioned",
      "is_training": "boolean or null — true if accompanying rep is a trainee",
      "close_reason": "string or null — reason for close/loss/expiry/defect, only for terminal stages",
      "follow_up_notes": "string or null",
      "summary_en": "string — brief English summary under 100 chars"
    }
  ],
  "confirmation_th": "string — Thai confirmation message"
}

If is_sales_report is false, return: {"is_sales_report": false, "activities": [], "confirmation_th": null}"""

FEW_SHOT_EXAMPLES = [
    {
        "input": "ไปเยี่ยม PTT วันนี้ เสนอ Megger MTO330 ราคา 150,000",
        "output": '{"is_sales_report":true,"activities":[{"customer_name":"PTT","contact_person":null,"contact_channel":"visit","product_brand":"Megger","product_name":"MTO330","quantity":null,"deal_value_thb":150000,"activity_type":"visit","sales_stage":"quotation_sent","payment_status":null,"planned_visit_date":null,"bidding_date":null,"accompanying_rep":null,"is_training":null,"close_reason":null,"follow_up_notes":null,"summary_en":"Visited PTT, quoted Megger MTO330 at 150K THB"}],"confirmation_th":"รับทราบครับ บันทึกแล้ว:\\n- เข้าพบลูกค้า: PTT\\n- สินค้า: Megger MTO330\\n- มูลค่า: ฿150,000\\n- สถานะ: เสนอราคาแล้ว"}'
    },
    {
        "input": "ปิดดีล Fluke 1770 กับ EGAT แล้ว 450K วางมัดจำ 50%",
        "output": '{"is_sales_report":true,"activities":[{"customer_name":"EGAT","contact_person":null,"contact_channel":"visit","product_brand":"Fluke","product_name":"1770","quantity":null,"deal_value_thb":450000,"activity_type":"closed_won","sales_stage":"closed_won","payment_status":"deposit","planned_visit_date":null,"bidding_date":null,"accompanying_rep":null,"is_training":null,"close_reason":"ปิดดีลได้ตามราคาเสนอ ลูกค้าวางมัดจำ 50%","follow_up_notes":"Customer paid 50% deposit (225,000 THB); remaining 50% pending","summary_en":"Closed Fluke 1770 deal with EGAT, 450K THB, 50% deposit"}],"confirmation_th":"รับทราบครับ บันทึกแล้ว:\\n- ปิดการขายสำเร็จ: EGAT\\n- สินค้า: Fluke 1770\\n- มูลค่า: ฿450,000\\n- วางมัดจำ: 50%\\n\\nยินดีด้วยครับ! 🎉"}'
    },
    {
        "input": "ลูกค้า SCG โทรมา สนใจ CRC contact cleaner 20 กระป๋อง",
        "output": '{"is_sales_report":true,"activities":[{"customer_name":"SCG","contact_person":null,"contact_channel":"phone","product_brand":"CRC","product_name":"Contact Cleaner","quantity":20,"deal_value_thb":null,"activity_type":"call","sales_stage":"lead","payment_status":null,"planned_visit_date":null,"bidding_date":null,"accompanying_rep":null,"is_training":null,"close_reason":null,"follow_up_notes":"Customer called expressing interest in 20 cans","summary_en":"SCG called, interested in CRC Contact Cleaner x20"}],"confirmation_th":"รับทราบครับ บันทึกแล้ว:\\n- ลูกค้าโทรเข้ามา: SCG\\n- สินค้า: CRC Contact Cleaner\\n- จำนวน: 20 กระป๋อง\\n- สถานะ: ลูกค้าสนใจ (Lead)"}'
    },
    {
        "input": "ใครจะไปกินข้าวเที่ยงมั่ง",
        "output": '{"is_sales_report":false,"activities":[],"confirmation_th":null}'
    },
    {
        "input": "จะไปเยี่ยม IRPC อังคารหน้า เรื่อง Megger MIT525 พาน้องใหม่สมชายไปด้วย",
        "output": '{"is_sales_report":true,"activities":[{"customer_name":"IRPC","contact_person":null,"contact_channel":"visit","product_brand":"Megger","product_name":"MIT525","quantity":null,"deal_value_thb":null,"activity_type":"visit","sales_stage":"plan_to_visit","payment_status":null,"planned_visit_date":"2026-03-17","bidding_date":null,"accompanying_rep":"สมชาย","is_training":true,"close_reason":null,"follow_up_notes":"Planned visit next Tuesday with trainee","summary_en":"Planning to visit IRPC next Tue for Megger MIT525, with trainee"}],"confirmation_th":"รับทราบครับ บันทึกแล้ว:\\n- นัดเข้าพบ: IRPC (อังคารหน้า)\\n- สินค้า: Megger MIT525\\n- ไปกับ: สมชาย (ฝึกงาน)\\n- สถานะ: นัดเข้าพบ"}'
    },
    {
        "input": "เสียงาน Salisbury ถุงมือกันไฟฟ้าที่ กฟภ. แพ้ราคาเจ้าอื่น มูลค่า 320,000",
        "output": '{"is_sales_report":true,"activities":[{"customer_name":"กฟภ. (PEA)","contact_person":null,"contact_channel":"visit","product_brand":"Salisbury","product_name":"Insulating Gloves","quantity":null,"deal_value_thb":320000,"activity_type":"closed_lost","sales_stage":"closed_lost","payment_status":null,"planned_visit_date":null,"bidding_date":null,"accompanying_rep":null,"is_training":null,"close_reason":"แพ้ราคาคู่แข่ง ราคาถูกกว่า","follow_up_notes":"Lost on price — competitor was cheaper","summary_en":"Lost Salisbury gloves deal at PEA, 320K, undercut on price"}],"confirmation_th":"รับทราบครับ บันทึกแล้ว:\\n- เสียงาน: กฟภ.\\n- สินค้า: Salisbury ถุงมือกันไฟฟ้า\\n- มูลค่า: ฿320,000\\n- สาเหตุ: แพ้ราคา\\n\\nไม่เป็นไรครับ ครั้งหน้าจะได้แน่นอน 💪"}'
    },
    {
        "input": "ส่ง Megger MTO330 เครื่องของ PTT เข้าซ่อม warranty",
        "output": '{"is_sales_report":true,"activities":[{"customer_name":"PTT","contact_person":null,"contact_channel":null,"product_brand":"Megger","product_name":"MTO330","quantity":1,"deal_value_thb":null,"activity_type":"sent_to_service","sales_stage":null,"payment_status":null,"planned_visit_date":null,"bidding_date":null,"accompanying_rep":null,"is_training":null,"close_reason":null,"follow_up_notes":"Sent unit for warranty repair","summary_en":"Sent PTT Megger MTO330 for warranty service"}],"confirmation_th":"รับทราบครับ บันทึกแล้ว:\\n- ส่งซ่อม warranty: PTT\\n- สินค้า: Megger MTO330\\n- สถานะ: ส่งเข้าศูนย์บริการ"}'
    },
    {
        "input": "ยื่นซองประมูลงาน กฟภ. Megger MIT525 3 เครื่อง 2.1 ล้าน กำหนดเปิดซอง 25 มี.ค.",
        "output": '{"is_sales_report":true,"activities":[{"customer_name":"กฟภ. (PEA)","contact_person":null,"contact_channel":null,"product_brand":"Megger","product_name":"MIT525","quantity":3,"deal_value_thb":2100000,"activity_type":"quotation","sales_stage":"bidding","payment_status":null,"planned_visit_date":null,"bidding_date":"2026-03-25","accompanying_rep":null,"is_training":null,"close_reason":null,"follow_up_notes":"Government bid submitted, opening date March 25","summary_en":"Submitted bid for 3x Megger MIT525 at PEA, 2.1M THB, opens Mar 25"}],"confirmation_th":"รับทราบครับ บันทึกแล้ว:\\n- ยื่นประมูล: กฟภ.\\n- สินค้า: Megger MIT525 x3\\n- มูลค่า: ฿2,100,000\\n- เปิดซอง: 25 มี.ค. 2569"}'
    }
]


# ---------------------------------------------------------------------------
# Helper: Build Gemini prompt with few-shot examples
# ---------------------------------------------------------------------------

def build_gemini_prompt(message_text: str) -> str:
    examples = ""
    for ex in FEW_SHOT_EXAMPLES:
        examples += f"\n--- Example ---\nInput: {ex['input']}\nOutput: {ex['output']}\n"

    return f"""{examples}
--- Now parse this message ---
Input: {message_text}
Output:"""


# ---------------------------------------------------------------------------
# AI Parsing: Gemini (primary) and Groq (fallback)
# ---------------------------------------------------------------------------

def parse_with_gemini(message_text: str) -> dict:
    """Call Gemini API directly via HTTP to avoid SDK version issues."""
    if not GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY env var is not set")

    prompt = build_gemini_prompt(message_text)

    payload = json.dumps({
        "contents": [
            {
                "role": "user",
                "parts": [{"text": prompt}]
            }
        ],
        "systemInstruction": {
            "parts": [{"text": SYSTEM_PROMPT}]
        },
        "generationConfig": {
            "responseMimeType": "application/json",
            "temperature": 0
        }
    }).encode()

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={GEMINI_API_KEY}"

    req = urllib.request.Request(
        url,
        data=payload,
        headers={"Content-Type": "application/json"},
    )

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            raw = resp.read()
            data = json.loads(raw)
    except urllib.error.HTTPError as http_err:
        error_body = http_err.read().decode("utf-8", errors="replace")
        print(f"[GEMINI] HTTP Error {http_err.code}: {error_body[:300]}")
        sys.stdout.flush()
        raise ValueError(f"Gemini HTTP {http_err.code}: {error_body[:300]}")

    # Extract text from response
    text = data["candidates"][0]["content"]["parts"][0]["text"]

    # Handle potential markdown code fences
    text = text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        lines = [l for l in lines[1:] if l.strip() != "```"]
        text = "\n".join(lines).strip()

    return json.loads(text)


def parse_with_groq(message_text: str) -> dict:
    """Fallback: use Groq API with Llama 3.3 70B."""

    prompt = build_gemini_prompt(message_text)

    payload = json.dumps({
        "model": "llama-3.3-70b-versatile",
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0,
        "response_format": {"type": "json_object"},
    }).encode()

    req = urllib.request.Request(
        "https://api.groq.com/openai/v1/chat/completions",
        data=payload,
        headers={
            "Authorization": f"Bearer {GROQ_API_KEY}",
            "Content-Type": "application/json",
        },
    )
    with urllib.request.urlopen(req, timeout=20) as resp:
        data = json.loads(resp.read())

    return json.loads(data["choices"][0]["message"]["content"])


def parse_message(message_text: str) -> dict:
    """Try Gemini first, fall back to Groq."""
    try:
        return parse_with_gemini(message_text)
    except Exception as e:
        print(f"[AI] Gemini failed ({e}), trying Groq...")
        if GROQ_API_KEY:
            return parse_with_groq(message_text)
        raise


# ---------------------------------------------------------------------------
# Nudge logic: check for missing mandatory fields
# ---------------------------------------------------------------------------

MANDATORY_FIELDS = {
    "customer_name": "ชื่อลูกค้า",
    "product_brand": "สินค้า/แบรนด์",
    "deal_value_thb": "มูลค่าดีล",
    "activity_type": "ประเภทกิจกรรม",
    "sales_stage": "สถานะดีล",
}

# Fields exempt from mandatory check (service entries don't need sales_stage/deal_value)
SERVICE_ACTIVITY_TYPES = {"sent_to_service"}

EXAMPLE_MESSAGE = "ตัวอย่าง: ไปเยี่ยม PTT เสนอ Megger MTO330 ราคา 150,000 สถานะเจรจา"


def build_nudge_confirmation(parsed: dict, ai_confirmation: str) -> str:
    """Build confirmation with nudge for missing fields."""
    activities = parsed.get("activities", [])
    if not activities:
        return ai_confirmation

    # Check missing fields across all activities
    all_missing = []
    for activity in activities:
        # Skip mandatory check for service entries
        if activity.get("activity_type") in SERVICE_ACTIVITY_TYPES:
            continue
        for field_key, field_label in MANDATORY_FIELDS.items():
            val = activity.get(field_key)
            if val is None or val == "":
                if field_label not in all_missing:
                    all_missing.append(field_label)

    if not all_missing:
        return ai_confirmation

    # Build nudge
    missing_list = ", ".join(all_missing)
    nudge = f"\n\nถ้าสะดวก ช่วยแจ้งเพิ่มได้นะครับ: {missing_list}"
    nudge += "\n(ถ้าสะดวก ครั้งหน้าแจ้งในข้อความเดียวได้เลยนะครับ จะช่วยให้บันทึกได้ครบถ้วนขึ้น)"

    # Add example if 3+ fields missing
    if len(all_missing) >= 3:
        nudge += f"\n\n{EXAMPLE_MESSAGE}"

    return ai_confirmation + nudge


# ---------------------------------------------------------------------------
# Google Sheets: Append parsed data
# ---------------------------------------------------------------------------

def get_sheets_client():
    import gspread
    from google.oauth2.service_account import Credentials

    creds_dict = json.loads(GOOGLE_SERVICE_ACCOUNT_JSON)
    scopes = [
        "https://www.googleapis.com/auth/spreadsheets",
        "https://www.googleapis.com/auth/drive",
    ]
    creds = Credentials.from_service_account_info(creds_dict, scopes=scopes)
    return gspread.authorize(creds)


# ---------------------------------------------------------------------------
# Command keywords (Rich Menu + typed commands)
# ---------------------------------------------------------------------------

SUMMARY_KEYWORDS = {"สรุป", "สรุปยอด", "สรุปยอดขาย", "ยอดขาย", "report", "summary"}
HELP_KEYWORDS = {"วิธีรายงาน", "วิธีใช้", "help", "ช่วย"}

HELP_RESPONSE = """📝 วิธีรายงานการขาย

พิมพ์ข้อความรายงานเข้ามาได้เลยครับ ระบบจะบันทึกให้อัตโนมัติ

ตัวอย่างรายงาน:
• ไปเยี่ยม PTT เสนอ Megger MTO330 ราคา 150,000 สถานะเจรจา
• โทรคุย EGAT เรื่อง Fluke 1770 ลูกค้าสนใจ งบ 520,000
• ปิดดีล SCG Salisbury ถุงมือ 15 ชุด 975,000 วางมัดจำ 50%
• จะไปเยี่ยม IRPC อังคารหน้า เรื่อง Megger MIT525
• ส่ง Megger MTO330 ของ PTT เข้าซ่อม warranty
• ยื่นซองประมูล กฟภ. Megger MIT525 2.1 ล้าน เปิดซอง 25 มี.ค.
• เสียงาน Thai Oil MIT1025 ลูกค้าตัดงบ

อัพเดทดีลเดิม:
• พิมพ์: อัพเดท MSG-XXXXX ตามด้วยข้อมูลใหม่
• ตัวอย่าง: อัพเดท MSG-A1B2C สถานะเจรจา ราคา 2.8 ล้าน
• ถ้ารายงานซ้ำลูกค้า/สินค้าเดิม ระบบจะแนะนำ Batch ID ให้

คำสั่งอื่นๆ:
• สรุป — ดูสรุป pipeline
• วิธีใช้ — ดูข้อความนี้

ข้อมูลสำคัญ 5 อย่าง:
✅ ชื่อลูกค้า
✅ สินค้า/แบรนด์ (Megger, Fluke, CRC, Salisbury, SmartWasher, IK Sprayer, HVOP)
✅ มูลค่าดีล
✅ กิจกรรม (เยี่ยม/โทร/เสนอราคา/ปิดดีล/ส่งซ่อม)
✅ สถานะ (สนใจ/นัดเยี่ยม/เยี่ยมแล้ว/เจรจา/ส่ง QT/ประมูล/ปิดได้/เสียงาน)"""


# ---------------------------------------------------------------------------
# Update existing entries: อัพเดท MSG-XXXXX
# ---------------------------------------------------------------------------

UPDATE_PATTERN = re.compile(
    r'^(อัพเดท|อัพเดต|update|แก้ไข)\s+(MSG-[A-Za-z0-9]+)\s*(.*)',
    re.IGNORECASE | re.DOTALL
)

# Maps AI output field names → spreadsheet header names
AI_FIELD_TO_HEADER = {
    "customer_name": "Customer",
    "contact_person": "Contact Person",
    "contact_channel": "Contact Channel",
    "product_brand": "Product Brand",
    "product_name": "Product Name",
    "quantity": "Quantity",
    "deal_value_thb": "Deal Value (THB)",
    "activity_type": "Activity Type",
    "sales_stage": "Sales Stage",
    "payment_status": "Payment Status",
    "planned_visit_date": "Planned Visit Date",
    "bidding_date": "Bidding Date",
    "accompanying_rep": "Accompanying Rep",
    "close_reason": "Close Reason",
    "follow_up_notes": "Follow-up Notes",
    "summary_en": "Summary (EN)",
}


def _find_rows_by_batch_id(sheet, batch_id):
    """Find all row numbers containing the batch ID in column U (21, 1-based)."""
    try:
        cells = sheet.findall(batch_id, in_column=21)
        return [cell.row for cell in cells]
    except Exception:
        return []


def _apply_cell_updates(sheet, row_numbers, cell_updates):
    """Apply cell updates to specific rows. cell_updates: list of (col_1based, value)."""
    import gspread
    if not row_numbers or not cell_updates:
        return
    batch = []
    for row_num in row_numbers:
        for col_1based, value in cell_updates:
            batch.append(gspread.Cell(row_num, col_1based, value))
    if batch:
        sheet.update_cells(batch, value_input_option="USER_ENTERED")


def handle_update_command(message_text, reply_token, rep_name):
    """Handle 'อัพเดท MSG-XXXXX ...' command. Returns True if handled."""
    match = UPDATE_PATTERN.match(message_text.strip())
    if not match:
        return False

    batch_id = match.group(2).upper()
    update_text = match.group(3).strip()

    if not update_text:
        reply_to_line(reply_token,
            f"กรุณาระบุข้อมูลที่ต้องการอัพเดทด้วยครับ\n"
            f"ตัวอย่าง: อัพเดท {batch_id} สถานะเจรจา ราคา 2.8 ล้าน")
        return True

    client = get_sheets_client()
    spreadsheet = client.open_by_key(GOOGLE_SHEETS_ID)
    combined = get_or_create_combined_sheet(spreadsheet)

    # Find existing rows in Combined
    row_numbers = _find_rows_by_batch_id(combined, batch_id)
    if not row_numbers:
        reply_to_line(reply_token,
            f"ไม่พบรายการ {batch_id} ในระบบครับ กรุณาตรวจสอบ Batch ID อีกครั้ง")
        return True

    # Get existing data from first matching row for AI context
    existing_row = combined.row_values(row_numbers[0])
    existing_data = {}
    for i, header in enumerate(LIVE_DATA_HEADERS):
        if i < len(existing_row):
            existing_data[header] = existing_row[i]

    # Parse update with AI
    update_prompt = f"""An existing sales entry is being updated. Current data:
{json.dumps(existing_data, ensure_ascii=False)}

The rep says: "{update_text}"

Return ONLY the fields that should change as a JSON object. Use these exact field names:
customer_name, contact_person, contact_channel, product_brand, product_name, quantity,
deal_value_thb, activity_type, sales_stage, payment_status, planned_visit_date,
bidding_date, accompanying_rep, close_reason, follow_up_notes, summary_en

Valid sales_stage values: lead, plan_to_visit, visited, negotiation, quotation_sent, bidding, closed_won, closed_lost, job_expired, equipment_defect
Valid payment_status values: pending, deposit, paid
Parse Thai: "เจรจา"=negotiation, "ส่ง QT"=quotation_sent, "ปิดได้"=closed_won, "เสียงาน"=closed_lost, "หมดอายุ"=job_expired, "ประมูล"=bidding
Parse values: "2.8ล้าน"=2800000, "150K"=150000, "แสนห้า"=150000

Return ONLY valid JSON with changed fields. Do NOT include unchanged fields."""

    try:
        payload = json.dumps({
            "contents": [{"role": "user", "parts": [{"text": update_prompt}]}],
            "systemInstruction": {"parts": [{"text": "You extract field changes from Thai sales update messages. Return ONLY valid JSON."}]},
            "generationConfig": {"responseMimeType": "application/json", "temperature": 0}
        }).encode()

        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={GEMINI_API_KEY}"
        req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"})

        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read())

        text = data["candidates"][0]["content"]["parts"][0]["text"].strip()
        if text.startswith("```"):
            lines = text.split("\n")
            lines = [l for l in lines[1:] if l.strip() != "```"]
            text = "\n".join(lines).strip()

        changes = json.loads(text)
    except Exception as e:
        print(f"[UPDATE] AI parse error: {e}")
        sys.stdout.flush()
        reply_to_line(reply_token, "ขออภัยครับ ไม่สามารถประมวลผลการอัพเดทได้ กรุณาลองใหม่")
        return True

    if not changes:
        reply_to_line(reply_token, "ไม่พบข้อมูลที่ต้องการเปลี่ยนแปลงครับ กรุณาระบุให้ชัดเจนกว่านี้")
        return True

    # Build cell updates: (col_1based, value) pairs
    header_to_col = {h: i + 1 for i, h in enumerate(LIVE_DATA_HEADERS)}
    cell_updates = []

    # Handle is_training → Training Flag
    if "is_training" in changes:
        training_val = "yes" if changes.pop("is_training") else ""
        col = header_to_col.get("Training Flag")
        if col:
            cell_updates.append((col, training_val))

    for ai_field, new_value in changes.items():
        header_name = AI_FIELD_TO_HEADER.get(ai_field)
        if header_name and header_name in header_to_col:
            col = header_to_col[header_name]
            cell_updates.append((col, str(new_value) if new_value is not None else ""))

    # Update timestamp
    now = datetime.now(BKK_TZ).strftime("%Y-%m-%d %H:%M:%S")
    cell_updates.append((header_to_col["Timestamp"], now))

    if not cell_updates:
        reply_to_line(reply_token, "ไม่สามารถระบุฟิลด์ที่ต้องการเปลี่ยนแปลงได้ครับ")
        return True

    # Apply updates across all sheets
    updated_sheets = []

    # 1. Combined
    _apply_cell_updates(combined, row_numbers, cell_updates)
    updated_sheets.append("Combined")

    # 2. Rep's personal sheet
    try:
        original_rep = existing_data.get("Rep Name", rep_name)
        rep_sheet = spreadsheet.worksheet(original_rep)
        rep_rows = _find_rows_by_batch_id(rep_sheet, batch_id)
        if rep_rows:
            _apply_cell_updates(rep_sheet, rep_rows, cell_updates)
            updated_sheets.append(original_rep)
    except Exception:
        pass

    # 3. Live Data
    try:
        live_sheet = get_or_create_live_tab(spreadsheet)
        live_rows = _find_rows_by_batch_id(live_sheet, batch_id)
        if live_rows:
            _apply_cell_updates(live_sheet, live_rows, cell_updates)
            updated_sheets.append("Live Data")
    except Exception:
        pass

    # 4. Major Opportunity (if Megger deal)
    is_megger = (existing_data.get("Product Brand") == "Megger"
                 or changes.get("product_brand") == "Megger")
    if is_megger:
        try:
            mo_sheet = spreadsheet.worksheet("Major Opportunity")
            mo_rows = _find_rows_by_batch_id(mo_sheet, batch_id)
            if mo_rows:
                _apply_cell_updates(mo_sheet, mo_rows, cell_updates)
                updated_sheets.append("Major Opportunity")
        except Exception:
            pass

    # Build before→after reply
    change_lines = []
    for ai_field, new_value in changes.items():
        header_name = AI_FIELD_TO_HEADER.get(ai_field, ai_field)
        old_value = existing_data.get(header_name, "—")
        if old_value == "":
            old_value = "—"
        change_lines.append(f"• {header_name}: {old_value} → {new_value}")

    reply_text = f"✅ อัพเดท {batch_id} เรียบร้อยครับ ({len(row_numbers)} รายการ)\n\n"
    reply_text += "\n".join(change_lines)

    reply_to_line(reply_token, reply_text)
    print(f"[UPDATE] Updated {batch_id} in {updated_sheets}: {len(changes)} fields, {len(row_numbers)} rows")
    sys.stdout.flush()
    return True


def generate_summary(reply_token: str):
    """Generate pipeline summary from Combined sheet data using Gemini."""
    client = get_sheets_client()
    spreadsheet = client.open_by_key(GOOGLE_SHEETS_ID)
    sheet = get_or_create_combined_sheet(spreadsheet)
    all_data = sheet.get_all_values()

    if len(all_data) <= 1:
        reply_to_line(reply_token, "ยังไม่มีข้อมูลในระบบครับ")
        return

    headers = all_data[0]
    rows = all_data[1:]

    # Pre-compute stats for Gemini context
    total_rows = len(rows)

    # Find column indices
    try:
        val_idx = headers.index("Deal Value (THB)")
        stage_idx = headers.index("Sales Stage")
        brand_idx = headers.index("Product Brand")
        rep_idx = headers.index("Rep Name")
        activity_idx = headers.index("Activity Type")
        customer_idx = headers.index("Customer")
    except ValueError:
        reply_to_line(reply_token, "ไม่สามารถอ่านข้อมูลได้ครับ กรุณาตรวจสอบ headers ใน Sheet")
        return

    # Aggregate stats
    total_value = 0
    stage_counts = {}
    stage_values = {}
    brand_values = {}
    rep_values = {}

    for row in rows:
        try:
            val = float(row[val_idx].replace(",", "")) if row[val_idx] else 0
        except (ValueError, IndexError):
            val = 0

        total_value += val

        stage = row[stage_idx] if stage_idx < len(row) else ""
        brand = row[brand_idx] if brand_idx < len(row) else ""
        rep = row[rep_idx] if rep_idx < len(row) else ""

        stage_counts[stage] = stage_counts.get(stage, 0) + 1
        stage_values[stage] = stage_values.get(stage, 0) + val
        brand_values[brand] = brand_values.get(brand, 0) + val
        rep_values[rep] = rep_values.get(rep, 0) + val

    # Build stats text for Gemini
    stats_text = f"""Sales Pipeline Data Summary:
- Total entries: {total_rows}
- Total pipeline value: {total_value:,.0f} THB

By Sales Stage:
{chr(10).join(f'  - {s}: {c} deals, {stage_values.get(s, 0):,.0f} THB' for s, c in sorted(stage_counts.items()))}

By Brand:
{chr(10).join(f'  - {b}: {v:,.0f} THB' for b, v in sorted(brand_values.items(), key=lambda x: -x[1]))}

By Rep:
{chr(10).join(f'  - {r}: {v:,.0f} THB' for r, v in sorted(rep_values.items(), key=lambda x: -x[1]))}"""

    # Ask Gemini to generate natural Thai summary
    summary_prompt = f"""You are a sales reporting assistant for ATE (Advanced Technology Equipment), a Thai B2B industrial equipment distributor.

Generate a concise Thai-language pipeline summary from this data. Keep it under 800 characters.
Use bullet points. Include key numbers. Be encouraging but factual.
Format for LINE chat (plain text, no markdown).

{stats_text}"""

    payload = json.dumps({
        "contents": [{"role": "user", "parts": [{"text": summary_prompt}]}],
        "generationConfig": {"temperature": 0.3}
    }).encode()

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={GEMINI_API_KEY}"
    req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"})

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read())
        summary = data["candidates"][0]["content"]["parts"][0]["text"].strip()
    except Exception as e:
        # Fallback: send raw stats
        won_value = stage_values.get("closed_won", 0)
        lost_value = stage_values.get("closed_lost", 0)
        pipeline = total_value - won_value - lost_value
        summary = f"""📊 สรุป Pipeline ATE Sales

💰 มูลค่ารวม: ฿{total_value:,.0f}
✅ ปิดได้: ฿{won_value:,.0f} ({stage_counts.get('closed_won', 0)} ดีล)
❌ เสียงาน: ฿{lost_value:,.0f} ({stage_counts.get('closed_lost', 0)} ดีล)
📈 Pipeline คงเหลือ: ฿{pipeline:,.0f}
📋 รายการทั้งหมด: {total_rows} entries"""

    reply_to_line(reply_token, summary)


LIVE_DATA_HEADERS = [
    "Timestamp", "Rep Name", "Customer", "Contact Person",
    "Contact Channel", "Product Brand", "Product Name", "Quantity",
    "Deal Value (THB)", "Activity Type", "Sales Stage", "Payment Status",
    "Planned Visit Date", "Bidding Date", "Accompanying Rep", "Training Flag",
    "Close Reason", "Follow-up Notes", "Summary (EN)", "Raw Message",
    "Batch ID", "Item #", "Source", "Manager Notes"
]


def _format_new_sheet(spreadsheet, sheet):
    """Apply standard header formatting (bold white on blue, frozen) to a new sheet."""
    spreadsheet.batch_update({"requests": [
        {
            "repeatCell": {
                "range": {"sheetId": sheet.id, "startRowIndex": 0, "endRowIndex": 1},
                "cell": {"userEnteredFormat": {
                    "backgroundColor": {"red": 0.15, "green": 0.3, "blue": 0.55},
                    "textFormat": {"bold": True, "foregroundColor": {"red": 1, "green": 1, "blue": 1}},
                }},
                "fields": "userEnteredFormat(backgroundColor,textFormat)",
            }
        },
        {
            "updateSheetProperties": {
                "properties": {"sheetId": sheet.id, "gridProperties": {"frozenRowCount": 1}},
                "fields": "gridProperties.frozenRowCount",
            }
        },
    ]})


def get_or_create_rep_registry(spreadsheet):
    """Get 'Rep Registry' tab (maps LINE user IDs to display names), creating if needed."""
    import gspread
    try:
        return spreadsheet.worksheet("Rep Registry")
    except gspread.exceptions.WorksheetNotFound:
        reg = spreadsheet.add_worksheet(title="Rep Registry", rows=50, cols=3)
        reg.update(range_name="A1:C1", values=[["User ID", "Display Name", "Last Active"]])
        _format_new_sheet(spreadsheet, reg)
        print("[SHEETS] Created 'Rep Registry' tab")
        sys.stdout.flush()
        return reg


def register_rep(spreadsheet, user_id, display_name):
    """Register or update a rep in the Rep Registry tab."""
    from datetime import datetime
    reg = get_or_create_rep_registry(spreadsheet)
    now = datetime.now(BKK_TZ).strftime("%Y-%m-%d %H:%M:%S")

    # Check if user already registered
    try:
        cell = reg.find(user_id, in_column=1)
        # Update display name + last active
        reg.update(range_name=f"B{cell.row}:C{cell.row}", values=[[display_name, now]])
    except Exception:
        # New rep — append
        reg.append_row([user_id, display_name, now], value_input_option="USER_ENTERED")
        print(f"[REGISTRY] Registered new rep: {display_name} ({user_id})")
        sys.stdout.flush()


def get_or_create_live_tab(spreadsheet):
    """Get the 'Live Data' tab, creating it with headers if it doesn't exist."""
    import gspread
    try:
        return spreadsheet.worksheet("Live Data")
    except gspread.exceptions.WorksheetNotFound:
        live_sheet = spreadsheet.add_worksheet(title="Live Data", rows=500, cols=24)
        live_sheet.update(range_name="A1:X1", values=[LIVE_DATA_HEADERS])
        # Format header + freeze + protect (permanent record, restricted)
        spreadsheet.batch_update({"requests": [
            {
                "repeatCell": {
                    "range": {"sheetId": live_sheet.id, "startRowIndex": 0, "endRowIndex": 1},
                    "cell": {"userEnteredFormat": {
                        "backgroundColor": {"red": 0.15, "green": 0.3, "blue": 0.55},
                        "textFormat": {"bold": True, "foregroundColor": {"red": 1, "green": 1, "blue": 1}},
                    }},
                    "fields": "userEnteredFormat(backgroundColor,textFormat)",
                }
            },
            {
                "updateSheetProperties": {
                    "properties": {"sheetId": live_sheet.id, "gridProperties": {"frozenRowCount": 1}},
                    "fields": "gridProperties.frozenRowCount",
                }
            },
            {
                "addProtectedRange": {
                    "protectedRange": {
                        "range": {"sheetId": live_sheet.id},
                        "description": "Live Data — permanent record, bot-managed only",
                        "warningOnly": False,
                    }
                }
            },
        ]})
        print("[SHEETS] Created 'Live Data' tab with headers + protection")
        sys.stdout.flush()
        return live_sheet


def get_or_create_combined_sheet(spreadsheet):
    """Get 'Combined' tab. If not found, rename Sheet1 to 'Combined' and protect it."""
    import gspread
    try:
        return spreadsheet.worksheet("Combined")
    except gspread.exceptions.WorksheetNotFound:
        # First run with new code — rename Sheet1 to "Combined"
        sheet1 = spreadsheet.sheet1
        sheet1.update_title("Combined")
        # Protect: only service account can edit (add management emails manually later)
        spreadsheet.batch_update({"requests": [{
            "addProtectedRange": {
                "protectedRange": {
                    "range": {"sheetId": sheet1.id},
                    "description": "Combined sheet — bot-managed, add management editors manually",
                    "warningOnly": False,
                }
            }
        }]})
        print("[SHEETS] Renamed 'Sheet1' to 'Combined' with protection")
        sys.stdout.flush()
        return sheet1


def get_or_create_rep_sheet(spreadsheet, rep_name):
    """Get rep's personal sheet, creating it with headers + protection if new."""
    import gspread
    try:
        return spreadsheet.worksheet(rep_name)
    except gspread.exceptions.WorksheetNotFound:
        rep_sheet = spreadsheet.add_worksheet(title=rep_name, rows=500, cols=24)
        rep_sheet.update(range_name="A1:X1", values=[LIVE_DATA_HEADERS])
        # Format header + freeze + protect (only service account can edit)
        spreadsheet.batch_update({"requests": [
            {
                "repeatCell": {
                    "range": {"sheetId": rep_sheet.id, "startRowIndex": 0, "endRowIndex": 1},
                    "cell": {"userEnteredFormat": {
                        "backgroundColor": {"red": 0.15, "green": 0.3, "blue": 0.55},
                        "textFormat": {"bold": True, "foregroundColor": {"red": 1, "green": 1, "blue": 1}},
                    }},
                    "fields": "userEnteredFormat(backgroundColor,textFormat)",
                }
            },
            {
                "updateSheetProperties": {
                    "properties": {"sheetId": rep_sheet.id, "gridProperties": {"frozenRowCount": 1}},
                    "fields": "gridProperties.frozenRowCount",
                }
            },
            {
                "addProtectedRange": {
                    "protectedRange": {
                        "range": {"sheetId": rep_sheet.id},
                        "description": f"Personal sheet for {rep_name} — bot-managed",
                        "warningOnly": False,
                    }
                }
            },
        ]})
        print(f"[SHEETS] Created personal sheet for '{rep_name}' with protection")
        sys.stdout.flush()
        return rep_sheet


def get_or_create_major_opportunity_sheet(spreadsheet):
    """Get 'Major Opportunity' tab for Megger deals, creating if needed."""
    import gspread
    try:
        return spreadsheet.worksheet("Major Opportunity")
    except gspread.exceptions.WorksheetNotFound:
        mo_sheet = spreadsheet.add_worksheet(title="Major Opportunity", rows=500, cols=24)
        mo_sheet.update(range_name="A1:X1", values=[LIVE_DATA_HEADERS])
        _format_new_sheet(spreadsheet, mo_sheet)
        print("[SHEETS] Created 'Major Opportunity' tab with headers")
        sys.stdout.flush()
        return mo_sheet


def _detect_matching_deals(combined_sheet, activities):
    """Check Combined sheet for existing active deals matching new activities.
    Returns list of match dicts: {batch_id, customer, brand, product, value, stage}
    """
    all_data = combined_sheet.get_all_values()
    if len(all_data) <= 1:
        return []

    headers = all_data[0]
    try:
        customer_col = headers.index("Customer")
        brand_col = headers.index("Product Brand")
        product_col = headers.index("Product Name")
        stage_col = headers.index("Sales Stage")
        value_col = headers.index("Deal Value (THB)")
        batch_col = headers.index("Batch ID")
    except ValueError:
        return []

    terminal = {"closed_won", "closed_lost", "job_expired", "equipment_defect"}
    matches = []
    seen_batches = set()

    for activity in activities:
        new_customer = (activity.get("customer_name") or "").strip().lower()
        new_brand = (activity.get("product_brand") or "").strip().lower()
        new_product = (activity.get("product_name") or "").strip().lower()
        if not new_customer:
            continue

        for row in all_data[1:]:
            if len(row) <= batch_col:
                continue
            existing_batch = row[batch_col].strip()
            if not existing_batch or existing_batch in seen_batches:
                continue

            existing_stage = row[stage_col].strip().lower()
            if existing_stage in terminal:
                continue

            existing_customer = row[customer_col].strip().lower()
            existing_brand = row[brand_col].strip().lower()
            existing_product = row[product_col].strip().lower()

            # Match: customer substring + same brand or product
            customer_match = (new_customer in existing_customer
                              or existing_customer in new_customer)
            product_match = ((new_brand and new_brand == existing_brand)
                             or (new_product and new_product in existing_product))

            if customer_match and product_match:
                matches.append({
                    "batch_id": existing_batch,
                    "customer": row[customer_col],
                    "brand": row[brand_col],
                    "product": row[product_col],
                    "value": row[value_col] if value_col < len(row) else "",
                    "stage": row[stage_col],
                })
                seen_batches.add(existing_batch)

    return matches[:3]  # Max 3 matches


def append_to_sheets(parsed: dict, rep_name: str, raw_message: str, user_id: str = ""):
    """Write parsed activities to all sheets. Returns list of matching existing deals."""
    import gspread

    client = get_sheets_client()
    spreadsheet = client.open_by_key(GOOGLE_SHEETS_ID)

    # Register rep in Rep Registry (for push notifications)
    if user_id:
        try:
            register_rep(spreadsheet, user_id, rep_name)
        except Exception:
            pass

    now = datetime.now(BKK_TZ).strftime("%Y-%m-%d %H:%M:%S")

    # Generate batch ID from timestamp hash (groups multi-activity messages)
    batch_id = "MSG-" + hashlib.md5(f"{now}{rep_name}{raw_message}".encode()).hexdigest()[:5].upper()
    activities = parsed.get("activities", [])
    total = len(activities)

    rows = []
    for i, activity in enumerate(activities, 1):
        item_label = f"{i}/{total}" if total > 1 else ""
        is_training = activity.get("is_training")
        training_flag = "yes" if is_training else ""
        row = [
            now,
            rep_name,
            activity.get("customer_name", ""),
            activity.get("contact_person", ""),
            activity.get("contact_channel", ""),
            activity.get("product_brand", ""),
            activity.get("product_name", ""),
            activity.get("quantity", ""),
            activity.get("deal_value_thb", ""),
            activity.get("activity_type", ""),
            activity.get("sales_stage", ""),
            activity.get("payment_status", ""),
            activity.get("planned_visit_date", ""),
            activity.get("bidding_date", ""),
            activity.get("accompanying_rep", ""),
            training_flag,
            activity.get("close_reason", ""),
            activity.get("follow_up_notes", ""),
            activity.get("summary_en", ""),
            raw_message,
            batch_id,
            item_label,
            "live",
            "",  # Manager Notes (blank, manual only)
        ]
        rows.append(row)

    matches = []

    if rows:
        # Get Combined sheet (used for both match detection and writing)
        combined_sheet = get_or_create_combined_sheet(spreadsheet)

        # Detect matching existing deals BEFORE writing
        try:
            matches = _detect_matching_deals(combined_sheet, activities)
        except Exception:
            pass

        # 1. Write to rep's personal sheet (auto-create on first message)
        rep_sheet = get_or_create_rep_sheet(spreadsheet, rep_name)
        rep_sheet.append_rows(rows, value_input_option="USER_ENTERED")
        print(f"[SHEETS] Saved {len(rows)} rows to '{rep_name}' personal sheet")
        sys.stdout.flush()

        # 2. Write to Combined sheet (dashboard source)
        combined_sheet.append_rows(rows, value_input_option="USER_ENTERED")
        print(f"[SHEETS] Saved {len(rows)} rows to 'Combined' sheet")
        sys.stdout.flush()

        # 3. Write to Live Data (permanent record, never cleared)
        live_sheet = get_or_create_live_tab(spreadsheet)
        live_sheet.append_rows(rows, value_input_option="USER_ENTERED")
        print(f"[SHEETS] Saved {len(rows)} rows to 'Live Data' tab")
        sys.stdout.flush()

        # 4. If any Megger deals, also copy to Major Opportunity tab
        megger_rows = [r for r in rows if r[5] == "Megger"]  # col F (index 5) = Product Brand
        if megger_rows:
            mo_sheet = get_or_create_major_opportunity_sheet(spreadsheet)
            mo_sheet.append_rows(megger_rows, value_input_option="USER_ENTERED")
            print(f"[SHEETS] Copied {len(megger_rows)} Megger rows to 'Major Opportunity'")
            sys.stdout.flush()

    return matches


# ---------------------------------------------------------------------------
# LINE: Reply to message
# ---------------------------------------------------------------------------

def reply_to_line(reply_token: str, message_text: str):

    payload = json.dumps({
        "replyToken": reply_token,
        "messages": [{"type": "text", "text": message_text}],
    }).encode()

    req = urllib.request.Request(
        "https://api.line.me/v2/bot/message/reply",
        data=payload,
        headers={
            "Authorization": f"Bearer {LINE_CHANNEL_ACCESS_TOKEN}",
            "Content-Type": "application/json",
        },
    )
    urllib.request.urlopen(req, timeout=10)


def get_line_profile(user_id: str, group_id: str = None) -> str:
    """Get display name from LINE. Falls back to user_id if it fails."""

    try:
        if group_id:
            url = f"https://api.line.me/v2/bot/group/{group_id}/member/{user_id}"
        else:
            url = f"https://api.line.me/v2/bot/profile/{user_id}"

        req = urllib.request.Request(
            url,
            headers={"Authorization": f"Bearer {LINE_CHANNEL_ACCESS_TOKEN}"},
        )
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read())
        return data.get("displayName", user_id)
    except Exception:
        return user_id


# ---------------------------------------------------------------------------
# LINE: Validate webhook signature
# ---------------------------------------------------------------------------

def validate_signature(body: bytes, signature: str) -> bool:
    try:
        hash_val = hmac.new(
            LINE_CHANNEL_SECRET.encode(), body, hashlib.sha256
        ).digest()
        expected = base64.b64encode(hash_val).decode()
        return hmac.compare_digest(expected, signature)
    except Exception as e:
        print(f"Signature validation error: {e}")
        return False


# ---------------------------------------------------------------------------
# Vercel Serverless Handler
# ---------------------------------------------------------------------------

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        """Health check endpoint."""
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps({
            "status": "ok",
            "service": "ATE Sales Report Bot",
            "timestamp": datetime.now(BKK_TZ).isoformat(),
        }).encode())

    def do_POST(self):
        """LINE webhook handler."""
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length)

        # Handle empty body (LINE verify)
        if not body:
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(b'{"status": "ok"}')
            return

        # Parse body
        try:
            data = json.loads(body)
        except Exception:
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(b'{"status": "ok"}')
            return

        events = data.get("events", [])

        # No events (LINE verify request)
        if not events:
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(b'{"status": "ok"}')
            return

        # Process events BEFORE sending response (Vercel kills function after response)
        for event in events:
            try:
                self._process_event(event)
            except Exception as e:
                print(f"Error processing event: {e}")

        # Respond 200
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(b'{"status": "ok"}')

    def _process_event(self, event: dict):
        """Process a single LINE webhook event."""
        # Only handle text messages
        if event.get("type") != "message":
            return
        if event.get("message", {}).get("type") != "text":
            return

        message_text = event["message"]["text"]
        reply_token = event["replyToken"]
        user_id = event.get("source", {}).get("userId", "unknown")
        group_id = event.get("source", {}).get("groupId")

        # Get rep display name (skip if no token — just use user_id)
        try:
            rep_name = get_line_profile(user_id, group_id)
        except Exception:
            rep_name = user_id

        print(f"[MSG] {rep_name}: {message_text[:80]}")
        sys.stdout.flush()

        # Check for Rich Menu / command keywords
        msg_lower = message_text.strip().lower()
        if msg_lower in SUMMARY_KEYWORDS:
            try:
                generate_summary(reply_token)
            except Exception as e:
                print(f"[SUMMARY] Error: {e}")
                sys.stdout.flush()
                reply_to_line(reply_token, "ขออภัยครับ ไม่สามารถสร้างสรุปได้ กรุณาลองใหม่")
            return

        if msg_lower in HELP_KEYWORDS:
            reply_to_line(reply_token, HELP_RESPONSE)
            return

        # Check for update command: อัพเดท MSG-XXXXX ...
        if UPDATE_PATTERN.match(message_text.strip()):
            try:
                handle_update_command(message_text, reply_token, rep_name)
            except Exception as e:
                print(f"[UPDATE] Error: {e}")
                sys.stdout.flush()
                reply_to_line(reply_token, "ขออภัยครับ ไม่สามารถอัพเดทได้ กรุณาลองใหม่")
            return

        try:
            # Step 1: Parse with AI
            parsed = parse_message(message_text)

            # If not a sales report, ignore silently
            if not parsed.get("is_sales_report", False):
                return

            # Step 2: Write to Google Sheets
            sheets_ok = False
            matches = []
            if GOOGLE_SHEETS_ID and GOOGLE_SERVICE_ACCOUNT_JSON:
                try:
                    matches = append_to_sheets(parsed, rep_name, message_text, user_id)
                    sheets_ok = True
                except Exception as sheets_err:
                    print(f"[SHEETS] Error: {type(sheets_err).__name__}: {str(sheets_err)[:200]}")
                    sys.stdout.flush()

            # Step 3: Reply with confirmation + nudge for missing fields
            ai_confirmation = parsed.get("confirmation_th", "รับทราบครับ บันทึกแล้ว")
            confirmation = build_nudge_confirmation(parsed, ai_confirmation)
            if not sheets_ok and GOOGLE_SHEETS_ID:
                confirmation += "\n\n⚠️ (ระบบบันทึกข้อมูลขัดข้อง กรุณาลองอีกครั้ง)"

            # Append smart match info if existing deals found
            if matches:
                match_note = "\n\n📋 พบดีลที่อาจตรงกัน:"
                for m in matches:
                    val_str = f"฿{float(m['value']):,.0f}" if m['value'] else "—"
                    match_note += (f"\n• {m['batch_id']} | {m['customer']} / "
                                   f"{m['brand']} {m['product']} / {val_str} / {m['stage']}")
                match_note += "\n\nถ้าต้องการอัพเดทดีลเดิม พิมพ์: อัพเดท [Batch ID] ตามด้วยข้อมูลใหม่"
                confirmation += match_note

            reply_to_line(reply_token, confirmation)

        except Exception as e:
            print(f"[ERROR] {type(e).__name__}: {e}")
            sys.stdout.flush()
            try:
                reply_to_line(reply_token, f"ขออภัยครับ ระบบขัดข้อง กรุณาลองใหม่อีกครั้ง")
            except Exception:
                pass
