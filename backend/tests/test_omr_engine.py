import cv2
import numpy as np
import pytest
from backend.app.models import GradingRules, AnswerKeyData
from backend.app.services.omr_engine import OMREngine

def create_synthetic_sheet():
    """Generates a synthetic binary answer sheet with known markings for testing."""
    # Canonical size: 2000 x 3058
    img = np.ones((3058, 2000, 3), dtype=np.uint8) * 255
    
    from backend.app.templates.aiscc_160 import get_aiscc_grid_points
    grid = get_aiscc_grid_points(2000, 3058)
    
    # Mark Q1 Option B (fully shaded)
    q1_opt_b = grid[0]["options"]["B"]["center"]
    cv2.circle(img, q1_opt_b, 18, (0, 0, 0), -1)
    
    # Mark Q2 with multiple marks: Option A and Option C (both shaded)
    q2_opt_a = grid[1]["options"]["A"]["center"]
    q2_opt_c = grid[1]["options"]["C"]["center"]
    cv2.circle(img, q2_opt_a, 18, (0, 0, 0), -1)
    cv2.circle(img, q2_opt_c, 18, (0, 0, 0), -1)
    
    # Q3 is left completely blank
    
    # Mark Q4 Option D
    q4_opt_d = grid[3]["options"]["D"]["center"]
    cv2.circle(img, q4_opt_d, 18, (0, 0, 0), -1)
    
    _, enc = cv2.imencode(".png", img)
    return enc.tobytes()

def test_omr_engine_mark_classification_and_multiple_marks():
    img_bytes = create_synthetic_sheet()
    
    # Answer key expecting: Q1: B, Q2: A, Q3: C, Q4: D
    key = AnswerKeyData(
        title="Test Synthetic Key",
        total_questions=160,
        sections=["General Information", "Logical Reasoning", "Mathematics", "English"],
        answers={
            "1": "B",
            "2": "A",
            "3": "C",
            "4": "D"
        }
    )
    
    engine = OMREngine()
    questions, annotated_url, warped_url, proc_time = engine.process_image(
        image_bytes=img_bytes,
        answer_key=key,
        auto_align=False
    )
    
    assert len(questions) == 160
    assert annotated_url.startswith("data:image/jpeg;base64,")
    
    # Q1 should be CORRECT (student answered B, key is B)
    q1 = questions[0]
    assert q1.question_number == 1
    assert q1.student_answer == "B"
    assert q1.status == "correct"
    assert q1.points_awarded == 1.0
    
    # Q2 should be AMBIGUOUS / MULTIPLE MARKED (A and C)
    q2 = questions[1]
    assert q2.question_number == 2
    assert q2.status == "ambiguous"
    assert q2.needs_review is True
    assert "A" in q2.student_answer and "C" in q2.student_answer
    
    # Q3 should be UNANSWERED / BLANK
    q3 = questions[2]
    assert q3.question_number == 3
    assert q3.student_answer == "BLANK"
    assert q3.status == "unanswered"
    assert q3.points_awarded == 0.0

def test_omr_engine_rotation():
    img_bytes = create_synthetic_sheet()
    key = AnswerKeyData(
        title="Test Key",
        total_questions=160,
        sections=["General Information", "Logical Reasoning", "Mathematics", "English"],
        answers={"1": "B"}
    )
    
    engine = OMREngine()
    # Test that 90, 180, 270 rotations process without crash
    for rot in [90, 180, 270]:
        questions, annotated_url, _, _ = engine.process_image(
            image_bytes=img_bytes,
            answer_key=key,
            auto_align=False,
            rotation_degrees=rot
        )
        assert len(questions) == 160
        assert annotated_url is not None

def test_omr_engine_dynamic_grid_cropped_sheet():
    """Verifies that OMREngine dynamically aligns and accurately grades cropped sheets with no headers."""
    import cv2
    from backend.app.services.pdf_extractor import extract_answer_key_from_bytes
    
    with open('backend/sample_data/AISCC_Batch_02_Answer_Key.pdf', 'rb') as f:
        key_data = extract_answer_key_from_bytes(f.read())
        
    im = cv2.imread('backend/sample_data/sample_answer_key_300dpi.png')
    assert im is not None, "Sample answer sheet image not found"
    
    # Crop out the entire top header (remove first 750 pixels)
    cropped = im[750:, :]
    _, enc = cv2.imencode('.png', cropped)
    
    engine = OMREngine()
    questions, annotated_url, _, proc_time = engine.process_image(
        image_bytes=enc.tobytes(),
        answer_key=key_data,
        auto_align=True
    )
    
    assert len(questions) == 160
    assert annotated_url.startswith("data:image/jpeg;base64,")
    total_score = sum(q.points_awarded for q in questions)
    assert total_score >= 155.0, f"Expected near-perfect score on cropped sheet, got {total_score}"

