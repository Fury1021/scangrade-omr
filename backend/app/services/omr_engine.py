"""
OMR Engine (Optical Mark Recognition) using OpenCV and NumPy
Features:
- Document boundary detection and 4-point perspective transformation
- Deskew and CLAHE illumination compensation
- Sub-pixel alignment calibration
- Deterministic inner ROI fill ratio measurement
- Confidence estimation and multiple-mark / partial-mark classification
- High-resolution visual overlay generation with Base64 output
"""

import cv2
import numpy as np
import base64
import time
from typing import Dict, List, Optional, Tuple, Any

from backend.app.models import (
    ChoiceOption,
    QuestionAnswer,
    GradingRules,
    AnswerKeyData
)
from backend.app.templates.aiscc_160 import get_aiscc_grid_points, PAGE_WIDTH_PT, PAGE_HEIGHT_PT, SECTIONS

CANONICAL_WIDTH = 2000
CANONICAL_HEIGHT = int(2000 * (PAGE_HEIGHT_PT / PAGE_WIDTH_PT))  # ~3058 px

class OMREngine:
    def __init__(self, rules: Optional[GradingRules] = None):
        self.rules = rules or GradingRules()
        
    def detect_dynamic_grid(self, img: np.ndarray) -> Tuple[Optional[List[Dict]], Optional[np.ndarray]]:
        """
        Dynamically detects the 160-question answer bubble grid from square contours.
        Handles:
        - Cropped screenshots (no header / control number)
        - Mobile camera captures with arbitrary margins
        - Full-page scans / PDFs with headers
        
        Returns (grid, thresh_img) or (None, None) if dynamic detection is not viable.
        """
        H, W = img.shape[:2]
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if len(img.shape) == 3 else img
        _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
        contours, _ = cv2.findContours(thresh, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
        
        min_dim = int(W * 0.010)
        max_dim = int(W * 0.040)
        
        boxes = []
        for c in contours:
            x, y, w, h = cv2.boundingRect(c)
            aspect = w / float(h)
            if min_dim <= w <= max_dim and min_dim <= h <= max_dim and 0.75 <= aspect <= 1.30:
                boxes.append((x, y, w, h))
                
        if len(boxes) < 200:
            return None, None
            
        med_w = np.median([b[2] for b in boxes])
        med_h = np.median([b[3] for b in boxes])
        
        # Deduplicate concentric / inner contours
        boxes = sorted(boxes, key=lambda b: (b[1], b[0]))
        dedup = []
        thresh_dist = med_w * 0.4
        for b in boxes:
            cx = b[0] + b[2] / 2.0
            cy = b[1] + b[3] / 2.0
            if not any(abs(cx - (ex[0] + ex[2] / 2.0)) < thresh_dist and abs(cy - (ex[1] + ex[3] / 2.0)) < thresh_dist for ex in dedup):
                dedup.append(b)
                
        valid = [b for b in dedup if 0.7 * med_w <= b[2] <= 1.3 * med_w and 0.7 * med_h <= b[3] <= 1.3 * med_h]
        valid.sort(key=lambda b: b[1])
        
        if len(valid) < 200:
            return None, None
            
        # If there are header boxes (> 640 boxes, e.g. 661 in full sheet with 21 header boxes),
        # isolate the bottom continuous block of 640 answer boxes
        if len(valid) > 640:
            grid_boxes = valid[-640:]
        else:
            grid_boxes = valid
            
        # Cluster into 4 columns by X coordinate using k-means
        x_centers = np.array([b[0] + b[2] / 2.0 for b in grid_boxes]).reshape(-1, 1).astype(np.float32)
        criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 100, 0.2)
        _, labels, centers = cv2.kmeans(x_centers, 4, None, criteria, 10, cv2.KMEANS_PP_CENTERS)
        sorted_order = np.argsort(centers.flatten())
        label_map = {orig: i for i, orig in enumerate(sorted_order)}
        
        cols = {0: [], 1: [], 2: [], 3: []}
        for i, b in enumerate(grid_boxes):
            col_idx = label_map[int(labels[i][0])]
            cols[col_idx].append(b)
            
        for c_idx in range(4):
            if len(cols[c_idx]) < 40:
                return None, None
                
        grid = []
        for c_idx in range(4):
            c_boxes = cols[c_idx]
            sec_name = SECTIONS[c_idx] if c_idx < len(SECTIONS) else f"Section {c_idx + 1}"
            
            # 4 options (A, B, C, D) X centers
            opt_xs = np.array([b[0] + b[2] / 2.0 for b in c_boxes]).reshape(-1, 1).astype(np.float32)
            _, _, opt_centers = cv2.kmeans(opt_xs, 4, None, criteria, 10, cv2.KMEANS_PP_CENTERS)
            sorted_opts = sorted(opt_centers.flatten())
            
            # 40 rows Y centers
            y_centers = np.array([b[1] + b[3] / 2.0 for b in c_boxes]).reshape(-1, 1).astype(np.float32)
            _, _, row_centers = cv2.kmeans(y_centers, 40, None, criteria, 10, cv2.KMEANS_PP_CENTERS)
            sorted_rows = sorted(row_centers.flatten())
            
            for r_idx in range(40):
                global_q = c_idx * 40 + (r_idx + 1)
                y_center_px = int(sorted_rows[r_idx])
                q_data = {
                    "question_number": global_q,
                    "local_question_number": r_idx + 1,
                    "section": sec_name,
                    "y_center": y_center_px,
                    "box_w": int(med_w),
                    "box_h": int(med_h),
                    "options": {}
                }
                for opt_idx, opt_char in enumerate(["A", "B", "C", "D"]):
                    x_center_px = int(sorted_opts[opt_idx])
                    x_min = x_center_px - int(med_w) // 2
                    y_min = y_center_px - int(med_h) // 2
                    q_data["options"][opt_char] = {
                        "center": (x_center_px, y_center_px),
                        "bbox": [x_min, y_min, int(med_w), int(med_h)]
                    }
                grid.append(q_data)
                
        return grid, thresh

    def _orient_sheet_upright(self, img: np.ndarray) -> np.ndarray:
        """
        Ensures the answer sheet image is in portrait orientation (H > W) and upright.
        Mobile devices often deliver landscape images (W > H) or inverted orientations.
        """
        H, W = img.shape[:2]
        
        # If image is landscape (W > H), answer sheets are strictly portrait.
        # Test rotating 90° CCW vs 90° CW to determine which is upright.
        if W > H:
            cand_ccw = cv2.rotate(img, cv2.ROTATE_90_COUNTERCLOCKWISE)
            cand_cw = cv2.rotate(img, cv2.ROTATE_90_CLOCKWISE)
            
            g_ccw, _ = self.detect_dynamic_grid(cand_ccw)
            g_cw, _ = self.detect_dynamic_grid(cand_cw)
            
            if g_ccw is not None and g_cw is None:
                return cand_ccw
            elif g_cw is not None and g_ccw is None:
                return cand_cw
            elif g_ccw is not None and g_cw is not None:
                y_ccw = np.mean([q["y_center"] for q in g_ccw]) / float(cand_ccw.shape[0])
                y_cw = np.mean([q["y_center"] for q in g_cw]) / float(cand_cw.shape[0])
                # Upright sheet has header at top and grid at bottom (higher mean Y)
                return cand_ccw if y_ccw >= y_cw else cand_cw
            else:
                # Default landscape to portrait
                return cand_ccw
                
        # If image is portrait (H >= W):
        grid, _ = self.detect_dynamic_grid(img)
        if grid is None:
            # If dynamic grid failed in current portrait orientation, test 180° rotation
            cand_180 = cv2.rotate(img, cv2.ROTATE_180)
            grid_180, _ = self.detect_dynamic_grid(cand_180)
            if grid_180 is not None:
                return cand_180
                
        return img

    def process_image(
        self,
        image_bytes: bytes,
        answer_key: AnswerKeyData,
        auto_align: bool = True,
        rotation_degrees: int = 0
    ) -> Tuple[List[QuestionAnswer], str, str, float]:
        """
        Runs the full OMR pipeline:
        1. Decode image (respecting EXIF orientation) & apply manual rotation if requested
        2. Auto-orient sheet to upright portrait
        3. Detect dynamic answer grid (or detect paper boundary & warp)
        4. Measure bubble shading & compute fill ratios
        5. Compare against answer key
        6. Generate annotated overlay image
        
        Returns:
            questions: List of QuestionAnswer
            annotated_image_url: Base64 data URI of the annotated sheet
            warped_image_url: Base64 data URI of the aligned sheet
            processing_time_ms: Execution time in milliseconds
        """
        start_time = time.time()
        
        # 1. Decode image with EXIF orientation support (iOS/Android photos)
        try:
            from PIL import Image, ImageOps
            import io
            pil_img = Image.open(io.BytesIO(image_bytes))
            pil_img = ImageOps.exif_transpose(pil_img)
            if pil_img.mode != "RGB":
                pil_img = pil_img.convert("RGB")
            raw_img = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)
        except Exception:
            nparr = np.frombuffer(image_bytes, np.uint8)
            raw_img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if raw_img is None:
            raise ValueError("Invalid image file: could not decode image")
            
        # Apply manual rotation if explicitly requested
        if rotation_degrees == 90:
            raw_img = cv2.rotate(raw_img, cv2.ROTATE_90_CLOCKWISE)
        elif rotation_degrees == 180:
            raw_img = cv2.rotate(raw_img, cv2.ROTATE_180)
        elif rotation_degrees == 270:
            raw_img = cv2.rotate(raw_img, cv2.ROTATE_90_COUNTERCLOCKWISE)
            
        # Auto-orient to upright portrait if auto_align is enabled
        if auto_align:
            raw_img = self._orient_sheet_upright(raw_img)
            
        # 2. Check for dynamic grid directly on raw_img (works for cropped screenshots, phone photos)
        dynamic_grid, dynamic_thresh = self.detect_dynamic_grid(raw_img) if auto_align else (None, None)
        
        if dynamic_grid is not None and dynamic_thresh is not None:
            grid = dynamic_grid
            target_img = raw_img
            working_ink = dynamic_thresh
            shift_x, shift_y = 0, 0
            warped_img = raw_img
        else:
            # Perspective correction fallback
            warped_img = self.detect_and_warp_paper(raw_img) if auto_align else cv2.resize(raw_img, (CANONICAL_WIDTH, CANONICAL_HEIGHT))
            
            # Try dynamic grid on warped image
            dynamic_grid_w, dynamic_thresh_w = self.detect_dynamic_grid(warped_img) if auto_align else (None, None)
            if dynamic_grid_w is not None and dynamic_thresh_w is not None:
                grid = dynamic_grid_w
                target_img = warped_img
                working_ink = dynamic_thresh_w
                shift_x, shift_y = 0, 0
            else:
                # Preprocess canonical image with CLAHE and adaptive threshold
                target_img = warped_img
                gray = cv2.cvtColor(warped_img, cv2.COLOR_BGR2GRAY)
                clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8, 8))
                enhanced = clahe.apply(gray)
                binary = cv2.adaptiveThreshold(
                    enhanced,
                    255,
                    cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                    cv2.THRESH_BINARY_INV,
                    blockSize=25,
                    C=10
                )
                hsv = cv2.cvtColor(warped_img, cv2.COLOR_BGR2HSV)
                blue_mask = cv2.inRange(hsv, np.array([90, 40, 40]), np.array([140, 255, 220]))
                working_ink = cv2.bitwise_or(binary, blue_mask)
                
                # Standard template grid
                grid = get_aiscc_grid_points(CANONICAL_WIDTH, CANONICAL_HEIGHT)
                shift_x, shift_y = self._detect_fine_alignment_shift(working_ink, grid)
        
        # 3. Measure fill ratios and classify marks
        question_answers = []
        annotated_img = target_img.copy()
        target_h, target_w = target_img.shape[:2]
        
        fill_thresh = self.rules.fill_threshold
        uncertain_thresh = self.rules.uncertain_lower_threshold
        ambiguity_margin = self.rules.ambiguity_margin
        
        for q_item in grid:
            q_num = q_item["question_number"]
            q_str = str(q_num)
            sec_name = q_item["section"]
            correct_key = answer_key.answers.get(q_str, "BLANK")
            
            box_w = q_item["box_w"]
            box_h = q_item["box_h"]
            
            choices = []
            marked_choices = []
            
            for opt, opt_data in q_item["options"].items():
                x_center, y_center = opt_data["center"]
                x = x_center + shift_x - box_w // 2
                y = y_center + shift_y - box_h // 2
                
                # Extract inner region of interest (inner 60% to avoid counting the printed box frame)
                margin_x = int(box_w * 0.20)
                margin_y = int(box_h * 0.20)
                
                x1 = max(0, x + margin_x)
                y1 = max(0, y + margin_y)
                x2 = min(target_w, x + box_w - margin_x)
                y2 = min(target_h, y + box_h - margin_y)
                
                roi = working_ink[y1:y2, x1:x2]
                
                if roi.size > 0:
                    fill_ratio = float(np.mean(roi) / 255.0)
                else:
                    fill_ratio = 0.0
                    
                choices.append(ChoiceOption(
                    id=opt,
                    fill_ratio=round(fill_ratio, 3),
                    is_marked=False,
                    bbox=[int(x), int(y), int(box_w), int(box_h)]
                ))
                    
            # Sort choices by fill ratio descending
            sorted_by_fill = sorted(choices, key=lambda c: c.fill_ratio, reverse=True)
            top_fill = sorted_by_fill[0].fill_ratio
            second_fill = sorted_by_fill[1].fill_ratio if len(sorted_by_fill) > 1 else 0.0
            
            student_answer = "BLANK"
            status = "unanswered"
            needs_review = False
            confidence = 1.0
            points = 0.0
            
            # Check for multiple marks (competing shaded bubbles)
            is_competing_multiple = (
                (top_fill >= 0.40 and second_fill >= 0.35 and (top_fill - second_fill < ambiguity_margin)) or
                (top_fill >= 0.25 and second_fill >= 0.25 and (top_fill - second_fill < 0.05))
            )
            
            # Classification logic
            if top_fill < uncertain_thresh:
                # Completely blank
                student_answer = "BLANK"
                status = "unanswered"
                confidence = max(0.5, 1.0 - top_fill)
                needs_review = False
            elif is_competing_multiple:
                # Genuinely ambiguous: multiple shaded marks or neck-and-neck top two marks
                competing_opts = [c.id for c in choices if c.fill_ratio >= max(0.25, top_fill - ambiguity_margin)]
                student_answer = ", ".join(competing_opts) if len(competing_opts) > 1 else f"{sorted_by_fill[0].id}?"
                status = "ambiguous"
                confidence = 0.40
                needs_review = True
            elif top_fill >= fill_thresh or (top_fill >= 0.25 and (top_fill - second_fill >= 0.05)):
                # Single clear mark
                student_answer = sorted_by_fill[0].id
                confidence = min(1.0, 0.70 + (top_fill - second_fill) * 0.5)
                if correct_key == student_answer:
                    status = "correct"
                    points = self.rules.points_per_correct
                else:
                    status = "incorrect"
                    points = self.rules.points_per_incorrect
            else:
                # Weak mark / smudge / eraser mark
                student_answer = sorted_by_fill[0].id
                status = "ambiguous"
                confidence = 0.45
                needs_review = True
                
            # Update is_marked for choices
            for c in choices:
                c.is_marked = bool(student_answer and (c.id == student_answer or c.id in student_answer.split(", ")))
                
            # If key is blank, mark as neutral or correct
            if correct_key == "BLANK" and student_answer == "BLANK":
                status = "correct"
                points = self.rules.points_per_correct
                needs_review = False
                
            local_q_num = q_item.get("local_question_number", ((q_num - 1) % 40) + 1)
            q_res = QuestionAnswer(
                question_number=q_num,
                local_question_number=local_q_num,
                section=sec_name,
                correct_answer=correct_key,
                student_answer=student_answer,
                status=status,
                confidence=round(confidence, 2),
                needs_review=needs_review,
                points_awarded=points,
                points_possible=self.rules.points_per_correct,
                choices=choices,
                notes=f"Fill: {top_fill:.2f} (2nd: {second_fill:.2f})"
            )
            question_answers.append(q_res)
            
            # 4. Draw visual annotations on overlay
            self._draw_question_annotation(annotated_img, q_res, choices)
            
        # Convert images to base64 for direct frontend response
        annotated_base64 = self._img_to_base64(annotated_img, quality=85)
        warped_base64 = self._img_to_base64(warped_img, quality=75)
        
        processing_time = round((time.time() - start_time) * 1000, 2)
        return question_answers, annotated_base64, warped_base64, processing_time

    def detect_and_warp_paper(self, img: np.ndarray) -> np.ndarray:
        """
        Detects document corners and performs 4-point perspective warp.
        Falls back to image resize if clear paper quadrilateral is not found.
        """
        orig_h, orig_w = img.shape[:2]
        
        # Downscale for fast contour detection
        scale = 1000.0 / max(orig_h, orig_w)
        resized = cv2.resize(img, (int(orig_w * scale), int(orig_h * scale)))
        gray = cv2.cvtColor(resized, cv2.COLOR_BGR2GRAY)
        
        # Gaussian blur + Canny edges
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)
        edged = cv2.Canny(blurred, 50, 150)
        
        # Dilate to connect edges
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
        dilated = cv2.dilate(edged, kernel, iterations=2)
        
        contours, _ = cv2.findContours(dilated, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        contours = sorted(contours, key=cv2.contourArea, reverse=True)
        
        paper_corners = None
        for c in contours[:5]:
            peri = cv2.arcLength(c, True)
            approx = cv2.approxPolyDP(c, 0.02 * peri, True)
            
            # Check if 4 points and area is significant (> 35% of image)
            if len(approx) == 4 and cv2.contourArea(c) > (resized.shape[0] * resized.shape[1] * 0.35):
                paper_corners = approx.reshape(4, 2) / scale
                break
                
        if paper_corners is not None:
            # Order corners: top-left, top-right, bottom-right, bottom-left
            ordered_corners = self._order_points(paper_corners)
            dst_pts = np.array([
                [0, 0],
                [CANONICAL_WIDTH - 1, 0],
                [CANONICAL_WIDTH - 1, CANONICAL_HEIGHT - 1],
                [0, CANONICAL_HEIGHT - 1]
            ], dtype=np.float32)
            
            M = cv2.getPerspectiveTransform(ordered_corners, dst_pts)
            warped = cv2.warpPerspective(img, M, (CANONICAL_WIDTH, CANONICAL_HEIGHT))
            return warped
            
        # Fallback: simple resize
        return cv2.resize(img, (CANONICAL_WIDTH, CANONICAL_HEIGHT))

    def _order_points(self, pts: np.ndarray) -> np.ndarray:
        """Orders 4 points: top-left, top-right, bottom-right, bottom-left."""
        rect = np.zeros((4, 2), dtype=np.float32)
        s = pts.sum(axis=1)
        rect[0] = pts[np.argmin(s)]      # top-left has smallest sum
        rect[2] = pts[np.argmax(s)]      # bottom-right has largest sum
        diff = np.diff(pts, axis=1)
        rect[1] = pts[np.argmin(diff)]   # top-right has smallest diff
        rect[3] = pts[np.argmax(diff)]   # bottom-left has largest diff
        return rect

    def _detect_fine_alignment_shift(self, binary: np.ndarray, grid: List[Dict]) -> Tuple[int, int]:
        """
        Detects minor horizontal or vertical shifts (-12px to +12px) by cross-correlating
        expected box positions with detected ink.
        Requires significant signal before shifting from (0,0).
        """
        sample_q = grid[:20]
        
        # Calculate baseline score at (0, 0)
        base_score = 0
        for q in sample_q:
            for opt, opt_data in q["options"].items():
                x = opt_data["center"][0]
                y = opt_data["center"][1]
                if 0 <= y < binary.shape[0] and 0 <= x < binary.shape[1]:
                    base_score += int(binary[y, x])
                    
        best_score = base_score
        best_dx, best_dy = 0, 0
        
        # Test candidate shifts in steps of 3 px
        for dy in range(-12, 13, 3):
            for dx in range(-12, 13, 3):
                if dx == 0 and dy == 0:
                    continue
                score = 0
                for q in sample_q:
                    for opt, opt_data in q["options"].items():
                        x = opt_data["center"][0] + dx
                        y = opt_data["center"][1] + dy
                        if 0 <= y < binary.shape[0] and 0 <= x < binary.shape[1]:
                            score += int(binary[y, x])
                # Only shift if score is significantly better (e.g. at least 25% higher and substantial)
                if score > best_score * 1.25 and score > 255 * 8:
                    best_score = score
                    best_dx, best_dy = dx, dy
                    
        return best_dx, best_dy

    def _draw_question_annotation(self, img: np.ndarray, q: QuestionAnswer, choices: List[ChoiceOption]):
        """
        Renders clear, professional visual overlays on the warped answer sheet:
        - Correct answer: Green solid box
        - Incorrect student answer: Red solid box
        - Missed correct answer: Green dashed box
        - Ambiguous/Multiple: Amber solid box
        - Unanswered: Soft gray outline
        """
        color_correct = (34, 197, 94)      # #22c55e (Green in BGR)
        color_incorrect = (59, 130, 246)    # In BGR: (59, 130, 246) -> Red/Orange: (37, 99, 235) in BGR is (37, 68, 239)
        # Let's use explicit BGR:
        # BGR Green: (60, 180, 50)
        # BGR Red: (50, 50, 220)
        # BGR Amber/Yellow: (0, 180, 245)
        # BGR Light Gray: (180, 180, 180)
        bgr_green = (50, 180, 50)
        bgr_red = (50, 50, 225)
        bgr_amber = (0, 175, 245)
        bgr_gray = (190, 190, 190)
        
        line_thick = max(1, int(img.shape[1] / 650))
        font_scale = max(0.35, img.shape[1] / 2200.0)
        pad = max(1, line_thick)
        
        correct_key = q.correct_answer
        student_ans = q.student_answer
        
        for c in choices:
            if not c.bbox:
                continue
            x, y, w, h = c.bbox
            opt_letter = c.id
            
            if q.status == "correct" and opt_letter == student_ans:
                # Green box around student's correct mark
                cv2.rectangle(img, (x-pad, y-pad), (x+w+pad, y+h+pad), bgr_green, line_thick + 1)
                # Small checkmark badge
                cv2.putText(img, "+1", (x+w+pad+1, y+h-pad), cv2.FONT_HERSHEY_SIMPLEX, font_scale, bgr_green, line_thick)
            elif q.status == "incorrect":
                if opt_letter == student_ans:
                    # Red box around student's wrong mark
                    cv2.rectangle(img, (x-pad, y-pad), (x+w+pad, y+h+pad), bgr_red, line_thick + 1)
                    # Cross mark badge
                    cv2.putText(img, "X", (x+w+pad+1, y+h-pad), cv2.FONT_HERSHEY_SIMPLEX, font_scale, bgr_red, line_thick)
                elif opt_letter == correct_key:
                    # Highlight missed correct answer with green rectangle
                    cv2.rectangle(img, (x-pad, y-pad), (x+w+pad, y+h+pad), bgr_green, line_thick)
            elif q.status == "ambiguous":
                if c.is_marked:
                    cv2.rectangle(img, (x-pad, y-pad), (x+w+pad, y+h+pad), bgr_amber, line_thick + 1)
                    cv2.putText(img, "?", (x+w+pad+1, y+h-pad), cv2.FONT_HERSHEY_SIMPLEX, font_scale, bgr_amber, line_thick)
            elif q.status == "unanswered":
                if opt_letter == correct_key:
                    # Indicate the key they missed
                    cv2.rectangle(img, (x-pad, y-pad), (x+w+pad, y+h+pad), (100, 200, 100), line_thick)

    def _img_to_base64(self, img: np.ndarray, quality: int = 80) -> str:
        """Encodes an OpenCV image to JPEG Base64 data URI."""
        encode_params = [int(cv2.IMWRITE_JPEG_QUALITY), quality]
        success, buffer = cv2.imencode(".jpg", img, encode_params)
        if not success:
            return ""
        b64 = base64.b64encode(buffer).decode("utf-8")
        return f"data:image/jpeg;base64,{b64}"
