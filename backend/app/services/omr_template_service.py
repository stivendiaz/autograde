from __future__ import annotations

import json
import math
from typing import Any

from app.models import OMRTemplate

OPTION_LABELS = ["A", "B", "C", "D", "E", "F", "G", "H"]

# Page and margin constants (all in pixels at 150 DPI)
PAGE_W = 1700
PAGE_H = 2200
MARGIN = 80
MARKER_SIZE = 40

# Marker safe zone — no content touches the corner markers
MARKER_SAFE = 5
MARKER_BOTTOM = MARGIN + MARKER_SIZE  # 120 → bottom edge of top markers

# Header positions (all below top-marker safe zone)
TITLE_Y = MARKER_BOTTOM + MARKER_SAFE + 5             # 130 — title below markers
STUDENT_FIELD_Y = TITLE_Y + 55                         # 185 — student fields below title
STUDENT_FIELD_H = 44
INSTRUCTION_Y = STUDENT_FIELD_Y + STUDENT_FIELD_H + 25  # 254 — instructions below fields

# QR code position (right-aligned to page margin, below top-right marker)
QR_X = PAGE_W - MARGIN - 120
QR_Y = MARKER_BOTTOM + MARKER_SAFE + 10               # 135
QR_SIZE = 120

# Base content parameters (at scale 1.0 — used only for horizontal proportions)
BUBBLE_R = 18
BUBBLE_CX_OFFSET = 140
BUBBLE_GAP = 56
BOTTOM_PADDING = 40

# OMR-safe maximum bubble radius — larger bubbles for single-column layouts
MAX_BUBBLE_R = 54         # 108px diameter (single-column)
MAX_SCALE = 3.0
MAX_BUBBLE_R_MULTI = 48   # 96px diameter  (multi-column, ~11% smaller)
MAX_SCALE_MULTI = MAX_BUBBLE_R_MULTI / BUBBLE_R  # ~2.67

# Column spacing — fraction of available width reserved as gaps between columns
COLUMN_GAP_RATIO = 0.20  # 20% of page width used as gaps (10% each side for 2 cols)

GAP_AFTER_HEADER = 20
MIN_EDGE_GAP = 8  # minimum pixels between bubble edges vertically


def generate_omr_template(
    test_id: int, per_question_options: dict[int, int]
) -> OMRTemplate:
    layout = _build_layout(per_question_options)
    marker_config = _build_marker_config()
    return OMRTemplate(
        test_id=test_id,
        layout_json=json.dumps(layout),
        marker_config_json=json.dumps(marker_config),
        page_width=PAGE_W,
        page_height=PAGE_H,
    )


def _column_count(total_q: int) -> int:
    """Determine number of balanced columns based on question count."""
    if total_q <= 19:
        return 1
    elif total_q <= 40:
        return 2
    elif total_q <= 80:
        return 3
    else:
        return 4


def _compute_header_bottom() -> int:
    """Y-coordinate of the lowest pixel occupied by header elements."""
    return max(
        TITLE_Y + 50,                             # title text (~36pt)
        STUDENT_FIELD_Y + STUDENT_FIELD_H + 22,   # field label + rectangle
        QR_Y + QR_SIZE,                           # QR code bottom
        INSTRUCTION_Y + 30,                       # instruction text (~22pt)
    )


def _distribute_questions(
    sorted_qs: list[tuple[int, int]], num_cols: int
) -> list[list[tuple[int, int]]]:
    """Distribute questions evenly across columns (balanced, fill-first).

    21 questions, 2 columns → 11 + 10
    40 questions, 2 columns → 20 + 20
    """
    total_q = len(sorted_qs)
    base = total_q // num_cols
    remainder = total_q % num_cols

    cols: list[list[tuple[int, int]]] = []
    idx = 0
    for col in range(num_cols):
        count = base + (1 if col < remainder else 0)
        cols.append(sorted_qs[idx : idx + count])
        idx += count
    return cols


