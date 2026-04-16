"""
Setup LINE Rich Menu for ATE Sales Report Bot.

Run once after deployment:
  python3 setup_rich_menu.py

Requires:
  - LINE_CHANNEL_ACCESS_TOKEN in .env or environment
  - rich_menu.png in same directory
  - Google Sheets URL or GOOGLE_SHEETS_ID

Legacy note:
This script belongs to the older LINE/Python demo path retained for reference.
"""

import os
import json
import urllib.request

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------


def load_env_file():
    """Load a dotenv-style file into os.environ without overwriting existing vars."""
    env_path = os.environ.get("ENV_FILE")
    if not env_path:
        env_path = os.path.join(os.path.dirname(__file__), ".env")

    if not os.path.exists(env_path):
        return

    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            os.environ.setdefault(key, value)


load_env_file()

TOKEN = os.environ.get("LINE_CHANNEL_ACCESS_TOKEN", "")
GOOGLE_SHEETS_ID = os.environ.get("GOOGLE_SHEETS_ID", "")
SHEETS_URL = os.environ.get("SHEETS_URL", "")

if not TOKEN:
    print("ERROR: LINE_CHANNEL_ACCESS_TOKEN not found.")
    print("Set it as environment variable, ENV_FILE, or in .env file.")
    exit(1)

if not SHEETS_URL and GOOGLE_SHEETS_ID:
    SHEETS_URL = f"https://docs.google.com/spreadsheets/d/{GOOGLE_SHEETS_ID}/edit"

if not SHEETS_URL:
    print("ERROR: SHEETS_URL or GOOGLE_SHEETS_ID is required.")
    exit(1)


def api_call(method, path, data=None, content_type="application/json"):
    """Make LINE API call."""
    url = f"https://api.line.me/v2/bot/richmenu{path}"
    headers = {"Authorization": f"Bearer {TOKEN}"}

    if data and content_type == "application/json":
        body = json.dumps(data).encode()
        headers["Content-Type"] = "application/json"
    elif data:
        body = data
        headers["Content-Type"] = content_type
    else:
        body = None

    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        error_body = e.read().decode("utf-8", errors="replace")
        print(f"API Error {e.code}: {error_body}")
        raise


def delete_existing_menus():
    """Delete all existing rich menus."""
    print("Checking existing rich menus...")
    try:
        req = urllib.request.Request(
            "https://api.line.me/v2/bot/richmenu/list",
            headers={"Authorization": f"Bearer {TOKEN}"},
        )
        with urllib.request.urlopen(req, timeout=15) as resp:
            result = json.loads(resp.read())

        menus = result.get("richmenus", [])
        if menus:
            print(f"Found {len(menus)} existing menus, deleting...")
            for menu in menus:
                rid = menu["richMenuId"]
                req = urllib.request.Request(
                    f"https://api.line.me/v2/bot/richmenu/{rid}",
                    headers={"Authorization": f"Bearer {TOKEN}"},
                    method="DELETE",
                )
                urllib.request.urlopen(req, timeout=10)
                print(f"  Deleted: {rid}")
        else:
            print("No existing menus found.")
    except Exception as e:
        print(f"Warning: Could not list/delete menus: {e}")


def create_rich_menu():
    """Create the rich menu with 3 buttons in a 1x3 layout."""

    cell_w = 2500 // 3
    last_w = 2500 - cell_w * 2  # last cell absorbs remainder

    menu_data = {
        "size": {"width": 2500, "height": 843},
        "selected": True,
        "name": "ATE Sales Bot Menu",
        "chatBarText": "เมนู ATE Sales",
        "areas": [
            {
                "bounds": {"x": 0, "y": 0, "width": cell_w, "height": 843},
                "action": {"type": "message", "text": "วิธีรายงาน"}
            },
            {
                "bounds": {"x": cell_w, "y": 0, "width": cell_w, "height": 843},
                "action": {"type": "message", "text": "วิธีอัพเดท"}
            },
            {
                "bounds": {"x": cell_w * 2, "y": 0, "width": last_w, "height": 843},
                "action": {"type": "uri", "uri": SHEETS_URL}
            },
        ]
    }

    print("Creating rich menu...")
    result = api_call("POST", "", menu_data)
    menu_id = result["richMenuId"]
    print(f"Created: {menu_id}")
    return menu_id


def upload_image(menu_id):
    """Upload the rich menu image."""
    img_path = os.path.join(os.path.dirname(__file__), "rich_menu.png")
    if not os.path.exists(img_path):
        print(f"ERROR: {img_path} not found. Run generate_rich_menu_image.py first.")
        exit(1)

    with open(img_path, "rb") as f:
        img_data = f.read()

    print(f"Uploading image ({len(img_data)} bytes)...")
    url = f"https://api-data.line.me/v2/bot/richmenu/{menu_id}/content"
    req = urllib.request.Request(
        url,
        data=img_data,
        headers={
            "Authorization": f"Bearer {TOKEN}",
            "Content-Type": "image/png",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        resp.read()
    print("Image uploaded.")


def set_default(menu_id):
    """Set as default rich menu for all users."""
    print("Setting as default menu...")
    url = f"https://api.line.me/v2/bot/user/all/richmenu/{menu_id}"
    req = urllib.request.Request(
        url,
        data=b"",
        headers={"Authorization": f"Bearer {TOKEN}"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        resp.read()
    print("Default menu set for all users.")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    print("=== ATE Sales Bot — Rich Menu Setup ===\n")
    delete_existing_menus()
    menu_id = create_rich_menu()
    upload_image(menu_id)
    set_default(menu_id)
    print(f"\nDone! Rich menu is now active.")
    print("Open LINE chat with the bot to verify.")
