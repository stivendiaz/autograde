from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Optional

import qrcode
from PIL import Image, ImageDraw, ImageFont

from app.models import OMRTemplate
from app.services.omr_template_service import OPTION_LABELS, layout_from_template

STORAGE_DIR = Path(__file__).parent.parent / "storage"
SHEETS_DIR = STORAGE_DIR / "generated_sheets"
PDF_DIR = STORAGE_DIR / "pdfs"

QR_SIZE = 120
QR_X = 1500
QR_Y = 130


def generate_answer_sheet_image(
    test_id: int, template: OMRTemplate, test_name: str, qr_code: str = "", lang: str = "es"
) -> str:
    img = _build_sheet_image(test_id, template, test_name, qr_code, lang)
    os.makedirs(SHEETS_DIR, exist_ok=True)
    image_path = str(SHEETS_DIR / f"test_{test_id}_sheet.png")
    img.save(image_path, "PNG")
    return image_path


def generate_answer_sheet_pdf(
    test_id: int, template: OMRTemplate, test_name: str, qr_code: str = "", lang: str = "es"
) -> str:
    img = _build_sheet_image(test_id, template, test_name, qr_code, lang)
    os.makedirs(PDF_DIR, exist_ok=True)
    pdf_path = str(PDF_DIR / f"test_{test_id}_sheet.pdf")
    img.save(pdf_path, "PDF")
    return pdf_path


def generate_answer_key_pdf(
    test_id: int, template: OMRTemplate, test_name: str,
    answer_key_data: list, qr_code: str = "", lang: str = "es"
) -> str:
    img = _build_key_image(test_id, template, test_name, answer_key_data, qr_code, lang)
    os.makedirs(PDF_DIR, exist_ok=True)
    pdf_path = str(PDF_DIR / f"test_{test_id}_key.pdf")
    img.save(pdf_path, "PDF")
    return pdf_path


def _build_sheet_image(
    test_id: int, template: OMRTemplate, test_name: str, qr_code: str = "", lang: str = "es"
) -> Image.Image:
    layout = layout_from_template(template)
    num_q = len(layout["questions"])

    img = Image.new("RGB", (layout["page_width"], layout["page_height"]), "white")
    draw = ImageDraw.Draw(img)

    try:
        font_title = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 36)
        font_body = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 22)
        font_small = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 18)
    except Exception:
        font_title = ImageFont.load_default()
        font_body = font_title
        font_small = font_title

    _draw_markers(draw, layout)
    _draw_title(draw, layout, test_name, font_title)
    _draw_student_fields(draw, layout, font_small, lang)
    _draw_instructions(draw, layout, num_q, font_body, lang)
    _draw_questions(draw, layout, font_body, font_small)
    if qr_code:
        _draw_qr_code(img, qr_code)
    return img


def _build_key_image(
    test_id: int, template: OMRTemplate, test_name: str,
    answer_key_data: list, qr_code: str = "", lang: str = "es"
) -> Image.Image:
    img = _build_sheet_image(test_id, template, test_name, qr_code, lang)
    draw = ImageDraw.Draw(img)
    layout = layout_from_template(template)

    correct_map = {}
    for q in answer_key_data:
        correct_map[q.get("question_number")] = q.get("correct_answer", "")

    for q in layout["questions"]:
        qno = q["number"]
        correct = correct_map.get(qno, "")
        if not correct:
            continue
        for opt in q["options"]:
            if opt["label"] == correct:
                cx, cy, r = opt["cx"], opt["cy"], opt["r"]
                draw.ellipse([cx - r + 2, cy - r + 2, cx + r - 2, cy + r - 2], fill="black")
                # Redraw label in white over the filled bubble
                try:
                    font_w = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 16)
                except Exception:
                    font_w = ImageFont.load_default()
                draw.text((cx, cy), opt["label"], fill="white", font=font_w, anchor="mm")
                break

    return img


def generate_answer_key_image(
    test_id: int, template: OMRTemplate, test_name: str,
    answer_key_data: list, qr_code: str = "", lang: str = "es"
) -> str:
    img = _build_key_image(test_id, template, test_name, answer_key_data, qr_code, lang)
    os.makedirs(SHEETS_DIR, exist_ok=True)
    image_path = str(SHEETS_DIR / f"test_{test_id}_key.png")
    img.save(image_path, "PNG")
    return image_path


def _draw_qr_code(img: Image.Image, code: str):
    qr = qrcode.make(code, box_size=4)
    qr = qr.convert("RGB")
    qr = qr.resize((QR_SIZE, QR_SIZE), Image.NEAREST)
    img.paste(qr, (QR_X, QR_Y))


def _draw_markers(draw: ImageDraw, layout: dict):
    markers = layout.get("markers", {})
    for key, m in markers.items():
        x, y, s = m["x"], m["y"], m["size"]
        draw.rectangle([x, y, x + s, y + s], fill="black")
        inner = s // 4
        draw.rectangle([x + inner, y + inner, x + s - inner, y + s - inner], fill="white")


def _draw_title(draw: ImageDraw, layout: dict, test_name: str, font):
    y = layout["title_area"]["y"]
    draw.text((layout["page_width"] // 2, y), test_name, fill="black", font=font, anchor="mt")


def _draw_student_fields(draw: ImageDraw, layout: dict, font, lang: str = "es"):
    nf = layout["name_field"]
    idf = layout["id_field"]
    name_label = "Nombre del estudiante:" if lang == "es" else "Student Name:"
    id_label = "ID del estudiante:" if lang == "es" else "Student ID:"

    draw.text((nf["x"], nf["y"] - 4), name_label, fill="black", font=font)
    draw.rectangle([nf["x"], nf["y"] + 18, nf["x"] + nf["w"], nf["y"] + nf["h"]], outline="black", width=2)

    draw.text((idf["x"], idf["y"] - 4), id_label, fill="black", font=font)
    draw.rectangle([idf["x"], idf["y"] + 18, idf["x"] + idf["w"], idf["y"] + idf["h"]], outline="black", width=2)


def _draw_instructions(draw: ImageDraw, layout: dict, num_q: int, font, lang: str = "es"):
    y = layout["instruction_area"]["y"]
    if lang == "es":
        text = f"Responde {num_q} preguntas. Selecciona una opcion por pregunta. Las opciones pueden variar por pregunta."
    else:
        text = f"Answer {num_q} questions. Select one option per question. Options may vary per question."
    draw.text((layout["page_width"] // 2, y), text, fill="black", font=font, anchor="mt")


def _draw_questions(draw: ImageDraw, layout: dict, font_q: ImageFont.FreeTypeFont | ImageFont.ImageFont, font_label):
    for q in layout["questions"]:
        qx, qy = q["x"], q["y"]
        draw.text((qx, qy), f"{q['number']}.", fill="black", font=font_q)
        for opt in q["options"]:
            cx, cy, r = opt["cx"], opt["cy"], opt["r"]
            draw.ellipse([cx - r, cy - r, cx + r, cy + r], outline="black", width=2)
            draw.text((cx, cy), opt["label"], fill="black", font=font_label, anchor="mm")
