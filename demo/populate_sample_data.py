"""
Populate Google Sheets with sample data for the ATE Sales Demo.

Usage:
  python populate_sample_data.py
"""

import json
import os
import sys
import hashlib
from datetime import datetime, timezone, timedelta
import gspread
from google.oauth2.service_account import Credentials

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

GOOGLE_SHEETS_ID = os.environ.get("GOOGLE_SHEETS_ID", "1N8urzMgcVBjJ3iv5ACPtMP-pG70rtlaHQ6v3iTJ48wY")
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
    return "MSG-" + hashlib.md5(raw.encode()).hexdigest()[:5].upper()


# ---------------------------------------------------------------------------
# Row builder
# ---------------------------------------------------------------------------

def row(ts, rep, customer, contact, channel, brand, product, qty, value,
        activity, stage, payment="", visit_date="", bid_date="", accomp="",
        training="", close_reason="", notes="", summary="", raw="",
        batch_id="", item_label=""):
    return [ts, rep, customer, contact, channel, brand, product, qty, value,
            activity, stage, payment, visit_date, bid_date, accomp, training,
            close_reason, notes, summary, raw, batch_id, item_label, "sample", ""]

# ---------------------------------------------------------------------------
# Build sample data with Batch IDs
# ---------------------------------------------------------------------------

_rows = []

# === Deal Progression Story 1: PTT + Megger MTO330 (สมชาย) ===
b = make_batch_id("2026-02-10 09:15:00", "สมชาย", "PTT MTO330 visit")
_rows.append(row("2026-02-10 09:15:00", "สมชาย", "PTT", "คุณวีระ", "081-234-5678", "Megger", "MTO330", 2, 3200000, "visit", "lead", "", "", "", "", "", "", "เข้าพบลูกค้า นำเสนอ MTO330 ลูกค้าสนใจขอใบเสนอราคา", "Visited PTT HQ to present Megger MTO330", "เข้าพบ PTT วันนี้ครับ คุณวีระสนใจ MTO330 จำนวน 2 เครื่อง งบประมาณราว 3.2 ล้าน", b))
b = make_batch_id("2026-02-14 10:30:00", "สมชาย", "PTT MTO330 qt")
_rows.append(row("2026-02-14 10:30:00", "สมชาย", "PTT", "คุณวีระ", "weera.p@ptt.co.th", "Megger", "MTO330", 2, 3200000, "quotation", "quotation_sent", "", "", "", "", "", "", "ส่งใบเสนอราคา MTO330 x2 ให้ PTT รอพิจารณา 2 สัปดาห์", "Sent quotation for 2x MTO330 to PTT", "ส่ง QT ให้คุณวีระ PTT เรียบร้อยครับ MTO330 2 เครื่อง 3.2 ล้าน", b))
b = make_batch_id("2026-02-27 14:00:00", "สมชาย", "PTT MTO330 nego")
_rows.append(row("2026-02-27 14:00:00", "สมชาย", "PTT", "คุณวีระ", "081-234-5678", "Megger", "MTO330", 2, 3050000, "follow_up", "negotiation", "", "", "", "", "", "", "PTT ต่อรองราคาลงมาที่ 3.05 ล้าน ขอลด 5%", "PTT negotiating price down to 3.05M THB", "คุณวีระ PTT โทรมาต่อรองราคาครับ ขอลด 5% เหลือ 3.05 ล้าน", b))
b = make_batch_id("2026-03-06 11:00:00", "สมชาย", "PTT MTO330 won")
_rows.append(row("2026-03-06 11:00:00", "สมชาย", "PTT", "คุณวีระ", "weera.p@ptt.co.th", "Megger", "MTO330", 2, 3050000, "closed_won", "closed_won", "pending", "", "", "", "", "ลด 5% จากราคาเสนอ ได้ PO เลขที่ PTT-2026-0312", "ปิดดีล PTT สำเร็จ 3.05 ล้าน PO เลขที่ PTT-2026-0312", "Closed deal with PTT at 3.05M THB, 5% discount", "ปิดดีล PTT ได้แล้วครับ! 3.05 ล้าน ได้ PO แล้ว รอเงินงวดแรกครับ", b))

