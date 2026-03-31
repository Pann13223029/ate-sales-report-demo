"""
ATE Sales Report — Stale Deal Push Notification

Endpoint: GET /api/stale-check
Trigger: External cron (GitHub Actions) every Monday
Logic: Scan Combined sheet for deals with no update in 7+ days, push to each rep via LINE.

Security: Requires X-Cron-Secret header matching CRON_SECRET env var.
"""

import os
import sys
import json
import urllib.request
from http.server import BaseHTTPRequestHandler
from datetime import datetime, timezone, timedelta

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

LINE_CHANNEL_ACCESS_TOKEN = os.environ.get("LINE_CHANNEL_ACCESS_TOKEN", "")
GOOGLE_SHEETS_ID = os.environ.get("GOOGLE_SHEETS_ID", "")
GOOGLE_SERVICE_ACCOUNT_JSON = os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON", "")
CRON_SECRET = os.environ.get("CRON_SECRET", "")

BKK_TZ = timezone(timedelta(hours=7))
STALE_DAYS = 7


# ---------------------------------------------------------------------------
# Shared helpers (same pattern as webhook.py)
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


def push_line_message(user_id: str, text: str):
    """Send LINE push message to a specific user."""
    payload = json.dumps({
        "to": user_id,
        "messages": [{"type": "text", "text": text}],
    }).encode()

    req = urllib.request.Request(
        "https://api.line.me/v2/bot/message/push",
        data=payload,
        headers={
            "Authorization": f"Bearer {LINE_CHANNEL_ACCESS_TOKEN}",
            "Content-Type": "application/json",
        },
    )
    urllib.request.urlopen(req, timeout=10)


# ---------------------------------------------------------------------------
# Stale deal detection
# ---------------------------------------------------------------------------

def find_stale_deals():
    """Scan Combined sheet for active deals not updated in 7+ days.
    Returns dict: {rep_name: [deal_info, ...]}
    """
    client = get_sheets_client()
    spreadsheet = client.open_by_key(GOOGLE_SHEETS_ID)

    try:
        combined = spreadsheet.worksheet("Combined")
    except Exception:
        combined = spreadsheet.sheet1

    all_data = combined.get_all_values()
    if len(all_data) <= 1:
        return {}, spreadsheet

    headers = all_data[0]
    try:
        ts_col = headers.index("Timestamp")
        rep_col = headers.index("Rep Name")
        customer_col = headers.index("Customer")
        product_col = headers.index("Product Name")
        value_col = headers.index("Deal Value (THB)")
        stage_col = headers.index("Sales Stage")
        batch_col = headers.index("Batch ID")
    except ValueError as e:
        print(f"[STALE] Missing column: {e}")
        return {}, spreadsheet

    now = datetime.now(BKK_TZ)
    cutoff = now - timedelta(days=STALE_DAYS)
    terminal = {"closed_won", "closed_lost", "job_expired", "equipment_defect"}

    # Group by batch_id → keep latest timestamp per deal
    deals = {}  # batch_id → {rep, customer, product, value, stage, timestamp}
    for row in all_data[1:]:
        if len(row) <= batch_col:
            continue

        stage = row[stage_col].strip().lower()
        if stage in terminal or not stage:
            continue

        batch_id = row[batch_col].strip()
        if not batch_id:
            continue

        try:
            ts = datetime.strptime(row[ts_col].strip(), "%Y-%m-%d %H:%M:%S")
            ts = ts.replace(tzinfo=BKK_TZ)
        except (ValueError, IndexError):
            continue

        # Keep the latest timestamp per batch_id
        if batch_id not in deals or ts > deals[batch_id]["timestamp"]:
            try:
                val = float(row[value_col].replace(",", "")) if row[value_col] else 0
            except ValueError:
                val = 0

            deals[batch_id] = {
                "rep": row[rep_col].strip(),
                "customer": row[customer_col].strip(),
                "product": row[product_col].strip(),
                "value": val,
                "stage": row[stage_col].strip(),
                "timestamp": ts,
                "batch_id": batch_id,
            }

    # Filter stale deals and group by rep
    stale_by_rep = {}
    for batch_id, deal in deals.items():
        if deal["timestamp"] < cutoff:
            days_stale = (now - deal["timestamp"]).days
            deal["days_stale"] = days_stale
            rep = deal["rep"]
            if rep not in stale_by_rep:
                stale_by_rep[rep] = []
            stale_by_rep[rep].append(deal)

    # Sort each rep's stale deals by days (most stale first)
    for rep in stale_by_rep:
        stale_by_rep[rep].sort(key=lambda d: -d["days_stale"])

    return stale_by_rep, spreadsheet


