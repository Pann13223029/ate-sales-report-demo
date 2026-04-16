"""
Populate Google Sheets with sample data for the ATE Sales Demo.

Usage:
  python populate_sample_data.py

Legacy note:
This script belongs to the older LINE/Python demo path retained for reference.
"""

import json
import os
import sys
import hashlib
from datetime import datetime, timezone, timedelta
import gspread
from google.oauth2.service_account import Credentials

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "api"))
from megger_segments import lookup_segment

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

GOOGLE_SHEETS_ID = os.environ.get("GOOGLE_SHEETS_ID")
if not GOOGLE_SHEETS_ID:
    print("ERROR: Set GOOGLE_SHEETS_ID environment variable")
    sys.exit(1)
BKK_TZ = timezone(timedelta(hours=7))

# Load service account from file
SA_FILE = os.path.join(os.path.dirname(__file__), "ate-sales-demo-40e42c608c26.json")
with open(SA_FILE) as f:
    creds_dict = json.load(f)

scopes = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
]
creds = Credentials.from_service_account_info(creds_dict, scopes=scopes)
client = gspread.authorize(creds)


# ---------------------------------------------------------------------------
# Batch ID generator (deterministic from content)
# ---------------------------------------------------------------------------

def make_batch_id(timestamp, rep_name, text):
    raw = f"{timestamp}|{rep_name}|{text}"
    return "MSG-" + hashlib.md5(raw.encode()).hexdigest()[:8].upper()


# ---------------------------------------------------------------------------
# Row builder
# ---------------------------------------------------------------------------

def row(ts, rep, customer, contact, channel, product, qty, value,
        activity, stage, payment="", visit_date="", bid_date="", accomp="",
        training="", close_reason="", notes="", summary="", raw="",
        batch_id="", item_label=""):
    segment = lookup_segment(product)
    return [ts, rep, customer, contact, channel, product, segment, qty, value,
            activity, stage, payment, visit_date, bid_date, accomp, training,
            close_reason, notes, summary, raw, batch_id, item_label, "sample", ""]

# ---------------------------------------------------------------------------
# Build sample data with Batch IDs
# All products are from the 431-product catalog — every row gets a segment.
# Segments: PT, GET, PP, CI, LVI, MRM, PDIX
# ---------------------------------------------------------------------------

_rows = []

# === Deal Progression Story 1: PTT + MTO330 [PT] (สมชาย) ===
b = make_batch_id("2026-02-10 09:15:00", "สมชาย", "PTT MTO330 visit")
_rows.append(row("2026-02-10 09:15:00", "สมชาย", "PTT", "คุณวีระ", "081-234-5678", "MTO330", 2, 3200000, "visit", "lead", "", "", "", "", "", "", "เข้าพบลูกค้า นำเสนอ MTO330 สนใจขอใบเสนอราคา", "Visited PTT HQ to present MTO330", "เข้าพบ PTT วันนี้ครับ คุณวีระสนใจ MTO330 จำนวน 2 เครื่อง งบประมาณราว 3.2 ล้าน", b))
b = make_batch_id("2026-02-14 10:30:00", "สมชาย", "PTT MTO330 qt")
_rows.append(row("2026-02-14 10:30:00", "สมชาย", "PTT", "คุณวีระ", "weera.p@ptt.co.th", "MTO330", 2, 3200000, "quotation", "quotation_sent", "", "", "", "", "", "", "ส่งใบเสนอราคา MTO330 x2 ให้ PTT รอพิจารณา 2 สัปดาห์", "Sent quotation for 2x MTO330 to PTT", "ส่ง QT ให้คุณวีระ PTT เรียบร้อยครับ MTO330 2 เครื่อง 3.2 ล้าน", b))
b = make_batch_id("2026-02-27 14:00:00", "สมชาย", "PTT MTO330 nego")
_rows.append(row("2026-02-27 14:00:00", "สมชาย", "PTT", "คุณวีระ", "081-234-5678", "MTO330", 2, 3050000, "follow_up", "negotiation", "", "", "", "", "", "", "PTT ต่อรองราคาลงมาที่ 3.05 ล้าน ขอลด 5%", "PTT negotiating price down to 3.05M THB", "คุณวีระ PTT โทรมาต่อรองราคาครับ ขอลด 5% เหลือ 3.05 ล้าน", b))
b = make_batch_id("2026-03-06 11:00:00", "สมชาย", "PTT MTO330 won")
_rows.append(row("2026-03-06 11:00:00", "สมชาย", "PTT", "คุณวีระ", "weera.p@ptt.co.th", "MTO330", 2, 3050000, "closed_won", "closed_won", "pending", "", "", "", "", "ลด 5% จากราคาเสนอ ได้ PO เลขที่ PTT-2026-0312", "ปิดดีล PTT สำเร็จ 3.05 ล้าน PO เลขที่ PTT-2026-0312", "Closed deal with PTT at 3.05M THB, 5% discount", "ปิดดีล PTT ได้แล้วครับ! 3.05 ล้าน ได้ PO แล้ว รอเงินงวดแรกครับ", b))

# === Deal Progression Story 2: EGAT + TRAX280 [PT] (วิภา) ===
b = make_batch_id("2026-02-12 09:45:00", "วิภา", "EGAT TRAX280")
_rows.append(row("2026-02-12 09:45:00", "วิภา", "EGAT", "คุณสุรศักดิ์", "089-876-5432", "TRAX280", 3, 4500000, "call", "lead", "", "", "", "", "", "", "โทรหา EGAT เสนอ TRAX280 สำหรับทดสอบหม้อแปลง", "Called EGAT to propose TRAX280 transformer test system", "โทรคุย EGAT คุณสุรศักดิ์ เสนอ TRAX280 3 ชุด นัดเข้าพบอาทิตย์หน้าค่ะ", b))
b = make_batch_id("2026-02-19 13:30:00", "วิภา", "EGAT TRAX280 visit")
_rows.append(row("2026-02-19 13:30:00", "วิภา", "EGAT", "คุณสุรศักดิ์", "surasak@egat.co.th", "TRAX280", 3, 4500000, "visit", "negotiation", "", "", "", "", "", "", "เข้าพบ EGAT สาธิต TRAX280 ลูกค้าขอเทียบกับ Omicron", "Visited EGAT, demo TRAX280, comparing with Omicron", "เข้าพบ EGAT วันนี้ค่ะ Demo TRAX280 ลูกค้าชอบ แต่ขอเทียบกับ Omicron ค่ะ", b))
b = make_batch_id("2026-03-05 16:00:00", "วิภา", "EGAT TRAX280 lost")
_rows.append(row("2026-03-05 16:00:00", "วิภา", "EGAT", "คุณสุรศักดิ์", "089-876-5432", "TRAX280", 3, 4500000, "closed_lost", "closed_lost", "", "", "", "", "", "แพ้ราคา Omicron ถูกกว่า 15% พร้อม service contract", "EGAT เลือก Omicron ราคาถูกกว่า 15% พร้อม service contract", "Lost to Omicron, 15% cheaper with service contract", "เสียดายค่ะ EGAT เลือก Omicron ราคาถูกกว่า 15% แถม service contract ด้วย", b))

