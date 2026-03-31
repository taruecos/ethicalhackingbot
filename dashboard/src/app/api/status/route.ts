import { NextResponse } from "next/server";

const scanServiceUrl = process.env.SCAN_SERVICE_URL || "http://localhost:8000";

export async function GET() {
  try {
    const res = await fetch(`${scanServiceUrl}/api/status`, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const data = await res.json();
      return NextResponse.json({ online: true, ...data });
    }
    return NextResponse.json({ online: false });
  } catch {
    return NextResponse.json({ online: false });
  }
}
