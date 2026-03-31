import { NextResponse } from "next/server";

export async function GET() {
  try {
    const botUrl = process.env.BOT_API_URL || "http://localhost:8080";
    const token = process.env.DASHBOARD_TOKEN || "";
    const res = await fetch(`${botUrl}/api/status?token=${encodeURIComponent(token)}`, {
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
