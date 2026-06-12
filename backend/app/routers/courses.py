from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth import get_current_user, require_teacher, user_is_course_teacher
from app.database import get_db
from app.models import Course, CourseStudent, CourseTeacher, Test, User

router = APIRouter(prefix="/courses", tags=["courses"])


class CourseCreate(BaseModel):
    name: str
    description: str = ""


class TeacherAdd(BaseModel):
    teacher_id: int


class StudentAdd(BaseModel):
    student_id: int


@router.get("")
def list_courses(
    user: User | None = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if user is None:
        return []
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
        return _format_courses(
            db.query(Course).filter(Course.id.in_(all_ids)).all() if all_ids else [],
            db,
        )
    else:
        cs_ids = [
            row[0] for row in
            db.query(CourseStudent.course_id)
            .filter(CourseStudent.student_id == user.id)
            .all()
        ]
        return _format_courses(
            db.query(Course).filter(Course.id.in_(cs_ids)).all() if cs_ids else [],
            db,
        )


@router.post("")
def create_course(payload: CourseCreate, user: User = Depends(require_teacher), db: Session = Depends(get_db)):
    course = Course(name=payload.name, description=payload.description, created_by_id=user.id)
    db.add(course)
    db.flush()
    ct = CourseTeacher(course_id=course.id, teacher_id=user.id)
    db.add(ct)
    db.commit()
    db.refresh(course)
    return _format_course(course, db)


@router.get("/{course_id}")
def get_course(
    course_id: int,
    user: User | None = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(404, "Course not found")
    if user and user.role == "teacher" and not user_is_course_teacher(user, course_id, db) and course.created_by_id != user.id:
        raise HTTPException(403, "Access denied")
    return _format_course(course, db)


@router.post("/{course_id}/teachers")
def add_teacher(
    course_id: int,
    payload: TeacherAdd,
    user: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    if not user_is_course_teacher(user, course_id, db):
        raise HTTPException(403, "Access denied")
    existing = (
        db.query(CourseTeacher)
        .filter(CourseTeacher.course_id == course_id, CourseTeacher.teacher_id == payload.teacher_id)
        .first()
    )
    if existing:
        raise HTTPException(400, "Teacher already in course")
    ct = CourseTeacher(course_id=course_id, teacher_id=payload.teacher_id)
    db.add(ct)
    db.commit()
    return {"ok": True}


@router.delete("/{course_id}/teachers/{teacher_id}")
def remove_teacher(
    course_id: int,
    teacher_id: int,
    user: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    if not user_is_course_teacher(user, course_id, db):
        raise HTTPException(403, "Access denied")
    ct = (
        db.query(CourseTeacher)
        .filter(CourseTeacher.course_id == course_id, CourseTeacher.teacher_id == teacher_id)
        .first()
    )
    if ct:
        db.delete(ct)
        db.commit()
    return {"ok": True}


@router.post("/{course_id}/students")
def add_student(
    course_id: int,
    payload: StudentAdd,
    user: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    if not user_is_course_teacher(user, course_id, db):
        raise HTTPException(403, "Access denied")
    existing = (
        db.query(CourseStudent)
        .filter(CourseStudent.course_id == course_id, CourseStudent.student_id == payload.student_id)
        .first()
    )
    if existing:
        raise HTTPException(400, "Student already in course")
    cs = CourseStudent(course_id=course_id, student_id=payload.student_id)
    db.add(cs)
    db.commit()
    return {"ok": True}


@router.delete("/{course_id}/students/{student_id}")
def remove_student(
    course_id: int,
    student_id: int,
    user: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    if not user_is_course_teacher(user, course_id, db):
        raise HTTPException(403, "Access denied")
    cs = (
        db.query(CourseStudent)
        .filter(CourseStudent.course_id == course_id, CourseStudent.student_id == student_id)
        .first()
    )
    if cs:
        db.delete(cs)
        db.commit()
    return {"ok": True}


def _format_courses(courses: list[Course], db: Session) -> list[dict]:
    return [_format_course(c, db) for c in courses]


def _format_course(course: Course, db: Session) -> dict:
    tests = db.query(Test).filter(Test.course_id == course.id).all()
    teachers = db.query(CourseTeacher).filter(CourseTeacher.course_id == course.id).all()
    students = db.query(CourseStudent).filter(CourseStudent.course_id == course.id).all()
    return {
        "id": course.id,
        "name": course.name,
        "description": course.description,
        "created_by_id": course.created_by_id,
        "teacher_count": len(teachers),
        "student_count": len(students),
        "test_count": len(tests),
        "teachers": [
            {"id": ct.teacher.id, "name": ct.teacher.name, "email": ct.teacher.email}
            if ct.teacher else {"id": ct.teacher_id, "name": "", "email": ""}
            for ct in teachers
        ],
        "students": [
            {"id": cs.student.id, "name": cs.student.name, "email": cs.student.email}
            if cs.student else {"id": cs.student_id, "name": "", "email": ""}
            for cs in students
        ],
        "tests": [
            {"id": t.id, "name": t.name, "number_of_questions": t.number_of_questions}
            for t in tests
        ],
        "created_at": course.created_at,
        "updated_at": course.updated_at,
    }
