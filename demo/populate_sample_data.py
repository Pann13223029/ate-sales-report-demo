"""
Populate Google Sheets with sample data for the ATE Sales Demo.

Usage:
  python populate_sample_data.py           # Backup + populate with sample data
  python populate_sample_data.py --restore # Restore from latest backup
  python populate_sample_data.py --no-backup # Populate without backup (dangerous)
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
MAX_BACKUPS = 3
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
# Backup & Restore functions
# ---------------------------------------------------------------------------

def get_backup_tabs(spreadsheet):
    """Get all backup tabs sorted by name (oldest first)."""
    return sorted(
        [ws for ws in spreadsheet.worksheets() if ws.title.startswith("Backup_")],
        key=lambda ws: ws.title
    )


def create_backup(spreadsheet, sheet):
    """Copy current Sheet1 data to a timestamped backup tab."""
    all_data = sheet.get_all_values()
    if len(all_data) <= 1:
        print("No data to backup (only headers or empty).")
        return None

    timestamp = datetime.now(BKK_TZ).strftime("%Y-%m-%d_%H%M")
    backup_name = f"Backup_{timestamp}"

    # Create backup tab
    row_count = max(len(all_data) + 5, 50)
    col_count = len(all_data[0]) if all_data else 17
    backup_sheet = spreadsheet.add_worksheet(title=backup_name, rows=row_count, cols=col_count)
    # Use gspread's col number to letter conversion
    from gspread.utils import rowcol_to_a1
    end_cell = rowcol_to_a1(len(all_data), col_count)
    backup_sheet.update(range_name=f"A1:{end_cell}", values=all_data)

    print(f"Backup created: '{backup_name}' ({len(all_data) - 1} data rows)")

    # Enforce max backups — delete oldest
    backups = get_backup_tabs(spreadsheet)
    while len(backups) > MAX_BACKUPS:
        oldest = backups.pop(0)
        spreadsheet.del_worksheet(oldest)
        print(f"Deleted old backup: '{oldest.title}' (keeping max {MAX_BACKUPS})")

    return backup_name


def restore_from_backup(spreadsheet, sheet, backup_name=None):
    """Restore Sheet1 from a backup tab."""
    backups = get_backup_tabs(spreadsheet)
    if not backups:
        print("No backups found. Nothing to restore.")
        return False

    if backup_name:
        target = next((b for b in backups if b.title == backup_name), None)
        if not target:
            print(f"Backup '{backup_name}' not found. Available: {[b.title for b in backups]}")
            return False
    else:
        target = backups[-1]  # latest

    backup_data = target.get_all_values()
    if not backup_data:
        print(f"Backup '{target.title}' is empty.")
        return False

    from gspread.utils import rowcol_to_a1

    # Clear Sheet1
    all_current = sheet.get_all_values()
    if len(all_current) > 0:
        max_cols = max(len(all_current[0]), len(backup_data[0]))
        max_rows = max(len(all_current), len(backup_data)) + 5
        end_cell = rowcol_to_a1(max_rows, max_cols)
        sheet.batch_clear([f"A1:{end_cell}"])

    # Write backup data
    end_cell = rowcol_to_a1(len(backup_data), len(backup_data[0]))
    sheet.update(range_name=f"A1:{end_cell}", values=backup_data)

    print(f"Restored from '{target.title}' ({len(backup_data) - 1} data rows)")
    return True

# ---------------------------------------------------------------------------
# 28 rows of sample data (1 month: Feb 10 – Mar 10, 2026)
# ---------------------------------------------------------------------------

def make_batch_id(ts, rep, raw):
    return "MSG-" + hashlib.md5(f"{ts}{rep}{raw}".encode()).hexdigest()[:5].upper()

# Helper: create row with batch ID and item label
def row(ts, rep, customer, contact, brand, product, qty, value, activity, stage, payment, notes, summary, raw, batch_id, item_label=""):
    return [ts, rep, customer, contact, brand, product, qty, value, activity, stage, payment, notes, summary, raw, batch_id, item_label, "sample"]

# ---------------------------------------------------------------------------
# Build sample data with Batch IDs
# ---------------------------------------------------------------------------

_rows = []

# === Deal Progression Story 1: PTT + Megger MTO330 (สมชาย) ===
b = make_batch_id("2026-02-10 09:15:00", "สมชาย", "PTT MTO330 visit")
_rows.append(row("2026-02-10 09:15:00", "สมชาย", "PTT", "คุณวีระ", "Megger", "MTO330", 2, 3200000, "visit", "lead", "", "เข้าพบลูกค้า นำเสนอ MTO330 ลูกค้าสนใจขอใบเสนอราคา", "Visited PTT HQ to present Megger MTO330. Customer requested quotation.", "เข้าพบ PTT วันนี้ครับ คุณวีระสนใจ MTO330 จำนวน 2 เครื่อง งบประมาณราว 3.2 ล้าน", b))
b = make_batch_id("2026-02-14 10:30:00", "สมชาย", "PTT MTO330 qt")
_rows.append(row("2026-02-14 10:30:00", "สมชาย", "PTT", "คุณวีระ", "Megger", "MTO330", 2, 3200000, "quotation", "quotation_sent", "", "ส่งใบเสนอราคา MTO330 x2 ให้ PTT รอพิจารณา 2 สัปดาห์", "Sent quotation for 2x MTO330 to PTT.", "ส่ง QT ให้คุณวีระ PTT เรียบร้อยครับ MTO330 2 เครื่อง 3.2 ล้าน", b))
b = make_batch_id("2026-02-27 14:00:00", "สมชาย", "PTT MTO330 nego")
_rows.append(row("2026-02-27 14:00:00", "สมชาย", "PTT", "คุณวีระ", "Megger", "MTO330", 2, 3050000, "follow_up", "negotiation", "", "PTT ต่อรองราคาลงมาที่ 3.05 ล้าน ขอลด 5%", "PTT negotiating price down to 3.05M THB.", "คุณวีระ PTT โทรมาต่อรองราคาครับ ขอลด 5% เหลือ 3.05 ล้าน", b))
b = make_batch_id("2026-03-06 11:00:00", "สมชาย", "PTT MTO330 won")
_rows.append(row("2026-03-06 11:00:00", "สมชาย", "PTT", "คุณวีระ", "Megger", "MTO330", 2, 3050000, "closed_won", "closed_won", "pending", "ปิดดีล PTT สำเร็จ 3.05 ล้าน PO เลขที่ PTT-2026-0312", "Closed deal with PTT at 3.05M THB. PO received.", "ปิดดีล PTT ได้แล้วครับ! 3.05 ล้าน ได้ PO แล้ว รอเงินงวดแรกครับ", b))

# === Deal Progression Story 2: EGAT + Fluke Ti480 PRO (วิภา) ===
b = make_batch_id("2026-02-12 09:45:00", "วิภา", "EGAT Ti480")
_rows.append(row("2026-02-12 09:45:00", "วิภา", "EGAT", "คุณสุรศักดิ์", "Fluke", "Ti480 PRO", 3, 1350000, "call", "lead", "", "โทรหา EGAT เสนอ Ti480 PRO สำหรับ predictive maintenance", "Called EGAT to propose Fluke Ti480 PRO thermal camera.", "โทรคุย EGAT คุณสุรศักดิ์ เสนอ Fluke Ti480 PRO 3 ตัว นัดเข้าพบอาทิตย์หน้าค่ะ", b))
b = make_batch_id("2026-02-19 13:30:00", "วิภา", "EGAT Ti480 visit")
_rows.append(row("2026-02-19 13:30:00", "วิภา", "EGAT", "คุณสุรศักดิ์", "Fluke", "Ti480 PRO", 3, 1350000, "visit", "negotiation", "", "เข้าพบ EGAT สาธิต Ti480 PRO ลูกค้าขอเทียบกับ FLIR", "Visited EGAT. Demonstrated Ti480 PRO. Customer comparing with FLIR.", "เข้าพบ EGAT วันนี้ค่ะ Demo Ti480 PRO ลูกค้าชอบ แต่ขอเทียบกับ FLIR ค่ะ", b))
b = make_batch_id("2026-03-05 16:00:00", "วิภา", "EGAT Ti480 lost")
_rows.append(row("2026-03-05 16:00:00", "วิภา", "EGAT", "คุณสุรศักดิ์", "Fluke", "Ti480 PRO", 3, 1350000, "closed_lost", "closed_lost", "", "EGAT เลือก FLIR ราคาถูกกว่า 15% พร้อม service contract", "Lost deal to FLIR. 15% lower price and service contract.", "เสียดายค่ะ EGAT เลือก FLIR ราคาถูกกว่า 15% แถม service contract ด้วย", b))

# === Deal Progression Story 3: SCG + Salisbury Arc Flash Kit (ธนกฤต) ===
b = make_batch_id("2026-02-18 10:00:00", "ธนกฤต", "SCG arc flash")
_rows.append(row("2026-02-18 10:00:00", "ธนกฤต", "SCG", "คุณอภิชาติ", "Salisbury", "Arc Flash Kit", 15, 975000, "visit", "lead", "", "เข้าพบ SCG บ้านโป่ง นำเสนอ Arc Flash Kit", "Visited SCG Ban Pong. Presented Arc Flash Kit.", "เข้าพบ SCG บ้านโป่งครับ คุณอภิชาติต้องการ Arc Flash Kit 15 ชุด งบ Q1", b))
b = make_batch_id("2026-02-25 11:30:00", "ธนกฤต", "SCG arc flash qt")
_rows.append(row("2026-02-25 11:30:00", "ธนกฤต", "SCG", "คุณอภิชาติ", "Salisbury", "Arc Flash Kit", 15, 975000, "quotation", "quotation_sent", "", "ส่ง QT Arc Flash Kit 15 ชุด รวมอบรม 1 วัน", "Sent quotation for 15 Arc Flash Kits including training.", "ส่ง QT ให้ SCG แล้วครับ Arc Flash Kit 15 ชุด 975,000 รวมอบรมครับ", b))
b = make_batch_id("2026-03-10 09:30:00", "ธนกฤต", "SCG arc flash won")
_rows.append(row("2026-03-10 09:30:00", "ธนกฤต", "SCG", "คุณอภิชาติ", "Salisbury", "Arc Flash Kit", 15, 975000, "closed_won", "closed_won", "partial", "SCG อนุมัติ PO ชำระงวดแรก 50% จัดส่ง 25 มี.ค.", "SCG approved PO. 50% paid. Delivery March 25.", "SCG อนุมัติแล้วครับ! ได้เงินงวดแรก 50% จัดส่งพร้อมอบรม 25 มี.ค.", b))

# === Multi-activity visit: PTTEP 3 products (วิภา) ===
raw_multi1 = "เข้าพบ PTTEP วันนี้ เจอคุณนภา\n- เสนอ Megger MIT1025 ราคา 350,000\n- เสนอ Fluke 87V จำนวน 3 ตัว ราคา 42,000\n- CRC 2-26 สเปรย์ 24 กระป๋อง ราคา 12,000\nรวม 404,000 ลูกค้าขอเวลาพิจารณา 2 สัปดาห์"
b = make_batch_id("2026-02-15 10:00:00", "วิภา", raw_multi1)
_rows.append(row("2026-02-15 10:00:00", "วิภา", "PTTEP", "คุณนภา", "Megger", "MIT1025", 1, 350000, "visit", "quotation_sent", "", "นำเสนอ MIT1025 ลูกค้าขอเวลาพิจารณา 2 สัปดาห์", "Visited PTTEP, quoted Megger MIT1025 at 350K.", raw_multi1, b, "1/3"))
_rows.append(row("2026-02-15 10:00:00", "วิภา", "PTTEP", "คุณนภา", "Fluke", "87V", 3, 42000, "visit", "quotation_sent", "", "เสนอ Fluke 87V 3 ตัว", "Visited PTTEP, quoted 3x Fluke 87V at 42K.", raw_multi1, b, "2/3"))
_rows.append(row("2026-02-15 10:00:00", "วิภา", "PTTEP", "คุณนภา", "CRC", "2-26 Spray", 24, 12000, "visit", "quotation_sent", "", "CRC 2-26 สเปรย์ 24 กระป๋อง", "Visited PTTEP, quoted CRC 2-26 spray x24 at 12K.", raw_multi1, b, "3/3"))

# === Multi-activity visit: กฟภ. 2 products (ปิยะ) ===
raw_multi2 = "เข้าพบ กฟภ. วันนี้ เจอคุณนิรันดร์\n1. เสนอ Megger MIT525 3 เครื่อง ราคา 2,100,000\n2. เสนอ Salisbury ถุงมือ Class 2 จำนวน 30 คู่ ราคา 255,000"
b = make_batch_id("2026-03-02 10:15:00", "ปิยะ", raw_multi2)
_rows.append(row("2026-03-02 10:15:00", "ปิยะ", "กฟภ. (PEA)", "คุณนิรันดร์", "Megger", "MIT525", 3, 2100000, "follow_up", "negotiation", "", "ติดตาม MIT525 ลูกค้าเทียบสเปกกับ Hioki", "Following up PEA deal for 3x MIT525. Comparing with Hioki.", raw_multi2, b, "1/2"))
_rows.append(row("2026-03-02 10:15:00", "ปิยะ", "กฟภ. (PEA)", "คุณนิรันดร์", "Salisbury", "Insulating Gloves Class 2", 30, 255000, "visit", "quotation_sent", "", "เสนอถุงมือฉนวน 30 คู่ ให้ทีมช่างภาคสนาม", "Visited PEA, quoted 30 pairs Salisbury Gloves at 255K.", raw_multi2, b, "2/2"))

# === Individual Megger deals ===
b = make_batch_id("2026-02-11 14:20:00", "ปิยะ", "Thai Oil MIT1025")
_rows.append(row("2026-02-11 14:20:00", "ปิยะ", "Thai Oil", "คุณกิตติพงษ์", "Megger", "MIT1025", 1, 890000, "visit", "lead", "", "เข้าพบ Thai Oil ศรีราชา เสนอ MIT1025", "Visited Thai Oil Sriracha. Proposed MIT1025.", "เข้าพบ Thai Oil ศรีราชาครับ คุณกิตติพงษ์สนใจ MIT1025 ราคา 890K", b))
b = make_batch_id("2026-02-20 09:00:00", "อนุชา", "IRPC DLRO200")
_rows.append(row("2026-02-20 09:00:00", "อนุชา", "IRPC", "คุณประยุทธ์", "Megger", "DLRO200", 2, 1450000, "quotation", "quotation_sent", "", "ส่ง QT DLRO200 สำหรับวัดความต้านทานต่ำ", "Sent quotation for 2x DLRO200 for refinery.", "ส่ง QT DLRO200 2 เครื่อง ให้ IRPC แล้วครับ 1.45 ล้าน", b))
b = make_batch_id("2026-02-24 15:45:00", "สมชาย", "MEA S1-1568")
_rows.append(row("2026-02-24 15:45:00", "สมชาย", "การไฟฟ้านครหลวง (MEA)", "คุณสมศักดิ์", "Megger", "S1-1568", 1, 2800000, "visit", "lead", "", "เข้าพบ กฟน. เสนอ S1-1568 ลูกค้ากำลังทำ TOR", "Visited MEA to present Megger S1-1568.", "เข้าพบ กฟน. ครับ คุณสมศักดิ์กำลังทำ TOR เสนอ S1-1568 ราคา 2.8 ล้าน", b))
b = make_batch_id("2026-03-07 08:30:00", "วิภา", "PTTEP MTO300")
_rows.append(row("2026-03-07 08:30:00", "วิภา", "PTTEP", "คุณธีรพงศ์", "Megger", "MTO300", 1, 1850000, "quotation", "quotation_sent", "", "ส่ง QT MTO300 สำหรับแท่นขุดเจาะ", "Sent quotation for MTO300 to PTTEP for offshore.", "ส่ง QT MTO300 ให้ PTTEP ค่ะ ใช้บนแท่นขุดเจาะ ราคา 1.85 ล้าน", b))
b = make_batch_id("2026-03-09 16:30:00", "อนุชา", "Bangchak MIT1025")
_rows.append(row("2026-03-09 16:30:00", "อนุชา", "บางจาก (Bangchak)", "คุณวรพจน์", "Megger", "MIT1025", 2, 1780000, "call", "lead", "", "โทรเสนอ MIT1025 สำหรับ shutdown ปลายปี", "Called Bangchak to propose MIT1025 for shutdown.", "โทรคุยบางจากครับ คุณวรพจน์สนใจ MIT1025 2 เครื่อง สำหรับ shutdown ปลายปี", b))

# === Fluke deals ===
b = make_batch_id("2026-02-13 11:00:00", "ธนกฤต", "Delta 1587FC")
_rows.append(row("2026-02-13 11:00:00", "ธนกฤต", "Delta Electronics", "คุณพิชัย", "Fluke", "1587 FC", 5, 375000, "visit", "lead", "", "เข้าพบ Delta นำเสนอ 1587 FC สำหรับไลน์ผลิต", "Visited Delta Electronics. Customer interested in 5x 1587 FC.", "เข้าพบ Delta ครับ คุณพิชัยสนใจ Fluke 1587 FC 5 เครื่อง งบ 375K", b))
b = make_batch_id("2026-02-17 14:45:00", "นภัสสร", "TCC 435-II")
_rows.append(row("2026-02-17 14:45:00", "นภัสสร", "ปูนซิเมนต์ไทย", "คุณมานพ", "Fluke", "435-II", 2, 680000, "quotation", "quotation_sent", "", "ส่ง QT Fluke 435-II สำหรับวิเคราะห์คุณภาพไฟฟ้า", "Sent quotation for 2x Fluke 435-II.", "ส่ง QT Fluke 435-II 2 เครื่อง ให้ปูนซิเมนต์ไทยค่ะ 680K", b))
b = make_batch_id("2026-03-03 09:30:00", "ปิยะ", "BG 87V")
_rows.append(row("2026-03-03 09:30:00", "ปิยะ", "Bangkok Glass", "คุณสุชาติ", "Fluke", "87V", 10, 250000, "closed_won", "closed_won", "paid", "ปิดดีล Bangkok Glass Fluke 87V 10 เครื่อง ชำระเต็ม", "Closed deal with Bangkok Glass for 10x Fluke 87V.", "ปิดดีล Bangkok Glass ได้ครับ! Fluke 87V 10 เครื่อง 250K จ่ายเต็ม", b))
b = make_batch_id("2026-03-08 13:15:00", "นภัสสร", "MEA 1770")
_rows.append(row("2026-03-08 13:15:00", "นภัสสร", "การไฟฟ้านครหลวง (MEA)", "คุณปรีชา", "Fluke", "1770", 1, 520000, "visit", "negotiation", "", "เข้าพบ กฟน. สาธิต Fluke 1770 เทียบกับ Dranetz", "Visited MEA to demonstrate Fluke 1770.", "เข้าพบ กฟน. ค่ะ Demo Fluke 1770 กำลังเทียบกับ Dranetz ดีล 520K", b))

# === CRC deals ===
b = make_batch_id("2026-02-16 10:30:00", "อนุชา", "IRPC Lectra")
_rows.append(row("2026-02-16 10:30:00", "อนุชา", "IRPC", "คุณสมบูรณ์", "CRC", "Lectra Clean", 200, 180000, "quotation", "quotation_sent", "", "ส่ง QT CRC Lectra Clean 200 กระป๋อง", "Sent quotation for 200 cans CRC Lectra Clean.", "ส่ง QT CRC Lectra Clean 200 กระป๋อง ให้ IRPC ครับ 180K", b))
b = make_batch_id("2026-02-21 15:00:00", "ธนกฤต", "SCG 2-26")
_rows.append(row("2026-02-21 15:00:00", "ธนกฤต", "SCG", "คุณเกรียงศักดิ์", "CRC", "2-26", 500, 125000, "closed_won", "closed_won", "paid", "ปิดดีล CRC 2-26 ให้ SCG 500 กระป๋อง ชำระแล้ว", "Closed 500 cans CRC 2-26 with SCG. Full payment.", "ปิดดีล SCG CRC 2-26 ได้ครับ! 500 กระป๋อง 125K ชำระแล้ว", b))
b = make_batch_id("2026-03-04 11:45:00", "วิภา", "Thai Oil CC")
_rows.append(row("2026-03-04 11:45:00", "วิภา", "Thai Oil", "คุณศิริพงษ์", "CRC", "Contact Cleaner", 150, 82500, "follow_up", "negotiation", "", "ติดตาม CRC Contact Cleaner ลูกค้ารวม order", "Following up CRC Contact Cleaner with Thai Oil.", "ติดตาม Thai Oil ค่ะ คุณศิริพงษ์จะรวม order CRC Contact Cleaner ยอด 82.5K", b))
b = make_batch_id("2026-03-10 14:00:00", "ปิยะ", "Bangchak Rust")
_rows.append(row("2026-03-10 14:00:00", "ปิยะ", "บางจาก (Bangchak)", "คุณเทพฤทธิ์", "CRC", "Rust Remover", 100, 55000, "call", "lead", "", "โทรเสนอ CRC Rust Remover ลูกค้าขอ sample", "Called Bangchak to propose CRC Rust Remover.", "โทรคุยบางจากครับ คุณเทพฤทธิ์สนใจ CRC Rust Remover 100 กระป๋อง ขอ sample", b))

# === Salisbury (extra) ===
b = make_batch_id("2026-02-26 09:30:00", "นภัสสร", "PEA gloves")
_rows.append(row("2026-02-26 09:30:00", "นภัสสร", "กฟภ. (PEA)", "คุณอำนาจ", "Salisbury", "Insulating Gloves Class 2", 50, 425000, "quotation", "quotation_sent", "", "ส่ง QT ถุงมือฉนวน Class 2 50 คู่", "Sent quotation for 50 pairs Salisbury Gloves to PEA.", "ส่ง QT ถุงมือ Salisbury Class 2 50 คู่ ให้ กฟภ. ค่ะ 425K", b))

# === SmartWasher ===
b = make_batch_id("2026-02-28 13:00:00", "สมชาย", "IRPC SW-28")
_rows.append(row("2026-02-28 13:00:00", "สมชาย", "IRPC", "คุณธนวัฒน์", "SmartWasher", "SW-28", 3, 750000, "visit", "negotiation", "", "เข้าพบ IRPC เสนอ SW-28 ทดแทนสารเคมี ต้องผ่าน EHS", "Visited IRPC to propose SmartWasher SW-28.", "เข้าพบ IRPC ครับ เสนอ SmartWasher SW-28 3 เครื่อง 750K ต้องผ่าน EHS ก่อน", b))

# === IK Sprayer ===
b = make_batch_id("2026-03-01 10:00:00", "ธนกฤต", "TCC IK Pro12")
_rows.append(row("2026-03-01 10:00:00", "ธนกฤต", "ปูนซิเมนต์ไทย", "คุณวัชรพงษ์", "IK Sprayer", "Pro 12", 20, 48000, "closed_lost", "closed_lost", "", "ปูนซิเมนต์ไทยเลือกยี่ห้อจีนถูกกว่า 60%", "Lost deal to Chinese sprayer brand, 60% lower price.", "เสียดายครับ ปูนซิเมนต์ไทยเลือกยี่ห้อจีน IK Pro 12 ราคาถูกกว่า 60%", b))

SAMPLE_DATA = _rows

# ---------------------------------------------------------------------------
# Main execution
# ---------------------------------------------------------------------------

HEADERS = [
    "Timestamp", "Rep Name", "Customer", "Contact Person",
    "Product Brand", "Product Name", "Quantity", "Deal Value (THB)",
    "Activity Type", "Sales Stage", "Payment Status",
    "Follow-up Notes", "Summary (EN)", "Raw Message",
    "Batch ID", "Item #", "Source"
]

spreadsheet = client.open_by_key(GOOGLE_SHEETS_ID)
sheet = spreadsheet.sheet1
sheet_id = sheet.id

# Handle CLI args
if "--restore" in sys.argv:
    restore_from_backup(spreadsheet, sheet)
    print(f"\nhttps://docs.google.com/spreadsheets/d/{GOOGLE_SHEETS_ID}/edit")
    sys.exit(0)

skip_backup = "--no-backup" in sys.argv

# Step 1: Backup current data before clearing
if not skip_backup:
    print("--- Creating backup ---")
    create_backup(spreadsheet, sheet)
else:
    print("--- Skipping backup (--no-backup) ---")

# Step 2: Clear existing data (keep header row) — clear ALL columns to catch any shifted data
all_data = sheet.get_all_values()
if len(all_data) > 1:
    sheet.batch_clear([f"A2:AZ{len(all_data) + 50}"])
    print(f"Cleared {len(all_data) - 1} existing rows.")

# Step 3: Write headers
sheet.update(range_name="A1:Q1", values=[HEADERS])

# Step 4: Insert sample data using explicit range (avoid append_rows offset issues)
from gspread.utils import rowcol_to_a1
end_cell = rowcol_to_a1(len(SAMPLE_DATA) + 1, 17)  # +1 for header row, 17 cols incl Source
sheet.update(range_name=f"A2:{end_cell}", values=SAMPLE_DATA, value_input_option="USER_ENTERED")
print(f"Inserted {len(SAMPLE_DATA)} sample rows.")

# Clear any existing conditional formatting rules
try:
    rules = gspread.utils.sheet_metadata(spreadsheet, sheet_id).get("conditionalFormats", [])
    if rules:
        clear_requests = [{"deleteConditionalFormatRule": {"sheetId": sheet_id, "index": 0}} for _ in rules]
        spreadsheet.batch_update({"requests": clear_requests})
        print(f"Cleared {len(rules)} existing conditional formatting rules.")
except Exception:
    pass

requests = []

# 1. Bold + colored header row
requests.append({
    "repeatCell": {
        "range": {"sheetId": sheet_id, "startRowIndex": 0, "endRowIndex": 1},
        "cell": {
            "userEnteredFormat": {
                "backgroundColor": {"red": 0.15, "green": 0.3, "blue": 0.55},
                "textFormat": {"bold": True, "foregroundColor": {"red": 1, "green": 1, "blue": 1}},
                "horizontalAlignment": "CENTER",
            }
        },
        "fields": "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)",
    }
})

# 2. Freeze header row
requests.append({
    "updateSheetProperties": {
        "properties": {"sheetId": sheet_id, "gridProperties": {"frozenRowCount": 1}},
        "fields": "gridProperties.frozenRowCount",
    }
})

# 3. Auto-resize columns
requests.append({
    "autoResizeDimensions": {
        "dimensions": {"sheetId": sheet_id, "dimension": "COLUMNS", "startIndex": 0, "endIndex": 14}
    }
})

# 4. Number format for Deal Value column (H = index 7)
requests.append({
    "repeatCell": {
        "range": {"sheetId": sheet_id, "startRowIndex": 1, "endRowIndex": 100, "startColumnIndex": 7, "endColumnIndex": 8},
        "cell": {
            "userEnteredFormat": {
                "numberFormat": {"type": "NUMBER", "pattern": "#,##0"}
            }
        },
        "fields": "userEnteredFormat.numberFormat",
    }
})

# 5. Data validation: Product Brand (column E = index 4)
brands = ["Megger", "Fluke", "CRC", "Salisbury", "SmartWasher", "IK Sprayer", "Other"]
requests.append({
    "setDataValidation": {
        "range": {"sheetId": sheet_id, "startRowIndex": 1, "endRowIndex": 200, "startColumnIndex": 4, "endColumnIndex": 5},
        "rule": {
            "condition": {"type": "ONE_OF_LIST", "values": [{"userEnteredValue": b} for b in brands]},
            "showCustomUi": True,
            "strict": False,
        },
    }
})

# 6. Data validation: Activity Type (column I = index 8)
activity_types = ["visit", "call", "quotation", "follow_up", "closed_won", "closed_lost", "other"]
requests.append({
    "setDataValidation": {
        "range": {"sheetId": sheet_id, "startRowIndex": 1, "endRowIndex": 200, "startColumnIndex": 8, "endColumnIndex": 9},
        "rule": {
            "condition": {"type": "ONE_OF_LIST", "values": [{"userEnteredValue": a} for a in activity_types]},
            "showCustomUi": True,
            "strict": False,
        },
    }
})

# 7. Data validation: Sales Stage (column J = index 9)
stages = ["lead", "negotiation", "quotation_sent", "closed_won", "closed_lost"]
requests.append({
    "setDataValidation": {
        "range": {"sheetId": sheet_id, "startRowIndex": 1, "endRowIndex": 200, "startColumnIndex": 9, "endColumnIndex": 10},
        "rule": {
            "condition": {"type": "ONE_OF_LIST", "values": [{"userEnteredValue": s} for s in stages]},
            "showCustomUi": True,
            "strict": False,
        },
    }
})

# 8. Data validation: Payment Status (column K = index 10)
pay_statuses = ["pending", "partial", "paid", ""]
requests.append({
    "setDataValidation": {
        "range": {"sheetId": sheet_id, "startRowIndex": 1, "endRowIndex": 200, "startColumnIndex": 10, "endColumnIndex": 11},
        "rule": {
            "condition": {"type": "ONE_OF_LIST", "values": [{"userEnteredValue": p} for p in pay_statuses]},
            "showCustomUi": True,
            "strict": False,
        },
    }
})

# 9. Conditional formatting: Sales Stage cell coloring (column J only)
stage_colors = {
    "closed_won": {"bg": {"red": 0.72, "green": 0.88, "blue": 0.72}, "text": {"red": 0.1, "green": 0.4, "blue": 0.1}},
    "closed_lost": {"bg": {"red": 0.92, "green": 0.72, "blue": 0.72}, "text": {"red": 0.55, "green": 0.1, "blue": 0.1}},
    "negotiation": {"bg": {"red": 1.0, "green": 0.92, "blue": 0.7}, "text": {"red": 0.55, "green": 0.4, "blue": 0.0}},
    "quotation_sent": {"bg": {"red": 0.75, "green": 0.87, "blue": 1.0}, "text": {"red": 0.1, "green": 0.25, "blue": 0.55}},
    "lead": {"bg": {"red": 0.9, "green": 0.9, "blue": 0.9}, "text": {"red": 0.35, "green": 0.35, "blue": 0.35}},
}

for stage, colors in stage_colors.items():
    # Sales Stage column (J = index 9)
    requests.append({
        "addConditionalFormatRule": {
            "rule": {
                "ranges": [{"sheetId": sheet_id, "startRowIndex": 1, "endRowIndex": 200, "startColumnIndex": 9, "endColumnIndex": 10}],
                "booleanRule": {
                    "condition": {"type": "CUSTOM_FORMULA", "values": [{"userEnteredValue": f'=$J2="{stage}"'}]},
                    "format": {"backgroundColor": colors["bg"], "textFormat": {"bold": True, "foregroundColor": colors["text"]}},
                },
            },
            "index": 0,
        }
    })

# 10. Conditional formatting: Activity Type cell coloring (column I)
activity_colors = {
    "visit": {"bg": {"red": 0.82, "green": 0.88, "blue": 1.0}, "text": {"red": 0.1, "green": 0.2, "blue": 0.5}},
    "call": {"bg": {"red": 0.88, "green": 0.82, "blue": 1.0}, "text": {"red": 0.3, "green": 0.15, "blue": 0.55}},
    "quotation": {"bg": {"red": 0.82, "green": 0.95, "blue": 0.92}, "text": {"red": 0.05, "green": 0.4, "blue": 0.35}},
    "follow_up": {"bg": {"red": 1.0, "green": 0.92, "blue": 0.82}, "text": {"red": 0.5, "green": 0.35, "blue": 0.05}},
    "closed_won": {"bg": {"red": 0.72, "green": 0.88, "blue": 0.72}, "text": {"red": 0.1, "green": 0.4, "blue": 0.1}},
    "closed_lost": {"bg": {"red": 0.92, "green": 0.72, "blue": 0.72}, "text": {"red": 0.55, "green": 0.1, "blue": 0.1}},
}

for activity, colors in activity_colors.items():
    requests.append({
        "addConditionalFormatRule": {
            "rule": {
                "ranges": [{"sheetId": sheet_id, "startRowIndex": 1, "endRowIndex": 200, "startColumnIndex": 8, "endColumnIndex": 9}],
                "booleanRule": {
                    "condition": {"type": "CUSTOM_FORMULA", "values": [{"userEnteredValue": f'=$I2="{activity}"'}]},
                    "format": {"backgroundColor": colors["bg"], "textFormat": {"bold": True, "foregroundColor": colors["text"]}},
                },
            },
            "index": 0,
        }
    })

# 11. Conditional formatting: Payment Status cell coloring (column K)
payment_colors = {
    "paid": {"bg": {"red": 0.72, "green": 0.88, "blue": 0.72}, "text": {"red": 0.1, "green": 0.4, "blue": 0.1}},
    "partial": {"bg": {"red": 1.0, "green": 0.92, "blue": 0.7}, "text": {"red": 0.55, "green": 0.4, "blue": 0.0}},
    "pending": {"bg": {"red": 0.95, "green": 0.9, "blue": 0.85}, "text": {"red": 0.45, "green": 0.35, "blue": 0.25}},
}

for pay, colors in payment_colors.items():
    requests.append({
        "addConditionalFormatRule": {
            "rule": {
                "ranges": [{"sheetId": sheet_id, "startRowIndex": 1, "endRowIndex": 200, "startColumnIndex": 10, "endColumnIndex": 11}],
                "booleanRule": {
                    "condition": {"type": "CUSTOM_FORMULA", "values": [{"userEnteredValue": f'=$K2="{pay}"'}]},
                    "format": {"backgroundColor": colors["bg"], "textFormat": {"bold": True, "foregroundColor": colors["text"]}},
                },
            },
            "index": 0,
        }
    })

# 12. Column group color bands for headers
header_bands = [
    (0, 2, {"red": 0.3, "green": 0.3, "blue": 0.4}),      # Who/When (A-B)
    (2, 6, {"red": 0.15, "green": 0.35, "blue": 0.6}),     # Customer/Product (C-F)
    (6, 8, {"red": 0.15, "green": 0.45, "blue": 0.3}),     # Value (G-H)
    (8, 11, {"red": 0.6, "green": 0.5, "blue": 0.15}),     # Status (I-K)
    (11, 14, {"red": 0.25, "green": 0.25, "blue": 0.35}),  # Notes/Raw (L-N)
    (14, 17, {"red": 0.35, "green": 0.25, "blue": 0.4}),  # Batch ID/Item #/Source (O-Q)
]
for start, end, color in header_bands:
    requests.append({
        "repeatCell": {
            "range": {"sheetId": sheet_id, "startRowIndex": 0, "endRowIndex": 1, "startColumnIndex": start, "endColumnIndex": end},
            "cell": {"userEnteredFormat": {"backgroundColor": color}},
            "fields": "userEnteredFormat.backgroundColor",
        }
    })

# Execute all formatting
spreadsheet.batch_update({"requests": requests})
print("Formatting applied: headers, freeze, dropdowns, conditional colors, number format.")

# Legend is in a separate "Legend" tab — no longer in columns P-Q

print("\nDone! Open your spreadsheet to verify:")
print(f"https://docs.google.com/spreadsheets/d/{GOOGLE_SHEETS_ID}/edit")
