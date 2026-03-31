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

# Ensure sibling modules are importable on Vercel's runtime
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from megger_segments import lookup_segment

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

ATE sells products such as: MTO330, MIT525, MTO300, DLRO200, S1-1568, MIT1025, 1587 FC, 1770, 87V, Ti480 PRO, 435-II, CRC 2-26, Lectra Clean, Contact Cleaner, Rust Remover, Arc Flash Kit, Insulating Gloves, SW-28, Pro 12, HV Detector, and more.

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
      "contact_channel": "string — MANDATORY: phone number or email address of the contact person. Must be a real phone number (e.g. 081-234-5678) or email (e.g. weera@ptt.co.th). Never use 'เข้าพบ' or visit/call categories. null only if truly not mentioned.",
      "product_name": "string or null — the product model/name mentioned (e.g. MTO330, 1587 FC, CRC 2-26)",
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
        "input": "ไปเยี่ยม PTT วันนี้ เสนอ MTO330 ราคา 150,000",
        "output": '{"is_sales_report":true,"activities":[{"customer_name":"PTT","contact_person":null,"contact_channel":null,"product_name":"MTO330","quantity":null,"deal_value_thb":150000,"activity_type":"visit","sales_stage":"quotation_sent","payment_status":null,"planned_visit_date":null,"bidding_date":null,"accompanying_rep":null,"is_training":null,"close_reason":null,"follow_up_notes":null,"summary_en":"Visited PTT, quoted MTO330 at 150K THB"}],"confirmation_th":"รับทราบครับ บันทึกแล้ว:\\n- เข้าพบลูกค้า: PTT\\n- สินค้า: MTO330\\n- มูลค่า: ฿150,000\\n- สถานะ: เสนอราคาแล้ว"}'
    },
    {
        "input": "ปิดดีล 1770 กับ EGAT แล้ว 450K วางมัดจำ 50%",
        "output": '{"is_sales_report":true,"activities":[{"customer_name":"EGAT","contact_person":null,"contact_channel":null,"product_name":"1770","quantity":null,"deal_value_thb":450000,"activity_type":"closed_won","sales_stage":"closed_won","payment_status":"deposit","planned_visit_date":null,"bidding_date":null,"accompanying_rep":null,"is_training":null,"close_reason":"ปิดดีลได้ตามราคาเสนอ ลูกค้าวางมัดจำ 50%","follow_up_notes":"Customer paid 50% deposit (225,000 THB); remaining 50% pending","summary_en":"Closed 1770 deal with EGAT, 450K THB, 50% deposit"}],"confirmation_th":"รับทราบครับ บันทึกแล้ว:\\n- ปิดการขายสำเร็จ: EGAT\\n- สินค้า: 1770\\n- มูลค่า: ฿450,000\\n- วางมัดจำ: 50%\\n\\nยินดีด้วยครับ! 🎉"}'
    },
    {
        "input": "ลูกค้า SCG โทรมาเบอร์ 081-234-5678 สนใจ CRC Contact Cleaner 20 กระป๋อง",
        "output": '{"is_sales_report":true,"activities":[{"customer_name":"SCG","contact_person":null,"contact_channel":"081-234-5678","product_name":"CRC Contact Cleaner","quantity":20,"deal_value_thb":null,"activity_type":"call","sales_stage":"lead","payment_status":null,"planned_visit_date":null,"bidding_date":null,"accompanying_rep":null,"is_training":null,"close_reason":null,"follow_up_notes":"Customer called expressing interest in 20 cans","summary_en":"SCG called, interested in CRC Contact Cleaner x20"}],"confirmation_th":"รับทราบครับ บันทึกแล้ว:\\n- ลูกค้าโทรเข้ามา: SCG\\n- สินค้า: CRC Contact Cleaner\\n- จำนวน: 20 กระป๋อง\\n- สถานะ: ลูกค้าสนใจ (Lead)"}'
    },
    {
        "input": "ใครจะไปกินข้าวเที่ยงมั่ง",
        "output": '{"is_sales_report":false,"activities":[],"confirmation_th":null}'
    },
    {
        "input": "จะไปเยี่ยม IRPC อังคารหน้า เรื่อง MIT525 พาน้องใหม่สมชายไปด้วย",
        "output": '{"is_sales_report":true,"activities":[{"customer_name":"IRPC","contact_person":null,"contact_channel":null,"product_name":"MIT525","quantity":null,"deal_value_thb":null,"activity_type":"visit","sales_stage":"plan_to_visit","payment_status":null,"planned_visit_date":"2026-03-17","bidding_date":null,"accompanying_rep":"สมชาย","is_training":true,"close_reason":null,"follow_up_notes":"Planned visit next Tuesday with trainee","summary_en":"Planning to visit IRPC next Tue for MIT525, with trainee"}],"confirmation_th":"รับทราบครับ บันทึกแล้ว:\\n- นัดเข้าพบ: IRPC (อังคารหน้า)\\n- สินค้า: MIT525\\n- ไปกับ: สมชาย (ฝึกงาน)\\n- สถานะ: นัดเข้าพบ"}'
    },
    {
        "input": "เสียงาน Insulating Gloves ที่ กฟภ. แพ้ราคาเจ้าอื่น มูลค่า 320,000",
        "output": '{"is_sales_report":true,"activities":[{"customer_name":"กฟภ. (PEA)","contact_person":null,"contact_channel":null,"product_name":"Insulating Gloves","quantity":null,"deal_value_thb":320000,"activity_type":"closed_lost","sales_stage":"closed_lost","payment_status":null,"planned_visit_date":null,"bidding_date":null,"accompanying_rep":null,"is_training":null,"close_reason":"แพ้ราคาคู่แข่ง ราคาถูกกว่า","follow_up_notes":"Lost on price — competitor was cheaper","summary_en":"Lost Insulating Gloves deal at PEA, 320K, undercut on price"}],"confirmation_th":"รับทราบครับ บันทึกแล้ว:\\n- เสียงาน: กฟภ.\\n- สินค้า: Insulating Gloves\\n- มูลค่า: ฿320,000\\n- สาเหตุ: แพ้ราคา\\n\\nไม่เป็นไรครับ ครั้งหน้าจะได้แน่นอน 💪"}'
    },
    {
        "input": "ส่ง MTO330 เครื่องของ PTT เข้าซ่อม warranty",
        "output": '{"is_sales_report":true,"activities":[{"customer_name":"PTT","contact_person":null,"contact_channel":null,"product_name":"MTO330","quantity":1,"deal_value_thb":null,"activity_type":"sent_to_service","sales_stage":null,"payment_status":null,"planned_visit_date":null,"bidding_date":null,"accompanying_rep":null,"is_training":null,"close_reason":null,"follow_up_notes":"Sent unit for warranty repair","summary_en":"Sent PTT MTO330 for warranty service"}],"confirmation_th":"รับทราบครับ บันทึกแล้ว:\\n- ส่งซ่อม warranty: PTT\\n- สินค้า: MTO330\\n- สถานะ: ส่งเข้าศูนย์บริการ"}'
    },
    {
        "input": "ส่งเมล์ใบเสนอราคา MIT525 ให้ กฟภ. 3 เครื่อง 2.1 ล้าน ประมูลเปิดซอง 25 มี.ค. email: procurement@pea.co.th",
        "output": '{"is_sales_report":true,"activities":[{"customer_name":"กฟภ. (PEA)","contact_person":null,"contact_channel":"procurement@pea.co.th","product_name":"MIT525","quantity":3,"deal_value_thb":2100000,"activity_type":"quotation","sales_stage":"bidding","payment_status":null,"planned_visit_date":null,"bidding_date":"2026-03-25","accompanying_rep":null,"is_training":null,"close_reason":null,"follow_up_notes":"Government bid submitted via email, opening date March 25","summary_en":"Submitted bid for 3x MIT525 at PEA, 2.1M THB, opens Mar 25"}],"confirmation_th":"รับทราบครับ บันทึกแล้ว:\\n- ยื่นประมูล: กฟภ.\\n- สินค้า: MIT525 x3\\n- มูลค่า: ฿2,100,000\\n- เปิดซอง: 25 มี.ค. 2569"}'
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
    "contact_channel": "เบอร์โทร/อีเมล ผู้ติดต่อ",
    "product_name": "ชื่อสินค้า",
    "deal_value_thb": "มูลค่าดีล",
    "activity_type": "ประเภทกิจกรรม",
    "sales_stage": "สถานะดีล",
}

