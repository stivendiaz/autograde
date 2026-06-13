from __future__ import annotations

import os
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from app.config import STORAGE_DIR

PROCESSED_DIR = STORAGE_DIR / "processed"
PROOFS_DIR = STORAGE_DIR / "proofs"

COLORS = {
    "correct":  (34, 197, 94),    # #22C55E green
    "incorrect": (239, 68, 68),   # #EF4444 red
    "blank":     (156, 163, 175), # #9CA3AF gray
    "ambiguous": (245, 158, 11),  # #F59E0B yellow
    "key":       (34, 197, 94),   # green outline for correct answer
}

LABEL_R = 18
LINE_W = 3
FONT_SIZE = 16


def _get_font() -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    font_paths = [
        "/System/Library/Fonts/Helvetica.ttc",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "C:\\Windows\\Fonts\\Arial.ttf",
    ]
    for fp in font_paths:
        if os.path.exists(fp):
            return ImageFont.truetype(fp, FONT_SIZE)
    return ImageFont.load_default()


def save_original(image_path: str, uid: str) -> str:
    os.makedirs(PROCESSED_DIR, exist_ok=True)
    dest = PROCESSED_DIR / f"{uid}_original.png"
    img = Image.open(image_path).convert("RGB")
    img.save(dest, "PNG")
    return str(dest)


def save_processed(pil_image: Image.Image, uid: str) -> str:
    os.makedirs(PROCESSED_DIR, exist_ok=True)
    dest = PROCESSED_DIR / f"{uid}_processed.png"
    pil_image.save(dest, "PNG")
    return str(dest)


def generate_proof(
    corrected_image: Image.Image,
    layout: dict,
    detected_answers: dict[str, str],
    answer_key: dict[str, str],
    uid: str,
) -> str:
    os.makedirs(PROOFS_DIR, exist_ok=True)
    img = corrected_image.copy().convert("RGB")
    draw = ImageDraw.Draw(img)
    font = _get_font()

    questions = layout.get("questions", [])
    for q in questions:
        qno = str(q["number"])
        student_pick = detected_answers.get(qno, "")
        correct_pick = answer_key.get(qno, "")

        filled_labels: list[str] = []
        if student_pick:
            filled_labels.append(student_pick)

        if not filled_labels:
            status = "blank"
        elif len(filled_labels) == 1 and filled_labels[0] == correct_pick:
            status = "correct"
        elif len(filled_labels) == 1 and filled_labels[0] != correct_pick:
            status = "incorrect"
        else:
            status = "ambiguous"

        for opt in q.get("options", []):
            label = opt["label"]
            cx, cy, r = opt["cx"], opt["cy"], opt["r"]

            if label == correct_pick:
                _draw_circle_outline(draw, cx, cy, r + 3, COLORS["key"], width=LINE_W)
                tx, ty = cx + r + 6, cy - 7
                draw.text((tx, ty), "\u2713", fill=COLORS["correct"], font=font)

            if label in filled_labels and label != correct_pick:
                _draw_circle_outline(draw, cx, cy, r + 3, COLORS[status], width=LINE_W)
                symbol = "\u2717" if status == "incorrect" else "\u26A0"
                tx, ty = cx + r + 6, cy - 7
                draw.text((tx, ty), symbol, fill=COLORS[status], font=font)

        if status == "blank" and correct_pick:
            qx = q.get("x", 0)
            qy = q.get("y", 0)
            draw.text((qx, qy - 12), "\u2022 Blank", fill=COLORS["blank"], font=font)

    dest = PROOFS_DIR / f"{uid}_proof.png"
    img.save(dest, "PNG")
    return str(dest)


def _draw_circle_outline(
    draw: ImageDraw.Draw, cx: int, cy: int, r: int, color: tuple, width: int = 3
):
    draw.ellipse(
        [cx - r, cy - r, cx + r, cy + r],
        outline=color,
        width=width,
    )