# === Deal Progression Story 2: EGAT + Fluke Ti480 PRO (วิภา) ===
b = make_batch_id("2026-02-12 09:45:00", "วิภา", "EGAT Ti480")
_rows.append(row("2026-02-12 09:45:00", "วิภา", "EGAT", "คุณสุรศักดิ์", "089-876-5432", "Fluke", "Ti480 PRO", 3, 1350000, "call", "lead", "", "", "", "", "", "", "โทรหา EGAT เสนอ Ti480 PRO สำหรับ predictive maintenance", "Called EGAT to propose Fluke Ti480 PRO", "โทรคุย EGAT คุณสุรศักดิ์ เสนอ Fluke Ti480 PRO 3 ตัว นัดเข้าพบอาทิตย์หน้าค่ะ", b))
b = make_batch_id("2026-02-19 13:30:00", "วิภา", "EGAT Ti480 visit")
_rows.append(row("2026-02-19 13:30:00", "วิภา", "EGAT", "คุณสุรศักดิ์", "surasak@egat.co.th", "Fluke", "Ti480 PRO", 3, 1350000, "visit", "negotiation", "", "", "", "", "", "", "เข้าพบ EGAT สาธิต Ti480 PRO ลูกค้าขอเทียบกับ FLIR", "Visited EGAT, demo Ti480 PRO, comparing with FLIR", "เข้าพบ EGAT วันนี้ค่ะ Demo Ti480 PRO ลูกค้าชอบ แต่ขอเทียบกับ FLIR ค่ะ", b))
b = make_batch_id("2026-03-05 16:00:00", "วิภา", "EGAT Ti480 lost")
_rows.append(row("2026-03-05 16:00:00", "วิภา", "EGAT", "คุณสุรศักดิ์", "089-876-5432", "Fluke", "Ti480 PRO", 3, 1350000, "closed_lost", "closed_lost", "", "", "", "", "", "แพ้ราคา FLIR ถูกกว่า 15% พร้อม service contract", "EGAT เลือก FLIR ราคาถูกกว่า 15% พร้อม service contract", "Lost to FLIR, 15% cheaper with service contract", "เสียดายค่ะ EGAT เลือก FLIR ราคาถูกกว่า 15% แถม service contract ด้วย", b))

# === Deal Progression Story 3: SCG + Salisbury Arc Flash Kit (ธนกฤต) ===
b = make_batch_id("2026-02-18 10:00:00", "ธนกฤต", "SCG arc flash")
_rows.append(row("2026-02-18 10:00:00", "ธนกฤต", "SCG", "คุณอภิชาติ", "apichat@scg.com", "Salisbury", "Arc Flash Kit", 15, 975000, "visit", "lead", "", "", "", "", "", "", "เข้าพบ SCG บ้านโป่ง นำเสนอ Arc Flash Kit", "Visited SCG Ban Pong, presented Arc Flash Kit", "เข้าพบ SCG บ้านโป่งครับ คุณอภิชาติต้องการ Arc Flash Kit 15 ชุด งบ Q1", b))
b = make_batch_id("2026-02-25 11:30:00", "ธนกฤต", "SCG arc flash qt")
_rows.append(row("2026-02-25 11:30:00", "ธนกฤต", "SCG", "คุณอภิชาติ", "apichat@scg.com", "Salisbury", "Arc Flash Kit", 15, 975000, "quotation", "quotation_sent", "", "", "", "", "", "", "ส่ง QT Arc Flash Kit 15 ชุด รวมอบรม 1 วัน", "Sent QT for 15 Arc Flash Kits incl training", "ส่ง QT ให้ SCG แล้วครับ Arc Flash Kit 15 ชุด 975,000 รวมอบรมครับ", b))
b = make_batch_id("2026-03-10 09:30:00", "ธนกฤต", "SCG arc flash won")
_rows.append(row("2026-03-10 09:30:00", "ธนกฤต", "SCG", "คุณอภิชาติ", "084-567-8901", "Salisbury", "Arc Flash Kit", 15, 975000, "closed_won", "closed_won", "deposit", "", "", "", "", "ปิดตามราคาเสนอ วางมัดจำ 50%", "SCG อนุมัติ PO วางมัดจำ 50% จัดส่ง 25 มี.ค.", "SCG approved, 50% deposit, delivery Mar 25", "SCG อนุมัติแล้วครับ! ได้เงินมัดจำ 50% จัดส่งพร้อมอบรม 25 มี.ค.", b))

