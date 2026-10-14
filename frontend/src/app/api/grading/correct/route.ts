import { NextRequest, NextResponse } from "next/server";
import { recalculateAfterCorrectionClient } from "@/utils/scoring";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { current_result, correction, rules } = body;

    if (!current_result || !correction) {
      return NextResponse.json(
        { detail: "Missing current_result or correction payload." },
        { status: 400 }
      );
    }

    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

    // Try cloud Python FastAPI if configured
    if (backendUrl) {
      try {
        const res = await fetch(`${backendUrl}/api/grading/correct`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(10000),
        });
        if (res.ok) {
          return NextResponse.json(await res.json());
        }
      } catch {}
    }

    // Try local FastAPI on port 8001
    try {
      const res = await fetch("http://127.0.0.1:8001/api/grading/correct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        return NextResponse.json(await res.json());
      }
    } catch {}

    // Fallback: Perform deterministic recalculation locally in Next.js
    const pointsPerCorrect = rules?.points_per_correct ?? 1;
    const pointsPerIncorrect = rules?.points_per_incorrect ?? 0;

    const updated = recalculateAfterCorrectionClient(
      current_result,
      correction.question_number,
      correction.corrected_answer,
      pointsPerCorrect,
      pointsPerIncorrect
    );

    return NextResponse.json(updated);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ detail: message }, { status: 500 });
  }
}
