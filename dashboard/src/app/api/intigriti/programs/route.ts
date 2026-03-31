import { NextRequest, NextResponse } from "next/server";

const botUrl = process.env.BOT_API_URL || "http://localhost:8080";
const token = process.env.DASHBOARD_TOKEN || "";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = searchParams.get("limit") || "100";
  const offset = searchParams.get("offset") || "0";
  const following = searchParams.get("following") || "";

  try {
    const params = new URLSearchParams({ limit, offset });
    if (following) params.set("following", following);

    const res = await fetch(`${botUrl}/api/intigriti/programs?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Bot unreachable" }, { status: 502 });
  }
}
