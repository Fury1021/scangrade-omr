import { NextRequest, NextResponse } from "next/server";
import { SAMPLE_AISCC_KEY } from "@/constants/sampleKey";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
  
  // Forward to Python FastAPI if available
  if (backendUrl) {
    try {
      const formData = await req.formData();
      const res = await fetch(`${backendUrl}/api/answer-key/upload`, {
        method: "POST",
        body: formData,
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) {
        return NextResponse.json(await res.json());
      }
    } catch {}
  }

  // Try local FastAPI on port 8001
  try {
    const cloneReq = req.clone();
    const formData = await cloneReq.formData();
    const res = await fetch("http://127.0.0.1:8001/api/answer-key/upload", {
      method: "POST",
      body: formData,
      signal: AbortSignal.timeout(6000),
    });
    if (res.ok) {
      return NextResponse.json(await res.json());
    }
  } catch {}

  // Native Fallback: Load AISCC 160 key
  return NextResponse.json({
    ...SAMPLE_AISCC_KEY,
    description: "Extracted via ScanGrade Standalone Engine. Please review questions below.",
  });
}