def get_rep_user_ids(spreadsheet):
    """Read Rep Registry to get display_name → user_id mapping."""
    try:
        reg = spreadsheet.worksheet("Rep Registry")
        all_data = reg.get_all_values()
        mapping = {}
        for row in all_data[1:]:
            if len(row) >= 2 and row[0] and row[1]:
                mapping[row[1]] = row[0]  # display_name → user_id
        return mapping
    except Exception:
        return {}


def send_stale_notifications(stale_by_rep, spreadsheet):
    """Push stale deal notifications to each rep via LINE."""
    rep_ids = get_rep_user_ids(spreadsheet)
    sent_count = 0

    for rep_name, deals in stale_by_rep.items():
        user_id = rep_ids.get(rep_name)
        if not user_id:
            print(f"[STALE] No user ID for rep '{rep_name}', skipping push")
            sys.stdout.flush()
            continue

        # Build message
        msg = f"📋 คุณมี {len(deals)} ดีลที่ไม่มีอัพเดท {STALE_DAYS}+ วัน:\n"
        for i, deal in enumerate(deals[:10], 1):  # Max 10 per message
            val_str = f"฿{deal['value']:,.0f}" if deal['value'] else "—"
            msg += (f"\n{i}. {deal['customer']} / {deal['product']}"
                    f" / {val_str} ({deal['days_stale']} วัน)"
                    f"\n   📝 {deal['batch_id']}")

        msg += "\n\nพิมพ์อัพเดทได้เลยครับ เช่น:"
        msg += f"\nอัพเดท {deals[0]['batch_id']} สถานะเจรจา ราคา..."
        msg += f"\nอัพเดท {deals[0]['batch_id']} job_expired ลูกค้าตัดงบ"

        try:
            push_line_message(user_id, msg)
            sent_count += 1
            print(f"[STALE] Pushed {len(deals)} stale deals to {rep_name}")
            sys.stdout.flush()
        except Exception as e:
            print(f"[STALE] Failed to push to {rep_name}: {e}")
            sys.stdout.flush()

    return sent_count


# ---------------------------------------------------------------------------
# Vercel Serverless Handler
# ---------------------------------------------------------------------------

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        """Stale deal check endpoint. Called by external cron."""
        # Security: verify cron secret
        if not CRON_SECRET:
            self.send_response(500)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(b'{"error": "missing CRON_SECRET"}')
            return

        secret = self.headers.get("X-Cron-Secret", "")
        if secret != CRON_SECRET:
            self.send_response(401)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(b'{"error": "unauthorized"}')
            return

        try:
            stale_by_rep, spreadsheet = find_stale_deals()

            if not stale_by_rep:
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({
                    "status": "ok",
                    "message": "No stale deals found",
                    "stale_count": 0,
                }).encode())
                return

            total_stale = sum(len(deals) for deals in stale_by_rep.values())
            sent_count = send_stale_notifications(stale_by_rep, spreadsheet)

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({
                "status": "ok",
                "stale_deals": total_stale,
                "reps_notified": sent_count,
                "reps_with_stale": list(stale_by_rep.keys()),
                "timestamp": datetime.now(BKK_TZ).isoformat(),
            }).encode())

        except Exception as e:
            print(f"[STALE] Error: {e}")
            sys.stdout.flush()
            self.send_response(500)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({
                "status": "error",
                "message": str(e)[:200],
            }).encode())
