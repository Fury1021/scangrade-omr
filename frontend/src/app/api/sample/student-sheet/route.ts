import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

export async function GET() {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
  if (backendUrl) {
    try {
      const res = await fetch(`${backendUrl}/api/sample/student-sheet`, {
        signal: AbortSignal.timeout(3000),
      });
      if (res.ok) {
        const buffer = await res.arrayBuffer();
        return new NextResponse(buffer, {
          headers: { "Content-Type": "image/png" },
        });
      }
    } catch {}
  }

  // Try local FastAPI
  try {
    const res = await fetch("http://127.0.0.1:8001/api/sample/student-sheet", {
      signal: AbortSignal.timeout(1500),
    });
    if (res.ok) {
      const buffer = await res.arrayBuffer();
      return new NextResponse(buffer, {
        headers: { "Content-Type": "image/png" },
      });
    }
  } catch {}

  // Native return from public folder
  try {
    const filePath = path.join(process.cwd(), "public", "sample_answer_sheet.png");
    if (fs.existsSync(filePath)) {
      const fileBuffer = fs.readFileSync(filePath);
      return new NextResponse(fileBuffer, {
        headers: { "Content-Type": "image/png" },
      });
    }
  } catch {}

  return NextResponse.json({ error: "Sample sheet not found" }, { status: 404 });
}
