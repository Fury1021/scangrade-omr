import { AnswerKeyData, GradingResult, QuestionAnswer, ChoiceOption, SectionSummary, GradingRules } from "@/types/grading";
import { compileGradingResultsClient } from "./scoring";

const PAGE_WIDTH_PT = 612.0;
const PAGE_HEIGHT_PT = 936.0;

const COLUMNS_CONFIG = [
  {
    name: "General Information",
    section_index: 0,
    q_num_x: 45.7,
    choices_x: { A: 71.2, B: 94.1, C: 117.0, D: 139.7 },
    box_size_pt: 12.0,
  },
  {
    name: "Logical Reasoning",
    section_index: 1,
    q_num_x: 169.8,
    choices_x: { A: 195.4, B: 218.3, C: 241.1, D: 264.0 },
    box_size_pt: 12.0,
  },
  {
    name: "Mathematics",
    section_index: 2,
    q_num_x: 294.0,
    choices_x: { A: 319.5, B: 342.5, C: 365.3, D: 388.2 },
    box_size_pt: 12.0,
  },
  {
    name: "English",
    section_index: 3,
    q_num_x: 418.1,
    choices_x: { A: 443.7, B: 466.6, C: 489.5, D: 512.3 },
    box_size_pt: 12.0,
  },
];

const ROW_START_Y_PT = 215.55;
const ROW_STEP_Y_PT = 15.52;

export async function processImageClientSide(
  imageSource: File | string,
  answerKey: AnswerKeyData,
  studentName: string = "Candidate",
  controlNumber: string = "N/A"
): Promise<GradingResult> {
  const startTime = performance.now();

  // Load image into an HTML Image element
  const img = new Image();
  const imageUrl = typeof imageSource === "string" ? imageSource : URL.createObjectURL(imageSource);

  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Failed to load image for scanning"));
    img.src = imageUrl;
  });

  const canvas = document.createElement("canvas");
  const targetWidth = 2000;
  const targetHeight = Math.round(targetWidth * (PAGE_HEIGHT_PT / PAGE_WIDTH_PT)); // ~3058
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    throw new Error("Could not initialize 2D canvas context");
  }

  // Draw scaled image
  ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

  // Extract pixel data for grayscale analysis
  const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight);
  const pixels = imageData.data;

  const scaleX = targetWidth / PAGE_WIDTH_PT;
  const scaleY = targetHeight / PAGE_HEIGHT_PT;

  const questions: QuestionAnswer[] = [];

  for (const col of COLUMNS_CONFIG) {
    const secName = col.name;
    const secIdx = col.section_index;
    const boxW = Math.round(col.box_size_pt * scaleX);
    const boxH = Math.round(col.box_size_pt * scaleY);

    for (let qIdx = 1; qIdx <= 40; qIdx++) {
      const globalQNum = secIdx * 40 + qIdx;
      const qStr = globalQNum.toString();
      const correctKey = answerKey.answers[qStr] || "BLANK";

      const yCenterPt = ROW_START_Y_PT + (qIdx - 1) * ROW_STEP_Y_PT;
      const yCenterPx = Math.round(yCenterPt * scaleY);

      const choices: ChoiceOption[] = [];
      const markedChoices: { opt: string; fill: number }[] = [];

      for (const [opt, xPt] of Object.entries(col.choices_x)) {
        const xCenterPx = Math.round(xPt * scaleX);
        const xMin = xCenterPx - Math.floor(boxW / 2);
        const yMin = yCenterPx - Math.floor(boxH / 2);

        // Sample inner 60%
        const marginX = Math.round(boxW * 0.20);
        const marginY = Math.round(boxH * 0.20);

        let darkCount = 0;
        let totalCount = 0;

        for (let y = yMin + marginY; y < yMin + boxH - marginY; y++) {
          if (y < 0 || y >= targetHeight) continue;
          for (let x = xMin + marginX; x < xMin + boxW - marginX; x++) {
            if (x < 0 || x >= targetWidth) continue;
            const idx = (y * targetWidth + x) * 4;
            // Grayscale luminance
            const r = pixels[idx];
            const g = pixels[idx + 1];
            const b = pixels[idx + 2];
            const lum = 0.299 * r + 0.587 * g + 0.114 * b;

            // Threshold for pencil/pen mark
            if (lum < 165) {
              darkCount++;
            }
            totalCount++;
          }
        }

        const fillRatio = totalCount > 0 ? darkCount / totalCount : 0;
        const isMarked = fillRatio >= 0.30;

        choices.push({
          id: opt,
          fill_ratio: Math.round(fillRatio * 100) / 100,
          is_marked: isMarked,
          bbox: [xMin, yMin, boxW, boxH],
        });

        if (isMarked) {
          markedChoices.push({ opt, fill: fillRatio });
        }
      }

      // Sort by fill ratio descending
      choices.sort((a, b) => b.fill_ratio - a.fill_ratio);
      const topFill = choices[0].fill_ratio;
      const secondFill = choices.length > 1 ? choices[1].fill_ratio : 0;

      let studentAnswer = "BLANK";
      let status: "correct" | "incorrect" | "unanswered" | "ambiguous" = "unanswered";
      let confidence = 1.0;
      let needsReview = false;
      let points = 0.0;

      if (topFill < 0.16) {
        studentAnswer = "BLANK";
        status = "unanswered";
        confidence = Math.max(0.5, 1.0 - topFill);
      } else if (topFill < 0.30) {
        studentAnswer = choices[0].id;
        status = "ambiguous";
        confidence = 0.45;
        needsReview = true;
      } else {
        if (markedChoices.length > 1 || (topFill - secondFill < 0.12 && secondFill >= 0.16)) {
          studentAnswer = markedChoices.length > 1 ? markedChoices.map((m) => m.opt).join(", ") : `${choices[0].id}?`;
          status = "ambiguous";
          confidence = 0.40;
          needsReview = true;
        } else {
          studentAnswer = choices[0].id;
          confidence = Math.min(1.0, 0.70 + (topFill - secondFill) * 0.5);

          if (correctKey === studentAnswer) {
            status = "correct";
            points = 1.0;
          } else {
            status = "incorrect";
            points = 0.0;
          }
        }
      }

      if (correctKey === "BLANK" && studentAnswer === "BLANK") {
        status = "correct";
        points = 1.0;
        needsReview = false;
      }

      // Restore natural order A, B, C, D in choices array
      choices.sort((a, b) => a.id.localeCompare(b.id));

      const qAnswer: QuestionAnswer = {
        question_number: globalQNum,
        section: secName,
        correct_answer: correctKey,
        student_answer: studentAnswer,
        status,
        confidence: Math.round(confidence * 100) / 100,
        needs_review: needsReview,
        points_awarded: points,
        points_possible: 1.0,
        choices,
        notes: `Fill: ${topFill.toFixed(2)} (2nd: ${secondFill.toFixed(2)})`,
      };

      questions.push(qAnswer);

      // Draw annotation on canvas
      drawQuestionOverlay(ctx, qAnswer, choices);
    }
  }

  // Generate Base64 annotated image
  const annotatedImageUrl = canvas.toDataURL("image/jpeg", 0.85);

  const processingTime = Math.round(performance.now() - startTime);

  return compileGradingResultsClient(
    "client-session-" + Math.random().toString(36).substring(2, 7),
    questions,
    answerKey,
    studentName,
    controlNumber,
    annotatedImageUrl,
    annotatedImageUrl,
    processingTime
  );
}

