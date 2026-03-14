"""
Generate LINE Rich Menu image (2500x843) for ATE Sales Report Bot.
4 buttons in a 2x2 grid with hand-drawn icons.

Usage:
  python3 generate_rich_menu_image.py
  → Outputs: rich_menu.png
"""

from PIL import Image, ImageDraw, ImageFont
import os

WIDTH = 2500
HEIGHT = 843
COLS = 2
ROWS = 2

# Colors (ATE brand: dark blue base)
BG_COLOR = (26, 54, 93)
CELL_COLOR = (32, 62, 105)
BORDER_COLOR = (40, 75, 120)
TEXT_COLOR = (255, 255, 255)
ICON_COLOR = (130, 180, 255)       # Light blue for icons
ICON_ACCENT = (100, 220, 160)      # Green accent

# Button definitions
BUTTONS = [
    ("สรุปยอด", "Monthly Summary"),
    ("วิธีรายงาน", "How to Report"),
    ("เปิด Dashboard", "Looker Studio"),
    ("เปิด Sheets", "Google Sheets"),
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
    font_main = ImageFont.truetype(font_path, 60) if font_path else ImageFont.load_default()
    font_sub = ImageFont.truetype(font_path, 34) if font_path else ImageFont.load_default()
except Exception:
    font_main = ImageFont.load_default()
    font_sub = ImageFont.load_default()


# ---------------------------------------------------------------------------
# Icon drawing functions (drawn at center cx, cy-offset)
# ---------------------------------------------------------------------------

def draw_bar_chart_icon(draw, cx, cy, size=70):
    """Bar chart icon for สรุปยอด."""
    s = size
    # Three bars of different heights
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

    # Base line
    draw.line([(cx - total_w // 2 - 8, cy + s // 2 + 2),
               (cx + total_w // 2 + 8, cy + s // 2 + 2)], fill=ICON_COLOR, width=3)


def draw_document_icon(draw, cx, cy, size=70):
    """Document with pen icon for วิธีรายงาน."""
    s = size
    # Document rectangle
    doc_w = s * 2 // 3
    doc_h = s
    x0 = cx - doc_w // 2
    y0 = cy - doc_h // 2

    # Document body
    draw.rounded_rectangle([x0, y0, x0 + doc_w, y0 + doc_h], radius=6, outline=ICON_COLOR, width=3)

    # Text lines inside document
    line_margin = doc_w // 5
    line_y_start = y0 + doc_h // 4
    for i in range(3):
        ly = line_y_start + i * (doc_h // 5)
        lw = doc_w - line_margin * 2 if i < 2 else doc_w // 2 - line_margin
        draw.line([(x0 + line_margin, ly), (x0 + line_margin + lw, ly)], fill=ICON_COLOR, width=3)

    # Pencil (small diagonal line at bottom-right corner)
    px = x0 + doc_w + 4
    py = y0 + doc_h - 4
    pen_len = s // 3
    draw.line([(px, py), (px - pen_len, py - pen_len)], fill=ICON_ACCENT, width=4)
    # Pencil tip
    draw.polygon([(px, py), (px - 5, py - 8), (px - 8, py - 5)], fill=ICON_ACCENT)


def draw_line_chart_icon(draw, cx, cy, size=70):
    """Line chart icon for เปิด Dashboard."""
    s = size
    half = s // 2

    # Axes
    ax_x = cx - half
    ax_y = cy + half
    draw.line([(ax_x, cy - half), (ax_x, ax_y)], fill=ICON_COLOR, width=3)
    draw.line([(ax_x, ax_y), (cx + half, ax_y)], fill=ICON_COLOR, width=3)

    # Upward trend line with points
    points = [
        (ax_x + s * 0.1, cy + half * 0.5),
        (ax_x + s * 0.35, cy - half * 0.1),
        (ax_x + s * 0.6, cy + half * 0.15),
        (ax_x + s * 0.85, cy - half * 0.65),
    ]
    # Draw line
    for i in range(len(points) - 1):
        draw.line([points[i], points[i + 1]], fill=ICON_ACCENT, width=4)
    # Draw dots
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

    # Outer rectangle
    draw.rounded_rectangle([x0, y0, x1, y1], radius=6, outline=ICON_COLOR, width=3)

    # Header row (filled)
    header_h = s // 4
    draw.rectangle([x0 + 2, y0 + 2, x1 - 2, y0 + header_h], fill=ICON_ACCENT)

    # Vertical lines (3 columns)
    col_w = s // 3
    draw.line([(x0 + col_w, y0 + header_h), (x0 + col_w, y1)], fill=ICON_COLOR, width=2)
    draw.line([(x0 + col_w * 2, y0 + header_h), (x0 + col_w * 2, y1)], fill=ICON_COLOR, width=2)

    # Horizontal lines (rows)
    row_h = (s - header_h) // 3
    for i in range(1, 3):
        ry = y0 + header_h + i * row_h
        draw.line([(x0, ry), (x1, ry)], fill=ICON_COLOR, width=2)


ICON_DRAWERS = [draw_bar_chart_icon, draw_document_icon, draw_line_chart_icon, draw_grid_icon]


# ---------------------------------------------------------------------------
# Build image
# ---------------------------------------------------------------------------

img = Image.new("RGB", (WIDTH, HEIGHT), BG_COLOR)
draw = ImageDraw.Draw(img)

cell_w = WIDTH // COLS
cell_h = HEIGHT // ROWS

for idx, (thai, eng) in enumerate(BUTTONS):
    col = idx % COLS
    row = idx // COLS

    x0 = col * cell_w
    y0 = row * cell_h
    x1 = x0 + cell_w
    y1 = y0 + cell_h

    # Cell background
    inner_margin = 6
    draw.rectangle([x0 + inner_margin, y0 + inner_margin, x1 - inner_margin, y1 - inner_margin],
                   fill=CELL_COLOR)

    # Border lines
    draw.line([(x1, y0), (x1, y1)], fill=BORDER_COLOR, width=3)
    draw.line([(x0, y1), (x1, y1)], fill=BORDER_COLOR, width=3)

    cx = x0 + cell_w // 2
    cy = y0 + cell_h // 2

    # Draw icon (centered above text)
    icon_cy = cy - 65
    ICON_DRAWERS[idx](draw, cx, icon_cy, size=80)

    # Draw Thai label
    thai_bbox = draw.textbbox((0, 0), thai, font=font_main)
    tw = thai_bbox[2] - thai_bbox[0]
    draw.text((cx - tw // 2, cy + 20), thai, fill=TEXT_COLOR, font=font_main)

    # Draw English subtitle
    eng_bbox = draw.textbbox((0, 0), eng, font=font_sub)
    ew = eng_bbox[2] - eng_bbox[0]
    draw.text((cx - ew // 2, cy + 85), eng, fill=(170, 190, 215), font=font_sub)

output_path = os.path.join(os.path.dirname(__file__), "rich_menu.png")
img.save(output_path, "PNG")
print(f"Rich menu image saved: {output_path}")
print(f"Size: {WIDTH}x{HEIGHT}")
