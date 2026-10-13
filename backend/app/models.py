from typing import List, Dict, Optional, Any, Union
from pydantic import BaseModel, Field

class ChoiceOption(BaseModel):
    id: str  # e.g. "A", "B", "C", "D"
    fill_ratio: float = 0.0
    is_marked: bool = False
    bbox: Optional[List[int]] = None  # [x, y, w, h] on transformed image

class QuestionAnswer(BaseModel):
    question_number: int
    local_question_number: int = 1  # 1 to 40 for AISCC exam columns
    section: Optional[str] = "General"
    correct_answer: str = ""  # e.g. "A", "B", or "A/B" for multi-key
    student_answer: Optional[str] = None  # e.g. "A", "BLANK", "A,B" (multiple)
    status: str = "unanswered"  # "correct", "incorrect", "unanswered", "ambiguous"
    confidence: float = 1.0  # 0.0 to 1.0
    needs_review: bool = False
    points_awarded: float = 0.0
    points_possible: float = 1.0
    choices: List[ChoiceOption] = []
    notes: Optional[str] = None

class SectionSummary(BaseModel):
    section_name: str
    total_questions: int
    correct_count: int
    incorrect_count: int
    unanswered_count: int
    ambiguous_count: int
    score: float
    max_score: float
    percentage: float

class GradingRules(BaseModel):
    points_per_correct: float = 1.0
    points_per_incorrect: float = 0.0  # no negative marking by default
    points_per_unanswered: float = 0.0
    points_per_ambiguous: float = 0.0
    allow_multiple_answers: bool = False
    fill_threshold: float = 0.30  # fill ratio to be considered marked
    uncertain_lower_threshold: float = 0.16  # below this is blank
    ambiguity_margin: float = 0.12  # if top two choices are within this margin, flag ambiguous

class AnswerKeyData(BaseModel):
    title: str = "Answer Key"
    description: Optional[str] = None
    total_questions: int
    sections: List[str] = []
    # Key is question number as int, or string key "sec_num"
    answers: Dict[str, str] = {}  # e.g. {"1": "B", "2": "C", ...}
    section_mapping: Dict[str, str] = {}  # e.g. {"1": "General Information", ...}
    choices_per_question: int = 4  # A, B, C, D
    is_verified: bool = False

class AnswerKeyVerificationUpdate(BaseModel):
    answers: Dict[str, str]
    section_mapping: Optional[Dict[str, str]] = None
    title: Optional[str] = None
    is_verified: bool = True

class GradingResult(BaseModel):
    session_id: str
    student_name: Optional[str] = "Student Answer Sheet"
    control_number: Optional[str] = None
    total_questions: int
    total_score: float
    max_score: float
    percentage: float
    correct_count: int
    incorrect_count: int
    unanswered_count: int
    ambiguous_count: int
    needs_review_count: int
    sections: List[SectionSummary] = []
    questions: List[QuestionAnswer] = []
    annotated_image_url: Optional[str] = None  # Base64 data URL
    warped_image_url: Optional[str] = None
    processing_time_ms: float = 0.0

class ManualCorrectionRequest(BaseModel):
    question_number: int
    corrected_answer: str  # e.g. "A", "B", "BLANK"
    section: Optional[str] = None

class DetectionReviewResponse(BaseModel):
    session_id: str
    uncertain_questions: List[QuestionAnswer]
    total_uncertain: int

class TemplateInfo(BaseModel):
    template_id: str
    name: str
    description: str
    total_questions: int
    sections: List[str]
    choices: List[str]