function drawQuestionOverlay(
  ctx: CanvasRenderingContext2D,
  q: QuestionAnswer,
  choices: ChoiceOption[]
) {
  const colorCorrect = "#22c55e"; // Green
  const colorIncorrect = "#ef4444"; // Red
  const colorAmbiguous = "#f59e0b"; // Amber

  for (const c of choices) {
    if (!c.bbox) continue;
    const [x, y, w, h] = c.bbox;
    const optLetter = c.id;

    if (q.status === "correct" && optLetter === q.student_answer) {
      ctx.strokeStyle = colorCorrect;
      ctx.lineWidth = 3;
      ctx.strokeRect(x - 2, y - 2, w + 4, h + 4);
    } else if (q.status === "incorrect") {
      if (optLetter === q.student_answer) {
        ctx.strokeStyle = colorIncorrect;
        ctx.lineWidth = 3;
        ctx.strokeRect(x - 2, y - 2, w + 4, h + 4);
      } else if (optLetter === q.correct_answer) {
        ctx.strokeStyle = colorCorrect;
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(x - 2, y - 2, w + 4, h + 4);
        ctx.setLineDash([]);
      }
    } else if (q.status === "ambiguous" && c.is_marked) {
      ctx.strokeStyle = colorAmbiguous;
      ctx.lineWidth = 3;
      ctx.strokeRect(x - 2, y - 2, w + 4, h + 4);
    }
  }
}
