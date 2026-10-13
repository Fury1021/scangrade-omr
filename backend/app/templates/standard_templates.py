"""
Standard OMR Templates for 50-question and 100-question answer sheets
and registry of available templates.
"""
from typing import Dict, List, Any
from backend.app.templates.aiscc_160 import get_aiscc_grid_points, SECTIONS as AISCC_SECTIONS

AVAILABLE_TEMPLATES = {
    "aiscc_160": {
        "id": "aiscc_160",
        "name": "CAAP AISCC Qualifying Exam (160 Questions)",
        "description": "Official 4-column layout for CAAP AISCC Batch Qualifying Examination. 40 questions x 4 sections (General Information, Logical Information, Mathematics, English).",
        "total_questions": 160,
        "sections": AISCC_SECTIONS,
        "choices": ["A", "B", "C", "D"],
        "aspect_ratio": 612.0 / 936.0,
        "grid_generator": get_aiscc_grid_points
    },
    "standard_50": {
        "id": "standard_50",
        "name": "Standard 50-Question Answer Sheet",
        "description": "General purpose 2-column answer sheet with 25 questions per column and 4 choices (A, B, C, D).",
        "total_questions": 50,
        "sections": ["Part 1 (Q1-25)", "Part 2 (Q26-50)"],
        "choices": ["A", "B", "C", "D"],
        "aspect_ratio": 612.0 / 792.0,  # Letter
        "grid_generator": None
    },
    "standard_100": {
        "id": "standard_100",
        "name": "Standard 100-Question Answer Sheet",
        "description": "General purpose 4-column answer sheet with 25 questions per column and 4 choices (A, B, C, D).",
        "total_questions": 100,
        "sections": ["Column 1 (Q1-25)", "Column 2 (Q26-50)", "Column 3 (Q51-75)", "Column 4 (Q76-100)"],
        "choices": ["A", "B", "C", "D"],
        "aspect_ratio": 612.0 / 792.0,
        "grid_generator": None
    }
}

def get_standard_50_grid(target_width: int, target_height: int) -> List[Dict]:
    """Generates standard 50-question 2-column grid."""
    grid = []
    # 2 columns: Col 1 (Q1-25) at X 20%-45%, Col 2 (Q26-50) at X 55%-80%
    cols = [
        {"q_start": 1, "sec": "Part 1 (Q1-25)", "x_start": int(target_width * 0.18), "dx": int(target_width * 0.065)},
        {"q_start": 26, "sec": "Part 2 (Q26-50)", "x_start": int(target_width * 0.58), "dx": int(target_width * 0.065)}
    ]
    box_w = int(target_width * 0.035)
    box_h = int(target_height * 0.018)
    
    y_start = int(target_height * 0.22)
    y_step = int(target_height * 0.028)
    
    for col in cols:
        for i in range(25):
            q_num = col["q_start"] + i
            y = y_start + i * y_step
            q_data = {
                "question_number": q_num,
                "local_question_number": i + 1,
                "section": col["sec"],
                "y_center": y,
                "box_w": box_w,
                "box_h": box_h,
                "options": {}
            }
            for opt_idx, opt in enumerate(["A", "B", "C", "D"]):
                x = col["x_start"] + opt_idx * col["dx"]
                q_data["options"][opt] = {
                    "center": (x, y),
                    "bbox": [x - box_w // 2, y - box_h // 2, box_w, box_h]
                }
            grid.append(q_data)
    return grid

AVAILABLE_TEMPLATES["standard_50"]["grid_generator"] = get_standard_50_grid
