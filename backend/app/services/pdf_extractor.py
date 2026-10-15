"""
PDF Answer Key Extractor Service
Supports:
1. Vector shaded exam sheets (e.g. CAAP AISCC Qualifying Exam 160-question sheet)
2. Tabular answer keys (tables with Question | Answer)
3. Text numbered lists (e.g. "1. A", "2: C", "3 - D")
4. Scanned / image-based answer sheets (via rasterization + OpenCV OMR)
5. Blank sheet detection
"""

import json
import re
from typing import Dict, List, Optional, Tuple, Any
import pymupdf  # PyMuPDF
import cv2
import numpy as np

from backend.app.models import AnswerKeyData
from backend.app.templates.aiscc_160 import (
    COLUMNS_CONFIG,
    PAGE_WIDTH_PT,
    PAGE_HEIGHT_PT,
    ROW_START_Y_PT,
    ROW_STEP_Y_PT,
    SECTIONS as AISCC_SECTIONS
)

def extract_answer_key_from_bytes(file_bytes: bytes, filename: str = "uploaded.pdf") -> AnswerKeyData:
    """
    Extracts answer key from PDF bytes.
    Tries vector parsing first, then text regex/tables, then rasterized OMR.
    """
    doc = pymupdf.open(stream=file_bytes, filetype="pdf")
    if len(doc) == 0:
        raise ValueError("PDF file is empty")
        
    page = doc[0]
    
    # 1. Try vector shaded sheet extraction (AISCC format)
    vector_result = _try_extract_aiscc_vector(page)
    if vector_result is not None:
        return vector_result
        
    # 2. Try text-based table / list extraction
    text_result = _try_extract_text_key(doc)
    if text_result is not None:
        return text_result
        
    # 3. If raster or image-based, render page to image and run OMR
    omr_result = _try_extract_raster_omr(page)
    if omr_result is not None:
        return omr_result
        
    # 4. Fallback: default empty template for 50 or 40 questions
    return AnswerKeyData(
        title="Blank / Unrecognized Sheet",
        description="Could not automatically detect filled answers. Please verify or configure the answers manually.",
        total_questions=40,
        sections=["General"],
        answers={str(i): "A" for i in range(1, 41)},
        section_mapping={str(i): "General" for i in range(1, 41)},
        choices_per_question=4,
        is_verified=False
    )