# === Multi-activity visit: PTTEP 3 products (วิภา) ===
raw_multi1 = "เข้าพบ PTTEP วันนี้ เจอคุณนภา\n- เสนอ Megger MIT1025 ราคา 350,000\n- เสนอ Fluke 87V จำนวน 3 ตัว ราคา 42,000\n- CRC 2-26 สเปรย์ 24 กระป๋อง ราคา 12,000"
b = make_batch_id("2026-02-15 10:00:00", "วิภา", raw_multi1)
_rows.append(row("2026-02-15 10:00:00", "วิภา", "PTTEP", "คุณนภา", "napha@pttep.com", "Megger", "MIT1025", 1, 350000, "visit", "quotation_sent", "", "", "", "", "", "", "นำเสนอ MIT1025 ลูกค้าขอเวลาพิจารณา 2 สัปดาห์", "Visited PTTEP, quoted Megger MIT1025 at 350K", raw_multi1, b, "1/3"))
_rows.append(row("2026-02-15 10:00:00", "วิภา", "PTTEP", "คุณนภา", "napha@pttep.com", "Fluke", "87V", 3, 42000, "visit", "quotation_sent", "", "", "", "", "", "", "เสนอ Fluke 87V 3 ตัว", "Visited PTTEP, quoted 3x Fluke 87V at 42K", raw_multi1, b, "2/3"))
_rows.append(row("2026-02-15 10:00:00", "วิภา", "PTTEP", "คุณนภา", "napha@pttep.com", "CRC", "2-26 Spray", 24, 12000, "visit", "quotation_sent", "", "", "", "", "", "", "CRC 2-26 สเปรย์ 24 กระป๋อง", "Visited PTTEP, quoted CRC 2-26 spray x24 at 12K", raw_multi1, b, "3/3"))

# === Multi-activity visit: กฟภ. 2 products (ปิยะ) ===
raw_multi2 = "เข้าพบ กฟภ. วันนี้ เจอคุณนิรันดร์\n1. เสนอ Megger MIT525 3 เครื่อง ราคา 2,100,000\n2. เสนอ Salisbury ถุงมือ Class 2 จำนวน 30 คู่ ราคา 255,000"
b = make_batch_id("2026-03-02 10:15:00", "ปิยะ", raw_multi2)
_rows.append(row("2026-03-02 10:15:00", "ปิยะ", "กฟภ. (PEA)", "คุณนิรันดร์", "nirun@pea.co.th", "Megger", "MIT525", 3, 2100000, "follow_up", "negotiation", "", "", "", "", "", "", "ติดตาม MIT525 ลูกค้าเทียบสเปกกับ Hioki", "Following up PEA deal for 3x MIT525", raw_multi2, b, "1/2"))
_rows.append(row("2026-03-02 10:15:00", "ปิยะ", "กฟภ. (PEA)", "คุณนิรันดร์", "nirun@pea.co.th", "Salisbury", "Insulating Gloves Class 2", 30, 255000, "visit", "quotation_sent", "", "", "", "", "", "", "เสนอถุงมือฉนวน 30 คู่ ให้ทีมช่างภาคสนาม", "Visited PEA, quoted 30 pairs Salisbury Gloves", raw_multi2, b, "2/2"))

