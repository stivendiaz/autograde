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

# ── Header layout (top markers moved below header) ──
TITLE_Y = 100
STUDENT_FIELD_Y = 210
STUDENT_FIELD_H = 70
STUDENT_FIELD_W_NAME = 700
STUDENT_FIELD_W_ID = 450
INSTRUCTION_Y = 360

# QR code (2x larger, right-aligned)
QR_SIZE = 240
QR_X = PAGE_W - MARGIN - QR_SIZE  # 1380
QR_Y = 90

# Top markers positioned below header, just above answer area
GAP_AFTER_HEADER = 20

# ── Base content parameters (at scale 1.0 — horizontal proportions) ──
BUBBLE_R = 18
BUBBLE_CX_OFFSET = 140
BUBBLE_GAP = 56
BOTTOM_PADDING = 40

# OMR-safe maximum bubble radius
MAX_BUBBLE_R = 54
MAX_SCALE = 3.0
MAX_BUBBLE_R_MULTI = 48
MAX_SCALE_MULTI = MAX_BUBBLE_R_MULTI / BUBBLE_R  # ~2.67

# Column spacing
COLUMN_GAP_RATIO = 0.20
MIN_EDGE_GAP = 8


def generate_omr_template(
    test_id: int, per_question_options: dict[int, int]
) -> OMRTemplate:
    layout = _build_layout(per_question_options)
    marker_config = {
        "type": "corner_boxes",
        "min_marker_area": MARKER_SIZE * MARKER_SIZE * 0.5,
        "max_marker_area": MARKER_SIZE * MARKER_SIZE * 2,
        "expected_positions": layout["markers"],
    }
    return OMRTemplate(
        test_id=test_id,
        layout_json=json.dumps(layout),
        marker_config_json=json.dumps(marker_config),
        page_width=PAGE_W,
        page_height=PAGE_H,
    )


def _column_count(total_q: int) -> int:
    if total_q <= 19:
        return 1
    elif total_q <= 40:
        return 2
    elif total_q <= 80:
        return 3
    else:
        return 4


def _compute_header_bottom() -> int:
    return max(
        TITLE_Y + 80,                              # title (~60pt)
        STUDENT_FIELD_Y + STUDENT_FIELD_H + 32,     # field label + rect + gap
        QR_Y + QR_SIZE,                            # QR code bottom
        INSTRUCTION_Y + 42,                        # instruction text (~32pt)
    )


def _distribute_questions(
    sorted_qs: list[tuple[int, int]], num_cols: int
) -> list[list[tuple[int, int]]]:
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


def _marker_positions(top_y: int) -> dict[str, Any]:
    mr = MARKER_SIZE
    return {
        "top_left": {"x": MARGIN, "y": top_y, "size": mr},
        "top_right": {"x": PAGE_W - MARGIN - mr, "y": top_y, "size": mr},
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


def _build_layout(per_question_options: dict[int, int]) -> dict[str, Any]:
    questions: list[dict[str, Any]] = []
    all_opts_set: set[str] = set()

    total_q = len(per_question_options)
    header_bottom = _compute_header_bottom()
    marker_top_y = header_bottom + GAP_AFTER_HEADER

    if total_q == 0:
        return {
            "page_width": PAGE_W,
            "page_height": PAGE_H,
            "margin": MARGIN,
            "markers": _marker_positions(marker_top_y),
            "title_area": {"y": TITLE_Y},
            "name_field": {"x": MARGIN, "y": STUDENT_FIELD_Y, "w": STUDENT_FIELD_W_NAME, "h": STUDENT_FIELD_H},
            "id_field": {"x": MARGIN + 730, "y": STUDENT_FIELD_Y, "w": STUDENT_FIELD_W_ID, "h": STUDENT_FIELD_H},
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

    # ── answer area boundaries (below relocated top markers) ──
    avail_w = PAGE_W - 2 * MARGIN
    safe_bottom = PAGE_H - MARGIN - MARKER_SIZE - BOTTOM_PADDING
    question_area_top = marker_top_y + MARKER_SIZE + 20

    # ── column geometry ──
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
    est_first_cy = question_area_top + bubble_cap
    est_last_cy = safe_bottom - bubble_cap

    if max_q_per_col > 1:
        target_row_gap = (est_last_cy - est_first_cy) / (max_q_per_col - 1)
    else:
        target_row_gap = float("inf")

    vert_max_r = max(0, (target_row_gap - MIN_EDGE_GAP) / 2) if target_row_gap > 0 else bubble_cap
    vert_max_scale = vert_max_r / BUBBLE_R if BUBBLE_R > 0 else 1.0
    vert_max_scale = max(0.3, vert_max_scale)

    # ── unified scale ──
    scale = min(horiz_max_scale, vert_max_scale)

    # ── apply scale ──
    scaled_r = round(BUBBLE_R * scale)
    scaled_gap = round(BUBBLE_GAP * scale)
    scaled_cx_rel = (BUBBLE_CX_OFFSET - MARGIN) * scale
    bubble_row_width = scaled_cx_rel + (max_opts - 1) * scaled_gap + scaled_r

    # ── vertical row distribution ──
    first_cy = question_area_top + scaled_r
    last_cy = safe_bottom - scaled_r

    if max_q_per_col > 1:
        row_gap = (last_cy - first_cy) / (max_q_per_col - 1)
    else:
        row_gap = 0

    # ── separators ──
    separators: list[dict[str, int]] = []
    if multi:
        for i in range(num_cols - 1):
            sep_x = round(MARGIN + (i + 1) * col_width + i * gap_between + gap_between / 2)
            separators.append({"x": sep_x, "y1": question_area_top, "y2": safe_bottom})

    # ── build questions ──
    sorted_qs = sorted(per_question_options.items())
    col_assignments = _distribute_questions(sorted_qs, num_cols)

    for col_idx, col_qs in enumerate(col_assignments):
        col_origin = MARGIN + col_idx * (col_width + gap_between)
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
        "markers": _marker_positions(marker_top_y),
        "title_area": {"y": TITLE_Y},
        "name_field": {"x": MARGIN, "y": STUDENT_FIELD_Y, "w": STUDENT_FIELD_W_NAME, "h": STUDENT_FIELD_H},
        "id_field": {
            "x": MARGIN + 730,
            "y": STUDENT_FIELD_Y,
            "w": STUDENT_FIELD_W_ID,
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


def layout_from_template(template: OMRTemplate) -> dict[str, Any]:
    return json.loads(template.layout_json)
