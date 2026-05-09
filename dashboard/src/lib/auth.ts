import { NextRequest } from "next/server";

export class AuthConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthConfigError";
  }
}

const MIN_TOKEN_LENGTH = 16;

export function getDashboardToken(): string {
  const token = process.env.DASHBOARD_TOKEN;
  if (!token || token.length < MIN_TOKEN_LENGTH) {
    throw new AuthConfigError(
      `DASHBOARD_TOKEN must be set and at least ${MIN_TOKEN_LENGTH} characters`
    );
  }
  return token;
}

export function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

export function verifyBearer(req: NextRequest): boolean {
  let expected: string;
  try {
    expected = getDashboardToken();
  } catch {
    return false;
  }
  const auth = req.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) return false;
  return constantTimeEquals(auth.slice(7), expected);
}

export function verifyCookie(req: NextRequest): boolean {
  let expected: string;
  try {
    expected = getDashboardToken();
  } catch {
    return false;
  }
  const cookie = req.cookies.get("auth_token")?.value || "";
  return constantTimeEquals(cookie, expected);
}
