from __future__ import annotations

import json
import math
import tempfile
from pathlib import Path
from typing import Any

import cv2
import numpy as np
from PIL import Image

from app.models import OMRTemplate
from app.services.omr_template_service import layout_from_template


def grade_sheet(
    image_path: str, template: OMRTemplate, answer_key: dict[str, str]
) -> dict[str, Any]:
    layout = layout_from_template(template)
    img = cv2.imread(image_path, cv2.IMREAD_GRAYSCALE)
    if img is None:
        raise ValueError(f"Cannot read image: {image_path}")

    img = _align_and_crop(img, layout)
    if img is None:
        raise ValueError("No markers detected")

    questions = layout["questions"]
    detected: dict[str, str] = {}
    per_question: list[dict[str, Any]] = []

    for q in questions:
        qno = str(q["number"])
        option_responses: list[tuple[str, float]] = []

        for opt in q["options"]:
            cx, cy, r = opt["cx"], opt["cy"], opt["r"]
            bubble_mean = _read_bubble(img, cx, cy, r)
            option_responses.append((opt["label"], bubble_mean))

        chosen = _detect_filled(option_responses)
        detected[qno] = chosen if chosen is not None else ""

        expected = answer_key.get(qno, "")
        is_correct = chosen == expected if chosen else False

        per_question.append(
            {
                "question": int(qno),
                "detected": detected[qno],
                "expected": expected,
                "correct": is_correct,
                "blank": chosen is None,
            }
        )

    correct_count = sum(1 for pq in per_question if pq["correct"])
    incorrect_count = sum(
        1 for pq in per_question if not pq["correct"] and not pq["blank"]
    )
    blank_count = sum(1 for pq in per_question if pq["blank"])

    return {
        "detected_answers": detected,
        "score": correct_count,
        "total_questions": len(questions),
        "correct_count": correct_count,
        "incorrect_count": incorrect_count,
        "blank_count": blank_count,
        "per_question": per_question,
    }


def validate_has_markers(image_path: str, template: OMRTemplate) -> bool:
    """Quick check: does this image contain the expected OMR corner markers?"""
    img = cv2.imread(image_path, cv2.IMREAD_GRAYSCALE)
    if img is None:
        return False
    layout = layout_from_template(template)
    markers = layout.get("markers", {})
    if not markers:
        return False
    result = _find_valid_markers(img, markers, layout["page_width"], layout["page_height"])
    return result is not None and len(result) == 4


def get_corrected_pil_image(image_path: str, template: OMRTemplate) -> Image.Image:
    """Load, align, and perspective-correct an image, returning a PIL Image."""
    img = cv2.imread(image_path, cv2.IMREAD_GRAYSCALE)
    if img is None:
        raise ValueError(f"Cannot read image: {image_path}")
    layout = layout_from_template(template)
    warped = _align_and_crop(img, layout)
    if warped is None:
        raise ValueError("No markers detected")
    return Image.fromarray(warped).convert("RGB")


def _align_and_crop(
    img: np.ndarray, layout: dict
) -> np.ndarray | None:
    pw, ph = layout["page_width"], layout["page_height"]
    markers = layout.get("markers", {})

    expected_pts = []
    for key in ("top_left", "top_right", "bottom_left", "bottom_right"):
        m = markers[key]
        expected_pts.append([m["x"] + m["size"] // 2, m["y"] + m["size"] // 2])
    expected_pts = np.array(expected_pts, dtype=np.float32)

    detected_pts = _find_valid_markers(img, markers, pw, ph)
    if detected_pts is None or len(detected_pts) != 4:
        return None

    detected_pts = np.array(detected_pts, dtype=np.float32)
    matrix = cv2.getPerspectiveTransform(detected_pts, expected_pts)
    warped = cv2.warpPerspective(img, matrix, (pw, ph))
    return warped


def _find_valid_markers(
    img: np.ndarray, markers: dict, page_w: int, page_h: int
) -> list[list[int]] | None:
    """
    Find 4 corner markers in the image.  Returns their center coordinates
    in image pixel space, or None if any marker cannot be reliably located.
    """
    h, w = img.shape[:2]
    scale_x = w / page_w
    scale_y = h / page_h

    _, thresh = cv2.threshold(img, 127, 255, cv2.THRESH_BINARY_INV)
    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    min_area = 10 * 10
    boxes: list[tuple[list[int], float]] = []
    for cnt in contours:
        area = cv2.contourArea(cnt)
        if area < min_area:
            continue
        bx, by, bw, bh = cv2.boundingRect(cnt)
        aspect = max(bw, bh) / min(bw, bh) if min(bw, bh) > 0 else 99
        if aspect > 2.5:
            continue
        centroid = [bx + bw // 2, by + bh // 2]
        boxes.append((centroid, area))

    if len(boxes) < 4:
        return None

    corner_names = ["top_left", "top_right", "bottom_left", "bottom_right"]

    # Scale expected positions to image coordinate space
    expected_scaled = {}
    for key in corner_names:
        m = markers[key]
        ex = (m["x"] + m["size"] // 2) * scale_x
        ey = (m["y"] + m["size"] // 2) * scale_y
        expected_scaled[key] = (ex, ey)

    # Maximum allowed distance: 15% of the page diagonal in image space
    max_dist = math.hypot(w, h) * 0.15

    result = []
    used_indices: set[int] = set()
    for key in corner_names:
        ex, ey = expected_scaled[key]
        best_idx = -1
        best_dist = float("inf")
        for i, (centroid, _) in enumerate(boxes):
            if i in used_indices:
                continue
            d = math.hypot(centroid[0] - ex, centroid[1] - ey)
            if d < best_dist:
                best_dist = d
                best_idx = i
        if best_idx < 0 or best_dist > max_dist:
            return None
        used_indices.add(best_idx)
        result.append(boxes[best_idx][0])

    # Verify the 4 points form a reasonable quadrilateral (not all on same line)
    pts = np.array(result, dtype=np.float32)
    hull = cv2.convexHull(pts)
    if hull is None or len(hull) < 4:
        return None
    hull_area = cv2.contourArea(hull)
    image_area = w * h
    if hull_area < image_area * 0.1:
        return None

    return result


def _read_bubble(img: np.ndarray, cx: int, cy: int, r: int) -> float:
    mask = np.zeros(img.shape, dtype=np.uint8)
    cv2.circle(mask, (cx, cy), r, 255, -1)
    mean_val = cv2.mean(img, mask)[0]
    return mean_val


def _detect_filled(
    option_responses: list[tuple[str, float]],
) -> str | None:
    if not option_responses:
        return None

    vals = [v for _, v in option_responses]
    min_val = min(vals)
    max_val = max(vals)
    range_val = max_val - min_val

    if range_val < 15:
        return None

    threshold = min_val + range_val * 0.4
    filled = [label for label, v in option_responses if v < threshold]

    if len(filled) == 1:
        return filled[0]

    if len(filled) == 0:
        return None

    return None
