import { NextRequest, NextResponse } from "next/server";
import { GradingResult } from "@/types/grading";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const result: GradingResult = await req.json();

    let csvContent = "ScanGrade OMR Examination Results\n";
    csvContent += `Candidate Name,"${result.student_name}"\n`;
    csvContent += `Control Number,"${result.control_number || "N/A"}"\n`;
    csvContent += `Total Questions,${result.total_questions}\n`;
    csvContent += `Total Score,"${result.total_score} / ${result.max_score} (${result.percentage}%)"\n`;
    csvContent += `Correct Answers,${result.correct_count}\n`;
    csvContent += `Incorrect Answers,${result.incorrect_count}\n`;
    csvContent += `Unanswered,${result.unanswered_count}\n`;
    csvContent += `Ambiguous / Review,${result.ambiguous_count}\n\n`;

    csvContent += "--- Section Performance Breakdown ---\n";
    csvContent += "Section,Score,Max Score,Percentage,Correct,Incorrect,Unanswered\n";
    for (const s of result.sections) {
      csvContent += `"${s.section_name}",${s.score},${s.max_score},${s.percentage}%,${s.correct_count},${s.incorrect_count},${s.unanswered_count}\n`;
    }

    csvContent += "\n--- Question-by-Question Details ---\n";
    csvContent += "Question #,Section,Correct Answer,Student Answer,Result,Score,Confidence,Notes\n";
    for (const q of result.questions) {
      csvContent += `${q.question_number},"${q.section}","${q.correct_answer}","${q.student_answer || "BLANK"}",${q.status.toUpperCase()},${q.points_awarded},${Math.round(q.confidence * 100)}%,"${q.notes || ""}"\n`;
    }

    return new NextResponse(csvContent, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="ScanGrade_Results_${result.session_id}.csv"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
