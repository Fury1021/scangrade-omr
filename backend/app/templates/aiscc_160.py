"""
Template definition for CAAP AISCC Qualifying Examination Answer Sheet
(Aeronautical Information Service Comprehensive Course)
Page Size: 612 x 936 pt (US Folio/Legal)
160 Questions total, divided into 4 subjects of 40 questions each:
1. General Information (Q1 - Q40)
2. Logical Information (Q1 - Q40)
3. Mathematics (Q1 - Q40)
4. English (Q1 - Q40)
"""

from typing import Dict, List, Tuple

PAGE_WIDTH_PT = 612.0
PAGE_HEIGHT_PT = 936.0

SECTIONS = [
    "General Information",
    "Logical Information",
    "Mathematics",
    "English"
]

# Column definitions in PDF points (612 x 936 coordinate system)
COLUMNS_CONFIG = [
    {
        "name": "General Information",
        "section_index": 0,
        "q_num_x": 45.7,
        "choices_x": {
            "A": 71.2,
            "B": 94.1,
            "C": 117.0,
            "D": 139.7
        },
        "box_size_pt": 12.0
    },
    {
        "name": "Logical Information",
        "section_index": 1,
        "q_num_x": 169.8,
        "choices_x": {
            "A": 195.4,
            "B": 218.3,
            "C": 241.1,
            "D": 264.0
        },
        "box_size_pt": 12.0
    },
    {
        "name": "Mathematics",
        "section_index": 2,
        "q_num_x": 294.0,
        "choices_x": {
            "A": 319.5,
            "B": 342.5,
            "C": 365.3,
            "D": 388.2
        },
        "box_size_pt": 12.0
    },
    {
        "name": "English",
        "section_index": 3,
        "q_num_x": 418.1,
        "choices_x": {
            "A": 443.7,
            "B": 466.6,
            "C": 489.5,
            "D": 512.3
        },
        "box_size_pt": 12.0
    }
]

# Row Y centers in PDF points for Q1 to Q40
# Starting around Y=215.5 with step ~15.5 pt
ROW_START_Y_PT = 215.55
ROW_STEP_Y_PT = 15.52

def get_aiscc_grid_points(target_width: int, target_height: int) -> List[Dict]:
    """
    Returns the pixel coordinates for every question and option on an image
    scaled to (target_width, target_height).
    """
    scale_x = target_width / PAGE_WIDTH_PT
    scale_y = target_height / PAGE_HEIGHT_PT
    
    grid = []
    
    for col_info in COLUMNS_CONFIG:
        sec_name = col_info["name"]
        sec_idx = col_info["section_index"]
        box_w = int(col_info["box_size_pt"] * scale_x)
        box_h = int(col_info["box_size_pt"] * scale_y)
        
        for q_idx in range(1, 41):
            y_center_pt = ROW_START_Y_PT + (q_idx - 1) * ROW_STEP_Y_PT
            y_center_px = int(y_center_pt * scale_y)
            
            # Global question number: (sec_idx * 40) + q_idx
            global_q_num = (sec_idx * 40) + q_idx
            
            question_data = {
                "question_number": global_q_num,
                "local_question_number": q_idx,
                "section": sec_name,
                "y_center": y_center_px,
                "box_w": box_w,
                "box_h": box_h,
                "options": {}
            }
            
            for opt, x_pt in col_info["choices_x"].items():
                x_center_px = int(x_pt * scale_x)
                x_min = x_center_px - box_w // 2
                y_min = y_center_px - box_h // 2
                question_data["options"][opt] = {
                    "center": (x_center_px, y_center_px),
                    "bbox": [x_min, y_min, box_w, box_h]
                }
                
            grid.append(question_data)
            
    return grid