# === Individual Megger deals ===
b = make_batch_id("2026-02-11 14:20:00", "ปิยะ", "Thai Oil MIT1025")
_rows.append(row("2026-02-11 14:20:00", "ปิยะ", "Thai Oil", "คุณกิตติพงษ์", "kittipong@thaioil.co.th", "Megger", "MIT1025", 1, 890000, "visit", "lead", "", "", "", "", "", "", "เข้าพบ Thai Oil ศรีราชา เสนอ MIT1025", "Visited Thai Oil Sriracha, proposed MIT1025", "เข้าพบ Thai Oil ศรีราชาครับ คุณกิตติพงษ์สนใจ MIT1025 ราคา 890K", b))
b = make_batch_id("2026-02-20 09:00:00", "อนุชา", "IRPC DLRO200")
_rows.append(row("2026-02-20 09:00:00", "อนุชา", "IRPC", "คุณประยุทธ์", "prayuth@irpc.co.th", "Megger", "DLRO200", 2, 1450000, "quotation", "quotation_sent", "", "", "", "", "", "", "ส่ง QT DLRO200 สำหรับวัดความต้านทานต่ำ", "Sent QT for 2x DLRO200 for refinery", "ส่ง QT DLRO200 2 เครื่อง ให้ IRPC แล้วครับ 1.45 ล้าน", b))
b = make_batch_id("2026-02-24 15:45:00", "สมชาย", "MEA S1-1568")
_rows.append(row("2026-02-24 15:45:00", "สมชาย", "การไฟฟ้านครหลวง (MEA)", "คุณสมศักดิ์", "somsak@mea.or.th", "Megger", "S1-1568", 1, 2800000, "visit", "lead", "", "", "", "", "", "", "เข้าพบ กฟน. เสนอ S1-1568 ลูกค้ากำลังทำ TOR", "Visited MEA to present Megger S1-1568", "เข้าพบ กฟน. ครับ คุณสมศักดิ์กำลังทำ TOR เสนอ S1-1568 ราคา 2.8 ล้าน", b))
b = make_batch_id("2026-03-07 08:30:00", "วิภา", "PTTEP MTO300")
_rows.append(row("2026-03-07 08:30:00", "วิภา", "PTTEP", "คุณธีรพงศ์", "theeraphong@pttep.com", "Megger", "MTO300", 1, 1850000, "quotation", "quotation_sent", "", "", "", "", "", "", "ส่ง QT MTO300 สำหรับแท่นขุดเจาะ", "Sent QT for MTO300 to PTTEP for offshore", "ส่ง QT MTO300 ให้ PTTEP ค่ะ ใช้บนแท่นขุดเจาะ ราคา 1.85 ล้าน", b))
b = make_batch_id("2026-03-09 16:30:00", "อนุชา", "Bangchak MIT1025")
_rows.append(row("2026-03-09 16:30:00", "อนุชา", "บางจาก (Bangchak)", "คุณวรพจน์", "086-555-1234", "Megger", "MIT1025", 2, 1780000, "call", "lead", "", "", "", "", "", "", "โทรเสนอ MIT1025 สำหรับ shutdown ปลายปี", "Called Bangchak to propose MIT1025 for shutdown", "โทรคุยบางจากครับ คุณวรพจน์สนใจ MIT1025 2 เครื่อง สำหรับ shutdown ปลายปี", b))

# === Fluke deals ===
b = make_batch_id("2026-02-13 11:00:00", "ธนกฤต", "Delta 1587FC")
_rows.append(row("2026-02-13 11:00:00", "ธนกฤต", "Delta Electronics", "คุณพิชัย", "pichai@delta.co.th", "Fluke", "1587 FC", 5, 375000, "visit", "lead", "", "", "", "ปิยะ", "yes", "", "เข้าพบ Delta พาน้องปิยะไปเรียนรู้ นำเสนอ 1587 FC", "Visited Delta with trainee, presented 1587 FC", "เข้าพบ Delta ครับ พาน้องปิยะไปด้วย คุณพิชัยสนใจ Fluke 1587 FC 5 เครื่อง งบ 375K", b))
b = make_batch_id("2026-02-17 14:45:00", "นภัสสร", "TCC 435-II")
_rows.append(row("2026-02-17 14:45:00", "นภัสสร", "ปูนซิเมนต์ไทย", "คุณมานพ", "manop@siamcement.com", "Fluke", "435-II", 2, 680000, "quotation", "quotation_sent", "", "", "", "", "", "", "ส่ง QT Fluke 435-II สำหรับวิเคราะห์คุณภาพไฟฟ้า", "Sent QT for 2x Fluke 435-II", "ส่ง QT Fluke 435-II 2 เครื่อง ให้ปูนซิเมนต์ไทยค่ะ 680K", b))
b = make_batch_id("2026-03-03 09:30:00", "ปิยะ", "BG 87V")
_rows.append(row("2026-03-03 09:30:00", "ปิยะ", "Bangkok Glass", "คุณสุชาติ", "085-222-3344", "Fluke", "87V", 10, 250000, "closed_won", "closed_won", "paid", "", "", "", "", "ปิดตามราคาเสนอ ชำระเต็มจำนวน", "ปิดดีล Bangkok Glass Fluke 87V 10 เครื่อง ชำระเต็ม", "Closed Bangkok Glass 10x Fluke 87V, full payment", "ปิดดีล Bangkok Glass ได้ครับ! Fluke 87V 10 เครื่อง 250K จ่ายเต็ม", b))
b = make_batch_id("2026-03-08 13:15:00", "นภัสสร", "MEA 1770")
_rows.append(row("2026-03-08 13:15:00", "นภัสสร", "การไฟฟ้านครหลวง (MEA)", "คุณปรีชา", "preecha@mea.or.th", "Fluke", "1770", 1, 520000, "visit", "negotiation", "", "", "", "", "", "", "เข้าพบ กฟน. สาธิต Fluke 1770 เทียบกับ Dranetz", "Visited MEA to demo Fluke 1770 vs Dranetz", "เข้าพบ กฟน. ค่ะ Demo Fluke 1770 กำลังเทียบกับ Dranetz ดีล 520K", b))

