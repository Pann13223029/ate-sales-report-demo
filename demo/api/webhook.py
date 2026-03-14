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
- Megger — electrical testing equipment (insulation testers, cable fault locators, transformer testers like MTO330, MIT525, MTO300)
- Fluke — electronic test tools (digital multimeters, thermal imagers, power quality analyzers like 1587 FC, 1770, 87V)
- CRC — industrial chemicals (contact cleaners like 2-26, lubricants, degreasers, corrosion inhibitors)
- Salisbury — electrical safety equipment (insulating gloves, arc flash protection, hot sticks)
- SmartWasher — parts washing systems (bioremediating parts washers, OzzyJuice)
- IK Sprayer — industrial sprayers (pressure sprayers, foam sprayers)

Analyze the LINE message from a field sales rep and extract structured data.

RULES:
1. Messages will be in Thai, English, or mixed. Parse regardless of language.
2. If the message is NOT sales-related (casual chat, jokes, lunch plans), return is_sales_report: false.
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

If is_sales_report is false, return: {"is_sales_report": false, "activities": [], "confirmation_th": null}"""

FEW_SHOT_EXAMPLES = [
    {
        "input": "ไปเยี่ยม PTT วันนี้ เสนอ Megger MTO330 ราคา 150,000",
        "output": '{"is_sales_report":true,"activities":[{"customer_name":"PTT","contact_person":null,"product_brand":"Megger","product_name":"MTO330","quantity":null,"deal_value_thb":150000,"activity_type":"visit","sales_stage":"quotation_sent","payment_status":null,"follow_up_notes":null,"summary_en":"Visited PTT, quoted Megger MTO330 at 150K THB"}],"confirmation_th":"รับทราบครับ บันทึกแล้ว:\\n- เข้าพบลูกค้า: PTT\\n- สินค้า: Megger MTO330\\n- มูลค่า: ฿150,000\\n- สถานะ: เสนอราคาแล้ว"}'
    },
    {
        "input": "ปิดดีล Fluke 1770 กับ EGAT แล้ว 450K จ่ายแล้ว 50%",
        "output": '{"is_sales_report":true,"activities":[{"customer_name":"EGAT","contact_person":null,"product_brand":"Fluke","product_name":"1770","quantity":null,"deal_value_thb":450000,"activity_type":"closed_won","sales_stage":"closed_won","payment_status":"partial","follow_up_notes":"Customer paid 50% (225,000 THB); remaining 50% pending","summary_en":"Closed Fluke 1770 deal with EGAT, 450K THB, 50% paid"}],"confirmation_th":"รับทราบครับ บันทึกแล้ว:\\n- ปิดการขายสำเร็จ: EGAT\\n- สินค้า: Fluke 1770\\n- มูลค่า: ฿450,000\\n- ชำระแล้ว: 50%\\n\\nยินดีด้วยครับ! 🎉"}'
    },
    {
        "input": "ลูกค้า SCG โทรมา สนใจ CRC contact cleaner 20 กระป๋อง",
        "output": '{"is_sales_report":true,"activities":[{"customer_name":"SCG","contact_person":null,"product_brand":"CRC","product_name":"Contact Cleaner","quantity":20,"deal_value_thb":null,"activity_type":"call","sales_stage":"lead","payment_status":null,"follow_up_notes":"Customer called expressing interest in 20 cans","summary_en":"SCG called, interested in CRC Contact Cleaner x20"}],"confirmation_th":"รับทราบครับ บันทึกแล้ว:\\n- ลูกค้าโทรเข้ามา: SCG\\n- สินค้า: CRC Contact Cleaner\\n- จำนวน: 20 กระป๋อง\\n- สถานะ: ลูกค้าสนใจ (Lead)"}'
    },
    {
        "input": "ใครจะไปกินข้าวเที่ยงมั่ง",
        "output": '{"is_sales_report":false,"activities":[],"confirmation_th":null}'
    },
    {
        "input": "วันนี้ไปเยี่ยม 2 ที่\n1. IRPC เจอคุณสมชาย เสนอ Megger MIT525 ราคา 280,000\n2. Thai Oil follow up เรื่อง CRC น้ำยาทำความสะอาด 50 แกลลอน ราคา 85,000",
        "output": '{"is_sales_report":true,"activities":[{"customer_name":"IRPC","contact_person":"คุณสมชาย","product_brand":"Megger","product_name":"MIT525","quantity":null,"deal_value_thb":280000,"activity_type":"visit","sales_stage":"negotiation","payment_status":null,"follow_up_notes":"Customer very interested, sent quotation","summary_en":"Visited IRPC, presented Megger MIT525 at 280K THB"},{"customer_name":"Thai Oil","contact_person":null,"product_brand":"CRC","product_name":"Cleaning Solution","quantity":50,"deal_value_thb":85000,"activity_type":"follow_up","sales_stage":"negotiation","payment_status":null,"follow_up_notes":"Following up on CRC cleaning solution, 50 gallons","summary_en":"Follow-up at Thai Oil on CRC cleaner 50gal, 85K THB"}],"confirmation_th":"รับทราบครับ บันทึก 2 รายการแล้ว:\\n\\n1. เข้าพบ IRPC (คุณสมชาย)\\n   - Megger MIT525 ฿280,000\\n   - สถานะ: กำลังเจรจา\\n\\n2. Follow up Thai Oil\\n   - CRC น้ำยาทำความสะอาด x50 แกลลอน ฿85,000\\n   - สถานะ: กำลังเจรจา"}'
    },
    {
        "input": "เสียงาน Salisbury ถุงมือกันไฟฟ้าที่ กฟภ. แพ้ราคาเจ้าอื่น มูลค่า 320,000",
        "output": '{"is_sales_report":true,"activities":[{"customer_name":"กฟภ. (PEA)","contact_person":null,"product_brand":"Salisbury","product_name":"Insulating Gloves","quantity":null,"deal_value_thb":320000,"activity_type":"closed_lost","sales_stage":"closed_lost","payment_status":null,"follow_up_notes":"Lost on price — competitor was cheaper","summary_en":"Lost Salisbury gloves deal at PEA, 320K, undercut on price"}],"confirmation_th":"รับทราบครับ บันทึกแล้ว:\\n- เสียงาน: กฟภ.\\n- สินค้า: Salisbury ถุงมือกันไฟฟ้า\\n- มูลค่า: ฿320,000\\n- สาเหตุ: แพ้ราคา\\n\\nไม่เป็นไรครับ ครั้งหน้าจะได้แน่นอน 💪"}'
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

EXAMPLE_MESSAGE = "ตัวอย่าง: ไปเยี่ยม PTT เสนอ Megger MTO330 ราคา 150,000 สถานะเจรจา"


def build_nudge_confirmation(parsed: dict, ai_confirmation: str) -> str:
    """Build confirmation with nudge for missing fields."""
    activities = parsed.get("activities", [])
    if not activities:
        return ai_confirmation

    # Check missing fields across all activities
    all_missing = []
    for activity in activities:
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

ตัวอย่าง:
• ไปเยี่ยม PTT เสนอ Megger MTO330 ราคา 150,000 สถานะเจรจา
• โทรคุย EGAT เรื่อง Fluke 1770 ลูกค้าสนใจ งบ 520,000
• ปิดดีล SCG Salisbury ถุงมือ 15 ชุด 975,000 จ่ายแล้ว 50%

รายงานหลายรายการในข้อความเดียวก็ได้:
• เข้าพบ PTTEP วันนี้
  1. เสนอ Megger MIT1025 ราคา 350,000
  2. เสนอ Fluke 87V 3 ตัว ราคา 42,000

ข้อมูลสำคัญ 5 อย่าง:
✅ ชื่อลูกค้า
✅ สินค้า/แบรนด์
✅ มูลค่าดีล
✅ ประเภทกิจกรรม (เยี่ยม/โทร/เสนอราคา/ปิดดีล)
✅ สถานะดีล (สนใจ/เจรจา/ส่ง QT/ปิดได้/เสียงาน)"""


