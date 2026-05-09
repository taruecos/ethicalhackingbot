import { NextRequest, NextResponse } from "next/server";
import {
  isPasswordSetup,
  setInitialPassword,
  getDashboardToken,
  AuthConfigError,
  MIN_PASSWORD_LENGTH,
} from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { password } = await req.json();
  if (!password || typeof password !== "string") {
    return NextResponse.json({ error: "Password required" }, { status: 400 });
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json(
      { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` },
      { status: 400 }
    );
  }

  if (await isPasswordSetup()) {
    return NextResponse.json(
      { error: "Password already set" },
      { status: 409 }
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

  await setInitialPassword(password);

  const response = NextResponse.json({ ok: true });
  response.cookies.set("auth_token", dashboardToken, {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === "true",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}
