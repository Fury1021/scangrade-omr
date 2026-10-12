"""
Report Exporter Service
Generates:
1. CSV export of question results
2. PDF examination grading certificate/report using ReportLab
"""

import io
import csv
from typing import Optional
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    HRFlowable,
    KeepTogether
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

from backend.app.models import GradingResult

def generate_csv_report(result: GradingResult) -> str:
    """Generates a CSV string containing question-by-question grading details."""
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Metadata Header
    writer.writerow(["ScanGrade OMR Examination Results"])
    writer.writerow(["Candidate Name", result.student_name])
    writer.writerow(["Control Number", result.control_number or "N/A"])
    writer.writerow(["Total Questions", result.total_questions])
    writer.writerow(["Total Score", f"{result.total_score} / {result.max_score} ({result.percentage}%)"])
    writer.writerow(["Correct Answers", result.correct_count])
    writer.writerow(["Incorrect Answers", result.incorrect_count])
    writer.writerow(["Unanswered", result.unanswered_count])
    writer.writerow(["Ambiguous / Review", result.ambiguous_count])
    writer.writerow([])
    
    # Section Breakdown
    writer.writerow(["--- Section Performance Breakdown ---"])
    writer.writerow(["Section", "Score", "Max Score", "Percentage", "Correct", "Incorrect", "Unanswered"])
    for s in result.sections:
        writer.writerow([
            s.section_name,
            s.score,
            s.max_score,
            f"{s.percentage}%",
            s.correct_count,
            s.incorrect_count,
            s.unanswered_count
        ])
    writer.writerow([])
    
    # Question by Question Table
    writer.writerow(["--- Question-by-Question Details ---"])
    writer.writerow(["Question #", "Section", "Correct Answer", "Student Answer", "Result", "Score", "Confidence", "Notes"])
    for q in result.questions:
        writer.writerow([
            q.question_number,
            q.section,
            q.correct_answer,
            q.student_answer or "BLANK",
            q.status.upper(),
            q.points_awarded,
            f"{int(q.confidence * 100)}%",
            q.notes or ""
        ])
        
    return output.getvalue()

def generate_pdf_report(result: GradingResult) -> bytes:
    """Generates a professional PDF report using ReportLab."""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        leftMargin=36,
        rightMargin=36,
        topMargin=36,
        bottomMargin=36
    )
    
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontSize=18,
        leading=22,
        textColor=colors.HexColor('#0f172a'),
        alignment=1  # Center
    )
    sub_style = ParagraphStyle(
        'DocSub',
        parent=styles['Normal'],
        fontSize=10,
        leading=14,
        textColor=colors.HexColor('#64748b'),
        alignment=1
    )
    section_h2 = ParagraphStyle(
        'SectionH2',
        parent=styles['Heading2'],
        fontSize=12,
        leading=16,
        textColor=colors.HexColor('#1e293b'),
        spaceBefore=10,
        spaceAfter=6
    )
    cell_text = ParagraphStyle(
        'CellText',
        parent=styles['Normal'],
        fontSize=8,
        leading=10,
        textColor=colors.HexColor('#1e293b')
    )
    
    story = []
    
    # Header Banner
    story.append(Paragraph("<b>SCANGRADE OMR — EXAMINATION GRADING REPORT</b>", title_style))
    story.append(Paragraph("Aeronautical Information Service Comprehensive Course (AISCC) / CAAP Exam Grading System", sub_style))
    story.append(Spacer(1, 12))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor('#3b82f6'), spaceAfter=14))
    
    # Candidate Summary Card Table
    summary_data = [
        [
            Paragraph("<b>Candidate:</b> " + (result.student_name or "N/A"), cell_text),
            Paragraph("<b>Control No:</b> " + (result.control_number or "N/A"), cell_text),
            Paragraph(f"<b>Total Score:</b> <font color='#1d4ed8'><b>{result.total_score} / {result.max_score} ({result.percentage}%)</b></font>", cell_text)
        ],
        [
            Paragraph(f"<b>Correct:</b> <font color='#16a34a'>{result.correct_count}</font>", cell_text),
            Paragraph(f"<b>Incorrect:</b> <font color='#dc2626'>{result.incorrect_count}</font>", cell_text),
            Paragraph(f"<b>Unanswered / Review:</b> {result.unanswered_count + result.ambiguous_count}", cell_text)
        ]
    ]
    summary_table = Table(summary_data, colWidths=[180, 160, 200])
    summary_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f8fafc')),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#cbd5e1')),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ('RIGHTPADDING', (0, 0), (-1, -1), 10),
    ]))
    story.append(summary_table)
    story.append(Spacer(1, 14))
    
    # Section Breakdown Table
    story.append(Paragraph("<b>Subject / Section Breakdown</b>", section_h2))
    sec_rows = [["Section", "Questions", "Correct", "Incorrect", "Unanswered", "Score", "Percentage"]]
    for s in result.sections:
        sec_rows.append([
            s.section_name,
            str(s.total_questions),
            str(s.correct_count),
            str(s.incorrect_count),
            str(s.unanswered_count),
            f"{s.score}/{s.max_score}",
            f"{s.percentage}%"
        ])
    sec_table = Table(sec_rows, colWidths=[150, 60, 60, 60, 70, 70, 70])
    sec_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1e293b')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('ALIGN', (0, 0), (0, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f8fafc')])
    ]))
    story.append(sec_table)
    story.append(Spacer(1, 16))
    
    # Question Grid Summary (Compact 4-column table for 160 questions)
    story.append(Paragraph("<b>Question Item Summary</b>", section_h2))
    
    # Format questions into a 4-column compact layout
    # Each sub-column: Q# | Key | Student | Res
    q_data = [["Q", "Key", "Ans", "Res", "Q", "Key", "Ans", "Res", "Q", "Key", "Ans", "Res", "Q", "Key", "Ans", "Res"]]
    
    # Divide 160 questions into 4 groups of 40 (corresponding to the 4 columns)
    num_q = len(result.questions)
    per_col = 40 if num_q == 160 else (num_q // 4 if num_q >= 4 else num_q)
    
    for row_idx in range(per_col):
        row_items = []
        for c_idx in range(4):
            idx = c_idx * per_col + row_idx
            if idx < len(result.questions):
                q = result.questions[idx]
                res_symbol = "✓" if q.status == "correct" else ("✗" if q.status == "incorrect" else ("—" if q.status == "unanswered" else "?"))
                ans_display = q.student_answer if q.student_answer != "BLANK" else "—"
                row_items.extend([str(q.question_number), q.correct_answer, ans_display, res_symbol])
            else:
                row_items.extend(["", "", "", ""])
        q_data.append(row_items)
        
    q_table = Table(q_data, colWidths=[20, 24, 24, 20] * 4)
    q_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0f172a')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 6.5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 1.5),
        ('TOPPADDING', (0, 0), (-1, -1), 1.5),
        ('GRID', (0, 0), (-1, -1), 0.4, colors.HexColor('#e2e8f0')),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f8fafc')])
    ]))
    story.append(q_table)
    
    doc.build(story)
    return buffer.getvalue()