# === Deal Progression Story 3: SCG + Sverker900 [PP] (ธนกฤต) ===
b = make_batch_id("2026-02-18 10:00:00", "ธนกฤต", "SCG Sverker900")
_rows.append(row("2026-02-18 10:00:00", "ธนกฤต", "SCG", "คุณอภิชาติ", "apichat@scg.com", "Sverker900", 5, 975000, "visit", "lead", "", "", "", "", "", "", "เข้าพบ SCG บ้านโป่ง นำเสนอ Sverker900 สำหรับทดสอบ relay", "Visited SCG Ban Pong, presented Sverker900 relay tester", "เข้าพบ SCG บ้านโป่งครับ คุณอภิชาติต้องการ Sverker900 5 เครื่อง งบ Q1", b))
b = make_batch_id("2026-02-25 11:30:00", "ธนกฤต", "SCG Sverker900 qt")
_rows.append(row("2026-02-25 11:30:00", "ธนกฤต", "SCG", "คุณอภิชาติ", "apichat@scg.com", "Sverker900", 5, 975000, "quotation", "quotation_sent", "", "", "", "", "", "", "ส่ง QT Sverker900 5 เครื่อง รวมอบรม 1 วัน", "Sent QT for 5x Sverker900 incl training", "ส่ง QT ให้ SCG แล้วครับ Sverker900 5 เครื่อง 975,000 รวมอบรมครับ", b))
b = make_batch_id("2026-03-10 09:30:00", "ธนกฤต", "SCG Sverker900 won")
_rows.append(row("2026-03-10 09:30:00", "ธนกฤต", "SCG", "คุณอภิชาติ", "084-567-8901", "Sverker900", 5, 975000, "closed_won", "closed_won", "deposit", "", "", "", "", "ปิดตามราคาเสนอ วางมัดจำ 50%", "SCG อนุมัติ PO วางมัดจำ 50% จัดส่ง 25 มี.ค.", "SCG approved, 50% deposit, delivery Mar 25", "SCG อนุมัติแล้วครับ! ได้เงินมัดจำ 50% จัดส่งพร้อมอบรม 25 มี.ค.", b))

# === Multi-activity visit: PTTEP 3 products [GET+GET+LVI] (วิภา) ===
raw_multi1 = "เข้าพบ PTTEP วันนี้ เจอคุณนภา\n- เสนอ MIT1025 ราคา 350,000\n- เสนอ DLRO10 จำนวน 3 เครื่อง ราคา 42,000\n- DET14C 2 เครื่อง ราคา 36,000"
b = make_batch_id("2026-02-15 10:00:00", "วิภา", raw_multi1)
_rows.append(row("2026-02-15 10:00:00", "วิภา", "PTTEP", "คุณนภา", "napha@pttep.com", "MIT1025", 1, 350000, "visit", "quotation_sent", "", "", "", "", "", "", "นำเสนอ MIT1025 ลูกค้าขอเวลาพิจารณา 2 สัปดาห์", "Visited PTTEP, quoted MIT1025 at 350K", raw_multi1, b, "1/3"))
_rows.append(row("2026-02-15 10:00:00", "วิภา", "PTTEP", "คุณนภา", "napha@pttep.com", "DLRO10", 3, 42000, "visit", "quotation_sent", "", "", "", "", "", "", "เสนอ DLRO10 3 เครื่อง สำหรับวัดความต้านทานต่ำ", "Visited PTTEP, quoted 3x DLRO10 at 42K", raw_multi1, b, "2/3"))
_rows.append(row("2026-02-15 10:00:00", "วิภา", "PTTEP", "คุณนภา", "napha@pttep.com", "DET14C", 2, 36000, "visit", "quotation_sent", "", "", "", "", "", "", "เสนอ DET14C 2 เครื่อง สำหรับวัดดิน", "Visited PTTEP, quoted 2x DET14C earth tester at 36K", raw_multi1, b, "3/3"))

# === Multi-activity visit: กฟภ. 2 products [GET+PP] (ปิยะ) ===
raw_multi2 = "เข้าพบ กฟภ. วันนี้ เจอคุณนิรันดร์\n1. เสนอ MIT525 3 เครื่อง ราคา 2,100,000\n2. เสนอ TM1700 จำนวน 2 เครื่อง ราคา 255,000"
b = make_batch_id("2026-03-02 10:15:00", "ปิยะ", raw_multi2)
_rows.append(row("2026-03-02 10:15:00", "ปิยะ", "กฟภ. (PEA)", "คุณนิรันดร์", "nirun@pea.co.th", "MIT525", 3, 2100000, "follow_up", "negotiation", "", "", "", "", "", "", "ติดตาม MIT525 ลูกค้าเทียบสเปกกับ Hioki", "Following up PEA deal for 3x MIT525", raw_multi2, b, "1/2"))
_rows.append(row("2026-03-02 10:15:00", "ปิยะ", "กฟภ. (PEA)", "คุณนิรันดร์", "nirun@pea.co.th", "TM1700", 2, 255000, "visit", "quotation_sent", "", "", "", "", "", "", "เสนอ TM1700 สำหรับทดสอบ circuit breaker timing", "Visited PEA, quoted 2x TM1700 CB timing analyzer", raw_multi2, b, "2/2"))

