import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

export class AuthConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthConfigError";
  }
}

const MIN_TOKEN_LENGTH = 16;
export const MIN_PASSWORD_LENGTH = 12;
const BCRYPT_ROUNDS = 12;
const CREDENTIAL_ID = 1;

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

export async function isPasswordSetup(): Promise<boolean> {
  const cred = await prisma.authCredential.findUnique({
    where: { id: CREDENTIAL_ID },
  });
  return cred !== null;
}

export async function setInitialPassword(password: string): Promise<void> {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(
      `Password must be at least ${MIN_PASSWORD_LENGTH} characters`
    );
  }
  const existing = await prisma.authCredential.findUnique({
    where: { id: CREDENTIAL_ID },
  });
  if (existing) {
    throw new Error("Password already set");
  }
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  await prisma.authCredential.create({
    data: { id: CREDENTIAL_ID, passwordHash },
  });
}

export async function verifyPassword(password: string): Promise<boolean> {
  if (!password) return false;
  const cred = await prisma.authCredential.findUnique({
    where: { id: CREDENTIAL_ID },
  });
  if (!cred) return false;
  return bcrypt.compare(password, cred.passwordHash);
}