def _try_extract_aiscc_vector(page: pymupdf.Page) -> Optional[AnswerKeyData]:
    """
    Extracts answers from vector-rendered AISCC sheets using character coordinates and glyphs.
    """
    try:
        raw_json = json.loads(page.get_text("rawjson"))
    except Exception:
        return None
        
    chars = []
    for b in raw_json.get("blocks", []):
        for l in b.get("lines", []):
            for s in l.get("spans", []):
                for ch in s.get("chars", []):
                    c = ch.get("c")
                    code = ord(c) if isinstance(c, str) else c
                    bbox = ch.get("bbox")
                    chars.append({
                        "char": chr(code) if 32 <= code < 127 else f"\\u{code:04x}",
                        "code": code,
                        "bbox": bbox,
                        "x": (bbox[0] + bbox[2]) / 2,
                        "y": (bbox[1] + bbox[3]) / 2,
                        "font": s.get("font")
                    })
                    
    # Filled symbols: \u25a0, \u25aa, \u25fc, \u25fe (black square)
    filled_chars = [c for c in chars if c["code"] in (0x25a0, 0x25aa, 0x25fc, 0x25fe)]
    # Empty symbols: \uf06f, \u25a1, \u25fb, \u25fd, \u25cb, etc.
    empty_chars = [c for c in chars if c["code"] in (0xf06f, 0x25a1, 0x25fb, 0x25fd, 0x25cb, 0x25ef, 0x25ce)]
    
    total_markers = len(filled_chars) + len(empty_chars)
    # AISCC has 640 markers (160 questions * 4 choices)
    if total_markers < 50:
        return None  # Not a vector shaded sheet
        
    answers: Dict[str, str] = {}
    section_mapping: Dict[str, str] = {}
    
    # Check if page size matches US Legal/Folio (width ~612, height ~936)
    rect = page.rect
    scale_x = rect.width / PAGE_WIDTH_PT
    scale_y = rect.height / PAGE_HEIGHT_PT
    
    for col_info in COLUMNS_CONFIG:
        sec_name = col_info["name"]
        sec_idx = col_info["section_index"]
        
        for q_idx in range(1, 41):
            global_q_num = (sec_idx * 40) + q_idx
            q_str = str(global_q_num)
            section_mapping[q_str] = sec_name
            
            y_center = (ROW_START_Y_PT + (q_idx - 1) * ROW_STEP_Y_PT) * scale_y
            
            # Find markers for each option A, B, C, D
            marked_options = []
            for opt, x_pt in col_info["choices_x"].items():
                target_x = x_pt * scale_x
                # Find if any filled char matches target_x and y_center
                for fc in filled_chars:
                    if abs(fc["x"] - target_x) < 8.0 * scale_x and abs(fc["y"] - y_center) < 7.0 * scale_y:
                        marked_options.append(opt)
                        break
                        
            if len(marked_options) == 1:
                answers[q_str] = marked_options[0]
            elif len(marked_options) > 1:
                answers[q_str] = "/".join(marked_options)
            else:
                answers[q_str] = "BLANK"
                
    filled_count = sum(1 for v in answers.values() if v != "BLANK")
    is_blank = (filled_count == 0)

    title = "AISCC Qualifying Examination Answer Key" if not is_blank else "AISCC Qualifying Exam Sheet (Blank Sheet Template)"
    description = (
        f"Extracted {filled_count} shaded answers directly from AISCC 4-column vector exam answer sheet (160 Questions)."
        if not is_blank
        else "Notice: No shaded bubbles detected on this page (all 160 questions are blank). Please upload the shaded sample key or manually assign answers."
    )

    return AnswerKeyData(
        title=title,
        description=description,
        total_questions=160,
        sections=AISCC_SECTIONS,
        answers=answers,
        section_mapping=section_mapping,
        choices_per_question=4,
        is_verified=(filled_count >= 10)
    )

