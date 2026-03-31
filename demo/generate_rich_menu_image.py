"""
Generate a 4-button LINE Rich Menu image (2500x843) for ATE Sales Report Bot.

Usage:
  python3 generate_rich_menu_image.py
  → Outputs: rich_menu.png
"""

from PIL import Image, ImageDraw, ImageFont
import os

WIDTH = 2500
HEIGHT = 843

# Colors (ATE brand: dark blue base)
BG_COLOR = (26, 54, 93)
CELL_COLOR = (32, 62, 105)
BORDER_COLOR = (40, 75, 120)
TEXT_COLOR = (255, 255, 255)
ICON_COLOR = (130, 180, 255)       # Light blue for icons
ICON_ACCENT = (100, 220, 160)      # Green accent

# Layout: main menu uses a 2x2 grid
NUM_COLS = 2
NUM_ROWS = 2
CELL_W = WIDTH // NUM_COLS
CELL_H = HEIGHT // NUM_ROWS

# Button definitions
BUTTONS = [
    {"thai": "วิธีรายงาน", "eng": "How to Report", "col": 0, "row": 0},
    {"thai": "วิธีอัพเดท", "eng": "How to Update", "col": 1, "row": 0},
    {"thai": "เปิด Dashboard", "eng": "Dashboard", "col": 0, "row": 1},
    {"thai": "เปิด Sheets", "eng": "Google Sheets", "col": 1, "row": 1},
]

# Find Thai font
THAI_FONT_PATHS = [
    "/System/Library/Fonts/Thonburi.ttc",
    "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
    "/usr/share/fonts/truetype/noto/NotoSansThai-Regular.ttf",
]

font_path = None
for p in THAI_FONT_PATHS:
    if os.path.exists(p):
        font_path = p
        break

try:
    font_main = ImageFont.truetype(font_path, 55) if font_path else ImageFont.load_default()
    font_sub = ImageFont.truetype(font_path, 30) if font_path else ImageFont.load_default()
except Exception:
    font_main = ImageFont.load_default()
    font_sub = ImageFont.load_default()


# ---------------------------------------------------------------------------
# Icon drawing functions (drawn at center cx, cy-offset)
# ---------------------------------------------------------------------------

