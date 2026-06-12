from __future__ import annotations

import json
import os
import uuid

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import GeneratedSheet, OMRTemplate, QRCode, Test
from app.schemas import GeneratedSheetOut
from app.services.sheet_generator_service import (
    generate_answer_key_image,
    generate_answer_key_pdf,
    generate_answer_sheet_image,
    generate_answer_sheet_pdf,
)

router = APIRouter(prefix="/tests/{test_id}/sheets", tags=["sheets"])


@router.post("/generate", response_model=GeneratedSheetOut)
def generate_sheet(test_id: int, student_id: int | None = None, db: Session = Depends(get_db)):
    test = db.query(Test).filter(Test.id == test_id).first()
    if not test:
        raise HTTPException(404, "Test not found")

    tmpl = db.query(OMRTemplate).filter(OMRTemplate.test_id == test_id).first()
    if not tmpl:
        raise HTTPException(404, "OMR template not found for this test")

    code = uuid.uuid4().hex[:12]

    image_path = generate_answer_sheet_image(test_id, tmpl, test.name, code)

    answer_key_data = []
    if test.evaluation:
        raw = json.loads(test.evaluation.answer_key_json)
        if isinstance(raw, list):
            answer_key_data = raw
        elif isinstance(raw, dict):
            answer_key_data = [
                {"question_number": int(k), "options": [], "correct_answer": v}
                for k, v in raw.items()
            ]
        key_path = generate_answer_key_image(test_id, tmpl, test.name, answer_key_data, code)

    sheet = GeneratedSheet(
        test_id=test_id,
        student_id=student_id,
        file_path=image_path,
        image_path=image_path,
        pdf_path=None,
    )
    db.add(sheet)
    db.flush()

    qr_entry = QRCode(
        code=code,
        test_id=test_id,
        generated_sheet_id=sheet.id,
        student_id=student_id,
        version="1.0",
    )
    db.add(qr_entry)
    db.commit()
    db.refresh(sheet)

    return GeneratedSheetOut.model_validate(sheet)


@router.get("/download")
def download_sheet(test_id: int, lang: str | None = None, db: Session = Depends(get_db)):
    sheet = (
        db.query(GeneratedSheet)
        .filter(GeneratedSheet.test_id == test_id)
        .order_by(GeneratedSheet.created_at.desc())
        .first()
    )
    if not sheet:
        raise HTTPException(404, "No generated sheet found for this test")

    if lang and lang != "es":
        tmpl = db.query(OMRTemplate).filter(OMRTemplate.test_id == test_id).first()
        if tmpl:
            test = db.query(Test).filter(Test.id == test_id).first()
            qr_entry = db.query(QRCode).filter(QRCode.test_id == test_id).order_by(QRCode.id.desc()).first()
            qr_code = qr_entry.code if qr_entry else ""
            new_path = generate_answer_sheet_image(test_id, tmpl, test.name if test else "", qr_code, lang or "es")
            return FileResponse(new_path, media_type="image/png", filename=f"test_{test_id}_sheet.png")

    if not os.path.exists(sheet.image_path):
        raise HTTPException(404, "Sheet image file not found on disk")

    return FileResponse(
        sheet.image_path,
        media_type="image/png",
        filename=f"test_{test_id}_sheet.png",
    )


@router.get("/answer-key-image")
def download_answer_key(test_id: int, lang: str = "es", db: Session = Depends(get_db)):
    test = db.query(Test).filter(Test.id == test_id).first()
    if not test:
        raise HTTPException(404, "Test not found")

    tmpl = db.query(OMRTemplate).filter(OMRTemplate.test_id == test_id).first()
    if not tmpl:
        raise HTTPException(404, "Template not found")

    raw_ak = json.loads(test.evaluation.answer_key_json) if test.evaluation else {}
    if isinstance(raw_ak, list):
        answer_key_data = raw_ak
    elif isinstance(raw_ak, dict):
        answer_key_data = [
            {"question_number": int(k), "options": [], "correct_answer": v}
            for k, v in raw_ak.items()
        ]
    else:
        answer_key_data = []
    qr_entry = db.query(QRCode).filter(QRCode.test_id == test_id).order_by(QRCode.id.desc()).first()
    qr_code = qr_entry.code if qr_entry else ""

    key_path = generate_answer_key_image(test_id, tmpl, test.name, answer_key_data, qr_code, lang)

    if not os.path.exists(key_path):
        raise HTTPException(404, "Answer key image not found")

    return FileResponse(
        key_path,
        media_type="image/png",
        filename=f"test_{test_id}_answer_key.png",
    )


@router.get("/download-pdf")
def download_sheet_pdf(test_id: int, lang: str = "es", db: Session = Depends(get_db)):
    test = db.query(Test).filter(Test.id == test_id).first()
    if not test:
        raise HTTPException(404, "Test not found")
    tmpl = db.query(OMRTemplate).filter(OMRTemplate.test_id == test_id).first()
    if not tmpl:
        raise HTTPException(404, "Template not found")
    qr_entry = db.query(QRCode).filter(QRCode.test_id == test_id).order_by(QRCode.id.desc()).first()
    qr_code = qr_entry.code if qr_entry else ""
    pdf_path = generate_answer_sheet_pdf(test_id, tmpl, test.name, qr_code, lang)
    if not os.path.exists(pdf_path):
        raise HTTPException(404, "PDF not found")
    return FileResponse(pdf_path, media_type="application/pdf", filename=f"test_{test_id}_sheet.pdf")


@router.get("/answer-key-pdf")
def download_answer_key_pdf(test_id: int, lang: str = "es", db: Session = Depends(get_db)):
    test = db.query(Test).filter(Test.id == test_id).first()
    if not test:
        raise HTTPException(404, "Test not found")
    tmpl = db.query(OMRTemplate).filter(OMRTemplate.test_id == test_id).first()
    if not tmpl:
        raise HTTPException(404, "Template not found")
    raw_ak = json.loads(test.evaluation.answer_key_json) if test.evaluation else {}
    if isinstance(raw_ak, list):
        answer_key_data = raw_ak
    elif isinstance(raw_ak, dict):
        answer_key_data = [{"question_number": int(k), "options": [], "correct_answer": v} for k, v in raw_ak.items()]
    else:
        answer_key_data = []
    qr_entry = db.query(QRCode).filter(QRCode.test_id == test_id).order_by(QRCode.id.desc()).first()
    qr_code = qr_entry.code if qr_entry else ""
    pdf_path = generate_answer_key_pdf(test_id, tmpl, test.name, answer_key_data, qr_code, lang)
    if not os.path.exists(pdf_path):
        raise HTTPException(404, "PDF not found")
    return FileResponse(pdf_path, media_type="application/pdf", filename=f"test_{test_id}_key.pdf")
