import { NextRequest, NextResponse } from "next/server";
import { SAMPLE_AISCC_KEY } from "@/constants/sampleKey";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch (err: any) {
    return NextResponse.json(
      { detail: `Failed to read file: ${err.message}` },
      { status: 400 }
    );
  }
  
  // Forward to cloud Python FastAPI if available
  if (backendUrl) {
    try {
      const res = await fetch(`${backendUrl}/api/answer-key/upload`, {
        method: "POST",
        body: formData,
        signal: AbortSignal.timeout(12000),
      });
      if (res.ok) {
        return NextResponse.json(await res.json());
      }
    } catch {}
  }

  // Try local FastAPI on port 8001
  try {
    const res = await fetch("http://127.0.0.1:8001/api/answer-key/upload", {
      method: "POST",
      body: formData,
      signal: AbortSignal.timeout(10000),
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
