import json
import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.tests.test_omr_engine import create_synthetic_sheet

client = TestClient(app)

def test_api_health():
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "online"
    assert data["service"] == "ScanGrade OMR"

def test_api_templates():
    res = client.get("/api/templates")
    assert res.status_code == 200
    data = res.json()
    assert "templates" in data
    assert any(t["template_id"] == "aiscc_160" for t in data["templates"])

def test_api_sample_answer_key():
    res = client.get("/api/sample/answer-key")
    assert res.status_code == 200
    data = res.json()
    assert data["total_questions"] == 160
    assert len(data["sections"]) == 4

def test_api_scan_and_grade_synthetic():
    img_bytes = create_synthetic_sheet()
    
    answer_key_dict = {
        "title": "API Test Key",
        "total_questions": 160,
        "sections": ["General Information", "Logical Information", "Mathematics", "English"],
        "answers": {"1": "B", "2": "A", "3": "C", "4": "D"},
        "section_mapping": {"1": "General Information", "2": "General Information"},
        "choices_per_question": 4,
        "is_verified": True
    }
    
    files = {
        "file": ("sheet.png", img_bytes, "image/png")
    }
    data = {
        "answer_key_json": json.dumps(answer_key_dict),
        "auto_align": "false",
        "rotation": "0",
        "student_name": "Test Candidate"
    }
    
    res = client.post("/api/scan/grade", files=files, data=data)
    assert res.status_code == 200
    result = res.json()
    assert result["total_questions"] == 160
    assert result["student_name"] == "Test Candidate"
    assert result["correct_count"] >= 1
    assert "annotated_image_url" in result
    assert result["annotated_image_url"].startswith("data:image/jpeg;base64,")

def test_api_export_csv():
    # Build minimal result
    grading_res = {
        "session_id": "exp123",
        "student_name": "Export Candidate",
        "control_number": "CTRL-001",
        "total_questions": 2,
        "total_score": 2.0,
        "max_score": 2.0,
        "percentage": 100.0,
        "correct_count": 2,
        "incorrect_count": 0,
        "unanswered_count": 0,
        "ambiguous_count": 0,
        "needs_review_count": 0,
        "sections": [],
        "questions": [
            {
                "question_number": 1,
                "section": "General",
                "correct_answer": "A",
                "student_answer": "A",
                "status": "correct",
                "confidence": 1.0,
                "needs_review": False,
                "points_awarded": 1.0,
                "points_possible": 1.0,
                "choices": []
            }
        ]
    }
    
    res = client.post("/api/export/csv", json=grading_res)
    assert res.status_code == 200
    assert "text/csv" in res.headers["content-type"]
    assert "Export Candidate" in res.text

def test_api_export_pdf():
    grading_res = {
        "session_id": "pdf123",
        "student_name": "PDF Candidate",
        "control_number": "CTRL-002",
        "total_questions": 2,
        "total_score": 2.0,
        "max_score": 2.0,
        "percentage": 100.0,
        "correct_count": 2,
        "incorrect_count": 0,
        "unanswered_count": 0,
        "ambiguous_count": 0,
        "needs_review_count": 0,
        "sections": [],
        "questions": []
    }
    
    res = client.post("/api/export/pdf", json=grading_res)
    assert res.status_code == 200
    assert "application/pdf" in res.headers["content-type"]
    assert len(res.content) > 1000