def draw_bar_chart_icon(draw, cx, cy, size=70):
    """Bar chart icon for สรุปยอด."""
    s = size
    bar_w = s // 5
    gap = bar_w // 2
    total_w = bar_w * 3 + gap * 2
    x_start = cx - total_w // 2

    bars = [
        (0.5, ICON_COLOR),
        (0.85, ICON_ACCENT),
        (0.65, ICON_COLOR),
    ]
    for i, (h_ratio, color) in enumerate(bars):
        bx = x_start + i * (bar_w + gap)
        bar_h = int(s * h_ratio)
        draw.rectangle([bx, cy + s // 2 - bar_h, bx + bar_w, cy + s // 2], fill=color, outline=None)

    draw.line([(cx - total_w // 2 - 8, cy + s // 2 + 2),
               (cx + total_w // 2 + 8, cy + s // 2 + 2)], fill=ICON_COLOR, width=3)


def draw_document_icon(draw, cx, cy, size=70):
    """Document with pen icon for วิธีรายงาน."""
    s = size
    doc_w = s * 2 // 3
    doc_h = s
    x0 = cx - doc_w // 2
    y0 = cy - doc_h // 2

    draw.rounded_rectangle([x0, y0, x0 + doc_w, y0 + doc_h], radius=6, outline=ICON_COLOR, width=3)

    line_margin = doc_w // 5
    line_y_start = y0 + doc_h // 4
    for i in range(3):
        ly = line_y_start + i * (doc_h // 5)
        lw = doc_w - line_margin * 2 if i < 2 else doc_w // 2 - line_margin
        draw.line([(x0 + line_margin, ly), (x0 + line_margin + lw, ly)], fill=ICON_COLOR, width=3)

    px = x0 + doc_w + 4
    py = y0 + doc_h - 4
    pen_len = s // 3
    draw.line([(px, py), (px - pen_len, py - pen_len)], fill=ICON_ACCENT, width=4)
    draw.polygon([(px, py), (px - 5, py - 8), (px - 8, py - 5)], fill=ICON_ACCENT)


def draw_refresh_icon(draw, cx, cy, size=70):
    """Circular arrow icon for วิธีอัพเดท."""
    s = size
    half = s // 2
    # Draw circular arc (approximated with an ellipse outline)
    bbox = [cx - half, cy - half, cx + half, cy + half]
    draw.arc(bbox, start=30, end=330, fill=ICON_ACCENT, width=4)

    # Arrowhead at the end of the arc (roughly at 330 degrees = top-right)
    import math
    angle = math.radians(330)
    tip_x = cx + half * math.cos(angle)
    tip_y = cy - half * math.sin(angle)
    arrow_size = s // 5
    draw.polygon([
        (tip_x, tip_y),
        (tip_x - arrow_size, tip_y - arrow_size // 2),
        (tip_x - arrow_size // 3, tip_y + arrow_size),
    ], fill=ICON_ACCENT)


def draw_line_chart_icon(draw, cx, cy, size=70):
    """Line chart icon for เปิด Dashboard."""
    s = size
    half = s // 2

    ax_x = cx - half
    ax_y = cy + half
    draw.line([(ax_x, cy - half), (ax_x, ax_y)], fill=ICON_COLOR, width=3)
    draw.line([(ax_x, ax_y), (cx + half, ax_y)], fill=ICON_COLOR, width=3)

    points = [
        (ax_x + s * 0.1, cy + half * 0.5),
        (ax_x + s * 0.35, cy - half * 0.1),
        (ax_x + s * 0.6, cy + half * 0.15),
        (ax_x + s * 0.85, cy - half * 0.65),
    ]
    for i in range(len(points) - 1):
        draw.line([points[i], points[i + 1]], fill=ICON_ACCENT, width=4)
    for px, py in points:
        r = 5
        draw.ellipse([px - r, py - r, px + r, py + r], fill=ICON_ACCENT)


def draw_grid_icon(draw, cx, cy, size=70):
    """Grid/table icon for เปิด Sheets."""
    s = size
    half = s // 2
    x0 = cx - half
    y0 = cy - half
    x1 = cx + half
    y1 = cy + half

    draw.rounded_rectangle([x0, y0, x1, y1], radius=6, outline=ICON_COLOR, width=3)

    header_h = s // 4
    draw.rectangle([x0 + 2, y0 + 2, x1 - 2, y0 + header_h], fill=ICON_ACCENT)

    col_w = s // 3
    draw.line([(x0 + col_w, y0 + header_h), (x0 + col_w, y1)], fill=ICON_COLOR, width=2)
    draw.line([(x0 + col_w * 2, y0 + header_h), (x0 + col_w * 2, y1)], fill=ICON_COLOR, width=2)

    row_h = (s - header_h) // 3
    for i in range(1, 3):
        ry = y0 + header_h + i * row_h
        draw.line([(x0, ry), (x1, ry)], fill=ICON_COLOR, width=2)


ICON_DRAWERS = [draw_document_icon, draw_refresh_icon, draw_line_chart_icon, draw_grid_icon]


# ---------------------------------------------------------------------------
# Build image
# ---------------------------------------------------------------------------

def draw_menu(buttons, drawers, output_name):
    img = Image.new("RGB", (WIDTH, HEIGHT), BG_COLOR)
    draw = ImageDraw.Draw(img)

    for idx, btn in enumerate(buttons):
        x0 = btn["col"] * CELL_W
        y0 = btn["row"] * CELL_H
        x1 = WIDTH if btn["col"] == NUM_COLS - 1 else x0 + CELL_W
        y1 = HEIGHT if btn["row"] == NUM_ROWS - 1 else y0 + CELL_H

        inner_margin = 6
        draw.rectangle(
            [x0 + inner_margin, y0 + inner_margin, x1 - inner_margin, y1 - inner_margin],
            fill=CELL_COLOR,
        )
        draw.rectangle([x0, y0, x1, y1], outline=BORDER_COLOR, width=3)

        cx = x0 + (x1 - x0) // 2
        cy = y0 + (y1 - y0) // 2

        icon_cy = cy - 48
        drawers[idx](draw, cx, icon_cy, size=66)

        thai_bbox = draw.textbbox((0, 0), btn["thai"], font=font_main)
        tw = thai_bbox[2] - thai_bbox[0]
        draw.text((cx - tw // 2, cy + 2), btn["thai"], fill=TEXT_COLOR, font=font_main)

        eng_bbox = draw.textbbox((0, 0), btn["eng"], font=font_sub)
        ew = eng_bbox[2] - eng_bbox[0]
        draw.text((cx - ew // 2, cy + 58), btn["eng"], fill=(170, 190, 215), font=font_sub)

    output_path = os.path.join(os.path.dirname(__file__), output_name)
    img.save(output_path, "PNG")
    print(f"Rich menu image saved: {output_path}")
    print(f"Size: {WIDTH}x{HEIGHT}")


draw_menu(BUTTONS, ICON_DRAWERS, "rich_menu.png")
