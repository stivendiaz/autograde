from __future__ import annotations

import json
import os
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import Course, CourseTeacher, GradingHistory, Test, User
from app.schemas import GradingHistoryOut
from app.services.grading_history_service import PROOFS_DIR

router = APIRouter(prefix="/grading-history", tags=["grading-history"])


@router.get("", response_model=list[GradingHistoryOut])
def list_all(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if user is None:
        raise HTTPException(401, "Authentication required")
    query = db.query(GradingHistory)
    if user.role == "student":
        query = query.filter(GradingHistory.student_id == user.id)
    elif user.role == "teacher":
        ct_ids = [
            row[0] for row in
            db.query(CourseTeacher.course_id)
            .filter(CourseTeacher.teacher_id == user.id)
            .all()
        ]
        created_course_ids = [
            row[0] for row in
            db.query(Course.id)
            .filter(Course.created_by_id == user.id)
            .all()
        ]
        course_ids = list(set(ct_ids + created_course_ids))
        test_ids = [
            row[0] for row in
            db.query(Test.id)
            .filter(
                (Test.course_id.in_(course_ids)) | (Test.created_by_id == user.id)
            )
            .all()
        ]
        query = query.filter(GradingHistory.test_id.in_(test_ids))
    records = (
        query
        .order_by(GradingHistory.created_at.desc())
        .limit(200)
        .all()
    )
    return [_to_out(r, db) for r in records]


@router.get("/{history_id}", response_model=GradingHistoryOut)
def get_one(history_id: int, db: Session = Depends(get_db)):
    r = db.query(GradingHistory).filter(GradingHistory.id == history_id).first()
    if not r:
        raise HTTPException(404, "Grading history record not found")
    return _to_out(r, db)


@router.get("/test/{test_id}", response_model=list[GradingHistoryOut])
def by_test(
    test_id: int,
    user: User | None = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if user is None:
        raise HTTPException(401, "Authentication required")
    if user.role == "student":
        records = (
            db.query(GradingHistory)
            .filter(
                GradingHistory.test_id == test_id,
                GradingHistory.student_id == user.id,
            )
            .order_by(GradingHistory.created_at.desc())
            .all()
        )
    else:
        records = (
            db.query(GradingHistory)
            .filter(GradingHistory.test_id == test_id)
            .order_by(GradingHistory.created_at.desc())
            .all()
        )
    return [_to_out(r, db) for r in records]


@router.get("/sheet/{sheet_id}", response_model=list[GradingHistoryOut])
def by_sheet(sheet_id: int, db: Session = Depends(get_db)):
    records = (
        db.query(GradingHistory)
        .filter(GradingHistory.sheet_id == sheet_id)
        .order_by(GradingHistory.created_at.desc())
        .all()
    )
    return [_to_out(r, db) for r in records]


@router.get("/{history_id}/proof")
def get_proof(history_id: int, db: Session = Depends(get_db)):
    r = db.query(GradingHistory).filter(GradingHistory.id == history_id).first()
    if not r:
        raise HTTPException(404, "Grading history record not found")
    path = r.annotated_image_path
    if not path or not os.path.exists(path):
        raise HTTPException(404, "Proof image not available")
    return FileResponse(path, media_type="image/png")


@router.get("/{history_id}/processed")
def get_processed(history_id: int, db: Session = Depends(get_db)):
    r = db.query(GradingHistory).filter(GradingHistory.id == history_id).first()
    if not r:
        raise HTTPException(404, "Grading history record not found")
    path = r.processed_image_path
    if not path or not os.path.exists(path):
        raise HTTPException(404, "Processed image not available")
    return FileResponse(path, media_type="image/png")


def _to_out(r: GradingHistory, db: Session) -> GradingHistoryOut:
    test_name = ""
    student_name = ""
    course_name = ""
    if r.test:
        test_name = r.test.name
        if r.test.course:
            course_name = r.test.course.name
    elif r.test_id:
        t = db.query(Test).filter(Test.id == r.test_id).first()
        if t:
            test_name = t.name
            if t.course:
                course_name = t.course.name
    if r.student:
        student_name = r.student.name
    elif r.student_id:
        from app.models import User
        u = db.query(User).filter(User.id == r.student_id).first()
        if u:
            student_name = u.name

    detected = json.loads(r.detected_answers_json) if isinstance(r.detected_answers_json, str) else r.detected_answers_json
    answer_key = json.loads(r.answer_key_json) if isinstance(r.answer_key_json, str) else r.answer_key_json

    per_question = []
    if isinstance(answer_key, list):
        for q in answer_key:
            qno = str(q["question_number"])
            student = detected.get(qno, "")
            expected = q["correct_answer"]
            correct = student == expected if student else False
            per_question.append({
                "question": q["question_number"],
                "detected": student,
                "expected": expected,
                "correct": correct,
                "blank": not bool(student),
            })
    elif isinstance(answer_key, dict):
        for qno, expected in sorted(answer_key.items(), key=lambda x: int(x[0])):
            student = detected.get(qno, "")
            correct = student == expected if student else False
            per_question.append({
                "question": int(qno),
                "detected": student,
                "expected": expected,
                "correct": correct,
                "blank": not bool(student),
            })

    return GradingHistoryOut(
        id=r.id,
        test_id=r.test_id,
        test_name=test_name,
        sheet_id=r.sheet_id,
        student_id=r.student_id,
        student_name=student_name,
        course_name=course_name,
        score=r.score,
        total_questions=r.total_questions,
        correct_count=r.correct_count,
        incorrect_count=r.incorrect_count,
        blank_count=r.blank_count,
        ambiguous_count=r.ambiguous_count,
        annotated_image_path=r.annotated_image_path,
        processed_image_path=r.processed_image_path,
        original_image_path=r.original_image_path,
        detected_answers=detected,
        per_question=per_question,
        created_at=r.created_at,
        updated_at=r.updated_at,
    )
