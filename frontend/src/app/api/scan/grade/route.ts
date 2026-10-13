import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

  // Try cloud Python FastAPI if configured
  if (backendUrl) {
    try {
      const formData = await req.formData();
      const res = await fetch(`${backendUrl}/api/scan/grade`, {
        method: "POST",
        body: formData,
        signal: AbortSignal.timeout(25000),
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
    const res = await fetch("http://127.0.0.1:8001/api/scan/grade", {
      method: "POST",
      body: formData,
      signal: AbortSignal.timeout(15000),
    });
    if (res.ok) {
      return NextResponse.json(await res.json());
    }
  } catch {}

  // Return fallback response indicating client should use client-side OMR engine
  return NextResponse.json(
    {
      detail: "FastAPI backend is offline. Client OMR engine will process this paper automatically.",
      fallback_to_client: true,
    },
    { status: 503 }
  );
}
