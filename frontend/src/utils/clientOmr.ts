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
  controlNumber: string = "N/A",
  rotationDegrees: number = 0,
  rules?: GradingRules
): Promise<GradingResult> {
  const startTime = performance.now();

  // Load image into an HTML Image element
  const img = new Image();
  const isCreatedUrl = typeof imageSource !== "string";
  const imageUrl = typeof imageSource === "string" ? imageSource : URL.createObjectURL(imageSource);

  try {
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Failed to load image for scanning"));
      img.src = imageUrl;
    });
  } finally {
    if (isCreatedUrl) {
      URL.revokeObjectURL(imageUrl);
    }
  }

  const origW = img.naturalWidth || img.width || 612;
  const origH = img.naturalHeight || img.height || 936;

  // Auto-orient: if image is landscape (origW > origH) and rotation is 0, rotate 90° CW to portrait
  let effectiveRotation = rotationDegrees % 360;
  if (effectiveRotation === 0 && origW > origH) {
    effectiveRotation = 90;
  }

  // 1. Render oriented image on an intermediate canvas
  const effW = effectiveRotation === 90 || effectiveRotation === 270 ? origH : origW;
  const effH = effectiveRotation === 90 || effectiveRotation === 270 ? origW : origH;
  const orientCanvas = document.createElement("canvas");
  orientCanvas.width = effW;
  orientCanvas.height = effH;
  const oCtx = orientCanvas.getContext("2d", { willReadFrequently: true });
  if (!oCtx) {
    throw new Error("Could not initialize oriented canvas context");
  }

  oCtx.save();
  if (effectiveRotation === 90) {
    oCtx.translate(effW, 0);
    oCtx.rotate((90 * Math.PI) / 180);
    oCtx.drawImage(img, 0, 0, effH, effW);
  } else if (effectiveRotation === 180) {
    oCtx.translate(effW, effH);
    oCtx.rotate(Math.PI);
    oCtx.drawImage(img, 0, 0, effW, effH);
  } else if (effectiveRotation === 270) {
    oCtx.translate(0, effH);
    oCtx.rotate((270 * Math.PI) / 180);
    oCtx.drawImage(img, 0, 0, effH, effW);
  } else {
    oCtx.drawImage(img, 0, 0, effW, effH);
  }
  oCtx.restore();

  // 2. Automatically detect paper boundary to isolate paper from surrounding table/desk/UI margins
  const { cropX, cropY, cropW, cropH } = detectPaperCrop(oCtx, effW, effH);

  // 3. Draw ONLY the cropped paper onto the portrait canonical canvas
  const canvas = document.createElement("canvas");
  const targetWidth = 2000;
  const targetHeight = Math.round(targetWidth * (PAGE_HEIGHT_PT / PAGE_WIDTH_PT)); // ~3058
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    throw new Error("Could not initialize 2D canvas context");
  }

  ctx.drawImage(orientCanvas, cropX, cropY, cropW, cropH, 0, 0, targetWidth, targetHeight);

  // Extract pixel data for grayscale analysis
  const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight);
  const pixels = imageData.data;

  // Estimate background paper luminance adaptively to handle mobile room lighting & shadows
  const sampleLum: number[] = [];
  const sampleStep = Math.max(1, Math.floor(pixels.length / (4 * 600)));
  for (let i = 0; i < pixels.length; i += sampleStep * 4) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    sampleLum.push(0.299 * r + 0.587 * g + 0.114 * b);
  }
  sampleLum.sort((a, b) => a - b);
  const paperLum = sampleLum[Math.floor(sampleLum.length * 0.85)] || 230;
  // Mark threshold adapts to ambient paper brightness (pencil/pen mark is significantly darker)
  const darkThreshold = Math.max(50, Math.min(185, paperLum * 0.78));

  // Deterministically evaluate layout contrast scores: Compact vs Full Sheet
  const compactScore = evaluateLayoutScore(pixels, targetWidth, targetHeight, darkThreshold, true);
  const fullScore = evaluateLayoutScore(pixels, targetWidth, targetHeight, darkThreshold, false);

  // If contrast score decisively favors compact (score > 1.25 * fullScore and compactScore >= 2.5), use compact
  const isCompactSheet = compactScore > fullScore * 1.25 && compactScore >= 2.5;

  // Proportional column coordinates for compact 4-column sheets (exact relative centers)
  const COMPACT_COLUMN_CENTERS: Record<string, number>[] = [
    { A: 0.0882 * targetWidth, B: 0.1330 * targetWidth, C: 0.1777 * targetWidth, D: 0.2212 * targetWidth },
    { A: 0.3297 * targetWidth, B: 0.3745 * targetWidth, C: 0.4193 * targetWidth, D: 0.4627 * targetWidth },
    { A: 0.5712 * targetWidth, B: 0.6160 * targetWidth, C: 0.6594 * targetWidth, D: 0.7042 * targetWidth },
    { A: 0.8128 * targetWidth, B: 0.8562 * targetWidth, C: 0.9009 * targetWidth, D: 0.9457 * targetWidth },
  ];

  const PDF_GRID_W = 512.3 - 71.2; // 441.1 pt
  const colOffsets: Record<string, number>[] = [
    { A: 71.2 - 71.2, B: 94.1 - 71.2, C: 117.0 - 71.2, D: 139.7 - 71.2 },
    { A: 195.4 - 71.2, B: 218.3 - 71.2, C: 241.1 - 71.2, D: 264.0 - 71.2 },
    { A: 319.5 - 71.2, B: 342.5 - 71.2, C: 365.3 - 71.2, D: 388.2 - 71.2 },
    { A: 443.7 - 71.2, B: 466.6 - 71.2, C: 489.5 - 71.2, D: 512.3 - 71.2 },
  ];

  const gridX0 = (71.2 / PAGE_WIDTH_PT) * targetWidth;
  const gridX1 = (512.3 / PAGE_WIDTH_PT) * targetWidth;
  const gridScaleX = (gridX1 - gridX0) / PDF_GRID_W;

  let gridY0: number;
  let gridY1: number;
  let boxW: number;
  let boxH: number;

  if (isCompactSheet) {
    gridY0 = 0.1045 * targetHeight;
    gridY1 = 0.9707 * targetHeight;
    boxW = Math.round(0.018 * targetWidth); // ~36 px
    boxH = Math.round(0.012 * targetHeight); // ~37 px
  } else {
    gridY0 = (ROW_START_Y_PT / PAGE_HEIGHT_PT) * targetHeight;
    gridY1 = ((ROW_START_Y_PT + 39 * ROW_STEP_Y_PT) / PAGE_HEIGHT_PT) * targetHeight;
    boxW = Math.round((12.0 / PAGE_WIDTH_PT) * targetWidth);
    boxH = Math.round((12.0 / PAGE_HEIGHT_PT) * targetHeight);
  }

  const gridStepY = (gridY1 - gridY0) / 39.0;

  // Calibrate horizontal and vertical fine shifts dynamically
  let fineShiftX = 0;
  let fineShiftY = 0;
  let bestScoreX = -1;

  for (let dx = -28; dx <= 28; dx += 2) {
    let marginSum = 0;
    let count = 0;
    for (let s = 0; s <= Math.min(1, COLUMNS_CONFIG.length - 1); s++) {
      for (let q = 1; q <= 6; q++) {
        const yC = Math.round(gridY0 + (q - 1) * gridStepY);
        const fills: number[] = [];
        for (const opt of ["A", "B", "C", "D"]) {
          let xC: number;
          if (isCompactSheet) {
            xC = Math.round(COMPACT_COLUMN_CENTERS[s][opt]) + dx;
          } else {
            const offsetPt = colOffsets[s][opt];
            xC = Math.round(gridX0 + offsetPt * gridScaleX) + dx;
          }
          let darkCount = 0;
          let totalProbe = 0;
          for (let py = yC - 6; py <= yC + 6; py += 2) {
            if (py < 0 || py >= targetHeight) continue;
            for (let px = xC - 6; px <= xC + 6; px += 2) {
              if (px < 0 || px >= targetWidth) continue;
              const idx = (py * targetWidth + px) * 4;
              const lum = 0.299 * pixels[idx] + 0.587 * pixels[idx + 1] + 0.114 * pixels[idx + 2];
              if (lum < darkThreshold) darkCount++;
              totalProbe++;
            }
          }
          fills.push(totalProbe > 0 ? darkCount / totalProbe : 0);
        }
        fills.sort((a, b) => b - a);
        marginSum += fills[0] - fills[1];
        count++;
      }
    }
    const avgM = count > 0 ? marginSum / count : 0;
    if (avgM > bestScoreX) {
      bestScoreX = avgM;
      fineShiftX = dx;
    }
  }

  let bestScoreY = -1;
  for (let dy = -16; dy <= 16; dy += 2) {
    let marginSum = 0;
    let count = 0;
    for (let s = 0; s <= Math.min(1, COLUMNS_CONFIG.length - 1); s++) {
      for (let q = 1; q <= 6; q++) {
        const yC = Math.round(gridY0 + (q - 1) * gridStepY) + dy;
        const fills: number[] = [];
        for (const opt of ["A", "B", "C", "D"]) {
          let xC: number;
          if (isCompactSheet) {
            xC = Math.round(COMPACT_COLUMN_CENTERS[s][opt]) + fineShiftX;
          } else {
            const offsetPt = colOffsets[s][opt];
            xC = Math.round(gridX0 + offsetPt * gridScaleX) + fineShiftX;
          }
          let darkCount = 0;
          let totalProbe = 0;
          for (let py = yC - 6; py <= yC + 6; py += 2) {
            if (py < 0 || py >= targetHeight) continue;
            for (let px = xC - 6; px <= xC + 6; px += 2) {
              if (px < 0 || px >= targetWidth) continue;
              const idx = (py * targetWidth + px) * 4;
              const lum = 0.299 * pixels[idx] + 0.587 * pixels[idx + 1] + 0.114 * pixels[idx + 2];
              if (lum < darkThreshold) darkCount++;
              totalProbe++;
            }
          }
          fills.push(totalProbe > 0 ? darkCount / totalProbe : 0);
        }
        fills.sort((a, b) => b - a);
        marginSum += fills[0] - fills[1];
        count++;
      }
    }
    const avgM = count > 0 ? marginSum / count : 0;
    if (avgM > bestScoreY) {
      bestScoreY = avgM;
      fineShiftY = dy;
    }
  }

  const fillThresh = rules?.fill_threshold ?? 0.30;
  const uncertainThresh = rules?.uncertain_lower_threshold ?? 0.16;
  const ambiguityMargin = rules?.ambiguity_margin ?? 0.12;
  const pointsPerCorrect = rules?.points_per_correct ?? 1.0;
  const pointsPerIncorrect = rules?.points_per_incorrect ?? 0.0;

  const coreHalfW = Math.max(4, Math.round(boxW * 0.22));
  const coreHalfH = Math.max(4, Math.round(boxH * 0.22));

  const questions: QuestionAnswer[] = [];

  for (const col of COLUMNS_CONFIG) {
    const secName = col.name;
    const secIdx = col.section_index;

    for (let qIdx = 1; qIdx <= 40; qIdx++) {
      const globalQNum = secIdx * 40 + qIdx;
      const qStr = globalQNum.toString();
      const correctKey = answerKey.answers[qStr] || "BLANK";

      const yCenterPx = Math.round(gridY0 + (qIdx - 1) * gridStepY) + fineShiftY;

      const choices: ChoiceOption[] = [];

      for (const opt of ["A", "B", "C", "D"]) {
        let xCenterPx: number;
        if (isCompactSheet) {
          xCenterPx = Math.round(COMPACT_COLUMN_CENTERS[secIdx][opt]) + fineShiftX;
        } else {
          const offsetPt = colOffsets[secIdx][opt];
          xCenterPx = Math.round(gridX0 + offsetPt * gridScaleX) + fineShiftX;
        }
        const xMin = xCenterPx - Math.floor(boxW / 2);
        const yMin = yCenterPx - Math.floor(boxH / 2);

        // Sample strictly the inner core (~45% dimension) to avoid touching the printed black border
        let darkCount = 0;
        let totalCount = 0;

        for (let y = yCenterPx - coreHalfH; y <= yCenterPx + coreHalfH; y++) {
          if (y < 0 || y >= targetHeight) continue;
          for (let x = xCenterPx - coreHalfW; x <= xCenterPx + coreHalfW; x++) {
            if (x < 0 || x >= targetWidth) continue;
            const idx = (y * targetWidth + x) * 4;
            const r = pixels[idx];
            const g = pixels[idx + 1];
            const b = pixels[idx + 2];
            const lum = 0.299 * r + 0.587 * g + 0.114 * b;

            if (lum < darkThreshold) {
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
        (topFill >= 0.40 && secondFill >= 0.35 && (topFill - secondFill < ambiguityMargin)) ||
        (topFill >= 0.25 && secondFill >= 0.25 && (topFill - secondFill < 0.05));

      let studentAnswer = "BLANK";
      let status: "correct" | "incorrect" | "unanswered" | "ambiguous" = "unanswered";
      let confidence = 1.0;
      let needsReview = false;
      let points = 0.0;

      if (topFill < uncertainThresh) {
        studentAnswer = "BLANK";
        status = "unanswered";
        confidence = Math.max(0.5, 1.0 - topFill);
      } else if (isCompetingMultiple) {
        const competing = choices
          .filter((c) => c.fill_ratio >= Math.max(0.25, topFill - ambiguityMargin))
          .map((c) => c.id);
        studentAnswer = competing.length > 1 ? competing.join(", ") : `${choices[0].id}?`;
        status = "ambiguous";
        confidence = 0.40;
        needsReview = true;
      } else if (topFill >= fillThresh || (topFill >= 0.20 && (topFill - secondFill >= 0.08))) {
        studentAnswer = choices[0].id;
        confidence = Math.min(1.0, 0.70 + (topFill - secondFill) * 0.5);

        if (correctKey === studentAnswer) {
          status = "correct";
          points = pointsPerCorrect;
        } else {
          status = "incorrect";
          points = pointsPerIncorrect;
        }
      } else {
        studentAnswer = choices[0].id;
        status = "ambiguous";
        confidence = 0.45;
        needsReview = true;
      }

      if (correctKey === "BLANK" && studentAnswer === "BLANK") {
        status = "correct";
        points = pointsPerCorrect;
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
        points_possible: pointsPerCorrect,
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

/**
 * Automatically detects the bounding box of the paper within an image to remove
 * desk/table/background margins captured by phone cameras, webcams, or screenshots.
 */
function detectPaperCrop(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number
): { cropX: number; cropY: number; cropW: number; cropH: number } {
  const analysisScale = 360 / Math.max(w, h);
  const sW = Math.max(10, Math.round(w * analysisScale));
  const sH = Math.max(10, Math.round(h * analysisScale));

  const smallCanvas = document.createElement("canvas");
  smallCanvas.width = sW;
  smallCanvas.height = sH;
  const sCtx = smallCanvas.getContext("2d", { willReadFrequently: true });
  if (!sCtx) return { cropX: 0, cropY: 0, cropW: w, cropH: h };

  sCtx.drawImage(ctx.canvas, 0, 0, sW, sH);
  const imgData = sCtx.getImageData(0, 0, sW, sH).data;
  const lums = new Uint8Array(sW * sH);
  for (let i = 0; i < lums.length; i++) {
    lums[i] = Math.round(
      0.299 * imgData[i * 4] + 0.587 * imgData[i * 4 + 1] + 0.114 * imgData[i * 4 + 2]
    );
  }

  // Sample borders (top, bottom, left, right edges)
  const borderVals: number[] = [];
  for (let x = 0; x < sW; x += 4) {
    borderVals.push(lums[x]);
    borderVals.push(lums[(sH - 1) * sW + x]);
  }
  for (let y = 0; y < sH; y += 4) {
    borderVals.push(lums[y * sW]);
    borderVals.push(lums[y * sW + (sW - 1)]);
  }
  borderVals.sort((a, b) => a - b);
  const medBorder = borderVals[Math.floor(borderVals.length / 2)] || 240;

  // If the border is already bright white paper (e.g. PDF render or full-bleed crop), do not crop
  if (medBorder > 185) {
    return { cropX: 0, cropY: 0, cropW: w, cropH: h };
  }

  // Sample interior pixels
  const centerVals: number[] = [];
  const y0 = Math.floor(sH * 0.25);
  const y1 = Math.floor(sH * 0.75);
  const x0 = Math.floor(sW * 0.25);
  const x1 = Math.floor(sW * 0.75);
  for (let y = y0; y < y1; y += 4) {
    for (let x = x0; x < x1; x += 4) {
      centerVals.push(lums[y * sW + x]);
    }
  }
  centerVals.sort((a, b) => a - b);
  const medCenter = centerVals[Math.floor(centerVals.length * 0.5)] || 240;

  // If center paper is brighter than surrounding desk / dark background
  if (medCenter > medBorder + 25) {
    const threshVal = (medBorder + medCenter) / 2.0;
    let minRow = sH;
    let maxRow = 0;
    let minCol = sW;
    let maxCol = 0;

    for (let y = 0; y < sH; y++) {
      let count = 0;
      for (let x = 0; x < sW; x++) {
        if (lums[y * sW + x] > threshVal) count++;
      }
      if (count > sW * 0.15) {
        if (y < minRow) minRow = y;
        if (y > maxRow) maxRow = y;
      }
    }

    for (let x = 0; x < sW; x++) {
      let count = 0;
      for (let y = 0; y < sH; y++) {
        if (lums[y * sW + x] > threshVal) count++;
      }
      if (count > sH * 0.15) {
        if (x < minCol) minCol = x;
        if (x > maxCol) maxCol = x;
      }
    }

    if (maxCol > minCol && maxRow > minRow) {
      const cropX = Math.round(minCol / analysisScale);
      const cropY = Math.round(minRow / analysisScale);
      const cropW = Math.round((maxCol - minCol) / analysisScale);
      const cropH = Math.round((maxRow - minRow) / analysisScale);

      if (cropW > w * 0.20 && cropH > h * 0.20) {
        return { cropX, cropY, cropW, cropH };
      }
    }
  }

  return { cropX: 0, cropY: 0, cropW: w, cropH: h };
}

/**
 * Evaluates the fill contrast score of a candidate layout (Compact vs Full Sheet)
 * by sampling representative rows directly against the thresholded image pixels.
 * A marked bubble yields high contrast (top fill minus second fill), producing a high score.
 */
function evaluateLayoutScore(
  pixels: Uint8ClampedArray,
  targetW: number,
  targetH: number,
  darkThresh: number,
  isCompact: boolean
): number {
  let gY0: number;
  let gY1: number;
  let cols: Record<string, number>[];
  let bW: number;
  let bH: number;

  if (isCompact) {
    gY0 = 0.1045 * targetH;
    gY1 = 0.9707 * targetH;
    cols = [
      { A: 0.0882 * targetW, B: 0.1330 * targetW, C: 0.1777 * targetW, D: 0.2212 * targetW },
      { A: 0.3297 * targetW, B: 0.3745 * targetW, C: 0.4193 * targetW, D: 0.4627 * targetW },
      { A: 0.5712 * targetW, B: 0.6160 * targetW, C: 0.6594 * targetW, D: 0.7042 * targetW },
      { A: 0.8128 * targetW, B: 0.8562 * targetW, C: 0.9009 * targetW, D: 0.9457 * targetW },
    ];
    bW = Math.round(0.018 * targetW);
    bH = Math.round(0.012 * targetH);
  } else {
    gY0 = (ROW_START_Y_PT / PAGE_HEIGHT_PT) * targetH;
    gY1 = ((ROW_START_Y_PT + 39 * ROW_STEP_Y_PT) / PAGE_HEIGHT_PT) * targetH;
    const PDF_GRID_W = 512.3 - 71.2;
    const gX0 = (71.2 / PAGE_WIDTH_PT) * targetW;
    const gX1 = (512.3 / PAGE_WIDTH_PT) * targetW;
    const gScaleX = (gX1 - gX0) / PDF_GRID_W;
    cols = [
      { A: gX0 + (71.2 - 71.2) * gScaleX, B: gX0 + (94.1 - 71.2) * gScaleX, C: gX0 + (117.0 - 71.2) * gScaleX, D: gX0 + (139.7 - 71.2) * gScaleX },
      { A: gX0 + (195.4 - 71.2) * gScaleX, B: gX0 + (218.3 - 71.2) * gScaleX, C: gX0 + (241.1 - 71.2) * gScaleX, D: gX0 + (264.0 - 71.2) * gScaleX },
      { A: gX0 + (319.5 - 71.2) * gScaleX, B: gX0 + (342.5 - 71.2) * gScaleX, C: gX0 + (365.3 - 71.2) * gScaleX, D: gX0 + (388.2 - 71.2) * gScaleX },
      { A: gX0 + (443.7 - 71.2) * gScaleX, B: gX0 + (466.6 - 71.2) * gScaleX, C: gX0 + (489.5 - 71.2) * gScaleX, D: gX0 + (512.3 - 71.2) * gScaleX },
    ];
    bW = Math.round((12.0 / PAGE_WIDTH_PT) * targetW);
    bH = Math.round((12.0 / PAGE_HEIGHT_PT) * targetH);
  }

  const gStepY = (gY1 - gY0) / 39.0;
  const coreW = Math.max(4, Math.round(bW * 0.22));
  const coreH = Math.max(4, Math.round(bH * 0.22));

  let score = 0;
  const testRows = [1, 3, 5, 10, 15, 20, 30, 38];
  for (const qIdx of testRows) {
    const yC = Math.round(gY0 + (qIdx - 1) * gStepY);
    if (yC < 10 || yC >= targetH - 10) continue;
    for (let s = 0; s < 4; s++) {
      const fills: number[] = [];
      for (const opt of ["A", "B", "C", "D"]) {
        const xC = Math.round(cols[s][opt]);
        if (xC < 10 || xC >= targetW - 10) continue;
        let dark = 0;
        let total = 0;
        for (let py = yC - coreH; py <= yC + coreH; py += 2) {
          for (let px = xC - coreW; px <= xC + coreW; px += 2) {
            const idx = (py * targetW + px) * 4;
            const lum = 0.299 * pixels[idx] + 0.587 * pixels[idx + 1] + 0.114 * pixels[idx + 2];
            if (lum < darkThresh) dark++;
            total++;
          }
        }
        fills.push(total > 0 ? dark / total : 0);
      }
      if (fills.length === 4) {
        fills.sort((a, b) => b - a);
        score += (fills[0] - fills[1]);
      }
    }
  }
  return score;
}

