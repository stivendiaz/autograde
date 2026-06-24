from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=False, unique=True, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(20), nullable=False, default="student")  # "teacher" | "student"
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    created_tests = relationship("Test", back_populates="creator", foreign_keys="Test.created_by_id")
    created_courses = relationship("Course", back_populates="creator", foreign_keys="Course.created_by_id")
    course_teachers = relationship("CourseTeacher", back_populates="teacher", cascade="all, delete-orphan")
    course_students = relationship("CourseStudent", back_populates="student", cascade="all, delete-orphan")
    exam_assignments = relationship("ExamAssignment", back_populates="student", foreign_keys="ExamAssignment.student_id", cascade="all, delete-orphan")


class Course(Base):
    __tablename__ = "courses"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, default="")
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    creator = relationship("User", back_populates="created_courses", foreign_keys=[created_by_id])
    teachers_rel = relationship("CourseTeacher", back_populates="course", cascade="all, delete-orphan")
    students_rel = relationship("CourseStudent", back_populates="course", cascade="all, delete-orphan")
    tests = relationship("Test", back_populates="course", foreign_keys="Test.course_id")


class CourseTeacher(Base):
    __tablename__ = "course_teachers"

    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False)
    teacher_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    course = relationship("Course", back_populates="teachers_rel")
    teacher = relationship("User", back_populates="course_teachers")


class CourseStudent(Base):
    __tablename__ = "course_students"

    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    course = relationship("Course", back_populates="students_rel")
    student = relationship("User", back_populates="course_students")


class ExamAssignment(Base):
    __tablename__ = "exam_assignments"

    id = Column(Integer, primary_key=True, index=True)
    test_id = Column(Integer, ForeignKey("tests.id"), nullable=False)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    assigned_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    assigned_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    test = relationship("Test", back_populates="assignments")
    student = relationship("User", back_populates="exam_assignments", foreign_keys=[student_id])


class Test(Base):
    __tablename__ = "tests"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, default="")
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=True)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    number_of_questions = Column(Integer, nullable=False)
    number_of_options = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    course = relationship("Course", back_populates="tests", foreign_keys=[course_id])
    creator = relationship("User", back_populates="created_tests", foreign_keys=[created_by_id])
    omr_template = relationship(
        "OMRTemplate", back_populates="test", uselist=False, cascade="all, delete-orphan"
    )
    evaluation = relationship(
        "Evaluation", back_populates="test", uselist=False, cascade="all, delete-orphan"
    )
    generated_sheets = relationship(
        "GeneratedSheet", back_populates="test", cascade="all, delete-orphan"
    )
    grading_results = relationship(
        "GradingResult", back_populates="test", cascade="all, delete-orphan"
    )
    assignments = relationship(
        "ExamAssignment", back_populates="test", cascade="all, delete-orphan"
    )
    grading_history = relationship(
        "GradingHistory", back_populates="test", cascade="all, delete-orphan"
    )


class OMRTemplate(Base):
    __tablename__ = "omr_templates"

    id = Column(Integer, primary_key=True, index=True)
    test_id = Column(Integer, ForeignKey("tests.id"), nullable=False, unique=True)
    layout_json = Column(Text, nullable=False)
    marker_config_json = Column(Text, nullable=False)
    page_width = Column(Integer, nullable=False)
    page_height = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    test = relationship("Test", back_populates="omr_template")


class Evaluation(Base):
    __tablename__ = "evaluations"

    id = Column(Integer, primary_key=True, index=True)
    test_id = Column(Integer, ForeignKey("tests.id"), nullable=False, unique=True)
    answer_key_json = Column(Text, nullable=False)
    scoring_config_json = Column(Text, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    test = relationship("Test", back_populates="evaluation")


class GeneratedSheet(Base):
    __tablename__ = "generated_sheets"

    id = Column(Integer, primary_key=True, index=True)
    test_id = Column(Integer, ForeignKey("tests.id"), nullable=False)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    file_path = Column(String(500), nullable=False)
    image_path = Column(String(500), nullable=False)
    pdf_path = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    test = relationship("Test", back_populates="generated_sheets")
    student = relationship("User")
    qr_codes = relationship("QRCode", back_populates="generated_sheet", cascade="all, delete-orphan")


class QRCode(Base):
    __tablename__ = "qr_codes"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(64), nullable=False, unique=True, index=True)
    test_id = Column(Integer, ForeignKey("tests.id"), nullable=False)
    generated_sheet_id = Column(Integer, ForeignKey("generated_sheets.id"), nullable=False)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    version = Column(String(10), nullable=False, default="1.0")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    test = relationship("Test")
    student = relationship("User")
    generated_sheet = relationship("GeneratedSheet", back_populates="qr_codes")


class GradingResult(Base):
    __tablename__ = "grading_results"

    id = Column(Integer, primary_key=True, index=True)
    test_id = Column(Integer, ForeignKey("tests.id"), nullable=False)
    generated_sheet_id = Column(Integer, ForeignKey("generated_sheets.id"), nullable=True)
    uploaded_image_path = Column(String(500), nullable=False)
    detected_answers_json = Column(Text, nullable=False)
    score = Column(Integer, nullable=False, default=0)
    total_questions = Column(Integer, nullable=False)
    correct_count = Column(Integer, nullable=False, default=0)
    incorrect_count = Column(Integer, nullable=False, default=0)
    blank_count = Column(Integer, nullable=False, default=0)
    result_json = Column(Text, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    test = relationship("Test", back_populates="grading_results")


class GradingHistory(Base):
    __tablename__ = "grading_history"

    id = Column(Integer, primary_key=True, index=True)
    test_id = Column(Integer, ForeignKey("tests.id"), nullable=False)
    sheet_id = Column(Integer, ForeignKey("generated_sheets.id"), nullable=True)
    qr_code_id = Column(Integer, ForeignKey("qr_codes.id"), nullable=True)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    original_image_path = Column(String(500), nullable=False)
    processed_image_path = Column(String(500), nullable=True)
    annotated_image_path = Column(String(500), nullable=True)

    detected_answers_json = Column(Text, nullable=False)
    answer_key_json = Column(Text, nullable=False)

    score = Column(Integer, nullable=False, default=0)
    total_questions = Column(Integer, nullable=False)
    correct_count = Column(Integer, nullable=False, default=0)
    incorrect_count = Column(Integer, nullable=False, default=0)
    blank_count = Column(Integer, nullable=False, default=0)
    ambiguous_count = Column(Integer, nullable=False, default=0)

    result_json = Column(Text, nullable=False)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    test = relationship("Test", back_populates="grading_history")
    sheet = relationship("GeneratedSheet")
    student = relationship("User")
