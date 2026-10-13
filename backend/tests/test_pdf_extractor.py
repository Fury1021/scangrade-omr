import os
import pytest
from backend.app.services.pdf_extractor import extract_answer_key_from_bytes, _try_extract_text_key
import pymupdf

def test_extract_aiscc_sample_pdf():
    pdf_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "sample_data",
        "AISCC_Batch_02_Answer_Key.pdf"
    )
    assert os.path.exists(pdf_path), "Sample PDF should exist in sample_data"
    
    with open(pdf_path, "rb") as f:
        content = f.read()
        
    result = extract_answer_key_from_bytes(content, filename="AISCC_Batch_02_Answer_Key.pdf")
    
    assert result.total_questions == 160
    assert len(result.sections) == 4
    assert "General Information" in result.sections
    assert "Logical Information" in result.sections
    assert "Mathematics" in result.sections
    assert "English" in result.sections
    
    # Check known answers from page 1
    # Q1: B
    assert result.answers["1"] == "B"
    # Q2: C
    assert result.answers["2"] == "C"
    # Q3: A
    assert result.answers["3"] == "A"
    # Q6: D
    assert result.answers["6"] == "D"
    # Q39 of General Information is blank in the exam sheet
    assert result.answers["39"] == "BLANK"
    # Q40: C
    assert result.answers["40"] == "C"
    
    # Logical Reasoning Q1 (Global Q41) is A
    assert result.answers["41"] == "A"

def test_extract_text_answer_key():
    doc = pymupdf.open()
    page = doc.new_page()
    text = """
    OFFICIAL EXAM KEY
    1. A
    2. B
    3. C
    4. D
    5. A
    6. B
    """
    page.insert_text((50, 50), text)
    
    key = _try_extract_text_key(doc)
    assert key is not None
    assert key.total_questions == 6
    assert key.answers["1"] == "A"
    assert key.answers["2"] == "B"
    assert key.answers["3"] == "C"
    assert key.answers["4"] == "D"
