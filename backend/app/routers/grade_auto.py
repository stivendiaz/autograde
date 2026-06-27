from __future__ import annotations

import json
import logging
import os
import shutil
import tempfile
import uuid
from pathlib import Path

import cv2
from fastapi import APIRouter, Depends, UploadFile
from sqlalchemy.orm import Session

from app.config import STORAGE_DIR
from app.database import get_db
from app.models import Evaluation, GeneratedSheet, GradingHistory, GradingResult, OMRTemplate, QRCode, Test
from app.schemas import AutoDetectResponse
from app.services.grading_service import (
    AlignmentError,
    GradingError,
    MarkerNotFoundError,
    get_corrected_pil_image,
    grade_sheet,
)
from app.services.grading_history_service import (
    generate_proof,
    save_debug_image,
    save_original,
    save_processed,
)
from app.services.omr_template_service import layout_from_template

logger = logging.getLogger(__name__)

UPLOAD_DIR = STORAGE_DIR / "uploads"

router = APIRouter(prefix="/grade", tags=["auto-detect"])


@router.post("/auto-detect", response_model=AutoDetectResponse)
def auto_detect_grade(file: UploadFile, db: Session = Depends(get_db)):
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    ext = Path(file.filename).suffix if file.filename else ".png"
    fname = f"auto_{uuid.uuid4().hex}{ext}"
    dest = UPLOAD_DIR / fname
    with open(dest, "wb") as f:
        shutil.copyfileobj(file.file, f)

    qr_data = _decode_qr(str(dest))
    if qr_data is None:
        return AutoDetectResponse(
            status="not_detected",
            qr_detected=False,
            exam_detected=False,
            error="No QR code detected. Please select the test manually or upload a clearer image.",
        )

    qr_entry = db.query(QRCode).filter(QRCode.code == qr_data.strip()).first()
    if qr_entry is None:
        return AutoDetectResponse(
            status="not_detected",
            qr_detected=False,
            exam_detected=False,
            error="QR code is not registered in the system.",
        )

    sheet = db.query(GeneratedSheet).filter(GeneratedSheet.id == qr_entry.generated_sheet_id).first()
    test = db.query(Test).filter(Test.id == qr_entry.test_id).first()

    if sheet is None or test is None:
        return AutoDetectResponse(
            status="not_detected",
            qr_detected=False,
            exam_detected=False,
            error="QR code references data that no longer exists.",
        )

    try:
        return _attempt_grading(str(dest), test, sheet, qr_entry, db)
    except Exception:
        logger.exception("auto_detect_grade: unhandled error during grading")
        return AutoDetectResponse(
            status="error",
            qr_detected=True,
            exam_detected=False,
            error="An internal error occurred while grading. Check server logs for details.",
        )


def _attempt_grading(
    image_path: str,
    test: Test,
    sheet: GeneratedSheet,
    qr_entry: QRCode,
    db: Session,
) -> AutoDetectResponse:
    tmpl = db.query(OMRTemplate).filter(OMRTemplate.test_id == test.id).first()
    if not tmpl:
        return AutoDetectResponse(
            status="qr_only",
            qr_detected=True,
            exam_detected=False,
            should_redirect=True,
            redirect_url=f"/tests/{test.id}",
            test_id=test.id,
            test_name=test.name,
            sheet_id=sheet.id,
        )

    eval_obj = db.query(Evaluation).filter(Evaluation.test_id == test.id).first()
    if not eval_obj:
        return AutoDetectResponse(
            status="qr_only",
            qr_detected=True,
            exam_detected=False,
            should_redirect=True,
            redirect_url=f"/tests/{test.id}",
            test_id=test.id,
            test_name=test.name,
            sheet_id=sheet.id,
        )

    raw_ak = json.loads(eval_obj.answer_key_json)
    if isinstance(raw_ak, list):
        answer_key = {str(q["question_number"]): q["correct_answer"] for q in raw_ak}
    else:
        answer_key = raw_ak

    try:
        result = grade_sheet(image_path, tmpl, answer_key)
    except MarkerNotFoundError:
        return AutoDetectResponse(
            status="qr_only",
            qr_detected=True,
            exam_detected=False,
            markers_detected=False,
            error="Could not detect OMR markers. Please retake the photo ensuring all four corner markers are visible.",
            test_id=test.id,
            test_name=test.name,
            sheet_id=sheet.id,
            redirect_url=f"/tests/{test.id}",
        )
    except (AlignmentError, GradingError):
        return AutoDetectResponse(
            status="qr_only",
            qr_detected=True,
            exam_detected=False,
            should_redirect=True,
            redirect_url=f"/tests/{test.id}",
            test_id=test.id,
            test_name=test.name,
            sheet_id=sheet.id,
        )
    except Exception:
        return AutoDetectResponse(
            status="qr_only",
            qr_detected=True,
            exam_detected=False,
            should_redirect=True,
            redirect_url=f"/tests/{test.id}",
            test_id=test.id,
            test_name=test.name,
            sheet_id=sheet.id,
        )

    try:
        grading = GradingResult(
            test_id=test.id,
            generated_sheet_id=sheet.id,
            uploaded_image_path=image_path,
            detected_answers_json=json.dumps(result["detected_answers"]),
            score=result["score"],
            total_questions=result["total_questions"],
            correct_count=result["correct_count"],
            incorrect_count=result["incorrect_count"],
            blank_count=result["blank_count"],
            result_json=json.dumps(result),
        )
        db.add(grading)
        db.commit()
        db.refresh(grading)
    except Exception as e:
        logger.exception("_attempt_grading: GradingResult commit failed")
        return AutoDetectResponse(
            status="error",
            qr_detected=True,
            exam_detected=True,
            test_id=test.id,
            test_name=test.name,
            sheet_id=sheet.id,
            error=f"Failed to save grading result: {e}",
        )

    logger.info("GradingResult saved id=%s test=%s sheet=%s score=%s", grading.id, test.id, sheet.id, result["score"])

    try:
        _save_grading_history(
            image_path=image_path,
            test=test,
            sheet=sheet,
            qr_entry=qr_entry,
            result=result,
            answer_key=answer_key,
            raw_ak=raw_ak,
            tmpl=tmpl,
            db=db,
        )
    except Exception:
        logger.exception("_attempt_grading: _save_grading_history failed")
        db.rollback()

    return AutoDetectResponse(
        status="graded",
        qr_detected=True,
        exam_detected=True,
        markers_detected=True,
        test_id=test.id,
        test_name=test.name,
        sheet_id=sheet.id,
        student_id=sheet.student_id or qr_entry.student_id,
        score=result["score"],
        total_questions=result["total_questions"],
        correct_count=result["correct_count"],
        incorrect_count=result["incorrect_count"],
        blank_count=result["blank_count"],
        answers=result["detected_answers"],
    )