def generate_summary(reply_token: str):
    """Generate pipeline summary from Sheet1 data using Gemini."""
    client = get_sheets_client()
    sheet = client.open_by_key(GOOGLE_SHEETS_ID).sheet1
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
    "Product Brand", "Product Name", "Quantity", "Deal Value (THB)",
    "Activity Type", "Sales Stage", "Payment Status",
    "Follow-up Notes", "Summary (EN)", "Raw Message",
    "Batch ID", "Item #", "Source"
]


def get_or_create_live_tab(spreadsheet):
    """Get the 'Live Data' tab, creating it with headers if it doesn't exist."""
    import gspread
    try:
        return spreadsheet.worksheet("Live Data")
    except gspread.exceptions.WorksheetNotFound:
        live_sheet = spreadsheet.add_worksheet(title="Live Data", rows=500, cols=17)
        live_sheet.update(range_name="A1:Q1", values=[LIVE_DATA_HEADERS])
        # Bold header
        spreadsheet.batch_update({"requests": [{
            "repeatCell": {
                "range": {"sheetId": live_sheet.id, "startRowIndex": 0, "endRowIndex": 1},
                "cell": {"userEnteredFormat": {
                    "backgroundColor": {"red": 0.15, "green": 0.3, "blue": 0.55},
                    "textFormat": {"bold": True, "foregroundColor": {"red": 1, "green": 1, "blue": 1}},
                }},
                "fields": "userEnteredFormat(backgroundColor,textFormat)",
            }
        }, {
            "updateSheetProperties": {
                "properties": {"sheetId": live_sheet.id, "gridProperties": {"frozenRowCount": 1}},
                "fields": "gridProperties.frozenRowCount",
            }
        }]})
        print(f"[SHEETS] Created 'Live Data' tab with headers")
        sys.stdout.flush()
        return live_sheet