# === CRC deals ===
b = make_batch_id("2026-02-16 10:30:00", "อนุชา", "IRPC Lectra")
_rows.append(row("2026-02-16 10:30:00", "อนุชา", "IRPC", "คุณสมบูรณ์", "somboon@irpc.co.th", "CRC", "Lectra Clean", 200, 180000, "quotation", "quotation_sent", "", "", "", "", "", "", "ส่ง QT CRC Lectra Clean 200 กระป๋อง", "Sent QT for 200 cans CRC Lectra Clean", "ส่ง QT CRC Lectra Clean 200 กระป๋อง ให้ IRPC ครับ 180K", b))
b = make_batch_id("2026-02-21 15:00:00", "ธนกฤต", "SCG 2-26")
_rows.append(row("2026-02-21 15:00:00", "ธนกฤต", "SCG", "คุณเกรียงศักดิ์", "083-456-7890", "CRC", "2-26", 500, 125000, "closed_won", "closed_won", "paid", "", "", "", "", "ปิดตามราคา ชำระเต็ม", "ปิดดีล CRC 2-26 ให้ SCG 500 กระป๋อง ชำระแล้ว", "Closed 500 cans CRC 2-26 with SCG, full payment", "ปิดดีล SCG CRC 2-26 ได้ครับ! 500 กระป๋อง 125K ชำระแล้ว", b))
b = make_batch_id("2026-03-04 11:45:00", "วิภา", "Thai Oil CC")
_rows.append(row("2026-03-04 11:45:00", "วิภา", "Thai Oil", "คุณศิริพงษ์", "082-345-6789", "CRC", "Contact Cleaner", 150, 82500, "follow_up", "negotiation", "", "", "", "", "", "", "ติดตาม CRC Contact Cleaner ลูกค้ารวม order", "Following up CRC Contact Cleaner with Thai Oil", "ติดตาม Thai Oil ค่ะ คุณศิริพงษ์จะรวม order CRC Contact Cleaner ยอด 82.5K", b))
b = make_batch_id("2026-03-10 14:00:00", "ปิยะ", "Bangchak Rust")
_rows.append(row("2026-03-10 14:00:00", "ปิยะ", "บางจาก (Bangchak)", "คุณเทพฤทธิ์", "087-654-3210", "CRC", "Rust Remover", 100, 55000, "call", "lead", "", "", "", "", "", "", "โทรเสนอ CRC Rust Remover ลูกค้าขอ sample", "Called Bangchak to propose CRC Rust Remover", "โทรคุยบางจากครับ คุณเทพฤทธิ์สนใจ CRC Rust Remover 100 กระป๋อง ขอ sample", b))