# === Individual GET deals ===
b = make_batch_id("2026-02-11 14:20:00", "ปิยะ", "Thai Oil MIT1025")
_rows.append(row("2026-02-11 14:20:00", "ปิยะ", "Thai Oil", "คุณกิตติพงษ์", "kittipong@thaioil.co.th", "MIT1025", 1, 890000, "visit", "lead", "", "", "", "", "", "", "เข้าพบ Thai Oil ศรีราชา เสนอ MIT1025", "Visited Thai Oil Sriracha, proposed MIT1025", "เข้าพบ Thai Oil ศรีราชาครับ คุณกิตติพงษ์สนใจ MIT1025 ราคา 890K", b))
b = make_batch_id("2026-02-20 09:00:00", "อนุชา", "IRPC DLRO200")
_rows.append(row("2026-02-20 09:00:00", "อนุชา", "IRPC", "คุณประยุทธ์", "prayuth@irpc.co.th", "DLRO200", 2, 1450000, "quotation", "quotation_sent", "", "", "", "", "", "", "ส่ง QT DLRO200 สำหรับวัดความต้านทานต่ำ", "Sent QT for 2x DLRO200 for refinery", "ส่ง QT DLRO200 2 เครื่อง ให้ IRPC แล้วครับ 1.45 ล้าน", b))
b = make_batch_id("2026-02-24 15:45:00", "สมชาย", "MEA S1-1568")
_rows.append(row("2026-02-24 15:45:00", "สมชาย", "การไฟฟ้านครหลวง (MEA)", "คุณสมศักดิ์", "somsak@mea.or.th", "S1-1568", 1, 2800000, "visit", "lead", "", "", "", "", "", "", "เข้าพบ กฟน. เสนอ S1-1568 ลูกค้ากำลังทำ TOR", "Visited MEA to present S1-1568", "เข้าพบ กฟน. ครับ คุณสมศักดิ์กำลังทำ TOR เสนอ S1-1568 ราคา 2.8 ล้าน", b))
b = make_batch_id("2026-03-07 08:30:00", "วิภา", "PTTEP MTO300")
_rows.append(row("2026-03-07 08:30:00", "วิภา", "PTTEP", "คุณธีรพงศ์", "theeraphong@pttep.com", "MTO300", 1, 1850000, "quotation", "quotation_sent", "", "", "", "", "", "", "ส่ง QT MTO300 สำหรับแท่นขุดเจาะ", "Sent QT for MTO300 to PTTEP for offshore", "ส่ง QT MTO300 ให้ PTTEP ค่ะ ใช้บนแท่นขุดเจาะ ราคา 1.85 ล้าน", b))
b = make_batch_id("2026-03-09 16:30:00", "อนุชา", "Bangchak MIT1025")
_rows.append(row("2026-03-09 16:30:00", "อนุชา", "บางจาก (Bangchak)", "คุณวรพจน์", "086-555-1234", "MIT1025", 2, 1780000, "call", "lead", "", "", "", "", "", "", "โทรเสนอ MIT1025 สำหรับ shutdown ปลายปี", "Called Bangchak to propose MIT1025 for shutdown", "โทรคุยบางจากครับ คุณวรพจน์สนใจ MIT1025 2 เครื่อง สำหรับ shutdown ปลายปี", b))

# === GET deals (with trainee) ===
b = make_batch_id("2026-02-13 11:00:00", "ธนกฤต", "Delta BM5200")
_rows.append(row("2026-02-13 11:00:00", "ธนกฤต", "Delta Electronics", "คุณพิชัย", "pichai@delta.co.th", "BM5200", 5, 375000, "visit", "lead", "", "", "", "ปิยะ", "yes", "", "เข้าพบ Delta พาน้องปิยะไปเรียนรู้ นำเสนอ BM5200", "Visited Delta with trainee, presented BM5200 insulation tester", "เข้าพบ Delta ครับ พาน้องปิยะไปด้วย คุณพิชัยสนใจ BM5200 5 เครื่อง งบ 375K", b))

# === PT deals ===
b = make_batch_id("2026-02-17 14:45:00", "นภัสสร", "TCC FRAX101")
_rows.append(row("2026-02-17 14:45:00", "นภัสสร", "ปูนซิเมนต์ไทย", "คุณมานพ", "manop@siamcement.com", "FRAX101", 2, 680000, "quotation", "quotation_sent", "", "", "", "", "", "", "ส่ง QT FRAX101 สำหรับวิเคราะห์หม้อแปลง", "Sent QT for 2x FRAX101 frequency response analyzer", "ส่ง QT FRAX101 2 เครื่อง ให้ปูนซิเมนต์ไทยค่ะ 680K", b))

# === LVI deals ===
b = make_batch_id("2026-03-03 09:30:00", "ปิยะ", "BG MFT-X1")
_rows.append(row("2026-03-03 09:30:00", "ปิยะ", "Bangkok Glass", "คุณสุชาติ", "085-222-3344", "MFT-X1", 10, 250000, "closed_won", "closed_won", "paid", "", "", "", "", "ปิดตามราคาเสนอ ชำระเต็มจำนวน", "ปิดดีล Bangkok Glass MFT-X1 10 เครื่อง ชำระเต็ม", "Closed Bangkok Glass 10x MFT-X1, full payment", "ปิดดีล Bangkok Glass ได้ครับ! MFT-X1 10 เครื่อง 250K จ่ายเต็ม", b))
b = make_batch_id("2026-03-08 13:15:00", "นภัสสร", "MEA IDAX300")
_rows.append(row("2026-03-08 13:15:00", "นภัสสร", "การไฟฟ้านครหลวง (MEA)", "คุณปรีชา", "preecha@mea.or.th", "IDAX300", 1, 520000, "visit", "negotiation", "", "", "", "", "", "", "เข้าพบ กฟน. สาธิต IDAX300 ระบบวิเคราะห์ฉนวน", "Visited MEA to demo IDAX300 insulation diagnostic", "เข้าพบ กฟน. ค่ะ Demo IDAX300 สำหรับวิเคราะห์ฉนวนหม้อแปลง ดีล 520K", b))

# === CI deals ===
b = make_batch_id("2026-02-16 10:30:00", "อนุชา", "IRPC Teleflex")
_rows.append(row("2026-02-16 10:30:00", "อนุชา", "IRPC", "คุณสมบูรณ์", "somboon@irpc.co.th", "Teleflex", 1, 1800000, "quotation", "quotation_sent", "", "", "", "", "", "", "ส่ง QT Teleflex สำหรับหาจุดผิดปกติสายเคเบิล", "Sent QT for Teleflex cable fault locator", "ส่ง QT Teleflex ให้ IRPC ครับ สำหรับหาจุด fault สาย 1.8 ล้าน", b))
b = make_batch_id("2026-02-21 15:00:00", "ธนกฤต", "SCG VLF")
_rows.append(row("2026-02-21 15:00:00", "ธนกฤต", "SCG", "คุณเกรียงศักดิ์", "083-456-7890", "VLF Sinus 45kV", 1, 2500000, "closed_won", "closed_won", "paid", "", "", "", "", "ปิดตามราคา ชำระเต็ม", "ปิดดีล VLF Sinus 45kV ให้ SCG ชำระแล้ว", "Closed VLF Sinus 45kV with SCG, full payment", "ปิดดีล SCG VLF Sinus 45kV ได้ครับ! 2.5 ล้าน ชำระแล้ว", b))

