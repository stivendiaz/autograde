from __future__ import annotations

import json
import math
from typing import Any

from app.models import OMRTemplate

OPTION_LABELS = ["A", "B", "C", "D", "E", "F", "G", "H"]

# Layout constants (all in pixels at 150 DPI)
PAGE_W = 1700
PAGE_H = 2200
MARGIN = 80
TITLE_Y = 80
STUDENT_FIELD_Y = 160
STUDENT_FIELD_H = 60
INSTRUCTION_Y = 270
QUESTION_START_Y = 340
QUESTION_H = 64
BUBBLE_R = 18
BUBBLE_CX_OFFSET = 180
BUBBLE_GAP = 56
MARKER_SIZE = 40
BOTTOM_PADDING = 40


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


def _max_per_col() -> int:
    bottom = PAGE_H - MARGIN - MARKER_SIZE - BOTTOM_PADDING
    return (bottom - QUESTION_START_Y) // QUESTION_H


def _physical_max_cols(max_options: int) -> int:
    """Maximum number of columns that can fit horizontally given the max option count."""
    avail = PAGE_W - 2 * MARGIN
    for n in range(10, 0, -1):
        col_w = avail / n
        last_col_x = MARGIN + (n - 1) * col_w
        first_bubble = last_col_x + (BUBBLE_CX_OFFSET - MARGIN)
        last_right = first_bubble + (max_options - 1) * BUBBLE_GAP + 2 * BUBBLE_R
        if last_right <= PAGE_W - MARGIN:
            return n
    return 1


def _build_layout(per_question_options: dict[int, int]) -> dict[str, Any]:
    questions = []
    all_opts_set: set[str] = set()

    total_q = len(per_question_options)
    max_opts = max(per_question_options.values())
    q_per_col = _max_per_col()
    cols_needed = max(1, (total_q + q_per_col - 1) // q_per_col)
    num_cols = min(cols_needed, _physical_max_cols(max_opts))
    col_width = (PAGE_W - 2 * MARGIN) / num_cols

    col_idx = 0
    row_in_col = 0

    for qno in sorted(per_question_options):
        num_opts = per_question_options[qno]
        col_x = MARGIN + col_idx * col_width
        q_x = col_x + 10
        q_y = QUESTION_START_Y + row_in_col * QUESTION_H + 6
        bubble_cy = QUESTION_START_Y + row_in_col * QUESTION_H

        opts = []
        for o in range(num_opts):
            label = OPTION_LABELS[o]
            cx = round(col_x + (BUBBLE_CX_OFFSET - MARGIN) + o * BUBBLE_GAP)
            opts.append({"label": label, "cx": cx, "cy": bubble_cy, "r": BUBBLE_R})
            all_opts_set.add(label)

        questions.append(
            {
                "number": qno,
                "column": col_idx + 1,
                "x": round(q_x),
                "y": q_y,
                "options": opts,
            }
        )

        row_in_col += 1
        if row_in_col >= q_per_col:
            col_idx += 1
            row_in_col = 0

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
        "bubble_radius": BUBBLE_R,
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
