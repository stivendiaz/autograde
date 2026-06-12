from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import CourseStudent, ExamAssignment, GradingHistory, Test, User

router = APIRouter(prefix="/students", tags=["students"])


@router.get("/me")
def get_me(user: User = Depends(get_current_user)):
    if user is None:
        raise HTTPException(401, "Authentication required")
    courses = user.course_students
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "role": user.role,
        "courses": [
            {"id": cs.course_id, "name": cs.course.name if cs.course else ""}
            for cs in courses
        ],
    }


@router.get("/me/grades")
def my_grades(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user is None:
        raise HTTPException(401, "Authentication required")
    records = (
        db.query(GradingHistory)
        .filter(GradingHistory.student_id == user.id)
        .order_by(GradingHistory.created_at.desc())
        .all()
    )
    return [
        {
            "id": r.id,
            "test_id": r.test_id,
            "test_name": r.test.name if r.test else "",
            "course_name": r.test.course.name if r.test and r.test.course else "",
            "score": r.score,
            "total_questions": r.total_questions,
            "correct_count": r.correct_count,
            "incorrect_count": r.incorrect_count,
            "blank_count": r.blank_count,
            "annotated_image_path": r.annotated_image_path,
            "created_at": r.created_at,
        }
        for r in records
    ]


@router.get("/me/tests")
def my_tests(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user is None:
        raise HTTPException(401, "Authentication required")
    course_ids = [
        cs.course_id for cs in
        db.query(CourseStudent).filter(CourseStudent.student_id == user.id).all()
    ]
    assigned_ids = [
        ea.test_id for ea in
        db.query(ExamAssignment).filter(ExamAssignment.student_id == user.id).all()
    ]
    tests = (
        db.query(Test)
        .filter(
            (Test.course_id.in_(course_ids) if course_ids else False) |
            Test.id.in_(assigned_ids if assigned_ids else [-1])
        )
        .order_by(Test.created_at.desc())
        .all()
    )
    return [
        {
            "id": t.id,
            "name": t.name,
            "description": t.description,
            "number_of_questions": t.number_of_questions,
            "course_name": t.course.name if t.course else "",
        }
        for t in tests
    ]
