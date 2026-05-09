import { NextRequest, NextResponse } from "next/server";

const MIN_TOKEN_LENGTH = 16;

const PUBLIC_API_PATHS = new Set<string>(["/api/auth"]);

const BOT_CALLBACK_PATTERNS: RegExp[] = [
  /^\/api\/scans\/[^/]+\/progress$/,
  /^\/api\/scans\/[^/]+\/checkpoint$/,
  /^\/api\/scans\/[^/]+\/endpoints$/,
];

function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_API_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  const expected = process.env.DASHBOARD_TOKEN;
  if (!expected || expected.length < MIN_TOKEN_LENGTH) {
    return NextResponse.json(
      { error: "Server misconfigured: DASHBOARD_TOKEN missing or too short" },
      { status: 503 }
    );
  }

  const isBotCallback = BOT_CALLBACK_PATTERNS.some((rx) => rx.test(pathname));
  if (isBotCallback) {
    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!constantTimeEquals(token, expected)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.next();
  }

  const cookie = req.cookies.get("auth_token")?.value || "";
  if (!constantTimeEquals(cookie, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};
