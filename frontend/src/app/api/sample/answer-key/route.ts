import { NextResponse } from "next/server";
import { SAMPLE_AISCC_KEY } from "@/constants/sampleKey";

export const dynamic = "force-dynamic";

export async function GET() {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
  if (backendUrl) {
    try {
      const res = await fetch(`${backendUrl}/api/sample/answer-key`, {
        signal: AbortSignal.timeout(3000),
      });
      if (res.ok) {
        return NextResponse.json(await res.json());
      }
    } catch {}
  }

  // Try local FastAPI
  try {
    const res = await fetch("http://127.0.0.1:8001/api/sample/answer-key", {
      signal: AbortSignal.timeout(1500),
    });
    if (res.ok) {
      return NextResponse.json(await res.json());
    }
  } catch {}

  // Native return
  return NextResponse.json(SAMPLE_AISCC_KEY);
}