# === MRM deals ===
b = make_batch_id("2026-03-04 11:45:00", "วิภา", "Thai Oil EXP400")
_rows.append(row("2026-03-04 11:45:00", "วิภา", "Thai Oil", "คุณศิริพงษ์", "082-345-6789", "EXP400", 2, 850000, "follow_up", "negotiation", "", "", "", "", "", "", "ติดตาม EXP400 สำหรับทดสอบมอเตอร์โรงกลั่น", "Following up EXP400 motor tester with Thai Oil", "ติดตาม Thai Oil ค่ะ คุณศิริพงษ์สนใจ EXP400 2 เครื่อง ยอด 850K", b))

# === PDIX deal ===
b = make_batch_id("2026-03-10 14:00:00", "ปิยะ", "Bangchak PD")
_rows.append(row("2026-03-10 14:00:00", "ปิยะ", "บางจาก (Bangchak)", "คุณเทพฤทธิ์", "087-654-3210", "PD Measurement system", 1, 3200000, "call", "lead", "", "", "", "", "", "", "โทรเสนอ PD Measurement system สำหรับตรวจ partial discharge", "Called Bangchak to propose PD Measurement system", "โทรคุยบางจากครับ คุณเทพฤทธิ์สนใจ PD Measurement system 3.2 ล้าน", b))

# === PP deal (extra) ===
b = make_batch_id("2026-02-26 09:30:00", "นภัสสร", "PEA EGIL")
_rows.append(row("2026-02-26 09:30:00", "นภัสสร", "กฟภ. (PEA)", "คุณอำนาจ", "amnat@pea.co.th", "EGIL", 3, 425000, "quotation", "quotation_sent", "", "", "", "", "", "", "ส่ง QT EGIL 3 เครื่อง สำหรับทดสอบ circuit breaker", "Sent QT for 3x EGIL CB analyzer to PEA", "ส่ง QT EGIL 3 เครื่อง ให้ กฟภ. ค่ะ 425K", b))

# === CI deal (cable) ===
b = make_batch_id("2026-02-28 13:00:00", "สมชาย", "IRPC EST")
_rows.append(row("2026-02-28 13:00:00", "สมชาย", "IRPC", "คุณธนวัฒน์", "thanawat@irpc.co.th", "EST", 2, 750000, "visit", "negotiation", "", "", "", "", "", "", "เข้าพบ IRPC เสนอ EST สำหรับทดสอบ sheath สายเคเบิล", "Visited IRPC to propose EST cable sheath tester", "เข้าพบ IRPC ครับ เสนอ EST 2 เครื่อง 750K สำหรับทดสอบ sheath สายเคเบิล", b))

# === MRM deal (motor testing) ===
b = make_batch_id("2026-03-01 10:00:00", "ธนกฤต", "TCC Baker DX")
_rows.append(row("2026-03-01 10:00:00", "ธนกฤต", "ปูนซิเมนต์ไทย", "คุณวัชรพงษ์", "watcharapong@sccc.co.th", "Baker DX", 1, 1200000, "closed_lost", "closed_lost", "", "", "", "", "", "แพ้ราคาคู่แข่งถูกกว่า 30%", "ปูนซิเมนต์ไทยเลือกคู่แข่งถูกกว่า 30%", "Lost to competitor, 30% lower price", "เสียดายครับ ปูนซิเมนต์ไทยเลือกคู่แข่ง Baker DX ราคาถูกกว่า 30%", b))

# === LVI deal ===
b = make_batch_id("2026-03-11 10:00:00", "สมชาย", "PEA PAT350")
_rows.append(row("2026-03-11 10:00:00", "สมชาย", "กฟภ. (PEA)", "คุณอำนาจ", "amnat@pea.co.th", "PAT350", 5, 450000, "visit", "lead", "", "", "", "", "", "", "เข้าพบ กฟภ. เสนอ PAT350 5 เครื่อง สำหรับทดสอบเครื่องใช้ไฟฟ้า", "Visited PEA to present PAT350 x5 portable appliance tester", "เข้าพบ กฟภ. ครับ เสนอ PAT350 5 เครื่อง งบ 450K", b))

# === Bidding example [GET] ===
b = make_batch_id("2026-03-12 14:00:00", "อนุชา", "MEA bidding MIT525")
_rows.append(row("2026-03-12 14:00:00", "อนุชา", "การไฟฟ้านครหลวง (MEA)", "คุณสมศักดิ์", "procurement@mea.or.th", "MIT525", 5, 4500000, "quotation", "bidding", "", "", "2026-03-28", "", "", "", "ยื่นซองประมูล MIT525 5 เครื่อง เปิดซอง 28 มี.ค.", "Submitted bid for 5x MIT525 at MEA, opens Mar 28", "ยื่นซองประมูล กฟน. MIT525 5 เครื่อง 4.5 ล้าน เปิดซอง 28 มี.ค.", b))

# === Service/warranty example [PT] ===
b = make_batch_id("2026-03-13 09:00:00", "วิภา", "PTT MTO330 service")
_rows.append(row("2026-03-13 09:00:00", "วิภา", "PTT", "คุณวีระ", "081-234-5678", "MTO330", 1, "", "sent_to_service", "", "", "", "", "", "", "", "ส่ง MTO330 S/N 12345 เข้าซ่อม warranty", "Sent PTT MTO330 for warranty service", "ส่ง MTO330 ของ PTT เข้าซ่อม warranty ค่ะ", b))