def _build_layout(per_question_options: dict[int, int]) -> dict[str, Any]:
    questions: list[dict[str, Any]] = []
    all_opts_set: set[str] = set()

    total_q = len(per_question_options)
    if total_q == 0:
        return {
            "page_width": PAGE_W,
            "page_height": PAGE_H,
            "margin": MARGIN,
            "markers": _marker_positions(),
            "title_area": {"y": TITLE_Y},
            "name_field": {"x": MARGIN, "y": STUDENT_FIELD_Y, "w": 600, "h": STUDENT_FIELD_H},
            "id_field": {"x": MARGIN + 700, "y": STUDENT_FIELD_Y, "w": 400, "h": STUDENT_FIELD_H},
            "instruction_area": {"y": INSTRUCTION_Y},
            "qr_code": {"x": QR_X, "y": QR_Y, "size": QR_SIZE},
            "bubble_radius": BUBBLE_R,
            "scale": 1.0,
            "separators": [],
            "option_labels": sorted(all_opts_set, key=lambda x: OPTION_LABELS.index(x)),
            "questions": [],
        }

    max_opts = max(per_question_options.values())
    num_cols = _column_count(total_q)
    max_q_per_col = math.ceil(total_q / num_cols)
    multi = num_cols > 1

    bubble_cap = MAX_BUBBLE_R_MULTI if multi else MAX_BUBBLE_R
    scale_cap = MAX_SCALE_MULTI if multi else MAX_SCALE

    # ── fixed page boundaries ──
    avail_w = PAGE_W - 2 * MARGIN
    header_bottom = _compute_header_bottom()
    safe_top = header_bottom + GAP_AFTER_HEADER
    safe_bottom = PAGE_H - MARGIN - MARKER_SIZE - BOTTOM_PADDING

    # ── column geometry (with inter-column gaps for multi-column layouts) ──
    if multi:
        total_gap = avail_w * COLUMN_GAP_RATIO
        gap_between = total_gap / (num_cols - 1)
        col_width = (avail_w - total_gap) / num_cols
    else:
        gap_between = 0
        col_width = avail_w

    # ── horizontal scale constraint ──
    base_content_w = (BUBBLE_CX_OFFSET - MARGIN) + (max_opts - 1) * BUBBLE_GAP + BUBBLE_R
    horiz_max_scale = min(scale_cap, col_width / base_content_w if base_content_w > 0 else scale_cap)

    # ── vertical scale constraint ──
    # Conservative estimate: use bubble_cap to reserve safe margins at top/bottom.
    est_first_cy = safe_top + bubble_cap
    est_last_cy = safe_bottom - bubble_cap

    if max_q_per_col > 1:
        target_row_gap = (est_last_cy - est_first_cy) / (max_q_per_col - 1)
    else:
        target_row_gap = float("inf")

    # target_row_gap >= 2 * BUBBLE_R * scale + MIN_EDGE_GAP  →  scale ≤ (gap - pad) / (2 * R)
    vert_max_r = max(0, (target_row_gap - MIN_EDGE_GAP) / 2) if target_row_gap > 0 else bubble_cap
    vert_max_scale = vert_max_r / BUBBLE_R if BUBBLE_R > 0 else 1.0
    vert_max_scale = max(0.3, vert_max_scale)

    # ── unified scale ──
    scale = min(horiz_max_scale, vert_max_scale)

    # ── apply scale to horizontal parameters ──
    scaled_r = round(BUBBLE_R * scale)
    scaled_gap = round(BUBBLE_GAP * scale)
    scaled_cx_rel = (BUBBLE_CX_OFFSET - MARGIN) * scale

    # Width of one bubble row (first bubble center to rightmost bubble edge)
    bubble_row_width = scaled_cx_rel + (max_opts - 1) * scaled_gap + scaled_r

    # ── vertical row distribution (zoom-to-fit) ──
    first_cy = safe_top + scaled_r
    last_cy = safe_bottom - scaled_r

    if max_q_per_col > 1:
        row_gap = (last_cy - first_cy) / (max_q_per_col - 1)
    else:
        row_gap = 0

    # ── column separator positions (for sheet generator) ──
    separators: list[dict[str, int]] = []
    if multi:
        for i in range(num_cols - 1):
            sep_x = round(MARGIN + (i + 1) * col_width + i * gap_between + gap_between / 2)
            separators.append({"x": sep_x, "y1": safe_top, "y2": safe_bottom})

    # ── build question/option coordinates ──
    sorted_qs = sorted(per_question_options.items())
    col_assignments = _distribute_questions(sorted_qs, num_cols)

    for col_idx, col_qs in enumerate(col_assignments):
        col_origin = MARGIN + col_idx * (col_width + gap_between)
        # Center bubble row horizontally within the column
        col_center = max(0, (col_width - bubble_row_width) / 2)

        for row, (qno, num_opts) in enumerate(col_qs):
            q_x = col_origin + col_center
            bubble_cy = round(first_cy + row * row_gap)

            opts = []
            for o in range(num_opts):
                label = OPTION_LABELS[o]
                cx = round(col_origin + col_center + scaled_cx_rel + o * scaled_gap)
                opts.append({"label": label, "cx": cx, "cy": bubble_cy, "r": scaled_r})
                all_opts_set.add(label)

            questions.append(
                {
                    "number": qno,
                    "column": col_idx + 1,
                    "x": round(q_x),
                    "y": bubble_cy + 6,
                    "options": opts,
                }
            )

    questions.sort(key=lambda q: q["number"])
    all_opts_sorted = sorted(all_opts_set, key=lambda x: OPTION_LABELS.index(x))

    return {
        "page_width": PAGE_W,
        "page_height": PAGE_H,
        "margin": MARGIN,
        "markers": _marker_positions(),
        "title_area": {"y": TITLE_Y},
        "name_field": {"x": MARGIN, "y": STUDENT_FIELD_Y, "w": 600, "h": STUDENT_FIELD_H},
        "id_field": {
            "x": MARGIN + 700,
            "y": STUDENT_FIELD_Y,
            "w": 400,
            "h": STUDENT_FIELD_H,
        },
        "instruction_area": {"y": INSTRUCTION_Y},
        "qr_code": {"x": QR_X, "y": QR_Y, "size": QR_SIZE},
        "bubble_radius": scaled_r,
        "scale": scale,
        "separators": separators,
        "option_labels": all_opts_sorted,
        "questions": questions,
    }


def _marker_positions():
    mr = MARKER_SIZE
    return {
        "top_left": {"x": MARGIN, "y": MARGIN, "size": mr},
        "top_right": {"x": PAGE_W - MARGIN - mr, "y": MARGIN, "size": mr},
        "bottom_left": {
            "x": MARGIN,
            "y": PAGE_H - MARGIN - mr,
            "size": mr,
        },
        "bottom_right": {
            "x": PAGE_W - MARGIN - mr,
            "y": PAGE_H - MARGIN - mr,
            "size": mr,
        },
    }


def _build_marker_config() -> dict[str, Any]:
    return {
        "type": "corner_boxes",
        "min_marker_area": MARKER_SIZE * MARKER_SIZE * 0.5,
        "max_marker_area": MARKER_SIZE * MARKER_SIZE * 2,
        "expected_positions": _marker_positions(),
    }


def layout_from_template(template: OMRTemplate) -> dict[str, Any]:
    return json.loads(template.layout_json)
