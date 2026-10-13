import {
  GradingResult,
  QuestionAnswer,
  AnswerKeyData,
  SectionSummary,
} from "@/types/grading";

export function compileGradingResultsClient(
  sessionId: string,
  questions: QuestionAnswer[],
  answerKey: AnswerKeyData,
  studentName: string,
  controlNumber: string,
  annotatedImageUrl: string,
  warpedImageUrl: string,
  processingTimeMs: number
): GradingResult {
  let correctCount = 0;
  let incorrectCount = 0;
  let unansweredCount = 0;
  let ambiguousCount = 0;
  let needsReviewCount = 0;
  let totalScore = 0;
  let maxScore = 0;

  const sectionsMap: Record<string, QuestionAnswer[]> = {};

  for (const q of questions) {
    const sec = q.section || "General";
    if (!sectionsMap[sec]) {
      sectionsMap[sec] = [];
    }
    sectionsMap[sec].push(q);

    maxScore += q.points_possible;
    totalScore += q.points_awarded;

    if (q.status === "correct") correctCount++;
    else if (q.status === "incorrect") incorrectCount++;
    else if (q.status === "unanswered") unansweredCount++;
    else if (q.status === "ambiguous") ambiguousCount++;

    if (q.needs_review) needsReviewCount++;
  }

  const sectionSummaries: SectionSummary[] = [];
  const orderedSections = answerKey.sections || Object.keys(sectionsMap);

  for (const secName of orderedSections) {
    const secQuestions = sectionsMap[secName] || [];
    const secTotal = secQuestions.length;
    const secCorr = secQuestions.filter((q) => q.status === "correct").length;
    const secInc = secQuestions.filter((q) => q.status === "incorrect").length;
    const secUnans = secQuestions.filter((q) => q.status === "unanswered").length;
    const secAmb = secQuestions.filter((q) => q.status === "ambiguous").length;
    const secScore = secQuestions.reduce((acc, q) => acc + q.points_awarded, 0);
    const secMax = secQuestions.reduce((acc, q) => acc + q.points_possible, 0);
    const secPct = secMax > 0 ? Math.round((secScore / secMax) * 1000) / 10 : 0;

    sectionSummaries.push({
      section_name: secName,
      total_questions: secTotal,
      correct_count: secCorr,
      incorrect_count: secInc,
      unanswered_count: secUnans,
      ambiguous_count: secAmb,
      score: secScore,
      max_score: secMax,
      percentage: secPct,
    });
  }

  const overallPct = maxScore > 0 ? Math.round((totalScore / maxScore) * 1000) / 10 : 0;

  return {
    session_id: sessionId,
    student_name: studentName,
    control_number: controlNumber,
    total_questions: questions.length,
    total_score: totalScore,
    max_score: maxScore,
    percentage: overallPct,
    correct_count: correctCount,
    incorrect_count: incorrectCount,
    unanswered_count: unansweredCount,
    ambiguous_count: ambiguousCount,
    needs_review_count: needsReviewCount,
    sections: sectionSummaries,
    questions,
    annotated_image_url: annotatedImageUrl,
    warped_image_url: warpedImageUrl,
    processing_time_ms: processingTimeMs,
  };
}
