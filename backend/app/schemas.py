from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, field_validator


class QuestionDef(BaseModel):
    question_number: int
    options: list[str]
    correct_answer: str

    @field_validator("options")
    @classmethod
    def min_two_options(cls, v):
        if len(v) < 2:
            raise ValueError("Each question must have at least 2 options")
        return v

    @field_validator("correct_answer")
    @classmethod
    def answer_in_options(cls, v, info):
        if "options" in info.data and v not in info.data["options"]:
            raise ValueError(f"correct_answer '{v}' must be one of {info.data['options']}")
        return v


class TestCreate(BaseModel):
    name: str
    description: str = ""
    course_id: Optional[int] = None
    questions: list[QuestionDef]


class TestUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    course_id: Optional[int] = None
    number_of_questions: Optional[int] = None
    questions: Optional[list[QuestionDef]] = None


class TestOut(BaseModel):
    id: int
    name: str
    description: str
    course_id: Optional[int] = None
    created_by_id: Optional[int] = None
    number_of_questions: int
    number_of_options: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class TestListOut(BaseModel):
    id: int
    name: str
    description: str
    number_of_questions: int
    number_of_options: int
    course_id: Optional[int] = None
    created_at: datetime
    has_sheet: bool = False

    class Config:
        from_attributes = True


class TemplateOut(BaseModel):
    id: int
    test_id: int
    layout_json: Any
    marker_config_json: Any
    page_width: int
    page_height: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class EvaluationOut(BaseModel):
    id: int
    test_id: int
    answer_key_json: Any
    scoring_config_json: Any
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class TestDetailOut(BaseModel):
    test: TestOut
    template: Optional[TemplateOut] = None
    evaluation: Optional[EvaluationOut] = None
    course: Optional[dict] = None
    assignments: list[dict] = []


class GeneratedSheetOut(BaseModel):
    id: int
    test_id: int
    student_id: Optional[int] = None
    file_path: str
    image_path: str
    pdf_path: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class GradingResultOut(BaseModel):
    id: int
    test_id: int
    uploaded_image_path: str
    detected_answers_json: Any
    score: int
    total_questions: int
    correct_count: int
    incorrect_count: int
    blank_count: int
    result_json: Any
    created_at: datetime

    class Config:
        from_attributes = True


class GradingHistoryOut(BaseModel):
    id: int
    test_id: int
    test_name: str = ""
    sheet_id: Optional[int] = None
    student_id: Optional[int] = None
    student_name: str = ""
    course_name: str = ""
    score: int
    total_questions: int
    correct_count: int
    incorrect_count: int
    blank_count: int
    ambiguous_count: int
    annotated_image_path: Optional[str] = None
    processed_image_path: Optional[str] = None
    original_image_path: Optional[str] = None
    detected_answers: dict[str, str]
    per_question: list[dict[str, Any]]
    created_at: datetime
    updated_at: Optional[datetime] = None


class GradeResponse(BaseModel):
    id: int
    score: int
    total_questions: int
    correct_count: int
    incorrect_count: int
    blank_count: int
    detected_answers: dict[str, str]
    per_question: list[dict[str, Any]]


class AutoDetectResponse(BaseModel):
    status: str
    qr_detected: bool = False
    exam_detected: bool = False
    markers_detected: bool = False
    test_id: Optional[int] = None
    test_name: Optional[str] = None
    sheet_id: Optional[int] = None
    student_id: Optional[int] = None
    score: Optional[int] = None
    total_questions: Optional[int] = None
    correct_count: Optional[int] = None
    incorrect_count: Optional[int] = None
    blank_count: Optional[int] = None
    answers: Optional[dict[str, str]] = None
    should_redirect: Optional[bool] = None
    redirect_url: Optional[str] = None
    error: Optional[str] = None
