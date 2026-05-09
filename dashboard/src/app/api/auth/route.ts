import { NextRequest, NextResponse } from "next/server";
import { getDashboardToken, constantTimeEquals, AuthConfigError } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { token } = await req.json();
  if (!token) {
    return NextResponse.json({ error: "Token required" }, { status: 400 });
  }

  let expectedToken: string;
  try {
    expectedToken = getDashboardToken();
  } catch (err) {
    if (err instanceof AuthConfigError) {
      return NextResponse.json(
        { error: "Server misconfigured: dashboard token not set" },
        { status: 503 }
      );
    }
    throw err;
  }

  if (constantTimeEquals(token, expectedToken)) {
    const response = NextResponse.json({ ok: true });
    response.cookies.set("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    return response;
  }

  return NextResponse.json({ error: "Invalid token" }, { status: 401 });
}