@router.post("/detect-frame", response_model=AutoDetectResponse)
def detect_frame(file: UploadFile, db: Session = Depends(get_db)):
    ext = Path(file.filename).suffix if file.filename else ".png"
    with tempfile.NamedTemporaryFile(suffix=ext, delete=True) as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name

        qr_data = _decode_qr(tmp_path)
        if qr_data is None:
            return AutoDetectResponse(status="not_detected", qr_detected=False, exam_detected=False)

        qr_entry = db.query(QRCode).filter(QRCode.code == qr_data.strip()).first()
        if qr_entry is None:
            return AutoDetectResponse(status="not_detected", qr_detected=False, exam_detected=False)

        sheet = db.query(GeneratedSheet).filter(GeneratedSheet.id == qr_entry.generated_sheet_id).first()
        test = db.query(Test).filter(Test.id == qr_entry.test_id).first()
        if sheet is None or test is None:
            return AutoDetectResponse(status="not_detected", qr_detected=False, exam_detected=False)

        return _attempt_grading(tmp_path, test, sheet, qr_entry, db)


def _decode_qr(image_path: str) -> str | None:
    img = cv2.imread(image_path)
    if img is None:
        return None
    detector = cv2.QRCodeDetector()
    data, points, _ = detector.detectAndDecode(img)
    if not data:
        return None
    return data


def _save_grading_history(
    *,
    image_path: str,
    test: Test,
    sheet: GeneratedSheet,
    qr_entry: QRCode,
    result: dict,
    answer_key: dict,
    raw_ak,
    tmpl: OMRTemplate,
    db: Session,
) -> GradingHistory:
    uid = f"{test.id}_{sheet.id}_{uuid.uuid4().hex[:8]}"
    student_id = sheet.student_id or qr_entry.student_id
    answer_key_json = json.dumps(raw_ak)

    original_path = image_path
    corrected_pil = None
    processed_path = None
    annotated_path = None
    debug_path = None
    ambiguous_count = 0

    try:
        original_path = save_original(image_path, uid)
        corrected_pil = get_corrected_pil_image(image_path, tmpl)
        processed_path = save_processed(corrected_pil, uid)
        layout = layout_from_template(tmpl)
        annotated_path = generate_proof(
            corrected_pil, layout, result["detected_answers"], answer_key, uid
        )
        debug_path = save_debug_image(image_path, tmpl, result, answer_key, uid)
    except Exception:
        logger.exception("_save_grading_history: image processing failed")
        pass

    result_with_debug = {**result}
    if debug_path:
        result_with_debug["debug_image_path"] = debug_path

    record = GradingHistory(
        test_id=test.id,
        sheet_id=sheet.id,
        qr_code_id=qr_entry.id,
        student_id=student_id,
        original_image_path=original_path,
        processed_image_path=processed_path,
        annotated_image_path=annotated_path,
        detected_answers_json=json.dumps(result["detected_answers"]),
        answer_key_json=answer_key_json,
        score=result["score"],
        total_questions=result["total_questions"],
        correct_count=result["correct_count"],
        incorrect_count=result["incorrect_count"],
        blank_count=result["blank_count"],
        ambiguous_count=ambiguous_count,
        result_json=json.dumps(result_with_debug),
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    logger.info("GradingHistory created id=%s test=%s sheet=%s score=%s", record.id, test.id, sheet.id, result["score"])
    return record
