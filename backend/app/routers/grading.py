from __future__ import annotations

import json
import os
import shutil
import traceback
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Evaluation, GradingHistory, GradingResult, OMRTemplate, Test
from app.schemas import GradeResponse, GradingResultOut
from app.services.grading_service import get_corrected_pil_image, grade_sheet
from app.services.grading_history_service import (
    generate_proof,
    save_original,
    save_processed,
)
from app.services.omr_template_service import layout_from_template

UPLOAD_DIR = Path(__file__).parent.parent / "storage" / "uploads"

router = APIRouter(prefix="/tests/{test_id}/grading", tags=["grading"])


@router.post("", response_model=GradeResponse)
def grade_upload(
    test_id: int,
    file: UploadFile,
    student_id: int | None = Query(None),
    db: Session = Depends(get_db),
):
    test = db.query(Test).filter(Test.id == test_id).first()
    if not test:
        raise HTTPException(404, "Test not found")

    tmpl = db.query(OMRTemplate).filter(OMRTemplate.test_id == test_id).first()
    if not tmpl:
        raise HTTPException(404, "OMR template not found")

    eval_obj = db.query(Evaluation).filter(Evaluation.test_id == test_id).first()
    if not eval_obj:
        raise HTTPException(404, "Evaluation / answer key not found")

    raw_ak = json.loads(eval_obj.answer_key_json)
    if isinstance(raw_ak, list):
        answer_key = {str(q["question_number"]): q["correct_answer"] for q in raw_ak}
    else:
        answer_key = raw_ak

    os.makedirs(UPLOAD_DIR, exist_ok=True)
    ext = Path(file.filename).suffix if file.filename else ".png"
    fname = f"{test_id}_{uuid.uuid4().hex}{ext}"
    dest = UPLOAD_DIR / fname
    with open(dest, "wb") as f:
        shutil.copyfileobj(file.file, f)

    try:
        result = grade_sheet(str(dest), tmpl, answer_key)
    except ValueError as e:
        msg = str(e).lower()
        if "marker" in msg:
            raise HTTPException(422, "Processing failed: no markers detected — this image does not appear to be a valid answer sheet.")
        raise HTTPException(400, str(e))

    grading = GradingResult(
        test_id=test_id,
        uploaded_image_path=str(dest),
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

    try:
        _save_history_for_manual(
            image_path=str(dest),
            test=test,
            result=result,
            answer_key=answer_key,
            raw_ak=raw_ak,
            tmpl=tmpl,
            student_id=student_id,
            db=db,
        )
    except Exception:
        traceback.print_exc()
        db.rollback()

    return GradeResponse(
        id=grading.id,
        score=result["score"],
        total_questions=result["total_questions"],
        correct_count=result["correct_count"],
        incorrect_count=result["incorrect_count"],
        blank_count=result["blank_count"],
        detected_answers=result["detected_answers"],
        per_question=result["per_question"],
    )


@router.get("", response_model=list[GradingResultOut])
def list_results(test_id: int, db: Session = Depends(get_db)):
    test = db.query(Test).filter(Test.id == test_id).first()
    if not test:
        raise HTTPException(404, "Test not found")

    results = (
        db.query(GradingResult)
        .filter(GradingResult.test_id == test_id)
        .order_by(GradingResult.created_at.desc())
        .all()
    )

    out = []
    for r in results:
        out.append(
            GradingResultOut(
                id=r.id,
                test_id=r.test_id,
                uploaded_image_path=r.uploaded_image_path,
                detected_answers_json=json.loads(r.detected_answers_json),
                score=r.score,
                total_questions=r.total_questions,
                correct_count=r.correct_count,
                incorrect_count=r.incorrect_count,
                blank_count=r.blank_count,
                result_json=json.loads(r.result_json),
                created_at=r.created_at,
            )
        )
    return out


def _save_history_for_manual(
    *,
    image_path: str,
    test: Test,
    result: dict,
    answer_key: dict,
    raw_ak,
    tmpl: OMRTemplate,
    student_id: int | None = None,
    db: Session,
) -> GradingHistory:
    uid = f"manual_{test.id}_{uuid.uuid4().hex[:8]}"
    answer_key_json = json.dumps(raw_ak)

    original_path = image_path
    processed_path = None
    annotated_path = None

    try:
        original_path = save_original(image_path, uid)
        corrected_pil = get_corrected_pil_image(image_path, tmpl)
        processed_path = save_processed(corrected_pil, uid)
        layout = layout_from_template(tmpl)
        annotated_path = generate_proof(
            corrected_pil, layout, result["detected_answers"], answer_key, uid
        )
    except Exception:
        traceback.print_exc()
        pass

    record = GradingHistory(
        test_id=test.id,
        sheet_id=None,
        qr_code_id=None,
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
        ambiguous_count=0,
        result_json=json.dumps(result),
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record
