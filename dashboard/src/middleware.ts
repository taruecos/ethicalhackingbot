import { NextRequest, NextResponse } from "next/server";

const MIN_TOKEN_LENGTH = 16;

const PUBLIC_API_PATHS = new Set<string>([
  "/api/auth",
  "/api/auth/setup",
  "/api/auth/status",
]);

const BOT_CALLBACK_PATTERNS: { method: string; pattern: RegExp }[] = [
  { method: "PATCH", pattern: /^\/api\/scans\/[^/]+\/progress$/ },
  { method: "POST", pattern: /^\/api\/scans\/[^/]+\/checkpoint$/ },
  { method: "POST", pattern: /^\/api\/scans\/[^/]+\/endpoints$/ },
  { method: "POST", pattern: /^\/api\/scans\/[^/]+\/logs$/ },
];

function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

function redirectToLogin(req: NextRequest) {
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isApi = pathname.startsWith("/api");

  if (isApi && PUBLIC_API_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  const expected = process.env.DASHBOARD_TOKEN;
  if (!expected || expected.length < MIN_TOKEN_LENGTH) {
    if (isApi) {
      return NextResponse.json(
        { error: "Server misconfigured: DASHBOARD_TOKEN missing or too short" },
        { status: 503 }
      );
    }
    return redirectToLogin(req);
  }

  if (isApi) {
    const isBotCallback = BOT_CALLBACK_PATTERNS.some(
      (bc) => bc.method === req.method && bc.pattern.test(pathname)
    );
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

  const cookie = req.cookies.get("auth_token")?.value || "";
  if (!constantTimeEquals(cookie, expected)) {
    return redirectToLogin(req);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!login|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
