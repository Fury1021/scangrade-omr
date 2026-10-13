import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
  
  if (backendUrl) {
    try {
      const res = await fetch(`${backendUrl}/api/health`, {
        signal: AbortSignal.timeout(3000),
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        return NextResponse.json({ ...data, mode: "Python FastAPI (OpenCV)" });
      }
    } catch {
      // Fall through to fallback
    }
  }

  // Try local FastAPI port 8001
  try {
    const res = await fetch("http://127.0.0.1:8001/api/health", {
      signal: AbortSignal.timeout(1500),
      cache: "no-store",
    });
    if (res.ok) {
      const data = await res.json();
      return NextResponse.json({ ...data, mode: "Local Python Engine (Port 8001)" });
    }
  } catch {
    // Local backend offline
  }

  // Built-in Next.js Standalone Mode (Works 100% on Vercel)
  return NextResponse.json({
    status: "online",
    service: "ScanGrade OMR",
    mode: "Cloud Standalone Engine",
    version: "1.0.0",
    templates_available: ["aiscc_160", "standard_50", "standard_100"],
  });
}
