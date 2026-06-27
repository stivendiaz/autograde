from __future__ import annotations

import math
import os
from pathlib import Path
from typing import Any

import cv2
import numpy as np
from PIL import Image

from app.models import OMRTemplate
from app.services.omr_template_service import layout_from_template


class GradingError(Exception):
    pass


class MarkerNotFoundError(GradingError):
    pass


class AlignmentError(GradingError):
    pass


CLAHE_HELPER = cv2.createCLAHE(clipLimit=5.0, tileGridSize=(8, 8))

MIN_MARKER_AREA_FACTOR = 0.0002
MAX_MARKER_AREA_FACTOR = 0.01
MARKER_ASPECT_TOLERANCE = 2.5
MARKER_SEARCH_RADIUS_FACTOR = 0.20
MIN_CONTOUR_AREA = 50
COSINE_THRESHOLD = 0.35
APPROX_POLY_EPSILON = 0.04

MIN_JUMP = 15
CONFIDENT_SURPLUS = 10
GLOBAL_DEFAULT_THRESHOLD = 128

DEBUG_DIR = Path(__file__).parent.parent / "storage" / "debug"


def grade_sheet(
    image_path: str, template: OMRTemplate, answer_key: dict[str, str]
) -> dict[str, Any]:
    layout = layout_from_template(template)
    img = cv2.imread(image_path, cv2.IMREAD_GRAYSCALE)
    if img is None:
        raise GradingError(f"Cannot read image: {image_path}")

    preprocessed = _preprocess(img)
    detected_pts = _find_markers(preprocessed, layout)
    if detected_pts is None:
        raise MarkerNotFoundError(
            "Could not detect OMR markers. Please retake the photo ensuring all four corner markers are visible."
        )

    warped = _warp_to_template(img, detected_pts, layout)
    if warped is None:
        raise AlignmentError("Perspective correction failed. Please retake the photo.")

    warped_preprocessed = _preprocess(warped)

    questions = layout["questions"]
    detected: dict[str, str] = {}
    per_question: list[dict[str, Any]] = []
    bubble_scores: dict[str, list[tuple[str, float]]] = {}

    for q in questions:
        qno = str(q["number"])
        option_responses: list[tuple[str, float]] = []

        for opt in q["options"]:
            cx, cy, r = opt["cx"], opt["cy"], opt["r"]
            bubble_mean = _read_bubble(warped_preprocessed, cx, cy, r)
            option_responses.append((opt["label"], bubble_mean))

        bubble_scores[qno] = option_responses
        chosen = _detect_filled_adaptive(option_responses)
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
        "bubble_scores": bubble_scores,
    }


def validate_has_markers(image_path: str, template: OMRTemplate) -> bool:
    img = cv2.imread(image_path, cv2.IMREAD_GRAYSCALE)
    if img is None:
        return False
    layout = layout_from_template(template)
    preprocessed = _preprocess(img)
    result = _find_markers(preprocessed, layout)
    return result is not None and len(result) == 4


def get_corrected_pil_image(image_path: str, template: OMRTemplate) -> Image.Image:
    img = cv2.imread(image_path, cv2.IMREAD_GRAYSCALE)
    if img is None:
        raise GradingError(f"Cannot read image: {image_path}")
    layout = layout_from_template(template)
    preprocessed = _preprocess(img)
    detected_pts = _find_markers(preprocessed, layout)
    if detected_pts is None:
        raise MarkerNotFoundError("No markers detected")
    warped = _warp_to_template(img, detected_pts, layout)
    if warped is None:
        raise AlignmentError("Perspective correction failed")
    return Image.fromarray(warped).convert("RGB")


def generate_debug_image(
    image_path: str,
    template: OMRTemplate,
    result: dict[str, Any],
    answer_key: dict[str, str],
) -> Image.Image | None:
    img = cv2.imread(image_path, cv2.IMREAD_GRAYSCALE)
    if img is None:
        return None
    layout = layout_from_template(template)
    preprocessed = _preprocess(img)
    detected_pts = _find_markers(preprocessed, layout)
    if detected_pts is None:
        return None
    warped = _warp_to_template(img, detected_pts, layout)
    if warped is None:
        return None

    debug = _build_debug_composite(img, detected_pts, warped, layout, result, answer_key)
    return debug