# Fields exempt from mandatory check (service entries don't need sales_stage/deal_value)
SERVICE_ACTIVITY_TYPES = {"sent_to_service"}

EXAMPLE_MESSAGE = "ตัวอย่าง: ไปเยี่ยม PTT คุณวีระ 081-234-5678 เสนอ Megger MTO330 ราคา 150,000 สถานะเจรจา"


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
HELP_UPDATE_KEYWORDS = {"วิธีอัพเดท", "วิธีอัพเดต", "วิธีแก้ไข", "how to update"}

HELP_RESPONSE = """📝 วิธีรายงานการขาย

พิมพ์ข้อความรายงานเข้ามาได้เลยครับ ระบบจะบันทึกให้อัตโนมัติ

ตัวอย่างรายงาน:
• ไปเยี่ยม PTT คุณวีระ 081-234-5678 เสนอ MTO330 ราคา 150,000 สถานะเจรจา
• โทรคุย EGAT คุณสุรศักดิ์ surasak@egat.co.th เรื่อง TRAX280 งบ 4,500,000
• ปิดดีล SCG คุณอภิชาติ 084-567-8901 Sverker900 5 เครื่อง 975,000 วางมัดจำ 50%
• จะไปเยี่ยม IRPC คุณประยุทธ์ prayuth@irpc.co.th เรื่อง MIT525
• ส่ง MTO330 ของ PTT คุณวีระ 081-234-5678 เข้าซ่อม warranty
• ยื่นซองประมูล กฟภ. procurement@pea.co.th MIT525 2.1 ล้าน เปิดซอง 25 มี.ค.

อัพเดทดีลเดิม:
• พิมพ์: อัพเดท MSG-XXXXX ตามด้วยข้อมูลใหม่
• ตัวอย่าง: อัพเดท MSG-A1B2C สถานะเจรจา ราคา 2.8 ล้าน

คำสั่งอื่นๆ:
• สรุป — ดูสรุป pipeline
• วิธีอัพเดท — ดูวิธีอัพเดทดีล
• วิธีใช้ — ดูข้อความนี้

ข้อมูลสำคัญ 6 อย่าง:
✅ ชื่อลูกค้า
✅ เบอร์โทร/อีเมล ผู้ติดต่อ (จำเป็น!)
✅ ชื่อสินค้า (เช่น MTO330, MIT525, TRAX280, Sverker900)
✅ มูลค่าดีล
✅ กิจกรรม (เยี่ยม/โทร/เสนอราคา/ปิดดีล/ส่งซ่อม)
✅ สถานะ (สนใจ/นัดเยี่ยม/เยี่ยมแล้ว/เจรจา/ส่ง QT/ประมูล/ปิดได้/เสียงาน)"""