# === Job expired example [GET] ===
b = make_batch_id("2026-03-13 15:00:00", "ปิยะ", "Thai Oil expired")
_rows.append(row("2026-03-13 15:00:00", "ปิยะ", "Thai Oil", "คุณกิตติพงษ์", "083-111-2222", "MIT1025", 1, 890000, "follow_up", "job_expired", "", "", "", "", "", "ลูกค้าตัดงบ ไม่มีงบปีนี้แล้ว", "Thai Oil ตัดงบ MIT1025 ไม่มีงบปีนี้", "Thai Oil cut budget, no allocation this year", "Thai Oil ตัดงบครับ คุณกิตติพงษ์แจ้งว่าไม่มีงบปีนี้แล้ว", b))

# === Equipment defect example [GET] ===
b = make_batch_id("2026-03-14 11:00:00", "ธนกฤต", "Delta defect")
_rows.append(row("2026-03-14 11:00:00", "ธนกฤต", "Delta Electronics", "คุณพิชัย", "pichai@delta.co.th", "BM5200", 1, 375000, "visit", "equipment_defect", "", "", "", "", "", "เครื่องเดโม่ค่าอ่านผิดปกติ ลูกค้าไม่รับ", "เครื่อง BM5200 เดโม่แล้วค่าอ่านผิดปกติ ลูกค้าไม่รับ", "Demo BM5200 defective, abnormal reading", "เข้าพบ Delta ครับ เครื่อง BM5200 เดโม่แล้วค่าอ่านผิดปกติ ลูกค้าไม่รับ", b))

# === Plan to visit example [GET] ===
b = make_batch_id("2026-03-14 16:00:00", "นภัสสร", "IRPC plan visit")
_rows.append(row("2026-03-14 16:00:00", "นภัสสร", "IRPC", "คุณประยุทธ์", "", "DLRO200", 2, 1450000, "follow_up", "plan_to_visit", "", "2026-03-20", "", "", "", "", "นัดเข้าพบ IRPC อาทิตย์หน้า ติดตาม DLRO200", "Planned visit to IRPC next week for DLRO200 follow-up", "นัดเข้าพบ IRPC วันพฤหัสหน้าค่ะ ติดตาม DLRO200", b))

SAMPLE_DATA = _rows

# ---------------------------------------------------------------------------
# Main execution
# ---------------------------------------------------------------------------

HEADERS = [
    "Timestamp", "Rep Name", "Customer", "Contact Person",
    "Contact Channel", "Product Name", "Product Segment", "Quantity",
    "Deal Value (THB)", "Activity Type", "Sales Stage", "Payment Status",
    "Planned Visit Date", "Bidding Date", "Accompanying Rep", "Training Flag",
    "Close Reason", "Follow-up Notes", "Summary (EN)", "Raw Message",
    "Batch ID", "Item #", "Source", "Manager Notes"
]

spreadsheet = client.open_by_key(GOOGLE_SHEETS_ID)
sheet = spreadsheet.sheet1
sheet_id = sheet.id

# ---------------------------------------------------------------------------
# Clean up extra tabs (Backup_*, Live Data) to reduce clutter
# ---------------------------------------------------------------------------

print("--- Cleaning up extra tabs ---")
SYSTEM_TABS = {"Sheet1", "Combined", "Legend", "Rep Registry"}
tabs_to_delete = []
for ws in spreadsheet.worksheets():
    if ws.title.startswith("Backup_") or ws.title == "Live Data" or ws.title == "Major Opportunity":
        tabs_to_delete.append(ws)
    elif ws.title not in SYSTEM_TABS and ws != sheet:
        # Delete old rep personal sheets (no longer used)
        tabs_to_delete.append(ws)

for ws in tabs_to_delete:
    try:
        spreadsheet.del_worksheet(ws)
        print(f"  Deleted: '{ws.title}'")
    except Exception as e:
        print(f"  Could not delete '{ws.title}': {e}")

if not tabs_to_delete:
    print("  No extra tabs to clean up.")

# ---------------------------------------------------------------------------
# Populate data
# ---------------------------------------------------------------------------

# Step 1: Clear existing data (keep header row)
all_data = sheet.get_all_values()
if len(all_data) > 1:
    sheet.batch_clear([f"A2:AZ{len(all_data) + 50}"])
    print(f"Cleared {len(all_data) - 1} existing rows.")

# Step 2: Write headers
sheet.update(range_name="A1:X1", values=[HEADERS])

# Step 3: Insert sample data
from gspread.utils import rowcol_to_a1
end_cell = rowcol_to_a1(len(SAMPLE_DATA) + 1, 24)  # +1 for header row, 24 cols (A-X)
sheet.update(range_name=f"A2:{end_cell}", values=SAMPLE_DATA, value_input_option="USER_ENTERED")
print(f"Inserted {len(SAMPLE_DATA)} sample rows.")

# Clear ALL existing conditional formatting rules first
try:
    resp = spreadsheet.fetch_sheet_metadata({"includeGridData": False})
    for s in resp.get("sheets", []):
        if s["properties"]["sheetId"] == sheet_id:
            existing_rules = s.get("conditionalFormats", [])
            if existing_rules:
                # Delete from last to first to keep indices stable
                del_requests = [
                    {"deleteConditionalFormatRule": {"sheetId": sheet_id, "index": i}}
                    for i in range(len(existing_rules) - 1, -1, -1)
                ]
                spreadsheet.batch_update({"requests": del_requests})
                print(f"Cleared {len(existing_rules)} old conditional format rules.")
            break
except Exception as e:
    print(f"Warning: could not clear old rules: {e}")

# ---------------------------------------------------------------------------
# Formatting
# ---------------------------------------------------------------------------

requests = []

# 1. Freeze header row + set bold
requests.append({
    "updateSheetProperties": {
        "properties": {"sheetId": sheet_id, "gridProperties": {"frozenRowCount": 1}},
        "fields": "gridProperties.frozenRowCount",
    }
})
requests.append({
    "repeatCell": {
        "range": {"sheetId": sheet_id, "startRowIndex": 0, "endRowIndex": 1},
        "cell": {
            "userEnteredFormat": {
                "textFormat": {"bold": True},
                "backgroundColor": {"red": 0.15, "green": 0.25, "blue": 0.45},
                "textFormat": {"bold": True, "foregroundColor": {"red": 1, "green": 1, "blue": 1}},
            }
        },
        "fields": "userEnteredFormat(backgroundColor,textFormat)",
    }
})