def _preprocess(img: np.ndarray) -> np.ndarray:
    blurred = cv2.GaussianBlur(img, (5, 5), 0)
    return blurred


def _find_markers(
    img: np.ndarray, layout: dict
) -> list[list[int]] | None:
    pw, ph = layout["page_width"], layout["page_height"]
    markers = layout.get("markers", {})
    if not markers:
        return None

    strategies = [
        _find_markers_otsu,
        _find_markers_adaptive,
        _find_markers_multi_threshold,
    ]

    for strategy in strategies:
        result = strategy(img, markers, pw, ph)
        if result is not None and len(result) == 4:
            return result

    return None


def _find_markers_otsu(
    img: np.ndarray, markers: dict, pw: int, ph: int
) -> list[list[int]] | None:
    _, thresh = cv2.threshold(img, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    return _match_markers_to_expected(thresh, markers, pw, ph, img.shape[:2])


def _find_markers_adaptive(
    img: np.ndarray, markers: dict, pw: int, ph: int
) -> list[list[int]] | None:
    thresh = cv2.adaptiveThreshold(
        img, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 21, 5
    )
    return _match_markers_to_expected(thresh, markers, pw, ph, img.shape[:2])


def _find_markers_multi_threshold(
    img: np.ndarray, markers: dict, pw: int, ph: int
) -> list[list[int]] | None:
    for t in [100, 120, 140, 160, 180]:
        _, thresh = cv2.threshold(img, t, 255, cv2.THRESH_BINARY_INV)
        result = _match_markers_to_expected(thresh, markers, pw, ph, img.shape[:2])
        if result is not None and len(result) == 4:
            return result
    return None


def _match_markers_to_expected(
    thresh: np.ndarray, markers: dict, pw: int, ph: int, img_shape: tuple
) -> list[list[int]] | None:
    h, w = img_shape[:2]
    scale_x = w / pw
    scale_y = h / ph

    contours, hierarchy = cv2.findContours(
        thresh, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE
    )

    img_area = w * h
    min_area = img_area * MIN_MARKER_AREA_FACTOR
    max_area = img_area * MAX_MARKER_AREA_FACTOR

    candidates: list[tuple[list[int], float]] = []

    if contours is not None and hierarchy is not None:
        hierarchy = hierarchy[0]
        for i, cnt in enumerate(contours):
            area = cv2.contourArea(cnt)
            if area < min_area or area > max_area:
                continue

            peri = cv2.arcLength(cnt, True)
            approx = cv2.approxPolyDP(cnt, APPROX_POLY_EPSILON * peri, True)

            if len(approx) < 4:
                bx, by, bw, bh = cv2.boundingRect(cnt)
                aspect = max(bw, bh) / min(bw, bh) if min(bw, bh) > 0 else 99
                if aspect > MARKER_ASPECT_TOLERANCE:
                    continue
                centroid = [bx + bw // 2, by + bh // 2]
            else:
                if not _is_approx_rectangular(approx):
                    bx, by, bw, bh = cv2.boundingRect(cnt)
                    aspect = max(bw, bh) / min(bw, bh) if min(bw, bh) > 0 else 99
                    if aspect > MARKER_ASPECT_TOLERANCE:
                        continue
                centroid = [int(np.mean(approx[:, 0, 0])), int(np.mean(approx[:, 0, 1]))]

            has_inner = False
            if hierarchy is not None and hierarchy[i][2] >= 0:
                child_idx = hierarchy[i][2]
                child_area = cv2.contourArea(contours[child_idx])
                ratio = child_area / area if area > 0 else 0
                if 0.02 < ratio < 0.5:
                    has_inner = True

            confidence = 1.5 if has_inner else 1.0
            candidates.append((centroid, confidence))

    if len(candidates) < 4:
        _, thresh_external = cv2.threshold(
            thresh, 0, 255, cv2.THRESH_BINARY
        )
        contours_ext, _ = cv2.findContours(
            thresh_external, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
        )
        if contours_ext is not None:
            for cnt in contours_ext:
                area = cv2.contourArea(cnt)
                if area < min_area or area > max_area:
                    continue
                bx, by, bw, bh = cv2.boundingRect(cnt)
                aspect = max(bw, bh) / min(bw, bh) if min(bw, bh) > 0 else 99
                if aspect > MARKER_ASPECT_TOLERANCE:
                    continue
                centroid = [bx + bw // 2, by + bh // 2]
                already_near = False
                for existing_c, _ in candidates:
                    if math.hypot(centroid[0] - existing_c[0], centroid[1] - existing_c[1]) < min_area ** 0.5:
                        already_near = True
                        break
                if not already_near:
                    candidates.append((centroid, 0.8))

    if len(candidates) < 4:
        return None

    corner_names = ["top_left", "top_right", "bottom_left", "bottom_right"]
    expected_scaled = {}
    for key in corner_names:
        m = markers[key]
        ex = (m["x"] + m["size"] // 2) * scale_x
        ey = (m["y"] + m["size"] // 2) * scale_y
        expected_scaled[key] = (ex, ey)

    max_dist = math.hypot(w, h) * MARKER_SEARCH_RADIUS_FACTOR

    result = []
    used_indices: set[int] = set()
    for key in corner_names:
        ex, ey = expected_scaled[key]
        best_idx = -1
        best_score = float("inf")
        for i, (centroid, confidence) in enumerate(candidates):
            if i in used_indices:
                continue
            d = math.hypot(centroid[0] - ex, centroid[1] - ey)
            score = d / confidence
            if score < best_score:
                best_score = score
                best_idx = i
        if best_idx < 0 or best_score > max_dist:
            return None
        used_indices.add(best_idx)
        result.append(candidates[best_idx][0])

    pts = np.array(result, dtype=np.float32)
    hull = cv2.convexHull(pts)
    if hull is None or len(hull) < 4:
        return None
    hull_area = cv2.contourArea(hull)
    if hull_area < img_area * 0.05:
        return None

    return result


def _is_approx_rectangular(approx: np.ndarray) -> bool:
    if len(approx) != 4:
        return False
    pts = approx.reshape(4, 2)
    max_cosine = 0.0
    for i in range(2, 5):
        cosine = abs(_angle(pts[i % 4], pts[i - 2], pts[i - 1]))
        max_cosine = max(cosine, max_cosine)
    return max_cosine < COSINE_THRESHOLD


def _angle(p1: np.ndarray, p2: np.ndarray, p0: np.ndarray) -> float:
    dx1 = float(p1[0] - p0[0])
    dy1 = float(p1[1] - p0[1])
    dx2 = float(p2[0] - p0[0])
    dy2 = float(p2[1] - p0[1])
    denom = math.sqrt((dx1 * dx1 + dy1 * dy1) * (dx2 * dx2 + dy2 * dy2) + 1e-10)
    return (dx1 * dx2 + dy1 * dy2) / denom


def _order_points(pts: np.ndarray) -> np.ndarray:
    rect = np.zeros((4, 2), dtype="float32")
    s = pts.sum(axis=1)
    rect[0] = pts[np.argmin(s)]
    rect[2] = pts[np.argmax(s)]
    diff = np.diff(pts, axis=1)
    rect[1] = pts[np.argmin(diff)]
    rect[3] = pts[np.argmax(diff)]
    return rect


def _warp_to_template(
    img: np.ndarray, detected_pts: list[list[int]], layout: dict
) -> np.ndarray | None:
    pw, ph = layout["page_width"], layout["page_height"]
    markers = layout.get("markers", {})

    expected_pts = []
    for key in ("top_left", "top_right", "bottom_left", "bottom_right"):
        m = markers[key]
        expected_pts.append([m["x"] + m["size"] // 2, m["y"] + m["size"] // 2])

    src = _order_points(np.array(detected_pts, dtype=np.float32))
    dst = _order_points(np.array(expected_pts, dtype=np.float32))

    try:
        matrix = cv2.getPerspectiveTransform(src, dst)
        warped = cv2.warpPerspective(img, matrix, (pw, ph))
        return warped
    except cv2.error:
        return None


def _read_bubble(img: np.ndarray, cx: int, cy: int, r: int) -> float:
    h, w = img.shape[:2]
    x1 = max(0, cx - r)
    y1 = max(0, cy - r)
    x2 = min(w, cx + r)
    y2 = min(h, cy + r)

    if x2 <= x1 or y2 <= y1:
        return 255.0

    roi = img[y1:y2, x1:x2]
    mask = np.zeros((y2 - y1, x2 - x1), dtype=np.uint8)
    local_cx = cx - x1
    local_cy = cy - y1
    cv2.circle(mask, (local_cx, local_cy), r, 255, -1)
    mean_val = cv2.mean(roi, mask)[0]
    return mean_val


def _detect_filled_adaptive(
    option_responses: list[tuple[str, float]],
) -> str | None:
    if not option_responses:
        return None

    vals = [v for _, v in option_responses]
    min_val = min(vals)
    max_val = max(vals)
    range_val = max_val - min_val

    if range_val < MIN_JUMP:
        return None

    sorted_vals = sorted(vals)
    max_gap = 0
    threshold = GLOBAL_DEFAULT_THRESHOLD

    for i in range(len(sorted_vals) - 1):
        gap = sorted_vals[i + 1] - sorted_vals[i]
        if gap > max_gap:
            max_gap = gap
            threshold = sorted_vals[i] + gap / 2

    if max_gap < MIN_JUMP:
        threshold = min_val + range_val * 0.4

    filled = [label for label, v in option_responses if v < threshold]

    if len(filled) == 1:
        return filled[0]

    if len(filled) == 0:
        return None

    return None


def _build_debug_composite(
    original: np.ndarray,
    detected_pts: list[list[int]],
    warped: np.ndarray,
    layout: dict,
    result: dict[str, Any],
    answer_key: dict[str, str],
) -> Image.Image:
    orig_color = cv2.cvtColor(original, cv2.COLOR_GRAY2BGR)
    for i, pt in enumerate(detected_pts):
        cv2.circle(orig_color, (pt[0], pt[1]), 15, (0, 255, 0), -1)
        cv2.putText(
            orig_color,
            ["TL", "TR", "BL", "BR"][i],
            (pt[0] + 20, pt[1]),
            cv2.FONT_HERSHEY_SIMPLEX,
            1.5,
            (0, 255, 0),
            3,
        )

    warped_color = cv2.cvtColor(warped, cv2.COLOR_GRAY2BGR)

    bubble_scores = result.get("bubble_scores", {})
    detected_answers = result.get("detected_responses", {})

    for q in layout.get("questions", []):
        qno = str(q["number"])
        chosen = detected_answers.get(qno, "")
        expected = answer_key.get(qno, "")

        for opt in q.get("options", []):
            cx, cy, r = opt["cx"], opt["cy"], opt["r"]
            label = opt["label"]

            scores = bubble_scores.get(qno, [])
            score = next((s for l, s in scores if l == label), None)

            if label == chosen and label == expected:
                color = (0, 200, 0)
                thickness = 3
            elif label == chosen and label != expected:
                color = (0, 0, 255)
                thickness = 3
            elif label == expected:
                color = (0, 200, 0)
                thickness = 2
            else:
                color = (180, 180, 180)
                thickness = 1

            cv2.circle(warped_color, (cx, cy), r, color, thickness)

            if score is not None:
                cv2.putText(
                    warped_color,
                    f"{int(score)}",
                    (cx - 10, cy + r + 15),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.4,
                    (100, 100, 100),
                    1,
                )

    orig_h, orig_w = orig_color.shape[:2]
    warped_h, warped_w = warped_color.shape[:2]

    target_h = 800
    orig_resized = cv2.resize(
        orig_color, (int(orig_w * target_h / orig_h), target_h)
    )
    warped_resized = cv2.resize(
        warped_color, (int(warped_w * target_h / warped_h), target_h)
    )

    composite = np.hstack([orig_resized, warped_resized])
    composite_rgb = cv2.cvtColor(composite, cv2.COLOR_BGR2RGB)
    return Image.fromarray(composite_rgb)
