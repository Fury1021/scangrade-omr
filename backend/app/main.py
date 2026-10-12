"""
ScanGrade OMR - FastAPI Backend
Automatic Answer Sheet Scanner and Grading Engine
"""

import json
import os
import uuid
from typing import Optional
from fastapi import FastAPI, File, UploadFile, Form, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response

from backend.app.models import (
    AnswerKeyData,
    AnswerKeyVerificationUpdate,
    GradingResult,
    GradingRules,
    ManualCorrectionRequest,
    TemplateInfo
)
from backend.app.services.pdf_extractor import extract_answer_key_from_bytes
from backend.app.services.omr_engine import OMREngine
from backend.app.services.grading_service import (
    compile_grading_results,
    recalculate_after_correction
)
from backend.app.services.exporter import generate_csv_report, generate_pdf_report
from backend.app.templates.standard_templates import AVAILABLE_TEMPLATES

app = FastAPI(
    title="ScanGrade OMR Grading Service",
    description="Deterministic Optical Mark Recognition (OMR) grading engine for paper answer sheets",
    version="1.0.0"
)

# Enable CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SAMPLE_PDF_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "sample_data",
    "AISCC_Batch_02_Answer_Key.pdf"
)

SAMPLE_IMG_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "sample_data",
    "sample_answer_key_300dpi.png"
)

@app.get("/api/health")
async def health_check():
    return {
        "status": "online",
        "service": "ScanGrade OMR",
        "version": "1.0.0",
        "templates_available": list(AVAILABLE_TEMPLATES.keys())
    }

@app.get("/api/templates")
async def list_templates():
    """Lists preconfigured answer sheet layouts."""
    templates = []
    for t_id, t in AVAILABLE_TEMPLATES.items():
        templates.append({
            "template_id": t["id"],
            "name": t["name"],
            "description": t["description"],
            "total_questions": t["total_questions"],
            "sections": t["sections"],
            "choices": t["choices"]
        })
    return {"templates": templates}

@app.post("/api/answer-key/upload")
async def upload_answer_key(file: UploadFile = File(...)):
    """
    Accepts an answer-key PDF or supported answer-sheet layout,
    extracts the questions and answers, and returns AnswerKeyData.
    """
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported for answer keys")
        
    try:
        content = await file.read()
        if len(content) > 25 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="File size exceeds 25MB limit")
            
        key_data = extract_answer_key_from_bytes(content, filename=file.filename)
        return key_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process answer key PDF: {str(e)}")

@app.get("/api/sample/answer-key")
async def get_sample_answer_key():
    """Returns the preloaded AISCC Batch 02 Answer Key for quick one-click testing."""
    if not os.path.exists(SAMPLE_PDF_PATH):
        raise HTTPException(status_code=404, detail="Sample PDF not found")
        
    with open(SAMPLE_PDF_PATH, "rb") as f:
        content = f.read()
        
    key_data = extract_answer_key_from_bytes(content, filename="AISCC_Batch_02_Answer_Key.pdf")
    return key_data

@app.get("/api/sample/student-sheet")
async def get_sample_student_sheet():
    """Returns the sample 300 DPI answer sheet as a downloadable image for testing."""
    if not os.path.exists(SAMPLE_IMG_PATH):
        raise HTTPException(status_code=404, detail="Sample student sheet image not found")
        
    with open(SAMPLE_IMG_PATH, "rb") as f:
        img_bytes = f.read()
        
    return Response(content=img_bytes, media_type="image/png")

@app.post("/api/scan/grade")
async def scan_and_grade(
    file: UploadFile = File(...),
    answer_key_json: str = Form(...),
    rules_json: Optional[str] = Form(None),
    auto_align: bool = Form(True),
    rotation: int = Form(0),
    student_name: Optional[str] = Form("Candidate 01"),
    control_number: Optional[str] = Form(None)
):
    """
    Main grading endpoint:
    Processes the uploaded paper sheet (image or single-page PDF),
    runs OpenCV OMR detection, checks against the answer key, and calculates scores.
    """
    try:
        raw_key = json.loads(answer_key_json)
        answer_key = AnswerKeyData(**raw_key)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid answer key data: {str(e)}")
        
    rules = GradingRules()
    if rules_json:
        try:
            rules = GradingRules(**json.loads(rules_json))
        except Exception:
            pass
            
    content = await file.read()
    if len(content) > 30 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Uploaded file size exceeds 30MB")
        
    # If uploaded file is a PDF, render first page to PNG
    filename = file.filename.lower()
    if filename.endswith(".pdf"):
        import pymupdf
        doc = pymupdf.open(stream=content, filetype="pdf")
        if len(doc) == 0:
            raise HTTPException(status_code=400, detail="Uploaded PDF has no pages")
        pix = doc[0].get_pixmap(dpi=250)
        image_bytes = pix.tobytes("png")
    else:
        image_bytes = content
        
    engine = OMREngine(rules=rules)
    session_id = str(uuid.uuid4())[:8]
    
    try:
        questions, annotated_url, warped_url, proc_time = engine.process_image(
            image_bytes=image_bytes,
            answer_key=answer_key,
            auto_align=auto_align,
            rotation_degrees=rotation
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OMR Image processing error: {str(e)}")
        
    result = compile_grading_results(
        session_id=session_id,
        questions=questions,
        answer_key=answer_key,
        rules=rules,
        student_name=student_name or "Candidate",
        control_number=control_number,
        annotated_image_url=annotated_url,
        warped_image_url=warped_url,
        processing_time_ms=proc_time
    )
    
    return result

@app.post("/api/grading/correct")
async def manual_correction(
    current_result: GradingResult,
    correction: ManualCorrectionRequest,
    rules: Optional[GradingRules] = None
):
    """
    Applies manual verification / correction for an uncertain question and updates scores immediately.
    """
    active_rules = rules or GradingRules()
    updated = recalculate_after_correction(
        result=current_result,
        question_number=correction.question_number,
        corrected_answer=correction.corrected_answer,
        rules=active_rules
    )
    return updated

@app.post("/api/export/csv")
async def export_csv(result: GradingResult):
    """Generates downloadable CSV results."""
    csv_text = generate_csv_report(result)
    filename = f"ScanGrade_Results_{result.session_id}.csv"
    return Response(
        content=csv_text,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )

@app.post("/api/export/pdf")
async def export_pdf(result: GradingResult):
    """Generates official downloadable PDF grading report."""
    pdf_bytes = generate_pdf_report(result)
    filename = f"ScanGrade_Report_{result.session_id}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )
