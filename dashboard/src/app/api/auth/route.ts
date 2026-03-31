import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { token } = await req.json();
  if (!token) {
    return NextResponse.json({ error: "Token required" }, { status: 400 });
  }

  // Simple token check — compare against DASHBOARD_TOKEN
  const expectedToken = process.env.DASHBOARD_TOKEN || "";
  if (token === expectedToken) {
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
}
