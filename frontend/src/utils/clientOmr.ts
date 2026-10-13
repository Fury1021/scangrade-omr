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
    name: "Logical Information",
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

  // Determine if image is cropped (aspect ratio < 1.45 where headers were omitted)
  const origW = img.naturalWidth || img.width || 612;
  const origH = img.naturalHeight || img.height || 936;
  const aspectRatio = origH / origW;
  const isCropped = aspectRatio < 1.45;

  const PDF_GRID_W = 512.3 - 71.2; // 441.1 pt
  const colOffsets: Record<string, number>[] = [
    { A: 71.2 - 71.2, B: 94.1 - 71.2, C: 117.0 - 71.2, D: 139.7 - 71.2 },
    { A: 195.4 - 71.2, B: 218.3 - 71.2, C: 241.1 - 71.2, D: 264.0 - 71.2 },
    { A: 319.5 - 71.2, B: 342.5 - 71.2, C: 365.3 - 71.2, D: 388.2 - 71.2 },
    { A: 443.7 - 71.2, B: 466.6 - 71.2, C: 489.5 - 71.2, D: 512.3 - 71.2 },
  ];

  let gridX0: number;
  let gridX1: number;
  let gridY0: number;
  let gridY1: number;

  if (isCropped) {
    gridX0 = 0.0893 * targetWidth;
    gridX1 = 0.9465 * targetWidth;
    gridY0 = 0.1057 * targetHeight;
    gridY1 = 0.9541 * targetHeight;
  } else {
    gridX0 = (71.2 / PAGE_WIDTH_PT) * targetWidth;
    gridX1 = (512.3 / PAGE_WIDTH_PT) * targetWidth;
    gridY0 = (ROW_START_Y_PT / PAGE_HEIGHT_PT) * targetHeight;
    gridY1 = ((ROW_START_Y_PT + 39 * ROW_STEP_Y_PT) / PAGE_HEIGHT_PT) * targetHeight;
  }

  const gridScaleX = (gridX1 - gridX0) / PDF_GRID_W;
  const gridStepY = (gridY1 - gridY0) / 39.0;
  const boxW = Math.round((12.0 / PAGE_WIDTH_PT) * targetWidth);
  const boxH = Math.round((12.0 / PAGE_HEIGHT_PT) * targetHeight);

  const questions: QuestionAnswer[] = [];

  for (const col of COLUMNS_CONFIG) {
    const secName = col.name;
    const secIdx = col.section_index;

    for (let qIdx = 1; qIdx <= 40; qIdx++) {
      const globalQNum = secIdx * 40 + qIdx;
      const qStr = globalQNum.toString();
      const correctKey = answerKey.answers[qStr] || "BLANK";

      const yCenterPx = Math.round(gridY0 + (qIdx - 1) * gridStepY);

      const choices: ChoiceOption[] = [];

      for (const [opt, offsetPt] of Object.entries(colOffsets[secIdx])) {
        const xCenterPx = Math.round(gridX0 + offsetPt * gridScaleX);
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

        choices.push({
          id: opt,
          fill_ratio: Math.round(fillRatio * 100) / 100,
          is_marked: false,
          bbox: [xMin, yMin, boxW, boxH],
        });
      }

      // Sort by fill ratio descending
      choices.sort((a, b) => b.fill_ratio - a.fill_ratio);
      const topFill = choices[0].fill_ratio;
      const secondFill = choices.length > 1 ? choices[1].fill_ratio : 0;

      // Multiple marks check: Only ambiguous if top two choices are both heavily marked or competing closely
      const isCompetingMultiple =
        (topFill >= 0.40 && secondFill >= 0.35 && (topFill - secondFill < 0.12)) ||
        (topFill >= 0.25 && secondFill >= 0.25 && (topFill - secondFill < 0.05));

      let studentAnswer = "BLANK";
      let status: "correct" | "incorrect" | "unanswered" | "ambiguous" = "unanswered";
      let confidence = 1.0;
      let needsReview = false;
      let points = 0.0;

      if (topFill < 0.16) {
        studentAnswer = "BLANK";
        status = "unanswered";
        confidence = Math.max(0.5, 1.0 - topFill);
      } else if (isCompetingMultiple) {
        const competing = choices
          .filter((c) => c.fill_ratio >= Math.max(0.25, topFill - 0.12))
          .map((c) => c.id);
        studentAnswer = competing.length > 1 ? competing.join(", ") : `${choices[0].id}?`;
        status = "ambiguous";
        confidence = 0.40;
        needsReview = true;
      } else if (topFill >= 0.30 || (topFill >= 0.25 && (topFill - secondFill >= 0.05))) {
        studentAnswer = choices[0].id;
        confidence = Math.min(1.0, 0.70 + (topFill - secondFill) * 0.5);

        if (correctKey === studentAnswer) {
          status = "correct";
          points = 1.0;
        } else {
          status = "incorrect";
          points = 0.0;
        }
      } else {
        studentAnswer = choices[0].id;
        status = "ambiguous";
        confidence = 0.45;
        needsReview = true;
      }

      if (correctKey === "BLANK" && studentAnswer === "BLANK") {
        status = "correct";
        points = 1.0;
        needsReview = false;
      }

      // Mark is_marked correctly for choices
      for (const c of choices) {
        c.is_marked = Boolean(studentAnswer && (c.id === studentAnswer || studentAnswer.includes(c.id)));
      }

      // Restore natural order A, B, C, D in choices array
      choices.sort((a, b) => a.id.localeCompare(b.id));

      const qAnswer: QuestionAnswer = {
        question_number: globalQNum,
        local_question_number: qIdx,
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