# === Salisbury (extra) ===
b = make_batch_id("2026-02-26 09:30:00", "นภัสสร", "PEA gloves")
_rows.append(row("2026-02-26 09:30:00", "นภัสสร", "กฟภ. (PEA)", "คุณอำนาจ", "amnat@pea.co.th", "Salisbury", "Insulating Gloves Class 2", 50, 425000, "quotation", "quotation_sent", "", "", "", "", "", "", "ส่ง QT ถุงมือฉนวน Class 2 50 คู่", "Sent QT for 50 pairs Salisbury Gloves to PEA", "ส่ง QT ถุงมือ Salisbury Class 2 50 คู่ ให้ กฟภ. ค่ะ 425K", b))

# === SmartWasher ===
b = make_batch_id("2026-02-28 13:00:00", "สมชาย", "IRPC SW-28")
_rows.append(row("2026-02-28 13:00:00", "สมชาย", "IRPC", "คุณธนวัฒน์", "thanawat@irpc.co.th", "SmartWasher", "SW-28", 3, 750000, "visit", "negotiation", "", "", "", "", "", "", "เข้าพบ IRPC เสนอ SW-28 ทดแทนสารเคมี ต้องผ่าน EHS", "Visited IRPC to propose SmartWasher SW-28", "เข้าพบ IRPC ครับ เสนอ SmartWasher SW-28 3 เครื่อง 750K ต้องผ่าน EHS ก่อน", b))

# === IK Sprayer ===
b = make_batch_id("2026-03-01 10:00:00", "ธนกฤต", "TCC IK Pro12")
_rows.append(row("2026-03-01 10:00:00", "ธนกฤต", "ปูนซิเมนต์ไทย", "คุณวัชรพงษ์", "watcharapong@sccc.co.th", "IK Sprayer", "Pro 12", 20, 48000, "closed_lost", "closed_lost", "", "", "", "", "", "แพ้ราคายี่ห้อจีน ถูกกว่า 60%", "ปูนซิเมนต์ไทยเลือกยี่ห้อจีนถูกกว่า 60%", "Lost to Chinese brand, 60% lower price", "เสียดายครับ ปูนซิเมนต์ไทยเลือกยี่ห้อจีน IK Pro 12 ราคาถูกกว่า 60%", b))

# === HVOP (new brand) ===
b = make_batch_id("2026-03-11 10:00:00", "สมชาย", "PEA HVOP")
_rows.append(row("2026-03-11 10:00:00", "สมชาย", "กฟภ. (PEA)", "คุณอำนาจ", "amnat@pea.co.th", "HVOP", "HV Detector", 5, 450000, "visit", "lead", "", "", "", "", "", "", "เข้าพบ กฟภ. เสนอ HVOP HV Detector 5 ชุด", "Visited PEA to present HVOP HV Detector x5", "เข้าพบ กฟภ. ครับ เสนอ HVOP HV Detector 5 ชุด งบ 450K", b))

# === Bidding example ===
b = make_batch_id("2026-03-12 14:00:00", "อนุชา", "MEA bidding MIT525")
_rows.append(row("2026-03-12 14:00:00", "อนุชา", "การไฟฟ้านครหลวง (MEA)", "คุณสมศักดิ์", "procurement@mea.or.th", "Megger", "MIT525", 5, 4500000, "quotation", "bidding", "", "", "2026-03-28", "", "", "", "ยื่นซองประมูล MIT525 5 เครื่อง เปิดซอง 28 มี.ค.", "Submitted bid for 5x MIT525 at MEA, opens Mar 28", "ยื่นซองประมูล กฟน. Megger MIT525 5 เครื่อง 4.5 ล้าน เปิดซอง 28 มี.ค.", b))

# === Service/warranty example ===
b = make_batch_id("2026-03-13 09:00:00", "วิภา", "PTT MTO330 service")
_rows.append(row("2026-03-13 09:00:00", "วิภา", "PTT", "คุณวีระ", "081-234-5678", "Megger", "MTO330", 1, "", "sent_to_service", "", "", "", "", "", "", "", "ส่ง MTO330 S/N 12345 เข้าซ่อม warranty", "Sent PTT Megger MTO330 for warranty service", "ส่ง Megger MTO330 ของ PTT เข้าซ่อม warranty ค่ะ", b))