def _try_extract_text_key(doc: pymupdf.Document) -> Optional[AnswerKeyData]:
    """
    Extracts answer keys formatted as text:
    E.g.
    1. A
    2. B
    3. C
    Or 4 sections with 1-40 items each.
    """
    full_text = ""
    for p in doc:
        full_text += p.get_text() + "\n"
        
    # Match patterns like: "1. A", "1) B", "1 - C", "Q1: D", "1.A"
    pattern = re.compile(r'(?:Q(?:uestion)?\s*)?(\d{1,3})\s*[\.\:\-\)\s]\s*([A-Ea-e])\b')
    matches = pattern.findall(full_text)
    
    if len(matches) >= 5:
        q_nums = [int(m[0]) for m in matches]
        is_multi_section_40 = False
        
        # Check if numbers reset or stay <= 40 with many questions
        if max(q_nums) <= 40 and len(matches) > 40:
            is_multi_section_40 = True
        else:
            resets = sum(1 for i in range(1, len(q_nums)) if q_nums[i] == 1 and q_nums[i-1] >= 20)
            if resets >= 1:
                is_multi_section_40 = True
                
        if is_multi_section_40:
            answers = {}
            section_mapping = {}
            sec_idx = 0
            prev_num = 0
            
            for q_str, ans in matches:
                q_num = int(q_str)
                if q_num < prev_num and (prev_num >= 20 or q_num == 1):
                    sec_idx = min(3, sec_idx + 1)
                prev_num = q_num
                
                sec_name = AISCC_SECTIONS[sec_idx] if sec_idx < len(AISCC_SECTIONS) else f"Section {sec_idx + 1}"
                global_q = (sec_idx * 40) + q_num
                answers[str(global_q)] = ans.upper()
                section_mapping[str(global_q)] = sec_name
                
            for i in range(1, 161):
                s = str(i)
                sec_i = (i - 1) // 40
                if s not in answers:
                    answers[s] = "BLANK"
                    section_mapping[s] = AISCC_SECTIONS[sec_i]
                    
            return AnswerKeyData(
                title="AISCC 4-Column Text Answer Key",
                description="Extracted 4 sections of 1-40 items each (160 Questions total).",
                total_questions=160,
                sections=AISCC_SECTIONS,
                answers=answers,
                section_mapping=section_mapping,
                choices_per_question=4,
                is_verified=True
            )
            
        answers = {}
        section_mapping = {}
        for q_str, ans in matches:
            q_num = int(q_str)
            answers[str(q_num)] = ans.upper()
            sec_i = (q_num - 1) // 40
            sec_name = AISCC_SECTIONS[sec_i] if (0 <= sec_i < 4 and len(matches) > 40) else "General"
            section_mapping[str(q_num)] = sec_name
            
        total_q = max(int(k) for k in answers.keys())
        sections = AISCC_SECTIONS if (total_q == 160 or len(matches) > 40) else ["General"]
        
        for i in range(1, total_q + 1):
            s = str(i)
            if s not in answers:
                answers[s] = "BLANK"
                sec_i = (i - 1) // 40
                section_mapping[s] = AISCC_SECTIONS[sec_i] if (0 <= sec_i < 4 and total_q == 160) else "General"
                
        return AnswerKeyData(
            title="Text-Extracted Answer Key",
            description=f"Extracted {len(matches)} answers from text/tabular formatting.",
            total_questions=total_q,
            sections=sections,
            answers=answers,
            section_mapping=section_mapping,
            choices_per_question=4,
            is_verified=True
        )

def _try_extract_raster_omr(page: pymupdf.Page) -> Optional[AnswerKeyData]:
    """
    Renders page to image and attempts OMR detection.
    """
    pix = page.get_pixmap(dpi=200)
    img_data = pix.tobytes("png")
    nparr = np.frombuffer(img_data, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    
    if img is None:
        return None
        
    # Check if aspect ratio is roughly US Legal (AISCC)
    h, w = img.shape[:2]
    aspect = w / float(h)
    
    if 0.60 <= aspect <= 0.70:
        # Attempt AISCC layout on image
        from backend.app.templates.aiscc_160 import get_aiscc_grid_points
        grid = get_aiscc_grid_points(w, h)
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        _, thresh = cv2.threshold(gray, 180, 255, cv2.THRESH_BINARY_INV)
        
        answers = {}
        section_mapping = {}
        detected_count = 0
        
        for q_item in grid:
            q_str = str(q_item["question_number"])
            section_mapping[q_str] = q_item["section"]
            box_w = q_item["box_w"]
            box_h = q_item["box_h"]
            
            marked = []
            for opt, opt_data in q_item["options"].items():
                x, y, bw, bh = opt_data["bbox"]
                # Inner region
                margin_x = int(bw * 0.22)
                margin_y = int(bh * 0.22)
                roi = thresh[max(0, y+margin_y):min(h, y+bh-margin_y), max(0, x+margin_x):min(w, x+bw-margin_x)]
                if roi.size > 0:
                    fill = np.mean(roi) / 255.0
                    if fill > 0.40:
                        marked.append(opt)
                        
            if len(marked) == 1:
                answers[q_str] = marked[0]
                detected_count += 1
            elif len(marked) > 1:
                answers[q_str] = "/".join(marked)
                detected_count += 1
            else:
                answers[q_str] = "BLANK"
                
        if detected_count > 10:
            return AnswerKeyData(
                title="AISCC Scanned Sheet Answer Key",
                description=f"Extracted {detected_count} shaded answers via image OMR.",
                total_questions=160,
                sections=AISCC_SECTIONS,
                answers=answers,
                section_mapping=section_mapping,
                choices_per_question=4,
                is_verified=True
            )
            
    return None