# 2. Header band colors (subtle alternating for visual grouping)
header_bands = [
    (0, 4, (0.85, 0.92, 1.0)),     # A-D: Timestamp, Rep, Customer, Contact
    (4, 5, (0.90, 0.95, 0.90)),     # E: Contact Channel
    (5, 9, (0.95, 0.90, 0.85)),     # F-I: Product Name, Product Segment, Qty, Value
    (9, 12, (1.0, 0.95, 0.85)),     # J-L: Activity, Stage, Payment
    (12, 14, (0.90, 0.90, 1.0)),    # M-N: Visit Date, Bidding Date
    (14, 16, (0.85, 0.95, 0.90)),   # O-P: Accomp, Training
    (16, 17, (1.0, 0.90, 0.90)),    # Q: Close Reason
    (17, 20, (0.90, 0.90, 0.90)),   # R-T: Notes, Summary, Raw
    (20, 24, (0.85, 0.85, 0.95)),   # U-X: Batch ID, Item, Source, Manager Notes
]

# Apply subtle column background for data rows
for start_col, end_col, (r, g, b_) in header_bands:
    requests.append({
        "repeatCell": {
            "range": {"sheetId": sheet_id, "startRowIndex": 1, "endRowIndex": 200,
                       "startColumnIndex": start_col, "endColumnIndex": end_col},
            "cell": {"userEnteredFormat": {"backgroundColor": {"red": r, "green": g, "blue": b_}}},
            "fields": "userEnteredFormat.backgroundColor",
        }
    })

# 3. Column widths for readability
col_widths = {
    0: 170,   # Timestamp
    1: 80,    # Rep Name
    2: 140,   # Customer
    3: 110,   # Contact Person
    4: 160,   # Contact Channel
    5: 160,   # Product Name
    6: 100,   # Product Segment
    7: 65,    # Quantity
    8: 130,   # Deal Value
    9: 110,   # Activity Type
    10: 120,  # Sales Stage
    11: 100,  # Payment Status
    12: 130,  # Planned Visit Date
    13: 110,  # Bidding Date
    14: 110,  # Accompanying Rep
    15: 80,   # Training Flag
    16: 200,  # Close Reason
    17: 250,  # Follow-up Notes
    18: 250,  # Summary (EN)
    19: 80,   # Raw Message (narrow — long text)
    20: 100,  # Batch ID
    21: 60,   # Item #
    22: 60,   # Source
    23: 200,  # Manager Notes
}
for col_idx, width in col_widths.items():
    requests.append({
        "updateDimensionProperties": {
            "range": {"sheetId": sheet_id, "dimension": "COLUMNS", "startIndex": col_idx, "endIndex": col_idx + 1},
            "properties": {"pixelSize": width},
            "fields": "pixelSize",
        }
    })

# 4. Number format for Deal Value column (I = index 8)
requests.append({
    "repeatCell": {
        "range": {"sheetId": sheet_id, "startRowIndex": 1, "endRowIndex": 200, "startColumnIndex": 8, "endColumnIndex": 9},
        "cell": {
            "userEnteredFormat": {
                "numberFormat": {"type": "NUMBER", "pattern": "#,##0"}
            }
        },
        "fields": "userEnteredFormat.numberFormat",
    }
})

# 5. Clear old validations on Contact Channel (E=4), Product Name (F=5), and Deal Value (I=8)
for col_idx in [4, 5, 8]:
    requests.append({
        "setDataValidation": {
            "range": {"sheetId": sheet_id, "startRowIndex": 1, "endRowIndex": 200, "startColumnIndex": col_idx, "endColumnIndex": col_idx + 1},
        }
    })

# 6. Data validation: Activity Type (column J = index 9)
activity_types = ["visit", "call", "quotation", "follow_up", "closed_won", "closed_lost", "sent_to_service", "other"]
requests.append({
    "setDataValidation": {
        "range": {"sheetId": sheet_id, "startRowIndex": 1, "endRowIndex": 200, "startColumnIndex": 9, "endColumnIndex": 10},
        "rule": {
            "condition": {"type": "ONE_OF_LIST", "values": [{"userEnteredValue": a} for a in activity_types]},
            "showCustomUi": True,
            "strict": False,
        },
    }
})

# 7. Data validation: Sales Stage (column K = index 10)
stages = ["lead", "plan_to_visit", "visited", "negotiation", "quotation_sent", "bidding", "closed_won", "closed_lost", "job_expired", "equipment_defect"]
requests.append({
    "setDataValidation": {
        "range": {"sheetId": sheet_id, "startRowIndex": 1, "endRowIndex": 200, "startColumnIndex": 10, "endColumnIndex": 11},
        "rule": {
            "condition": {"type": "ONE_OF_LIST", "values": [{"userEnteredValue": s} for s in stages]},
            "showCustomUi": True,
            "strict": False,
        },
    }
})

# 8. Data validation: Payment Status (column L = index 11)
payment_statuses = ["pending", "deposit", "paid", "overdue", ""]
requests.append({
    "setDataValidation": {
        "range": {"sheetId": sheet_id, "startRowIndex": 1, "endRowIndex": 200, "startColumnIndex": 11, "endColumnIndex": 12},
        "rule": {
            "condition": {"type": "ONE_OF_LIST", "values": [{"userEnteredValue": p} for p in payment_statuses]},
            "showCustomUi": True,
            "strict": False,
        },
    }
})

# 9. Data validation: Training Flag (column P = index 15)
requests.append({
    "setDataValidation": {
        "range": {"sheetId": sheet_id, "startRowIndex": 1, "endRowIndex": 200, "startColumnIndex": 15, "endColumnIndex": 16},
        "rule": {
            "condition": {"type": "ONE_OF_LIST", "values": [{"userEnteredValue": "yes"}, {"userEnteredValue": ""}]},
            "showCustomUi": True,
            "strict": False,
        },
    }
})

# 10. Conditional formatting: Activity Type (column J = index 9) — cell-only coloring
activity_colors = {
    "visit":           {"red": 0.85, "green": 0.93, "blue": 1.0},
    "call":            {"red": 0.90, "green": 0.96, "blue": 0.90},
    "quotation":       {"red": 1.0,  "green": 0.95, "blue": 0.80},
    "follow_up":       {"red": 0.95, "green": 0.90, "blue": 1.0},
    "closed_won":      {"red": 0.80, "green": 0.95, "blue": 0.80},
    "closed_lost":     {"red": 1.0,  "green": 0.85, "blue": 0.85},
    "sent_to_service": {"red": 0.90, "green": 0.90, "blue": 0.90},
    "other":           {"red": 0.95, "green": 0.95, "blue": 0.95},
}
for value, color in activity_colors.items():
    requests.append({
        "addConditionalFormatRule": {
            "rule": {
                "ranges": [{"sheetId": sheet_id, "startRowIndex": 1, "endRowIndex": 200, "startColumnIndex": 9, "endColumnIndex": 10}],
                "booleanRule": {
                    "condition": {"type": "TEXT_EQ", "values": [{"userEnteredValue": value}]},
                    "format": {"backgroundColor": color}
                },
            },
            "index": 0,
        }
    })

