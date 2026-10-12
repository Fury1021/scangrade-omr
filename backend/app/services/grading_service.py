"""
Grading Service
Calculates total scores, percentages, section breakdowns, and handles manual corrections.
"""

from typing import List, Dict, Optional
from backend.app.models import (
    QuestionAnswer,
    SectionSummary,
    GradingResult,
    GradingRules,
    AnswerKeyData
)

def compile_grading_results(
    session_id: str,
    questions: List[QuestionAnswer],
    answer_key: AnswerKeyData,
    rules: GradingRules,
    student_name: str = "Candidate Answer Sheet",
    control_number: Optional[str] = None,
    annotated_image_url: Optional[str] = None,
    warped_image_url: Optional[str] = None,
    processing_time_ms: float = 0.0
) -> GradingResult:
    """
    Computes overall statistics and per-section breakdowns from question responses.
    """
    total_q = len(questions)
    correct_count = 0
    incorrect_count = 0
    unanswered_count = 0
    ambiguous_count = 0
    needs_review_count = 0
    total_score = 0.0
    max_score = 0.0
    
    # Group questions by section
    sections_map: Dict[str, List[QuestionAnswer]] = {}
    
    for q in questions:
        sec = q.section or "General"
        if sec not in sections_map:
            sections_map[sec] = []
        sections_map[sec].append(q)
        
        max_score += q.points_possible
        total_score += q.points_awarded
        
        if q.status == "correct":
            correct_count += 1
        elif q.status == "incorrect":
            incorrect_count += 1
        elif q.status == "unanswered":
            unanswered_count += 1
        elif q.status == "ambiguous":
            ambiguous_count += 1
            
        if q.needs_review:
            needs_review_count += 1
            
    # Calculate section summaries
    section_summaries: List[SectionSummary] = []
    # Preserve order of sections from answer key if available
    ordered_sections = [s for s in answer_key.sections if s in sections_map]
    for s in sections_map.keys():
        if s not in ordered_sections:
            ordered_sections.append(s)
            
    for sec_name in ordered_sections:
        sec_questions = sections_map.get(sec_name, [])
        sec_total = len(sec_questions)
        sec_corr = sum(1 for q in sec_questions if q.status == "correct")
        sec_inc = sum(1 for q in sec_questions if q.status == "incorrect")
        sec_unans = sum(1 for q in sec_questions if q.status == "unanswered")
        sec_amb = sum(1 for q in sec_questions if q.status == "ambiguous")
        sec_score = sum(q.points_awarded for q in sec_questions)
        sec_max = sum(q.points_possible for q in sec_questions)
        sec_pct = round((sec_score / sec_max * 100.0) if sec_max > 0 else 0.0, 1)
        
        section_summaries.append(SectionSummary(
            section_name=sec_name,
            total_questions=sec_total,
            correct_count=sec_corr,
            incorrect_count=sec_inc,
            unanswered_count=sec_unans,
            ambiguous_count=sec_amb,
            score=round(sec_score, 2),
            max_score=round(sec_max, 2),
            percentage=sec_pct
        ))
        
    overall_pct = round((total_score / max_score * 100.0) if max_score > 0 else 0.0, 1)
    
    return GradingResult(
        session_id=session_id,
        student_name=student_name,
        control_number=control_number,
        total_questions=total_q,
        total_score=round(total_score, 2),
        max_score=round(max_score, 2),
        percentage=overall_pct,
        correct_count=correct_count,
        incorrect_count=incorrect_count,
        unanswered_count=unanswered_count,
        ambiguous_count=ambiguous_count,
        needs_review_count=needs_review_count,
        sections=section_summaries,
        questions=questions,
        annotated_image_url=annotated_image_url,
        warped_image_url=warped_image_url,
        processing_time_ms=processing_time_ms
    )

def recalculate_after_correction(
    result: GradingResult,
    question_number: int,
    corrected_answer: str,
    rules: GradingRules
) -> GradingResult:
    """
    Updates a single question's answer and recalculates all totals immediately.
    """
    updated_questions = []
    for q in result.questions:
        if q.question_number == question_number:
            student_ans = corrected_answer.upper().strip()
            status = "unanswered" if student_ans in ("BLANK", "") else (
                "correct" if student_ans == q.correct_answer else "incorrect"
            )
            pts = rules.points_per_correct if status == "correct" else rules.points_per_incorrect
            
            updated_q = q.model_copy(update={
                "student_answer": student_ans,
                "status": status,
                "points_awarded": pts,
                "needs_review": False,
                "confidence": 1.0,
                "notes": "Manually verified by examiner"
            })
            updated_questions.append(updated_q)
        else:
            updated_questions.append(q)
            
    # Mock answer key object for re-compiling sections
    sections = [s.section_name for s in result.sections]
    dummy_key = AnswerKeyData(
        title="Active Key",
        total_questions=result.total_questions,
        sections=sections
    )
    
    return compile_grading_results(
        session_id=result.session_id,
        questions=updated_questions,
        answer_key=dummy_key,
        rules=rules,
        student_name=result.student_name,
        control_number=result.control_number,
        annotated_image_url=result.annotated_image_url,
        warped_image_url=result.warped_image_url,
        processing_time_ms=result.processing_time_ms
    )