HELP_UPDATE_RESPONSE = """🔄 วิธีอัพเดทดีลเดิม

ใช้ Batch ID (MSG-XXXXX) ที่ได้ตอนรายงาน:

พิมพ์: อัพเดท MSG-XXXXX ตามด้วยข้อมูลใหม่

ตัวอย่าง:
• อัพเดท MSG-A1B2C สถานะเจรจา ราคา 2.8 ล้าน
• อัพเดท MSG-A1B2C ปิดดีลได้แล้ว วางมัดจำ 50%
• อัพเดท MSG-A1B2C เสียงาน ลูกค้าตัดงบ
• อัพเดท MSG-A1B2C นัดเยี่ยมอังคารหน้า

เปลี่ยนได้ทุกฟิลด์:
✅ สถานะ / มูลค่าดีล / การชำระเงิน
✅ วันนัดเยี่ยม / วันประมูล
✅ เหตุผลปิดงาน / หมายเหตุ

💡 ถ้าจำ Batch ID ไม่ได้ — ลองรายงานซ้ำลูกค้า/สินค้าเดิม ระบบจะแนะนำ Batch ID ให้อัตโนมัติ"""


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


def _normalize_name(value: str) -> str:
    return (value or "").strip().casefold()


def _get_requester_names(spreadsheet, user_id: str, rep_name: str) -> set:
    """Collect possible requester display names for ownership checks."""
    names = {_normalize_name(rep_name)}
    if not user_id:
        return {n for n in names if n}

    try:
        reg = get_or_create_rep_registry(spreadsheet)
        cell = reg.find(user_id, in_column=1)
        display_name = reg.cell(cell.row, 2).value
        names.add(_normalize_name(display_name))
    except Exception:
        pass

    return {n for n in names if n}