# 11. Conditional formatting: Sales Stage (column K = index 10) — cell-only coloring
stage_colors = {
    "lead":             {"red": 0.88, "green": 0.88, "blue": 0.88},
    "plan_to_visit":    {"red": 0.84, "green": 0.91, "blue": 1.0},
    "visited":          {"red": 0.68, "green": 0.78, "blue": 1.0},
    "negotiation":      {"red": 1.0,  "green": 0.88, "blue": 0.63},
    "quotation_sent":   {"red": 0.69, "green": 0.83, "blue": 1.0},
    "bidding":          {"red": 0.86, "green": 0.78, "blue": 1.0},
    "closed_won":       {"red": 0.72, "green": 0.94, "blue": 0.72},
    "closed_lost":      {"red": 1.0,  "green": 0.80, "blue": 0.80},
    "job_expired":      {"red": 0.85, "green": 0.85, "blue": 0.85},
    "equipment_defect": {"red": 1.0,  "green": 0.75, "blue": 0.50},
}
for value, color in stage_colors.items():
    requests.append({
        "addConditionalFormatRule": {
            "rule": {
                "ranges": [{"sheetId": sheet_id, "startRowIndex": 1, "endRowIndex": 200, "startColumnIndex": 10, "endColumnIndex": 11}],
                "booleanRule": {
                    "condition": {"type": "TEXT_EQ", "values": [{"userEnteredValue": value}]},
                    "format": {"backgroundColor": color}
                },
            },
            "index": 0,
        }
    })

# 12. Conditional formatting: Payment Status (column L = index 11)
payment_colors = {
    "pending": {"red": 1.0,  "green": 0.95, "blue": 0.80},
    "deposit": {"red": 0.85, "green": 0.93, "blue": 1.0},
    "paid":    {"red": 0.80, "green": 0.95, "blue": 0.80},
    "overdue": {"red": 1.0,  "green": 0.80, "blue": 0.80},
}
for value, color in payment_colors.items():
    requests.append({
        "addConditionalFormatRule": {
            "rule": {
                "ranges": [{"sheetId": sheet_id, "startRowIndex": 1, "endRowIndex": 200, "startColumnIndex": 11, "endColumnIndex": 12}],
                "booleanRule": {
                    "condition": {"type": "TEXT_EQ", "values": [{"userEnteredValue": value}]},
                    "format": {"backgroundColor": color}
                },
            },
            "index": 0,
        }
    })

# 13. Data validation: Product Segment (column G = index 6)
segment_codes = ["CI", "GET", "LVI", "MRM", "PDIX", "PP", "PT", ""]
requests.append({
    "setDataValidation": {
        "range": {"sheetId": sheet_id, "startRowIndex": 1, "endRowIndex": 200, "startColumnIndex": 6, "endColumnIndex": 7},
        "rule": {
            "condition": {"type": "ONE_OF_LIST", "values": [{"userEnteredValue": s} for s in segment_codes]},
            "showCustomUi": True,
            "strict": False,
        },
    }
})

# Execute all formatting in one batch
spreadsheet.batch_update({"requests": requests})
print("Formatting applied: headers, freeze, dropdowns, conditional colors, number format.")

# ---------------------------------------------------------------------------
# Legend sheet: add Product Segment reference
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# Rewrite Legend sheet from scratch
# ---------------------------------------------------------------------------

try:
    legend = spreadsheet.worksheet("Legend")
    spreadsheet.del_worksheet(legend)
except Exception:
    pass
legend = spreadsheet.add_worksheet(title="Legend", rows=100, cols=4)
legend_id = legend.id
print("Recreated Legend sheet.")

