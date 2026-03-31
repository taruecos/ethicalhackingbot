import { NextRequest, NextResponse } from "next/server";

const botUrl = process.env.BOT_API_URL || "http://localhost:8080";
const token = process.env.DASHBOARD_TOKEN || "";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const res = await fetch(`${botUrl}/api/intigriti/programs/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Bot unreachable" }, { status: 502 });
  }
}