def handle_update_command(message_text, reply_token, rep_name, user_id=""):
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

    requester_names = _get_requester_names(spreadsheet, user_id, rep_name)
    owner_names = set()
    for row_num in row_numbers:
        row = combined.row_values(row_num)
        if len(row) > 1:
            owner_names.add(_normalize_name(row[1]))

    owner_names = {n for n in owner_names if n}
    if owner_names and requester_names.isdisjoint(owner_names):
        reply_to_line(reply_token, f"ไม่สามารถอัพเดท {batch_id} ได้ครับ รายการนี้เป็นของ rep คนอื่น")
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
customer_name, contact_person, contact_channel, product_name, quantity,
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

    # Re-match Product Segment if product changed
    if "product_name" in changes:
        name = changes.get("product_name") or existing_data.get("Product Name", "")
        new_segment = lookup_segment(name)
        segment_col = header_to_col.get("Product Segment")
        if segment_col:
            cell_updates.append((segment_col, new_segment))

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

    # 2. Live Data
    try:
        live_sheet = get_or_create_live_tab(spreadsheet)
        live_rows = _find_rows_by_batch_id(live_sheet, batch_id)
        if live_rows:
            _apply_cell_updates(live_sheet, live_rows, cell_updates)
            updated_sheets.append("Live Data")
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
        segment_idx = headers.index("Product Segment")
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
    segment_values = {}
    rep_values = {}

    for row in rows:
        try:
            val = float(row[val_idx].replace(",", "")) if row[val_idx] else 0
        except (ValueError, IndexError):
            val = 0

        total_value += val

        stage = row[stage_idx] if stage_idx < len(row) else ""
        segment = row[segment_idx] if segment_idx < len(row) else ""
        rep = row[rep_idx] if rep_idx < len(row) else ""

        stage_counts[stage] = stage_counts.get(stage, 0) + 1
        stage_values[stage] = stage_values.get(stage, 0) + val
        if segment:
            segment_values[segment] = segment_values.get(segment, 0) + val
        rep_values[rep] = rep_values.get(rep, 0) + val

    # Build stats text for Gemini
    stats_text = f"""Sales Pipeline Data Summary:
- Total entries: {total_rows}
- Total pipeline value: {total_value:,.0f} THB

By Sales Stage:
{chr(10).join(f'  - {s}: {c} deals, {stage_values.get(s, 0):,.0f} THB' for s, c in sorted(stage_counts.items()))}

By Product Segment:
{chr(10).join(f'  - {s}: {v:,.0f} THB' for s, v in sorted(segment_values.items(), key=lambda x: -x[1]))}

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
    "Contact Channel", "Product Name", "Product Segment", "Quantity",
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


def _ensure_sheet_headers(spreadsheet, sheet, headers):
    """Ensure a sheet has the expected header row before data rows are appended."""
    row1 = sheet.row_values(1)
    normalized_existing = [cell.strip() for cell in row1]

    if normalized_existing[:len(headers)] == headers:
        return sheet

    if any(normalized_existing):
        raise ValueError(
            f"Sheet '{sheet.title}' is missing expected headers; refusing to overwrite existing row 1"
        )

    last_col = chr(ord("A") + len(headers) - 1)
    sheet.update(range_name=f"A1:{last_col}1", values=[headers])
    _format_new_sheet(spreadsheet, sheet)
    return sheet


def get_or_create_rep_registry(spreadsheet):
    """Get 'Rep Registry' tab (maps LINE user IDs to display names), creating if needed."""
    import gspread
    try:
        reg = spreadsheet.worksheet("Rep Registry")
    except gspread.exceptions.WorksheetNotFound:
        reg = spreadsheet.add_worksheet(title="Rep Registry", rows=50, cols=3)
        reg.update(range_name="A1:C1", values=[["User ID", "Display Name", "Last Active"]])
        _format_new_sheet(spreadsheet, reg)
        print("[SHEETS] Created 'Rep Registry' tab")
        sys.stdout.flush()
    return _ensure_sheet_headers(spreadsheet, reg, ["User ID", "Display Name", "Last Active"])


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
        live_sheet = spreadsheet.worksheet("Live Data")
    except gspread.exceptions.WorksheetNotFound:
        live_sheet = spreadsheet.add_worksheet(title="Live Data", rows=500, cols=24)
        spreadsheet.batch_update({"requests": [
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
    return _ensure_sheet_headers(spreadsheet, live_sheet, LIVE_DATA_HEADERS)


def get_or_create_combined_sheet(spreadsheet):
    """Get 'Combined' tab. If not found, rename Sheet1 to 'Combined' and protect it."""
    import gspread
    try:
        combined = spreadsheet.worksheet("Combined")
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
        combined = sheet1
    return _ensure_sheet_headers(spreadsheet, combined, LIVE_DATA_HEADERS)




def _detect_matching_deals(combined_sheet, activities):
    """Check Combined sheet for existing active deals matching new activities.
    Returns list of match dicts: {batch_id, customer, product, value, stage, segment}
    """
    all_data = combined_sheet.get_all_values()
    if len(all_data) <= 1:
        return []

    headers = all_data[0]
    try:
        customer_col = headers.index("Customer")
        product_col = headers.index("Product Name")
        stage_col = headers.index("Sales Stage")
        value_col = headers.index("Deal Value (THB)")
        batch_col = headers.index("Batch ID")
        segment_col = headers.index("Product Segment")
    except ValueError:
        return []

    terminal = {"closed_won", "closed_lost", "job_expired", "equipment_defect"}
    matches = []
    seen_batches = set()

    for activity in activities:
        new_customer = (activity.get("customer_name") or "").strip().lower()
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
            existing_product = row[product_col].strip().lower()

            # Match: customer substring + same product name
            customer_match = (new_customer in existing_customer
                              or existing_customer in new_customer)
            product_match = (new_product and new_product in existing_product
                             or existing_product in new_product)

            if customer_match and product_match:
                matches.append({
                    "batch_id": existing_batch,
                    "customer": row[customer_col],
                    "product": row[product_col],
                    "value": row[value_col] if value_col < len(row) else "",
                    "stage": row[stage_col],
                    "segment": row[segment_col] if segment_col < len(row) else "",
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
        segment = lookup_segment(activity.get("product_name", ""))
        row = [
            now,
            rep_name,
            activity.get("customer_name", ""),
            activity.get("contact_person", ""),
            activity.get("contact_channel", ""),
            activity.get("product_name", ""),
            segment,
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

        # 1. Write to Combined sheet (dashboard source)
        combined_sheet.append_rows(rows, value_input_option="USER_ENTERED")
        print(f"[SHEETS] Saved {len(rows)} rows to 'Combined' sheet")
        sys.stdout.flush()

        # 2. Write to Live Data (permanent record, never cleared)
        live_sheet = get_or_create_live_tab(spreadsheet)
        live_sheet.append_rows(rows, value_input_option="USER_ENTERED")
        print(f"[SHEETS] Saved {len(rows)} rows to 'Live Data' tab")
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

        if not LINE_CHANNEL_SECRET:
            self.send_response(500)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(b'{"error": "missing LINE_CHANNEL_SECRET"}')
            return

        signature = self.headers.get("X-Line-Signature", "")
        if not signature or not validate_signature(body, signature):
            self.send_response(401)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(b'{"error": "invalid signature"}')
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

        if msg_lower in HELP_UPDATE_KEYWORDS:
            reply_to_line(reply_token, HELP_UPDATE_RESPONSE)
            return

        # Check for update command: อัพเดท MSG-XXXXX ...
        if UPDATE_PATTERN.match(message_text.strip()):
            try:
                handle_update_command(message_text, reply_token, rep_name, user_id)
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

            # Step 1b: Block if contact_channel is missing (mandatory)
            activities = parsed.get("activities", [])
            needs_contact = [
                a for a in activities
                if a.get("activity_type") not in SERVICE_ACTIVITY_TYPES
                and not a.get("contact_channel")
            ]
            if needs_contact:
                reject_msg = ("⚠️ กรุณาระบุเบอร์โทรหรืออีเมลของผู้ติดต่อด้วยนะครับ "
                              "ระบบยังไม่ได้บันทึกข้อมูลนี้\n\n"
                              "กรุณาส่งใหม่พร้อมเบอร์โทร/อีเมล เช่น:\n"
                              "ไปเยี่ยม PTT คุณวีระ 081-234-5678 เสนอ Megger MTO330 ราคา 150,000 สถานะเจรจา")
                reply_to_line(reply_token, reject_msg)
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
                    val_str = f"฿{float(str(m['value']).replace(',', '')):,.0f}" if m['value'] else "—"
                    match_note += (f"\n• {m['batch_id']} | {m['customer']} / "
                                   f"{m['product']} / {val_str} / {m['stage']}")
                match_note += "\n\nถ้าต้องการอัพเดทดีลเดิม พิมพ์: อัพเดท [Batch ID] ตามด้วยข้อมูลใหม่"
                confirmation += match_note

            reply_to_line(reply_token, confirmation)

        except Exception as e:
            print(f"[ERROR] {type(e).__name__}: {e}")
            sys.stdout.flush()
            try:
                reply_to_line(reply_token, "ขออภัยครับ ระบบขัดข้อง กรุณาลองใหม่อีกครั้ง")
            except Exception:
                pass