legend_rows = [
    # --- Section 1: Column Guide ---
    ["Column Guide", "", "", ""],
    ["Column", "Letter", "Type", "Description"],
    ["Timestamp", "A", "datetime", "YYYY-MM-DD HH:MM:SS (Bangkok time)"],
    ["Rep Name", "B", "text", "LINE display name"],
    ["Customer", "C", "text", "Company/organization name"],
    ["Contact Person", "D", "text", "Contact name"],
    ["Contact Channel", "E", "text", "Phone or email (mandatory)"],
    ["Product Name", "F", "text", "Product model (e.g. MTO330, 87V, CRC 2-26)"],
    ["Product Segment", "G", "enum", "Auto-matched from product name"],
    ["Quantity", "H", "number", "Units"],
    ["Deal Value (THB)", "I", "number", "Value in Thai Baht"],
    ["Activity Type", "J", "enum", "See Activity Types below"],
    ["Sales Stage", "K", "enum", "See Sales Stages below"],
    ["Payment Status", "L", "enum", "pending / deposit / paid"],
    ["Planned Visit Date", "M", "date", "YYYY-MM-DD"],
    ["Bidding Date", "N", "date", "Government bid deadline"],
    ["Accompanying Rep", "O", "text", "2nd rep if present"],
    ["Training Flag", "P", "yes/blank", "Trainee accompanying"],
    ["Close Reason", "Q", "text", "Why won/lost/expired/defect"],
    ["Follow-up Notes", "R", "text", "Internal notes"],
    ["Summary (EN)", "S", "text", "AI-generated English summary"],
    ["Raw Message", "T", "text", "Original LINE message"],
    ["Batch ID", "U", "MSG-XXXXXXXX", "Groups multi-activity messages"],
    ["Item #", "V", "1/3, 2/3", "Item within a batch"],
    ["Source", "W", "live/sample", "Bot entry vs generated data"],
    ["Manager Notes", "X", "text", "Manual entry only"],
    [""],
    # --- Section 2: Activity Types ---
    ["Activity Types", "", "", ""],
    ["Value", "Thai", "", ""],
    ["visit", "เข้าพบ", "", ""],
    ["call", "โทร", "", ""],
    ["quotation", "เสนอราคา / ส่ง QT", "", ""],
    ["follow_up", "ติดตาม", "", ""],
    ["closed_won", "ปิดได้", "", ""],
    ["closed_lost", "เสียงาน", "", ""],
    ["sent_to_service", "ส่งซ่อม", "", ""],
    ["other", "อื่นๆ", "", ""],
    [""],
    # --- Section 3: Sales Stages ---
    ["Sales Stages", "", "", ""],
    ["Value", "Thai", "ความหมาย", ""],
    ["lead", "ลูกค้าสนใจ", "Initial interest", ""],
    ["plan_to_visit", "นัดเยี่ยม", "Visit scheduled", ""],
    ["visited", "เยี่ยมแล้ว", "Visit completed", ""],
    ["negotiation", "เจรจา", "Negotiating terms", ""],
    ["quotation_sent", "ส่ง QT แล้ว", "Quotation submitted", ""],
    ["bidding", "ประมูล", "Government bid", ""],
    ["closed_won", "ปิดได้", "Deal won", ""],
    ["closed_lost", "เสียงาน", "Deal lost", ""],
    ["job_expired", "งบหมด", "Budget cut / expired", ""],
    ["equipment_defect", "สินค้าเสีย", "Product defect", ""],
    [""],
    # --- Section 4: Product Segments ---
    ["Product Segments (auto-matched)", "", "", ""],
    ["Code", "Full Name", "Example Products", ""],
    ["CI", "Cable Infrastructure", "VLF, Teleflex, TDR, AC/DC Hipot, EST, EZ-Thump", ""],
    ["GET", "General Electrical Testing", "MIT515, MIT525, MIT1025, DLRO10, DLRO200, S1-1568", ""],
    ["LVI", "Low Voltage Installation", "DET14C, DET24C, MIT400, MIT420, PAT350, MFT-X1", ""],
    ["MRM", "Motor Reliability Management", "Baker DX, Baker PPX30, ADX, EXP400", ""],
    ["PDIX", "Partial Discharge", "PD Measurement system", ""],
    ["PP", "Protection & Power", "Sverker750, Sverker900, EGIL, SMRT, TM1700, ODEN", ""],
    ["PT", "Power Transformer", "MTO330, MTO300, MTO250, TRAX280, TTR25, FRAX101", ""],
    [""],
    ["ระบบจะจับคู่ Product Segment ให้อัตโนมัติจากชื่อสินค้า (431 รายการ)", "", "", ""],
    ["สินค้าที่ไม่อยู่ในฐานข้อมูลจะไม่มี segment", "", "", ""],
    [""],
    # --- Section 5: Mandatory Fields ---
    ["Mandatory Fields (6 ข้อมูลสำคัญ)", "", "", ""],
    ["Field", "Thai", "หมายเหตุ", ""],
    ["Customer", "ชื่อลูกค้า", "", ""],
    ["Contact Channel", "เบอร์โทร/อีเมล", "จำเป็น! ถ้าไม่มีจะไม่บันทึก", ""],
    ["Product Name", "ชื่อสินค้า", "", ""],
    ["Deal Value", "มูลค่าดีล", "", ""],
    ["Activity Type", "ประเภทกิจกรรม", "", ""],
    ["Sales Stage", "สถานะดีล", "", ""],
    [""],
    # --- Section 6: Payment Status ---
    ["Payment Status", "", "", ""],
    ["Value", "Thai", "", ""],
    ["pending", "รอชำระ", "", ""],
    ["deposit", "วางมัดจำ", "", ""],
    ["paid", "ชำระแล้ว", "", ""],
]

legend.update(range_name="A1:D{}".format(len(legend_rows)), values=legend_rows)

# Formatting: section headers bold + blue bg, sub-headers bold
section_header_rows = []  # 0-indexed row numbers for section titles
sub_header_rows = []      # 0-indexed row numbers for table headers
for i, row_data in enumerate(legend_rows):
    if row_data[0] and not row_data[1] and row_data[0] not in ("", ) and i > 0 and legend_rows[i-1] == [""]:
        section_header_rows.append(i)
    # First row is also a section header
    if i == 0:
        section_header_rows.append(i)

# Section headers: rows where next row has column headers
section_starts = [0, 27, 37, 52, 66, 76]  # Column Guide, Activity Types, Sales Stages, Product Segments, Mandatory, Payment
sub_headers = [1, 28, 38, 53, 67, 77]     # The header rows within each section

fmt_requests = []

# Freeze first row
fmt_requests.append({
    "updateSheetProperties": {
        "properties": {"sheetId": legend_id, "gridProperties": {"frozenRowCount": 0}},
        "fields": "gridProperties.frozenRowCount",
    }
})

# Section title formatting (blue bg, white bold, larger font)
for r in section_starts:
    fmt_requests.append({
        "repeatCell": {
            "range": {"sheetId": legend_id, "startRowIndex": r, "endRowIndex": r + 1, "startColumnIndex": 0, "endColumnIndex": 4},
            "cell": {"userEnteredFormat": {
                "backgroundColor": {"red": 0.15, "green": 0.3, "blue": 0.55},
                "textFormat": {"bold": True, "fontSize": 12, "foregroundColor": {"red": 1, "green": 1, "blue": 1}},
            }},
            "fields": "userEnteredFormat(backgroundColor,textFormat)",
        }
    })

# Sub-header formatting (light gray bg, bold)
for r in sub_headers:
    fmt_requests.append({
        "repeatCell": {
            "range": {"sheetId": legend_id, "startRowIndex": r, "endRowIndex": r + 1, "startColumnIndex": 0, "endColumnIndex": 4},
            "cell": {"userEnteredFormat": {
                "backgroundColor": {"red": 0.90, "green": 0.90, "blue": 0.90},
                "textFormat": {"bold": True},
            }},
            "fields": "userEnteredFormat(backgroundColor,textFormat)",
        }
    })

# Column widths
for col_idx, width in [(0, 180), (1, 160), (2, 350), (3, 150)]:
    fmt_requests.append({
        "updateDimensionProperties": {
            "range": {"sheetId": legend_id, "dimension": "COLUMNS", "startIndex": col_idx, "endIndex": col_idx + 1},
            "properties": {"pixelSize": width},
            "fields": "pixelSize",
        }
    })

spreadsheet.batch_update({"requests": fmt_requests})
print("Legend sheet written with all reference tables.")

print(f"\nDone! Open your spreadsheet to verify:")
print(f"https://docs.google.com/spreadsheets/d/{GOOGLE_SHEETS_ID}/edit")