# === Job expired example ===
b = make_batch_id("2026-03-13 15:00:00", "ปิยะ", "Thai Oil expired")
_rows.append(row("2026-03-13 15:00:00", "ปิยะ", "Thai Oil", "คุณกิตติพงษ์", "083-111-2222", "Megger", "MIT1025", 1, 890000, "follow_up", "job_expired", "", "", "", "", "", "ลูกค้าตัดงบ ไม่มีงบปีนี้แล้ว", "Thai Oil ตัดงบ MIT1025 ไม่มีงบปีนี้", "Thai Oil cut budget, no allocation this year", "Thai Oil ตัดงบครับ คุณกิตติพงษ์แจ้งว่าไม่มีงบปีนี้แล้ว", b))

# === Equipment defect example ===
b = make_batch_id("2026-03-14 11:00:00", "ธนกฤต", "Delta defect")
_rows.append(row("2026-03-14 11:00:00", "ธนกฤต", "Delta Electronics", "คุณพิชัย", "pichai@delta.co.th", "Fluke", "1587 FC", 1, 375000, "visit", "equipment_defect", "", "", "", "", "", "เครื่องเดโม่ค่าอ่านผิดปกติ ลูกค้าไม่รับ", "เครื่อง 1587 FC เดโม่แล้วค่าอ่านผิดปกติ ลูกค้าไม่รับ", "Demo Fluke 1587 FC defective, abnormal reading", "เข้าพบ Delta ครับ เครื่อง 1587 FC เดโม่แล้วค่าอ่านผิดปกติ ลูกค้าไม่รับ", b))

# === Plan to visit example ===
b = make_batch_id("2026-03-14 16:00:00", "นภัสสร", "IRPC plan visit")
_rows.append(row("2026-03-14 16:00:00", "นภัสสร", "IRPC", "คุณประยุทธ์", "", "Megger", "DLRO200", 2, 1450000, "follow_up", "plan_to_visit", "", "2026-03-20", "", "", "", "", "นัดเข้าพบ IRPC อาทิตย์หน้า ติดตาม DLRO200", "Planned visit to IRPC next week for DLRO200 follow-up", "นัดเข้าพบ IRPC วันพฤหัสหน้าค่ะ ติดตาม DLRO200", b))

SAMPLE_DATA = _rows

# ---------------------------------------------------------------------------
# Main execution
# ---------------------------------------------------------------------------

HEADERS = [
    "Timestamp", "Rep Name", "Customer", "Contact Person",
    "Contact Channel", "Product Brand", "Product Name", "Quantity",
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
tabs_to_delete = []
for ws in spreadsheet.worksheets():
    if ws.title.startswith("Backup_") or ws.title == "Live Data":
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
    (5, 9, (0.95, 0.90, 0.85)),     # F-I: Product, Brand, Qty, Value
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
    5: 100,   # Product Brand
    6: 160,   # Product Name
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

# 5. Clear old validations on Contact Channel (E=4) and Deal Value (I=8)
for col_idx in [4, 8]:
    requests.append({
        "setDataValidation": {
            "range": {"sheetId": sheet_id, "startRowIndex": 1, "endRowIndex": 200, "startColumnIndex": col_idx, "endColumnIndex": col_idx + 1},
        }
    })

# 5b. Data validation: Product Brand (column F = index 5)
brands = ["Megger", "Fluke", "CRC", "Salisbury", "SmartWasher", "IK Sprayer", "HVOP", "Other"]
requests.append({
    "setDataValidation": {
        "range": {"sheetId": sheet_id, "startRowIndex": 1, "endRowIndex": 200, "startColumnIndex": 5, "endColumnIndex": 6},
        "rule": {
            "condition": {"type": "ONE_OF_LIST", "values": [{"userEnteredValue": b} for b in brands]},
            "showCustomUi": True,
            "strict": False,
        },
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

# Execute all formatting in one batch
spreadsheet.batch_update({"requests": requests})
print("Formatting applied: headers, freeze, dropdowns, conditional colors, number format.")

print(f"\nDone! Open your spreadsheet to verify:")
print(f"https://docs.google.com/spreadsheets/d/{GOOGLE_SHEETS_ID}/edit")
