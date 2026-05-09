import { NextRequest, NextResponse } from "next/server";
import {
  verifyPassword,
  isPasswordSetup,
  getDashboardToken,
  AuthConfigError,
} from "@/lib/auth";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const password: string | undefined = body.password ?? body.token;

  if (!password) {
    return NextResponse.json({ error: "Password required" }, { status: 400 });
  }

  if (!(await isPasswordSetup())) {
    return NextResponse.json(
      { error: "Password not set up yet", setupRequired: true },
      { status: 412 }
    );
  }

  let dashboardToken: string;
  try {
    dashboardToken = getDashboardToken();
  } catch (err) {
    if (err instanceof AuthConfigError) {
      return NextResponse.json(
        { error: "Server misconfigured: dashboard token not set" },
        { status: 503 }
      );
    }
    throw err;
  }

  if (await verifyPassword(password)) {
    const response = NextResponse.json({ ok: true });
    response.cookies.set("auth_token", dashboardToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    return response;
  }

  return NextResponse.json({ error: "Invalid password" }, { status: 401 });
}
