import pytest
from backend.app.models import QuestionAnswer, ChoiceOption, GradingRules, AnswerKeyData
from backend.app.services.grading_service import compile_grading_results, recalculate_after_correction

def test_compile_grading_results_perfect_score():
    questions = [
        QuestionAnswer(
            question_number=1,
            section="General Information",
            correct_answer="A",
            student_answer="A",
            status="correct",
            confidence=1.0,
            points_awarded=1.0,
            points_possible=1.0
        ),
        QuestionAnswer(
            question_number=2,
            section="General Information",
            correct_answer="B",
            student_answer="B",
            status="correct",
            confidence=1.0,
            points_awarded=1.0,
            points_possible=1.0
        )
    ]
    key = AnswerKeyData(
        title="Test Key",
        total_questions=2,
        sections=["General Information"]
    )
    rules = GradingRules()
    
    result = compile_grading_results(
        session_id="test1",
        questions=questions,
        answer_key=key,
        rules=rules
    )
    
    assert result.total_score == 2.0
    assert result.percentage == 100.0
    assert result.correct_count == 2
    assert result.incorrect_count == 0
    assert result.unanswered_count == 0
    assert result.ambiguous_count == 0
    assert len(result.sections) == 1
    assert result.sections[0].percentage == 100.0

def test_compile_grading_results_with_blanks_and_ambiguous():
    questions = [
        QuestionAnswer(
            question_number=1,
            section="Math",
            correct_answer="A",
            student_answer="A",
            status="correct",
            points_awarded=1.0
        ),
        QuestionAnswer(
            question_number=2,
            section="Math",
            correct_answer="B",
            student_answer="C",
            status="incorrect",
            points_awarded=0.0
        ),
        QuestionAnswer(
            question_number=3,
            section="Math",
            correct_answer="D",
            student_answer="BLANK",
            status="unanswered",
            points_awarded=0.0
        ),
        QuestionAnswer(
            question_number=4,
            section="Math",
            correct_answer="A",
            student_answer="A, B",
            status="ambiguous",
            needs_review=True,
            points_awarded=0.0
        )
    ]
    key = AnswerKeyData(title="Test", total_questions=4, sections=["Math"])
    rules = GradingRules()
    
    result = compile_grading_results("test2", questions, key, rules)
    assert result.total_score == 1.0
    assert result.percentage == 25.0
    assert result.correct_count == 1
    assert result.incorrect_count == 1
    assert result.unanswered_count == 1
    assert result.ambiguous_count == 1
    assert result.needs_review_count == 1

def test_manual_correction_recalculation():
    questions = [
        QuestionAnswer(
            question_number=1,
            section="General",
            correct_answer="B",
            student_answer="A",
            status="incorrect",
            points_awarded=0.0
        )
    ]
    key = AnswerKeyData(title="Test", total_questions=1, sections=["General"])
    rules = GradingRules()
    initial_res = compile_grading_results("test3", questions, key, rules)
    assert initial_res.total_score == 0.0
    assert initial_res.correct_count == 0
    
    # Correct the answer from A to B
    corrected_res = recalculate_after_correction(initial_res, 1, "B", rules)
    assert corrected_res.total_score == 1.0
    assert corrected_res.correct_count == 1
    assert corrected_res.questions[0].status == "correct"
    assert corrected_res.percentage == 100.0
