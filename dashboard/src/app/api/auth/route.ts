import { NextRequest, NextResponse } from "next/server";
import { botFetch } from "@/lib/bot-api";

export async function POST(req: NextRequest) {
  const { token } = await req.json();
  if (!token) {
    return NextResponse.json({ error: "Token required" }, { status: 400 });
  }

  try {
    // Verify token against the bot API
    const res = await fetch(
      `${process.env.BOT_API_URL || "http://localhost:8080"}/api/auth?token=${encodeURIComponent(token)}`
    );
    const data = await res.json();

    if (data.ok) {
      const response = NextResponse.json({ ok: true });
      response.cookies.set("auth_token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 7, // 7 days
      });
      return response;
    }

    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  } catch {
    return NextResponse.json({ error: "Bot unreachable" }, { status: 502 });
  }
}