def append_to_sheets(parsed: dict, rep_name: str, raw_message: str):
    import gspread

    client = get_sheets_client()
    spreadsheet = client.open_by_key(GOOGLE_SHEETS_ID)

    now = datetime.now(BKK_TZ).strftime("%Y-%m-%d %H:%M:%S")

    # Generate batch ID from timestamp hash (groups multi-activity messages)
    batch_id = "MSG-" + hashlib.md5(f"{now}{rep_name}{raw_message}".encode()).hexdigest()[:5].upper()
    activities = parsed.get("activities", [])
    total = len(activities)

    rows = []
    for i, activity in enumerate(activities, 1):
        item_label = f"{i}/{total}" if total > 1 else ""
        row = [
            now,
            rep_name,
            activity.get("customer_name", ""),
            activity.get("contact_person", ""),
            activity.get("product_brand", ""),
            activity.get("product_name", ""),
            activity.get("quantity", ""),
            activity.get("deal_value_thb", ""),
            activity.get("activity_type", ""),
            activity.get("sales_stage", ""),
            activity.get("payment_status", ""),
            activity.get("follow_up_notes", ""),
            activity.get("summary_en", ""),
            raw_message,
            batch_id,
            item_label,
            "live",
        ]
        rows.append(row)

    if rows:
        # Write to Live Data tab FIRST (permanent record)
        live_sheet = get_or_create_live_tab(spreadsheet)
        live_sheet.append_rows(rows, value_input_option="USER_ENTERED")
        print(f"[SHEETS] Saved {len(rows)} rows to 'Live Data' tab")
        sys.stdout.flush()

        # Then write to Sheet1 (demo/dashboard tab)
        sheet1 = spreadsheet.sheet1
        sheet1.append_rows(rows, value_input_option="USER_ENTERED")
        print(f"[SHEETS] Saved {len(rows)} rows to Sheet1")


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

        try:
            # Step 1: Parse with AI
            parsed = parse_message(message_text)

            # If not a sales report, ignore silently
            if not parsed.get("is_sales_report", False):
                return

            # Step 2: Write to Google Sheets
            sheets_ok = False
            if GOOGLE_SHEETS_ID and GOOGLE_SERVICE_ACCOUNT_JSON:
                try:
                    append_to_sheets(parsed, rep_name, message_text)
                    sheets_ok = True
                except Exception as sheets_err:
                    print(f"[SHEETS] Error: {type(sheets_err).__name__}: {str(sheets_err)[:200]}")
                    sys.stdout.flush()

            # Step 3: Reply with confirmation + nudge for missing fields
            ai_confirmation = parsed.get("confirmation_th", "รับทราบครับ บันทึกแล้ว")
            confirmation = build_nudge_confirmation(parsed, ai_confirmation)
            if not sheets_ok and GOOGLE_SHEETS_ID:
                confirmation += "\n\n⚠️ (ระบบบันทึกข้อมูลขัดข้อง กรุณาลองอีกครั้ง)"
            reply_to_line(reply_token, confirmation)

        except Exception as e:
            print(f"[ERROR] {type(e).__name__}: {e}")
            sys.stdout.flush()
            try:
                reply_to_line(reply_token, f"ขออภัยครับ ระบบขัดข้อง กรุณาลองใหม่อีกครั้ง")
            except Exception:
                pass
