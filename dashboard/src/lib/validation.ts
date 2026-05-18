import { NextResponse } from "next/server";
import { z, type ZodSchema } from "zod";

/**
 * Loose CUID/ID shape check for path params.
 *
 * Prisma cuids look like `c[a-z0-9]{24}` but we keep this permissive
 * (alphanumeric + dashes/underscores, 8-64 chars) so we accept any
 * reasonable id format while still rejecting obviously malformed input
 * (null bytes, control chars, SQL injection attempts, etc.) before it
 * reaches the DB layer.
 */
export const idParamSchema = z
  .string()
  .min(1, "id is required")
  .max(64, "id is too long")
  .regex(/^[A-Za-z0-9_-]+$/, "id contains invalid characters");

/**
 * Parse a path param against `idParamSchema`. On failure, return a
 * 400 NextResponse. On success, return `{ id }`.
 */
export function parseIdParam(raw: string):
  | { ok: true; id: string }
  | { ok: false; response: NextResponse } {
  const result = idParamSchema.safeParse(raw);
  if (!result.success) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "Invalid path parameter",
          details: result.error.format(),
        },
        { status: 400 }
      ),
    };
  }
  return { ok: true, id: result.data };
}

/**
 * Convert URLSearchParams to a plain object for Zod parsing.
 * If a key appears multiple times, only the first value is kept
 * (matches `searchParams.get()` semantics used throughout the codebase).
 */
export function searchParamsToObject(
  searchParams: URLSearchParams
): Record<string, string> {
  const obj: Record<string, string> = {};
  for (const [key, value] of searchParams.entries()) {
    if (!(key in obj)) obj[key] = value;
  }
  return obj;
}

/**
 * Parse searchParams against a Zod schema. On failure, return a 400
 * NextResponse. On success, return the parsed data.
 */
export function parseSearchParams<T extends ZodSchema>(
  searchParams: URLSearchParams,
  schema: T
):
  | { ok: true; data: z.infer<T> }
  | { ok: false; response: NextResponse } {
  const result = schema.safeParse(searchParamsToObject(searchParams));
  if (!result.success) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "Invalid query parameters",
          details: result.error.format(),
        },
        { status: 400 }
      ),
    };
  }
  return { ok: true, data: result.data };
}

/**
 * Parse a request JSON body against a Zod schema. On parse failure or
 * schema failure, return a 400 NextResponse. On success, return the
 * parsed, typed data.
 *
 * Mirrors `parseSearchParams` style so all route handlers can use the
 * same `if (!parsed.ok) return parsed.response;` pattern.
 */
export async function parseJsonBody<T extends ZodSchema>(
  req: Request,
  schema: T
): Promise<
  | { ok: true; data: z.infer<T> }
  | { ok: false; response: NextResponse }
> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      ),
    };
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "Invalid request body",
          details: result.error.format(),
        },
        { status: 400 }
      ),
    };
  }
  return { ok: true, data: result.data };
}
