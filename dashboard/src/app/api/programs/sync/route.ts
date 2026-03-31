import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const platform = body.platform;

  try {
    const botUrl = process.env.BOT_API_URL || "http://localhost:8080";
    const token = process.env.DASHBOARD_TOKEN || "";
    const res = await fetch(`${botUrl}/api/bounty/fetch`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ platform }),
    });
    const data = await res.json();
    return NextResponse.json({ ok: true, ...data });
  } catch {
    return NextResponse.json({ error: "Bot unreachable" }, { status: 502 });
  }
}
