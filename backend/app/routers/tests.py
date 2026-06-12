from __future__ import annotations

import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth import get_current_user, require_teacher
from app.database import get_db
from app.models import Course, CourseStudent, CourseTeacher, Evaluation, ExamAssignment, GeneratedSheet, GradingHistory, OMRTemplate, Test, User
from app.schemas import (
    QuestionDef,
    TestCreate,
    TestDetailOut,
    TestListOut,
    TestOut,
)
from app.services.omr_template_service import generate_omr_template

router = APIRouter(prefix="/tests", tags=["tests"])


class StudentAssign(BaseModel):
    student_id: int


@router.post("", response_model=TestDetailOut)
def create_test(
    payload: TestCreate,
    user: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    if len(payload.questions) == 0:
        raise HTTPException(400, "At least one question is required")

    seen = set()
    for q in payload.questions:
        if q.question_number in seen:
            raise HTTPException(400, f"Duplicate question number: {q.question_number}")
        seen.add(q.question_number)
        if len(q.options) < 2:
            raise HTTPException(400, f"Question {q.question_number} must have at least 2 options")

    num_questions = len(payload.questions)
    max_options = max(len(q.options) for q in payload.questions)
    sorted_qs = sorted(payload.questions, key=lambda x: x.question_number)

    test = Test(
        name=payload.name,
        description=payload.description,
        course_id=payload.course_id,
        created_by_id=user.id,
        number_of_questions=num_questions,
        number_of_options=max_options,
    )
    db.add(test)
    db.flush()

    per_q_opts = {q.question_number: len(q.options) for q in sorted_qs}
    tmpl = generate_omr_template(test.id, per_q_opts)
    db.add(tmpl)

    answer_key = {str(q.question_number): q.correct_answer for q in sorted_qs}
    questions_data = [
        {
            "question_number": q.question_number,
            "options": q.options,
            "correct_answer": q.correct_answer,
        }
        for q in sorted_qs
    ]

    eval_obj = Evaluation(
        test_id=test.id,
        answer_key_json=json.dumps(questions_data),
        scoring_config_json=json.dumps({"correct": 1, "incorrect": 0, "unmarked": 0}),
    )
    db.add(eval_obj)
    db.commit()
    db.refresh(test)

    return _build_detail(test, db)


@router.get("", response_model=list[TestListOut])
def list_tests(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if user is None:
        raise HTTPException(401, "Authentication required")
    if user.role == "teacher":
        ct_ids = [
            row[0] for row in
            db.query(CourseTeacher.course_id)
            .filter(CourseTeacher.teacher_id == user.id)
            .all()
        ]
        created_ids = [
            row[0] for row in
            db.query(Course.id)
            .filter(Course.created_by_id == user.id)
            .all()
        ]
        all_ids = list(set(ct_ids + created_ids))
        tests = (
            db.query(Test)
            .filter(
                Test.course_id.in_(all_ids) |
                (Test.created_by_id == user.id) |
                (Test.course_id.is_(None))
            )
            .order_by(Test.created_at.desc())
            .all()
        )
    elif user.role == "student":
        cs_ids = [
            row[0] for row in
            db.query(CourseStudent.course_id)
            .filter(CourseStudent.student_id == user.id)
            .all()
        ]
        assigned_ids = [
            row[0] for row in
            db.query(ExamAssignment.test_id)
            .filter(ExamAssignment.student_id == user.id)
            .all()
        ]
        all_ids = list(set(cs_ids + assigned_ids))
        tests = (
            db.query(Test)
            .filter(
                Test.course_id.in_(all_ids) |
                Test.id.in_(assigned_ids if assigned_ids else [-1])
            )
            .order_by(Test.created_at.desc())
            .all()
        )
    else:
        return []
    result = []
    for t in tests:
        result.append(
            TestListOut(
                id=t.id,
                name=t.name,
                description=t.description,
                number_of_questions=t.number_of_questions,
                number_of_options=t.number_of_options,
                course_id=t.course_id,
                created_at=t.created_at,
                has_sheet=len(t.generated_sheets) > 0,
            )
        )
    return result


@router.get("/{test_id}", response_model=TestDetailOut)
def get_test(
    test_id: int,
    user: User | None = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    test = db.query(Test).filter(Test.id == test_id).first()
    if not test:
        raise HTTPException(404, "Test not found")
    return _build_detail(test, db)


@router.post("/{test_id}/assign-student")
def assign_student(
    test_id: int,
    payload: StudentAssign,
    user: User | None = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    test = db.query(Test).filter(Test.id == test_id).first()
    if not test:
        raise HTTPException(404, "Test not found")
    existing = (
        db.query(ExamAssignment)
        .filter(ExamAssignment.test_id == test_id, ExamAssignment.student_id == payload.student_id)
        .first()
    )
    if existing:
        return {"ok": True, "already_assigned": True}
    ea = ExamAssignment(test_id=test_id, student_id=payload.student_id, assigned_by=user.id if user else None)
    db.add(ea)
    db.commit()
    return {"ok": True}


@router.delete("/{test_id}/assign-student/{student_id}")
def unassign_student(
    test_id: int,
    student_id: int,
    user: User | None = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ea = (
        db.query(ExamAssignment)
        .filter(ExamAssignment.test_id == test_id, ExamAssignment.student_id == student_id)
        .first()
    )
    if ea:
        db.delete(ea)
        db.commit()
    return {"ok": True}


@router.get("/{test_id}/student-summary")
def get_student_summary(
    test_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if user is None:
        raise HTTPException(401, "Authentication required")

    all_records = (
        db.query(GradingHistory)
        .filter(GradingHistory.test_id == test_id)
        .all()
    )

    my_grade = next((r for r in all_records if r.student_id == user.id), None)
    has_grade = my_grade is not None

    scores = [r.score for r in all_records] if all_records else []
    stats = {
        "average_score": round(sum(scores) / len(scores), 1) if scores else 0,
        "highest_score": max(scores) if scores else 0,
        "submissions": len(scores),
    }

    return {
        "has_grade": has_grade,
        "grade": {
            "id": my_grade.id,
            "score": my_grade.score,
            "total_questions": my_grade.total_questions,
            "correct_count": my_grade.correct_count,
            "incorrect_count": my_grade.incorrect_count,
            "blank_count": my_grade.blank_count,
            "annotated_image_path": my_grade.annotated_image_path,
            "created_at": my_grade.created_at,
        } if my_grade else None,
        "stats": stats,
    }


@router.put("/{test_id}/answer-key")
def update_answer_key(
    test_id: int,
    payload: dict,
    user: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    eval_obj = db.query(Evaluation).filter(Evaluation.test_id == test_id).first()
    if not eval_obj:
        raise HTTPException(404, "Evaluation not found")
    if "answer_key" in payload:
        eval_obj.answer_key_json = json.dumps(payload["answer_key"])
        eval_obj.updated_at = datetime.now(timezone.utc)
        db.commit()
        return {"ok": True}
    raise HTTPException(400, "Missing answer_key field")


def _build_detail(test: Test, db: Session) -> TestDetailOut:
    tmpl = db.query(OMRTemplate).filter(OMRTemplate.test_id == test.id).first()
    eval_obj = db.query(Evaluation).filter(Evaluation.test_id == test.id).first()

    test_out = TestOut.model_validate(test)

    template_out = None
    if tmpl:
        template_out = {
            "id": tmpl.id,
            "test_id": tmpl.test_id,
            "layout_json": json.loads(tmpl.layout_json),
            "marker_config_json": json.loads(tmpl.marker_config_json),
            "page_width": tmpl.page_width,
            "page_height": tmpl.page_height,
            "created_at": tmpl.created_at,
            "updated_at": tmpl.updated_at,
        }

    eval_out = None
    if eval_obj:
        eval_out = {
            "id": eval_obj.id,
            "test_id": eval_obj.test_id,
            "answer_key_json": json.loads(eval_obj.answer_key_json),
            "scoring_config_json": json.loads(eval_obj.scoring_config_json),
            "created_at": eval_obj.created_at,
            "updated_at": eval_obj.updated_at,
        }

    course_info = None
    if test.course:
        course_info = {"id": test.course.id, "name": test.course.name}

    assignments = []
    for ea in test.assignments:
        assignments.append({
            "id": ea.id,
            "student_id": ea.student_id,
            "student_name": ea.student.name if ea.student else "",
            "assigned_at": ea.assigned_at,
        })

    return TestDetailOut(
        test=test_out,
        template=template_out,
        evaluation=eval_out,
        course=course_info,
        assignments=assignments,
    )
