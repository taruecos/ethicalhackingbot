import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getPayouts } from "@/lib/intigriti";
import { parseSearchParams } from "@/lib/validation";

const querySchema = z
  .object({
    limit: z
      .string()
      .regex(/^\d+$/, "limit must be a positive integer")
      .transform((v) => Number(v))
      .refine((n) => n > 0 && n <= 1000, "limit must be between 1 and 1000")
      .optional(),
    offset: z
      .string()
      .regex(/^\d+$/, "offset must be a non-negative integer")
      .transform((v) => Number(v))
      .refine((n) => n >= 0, "offset must be >= 0")
      .optional(),
  })
  .strict();

export async function GET(req: NextRequest) {
  const parsed = parseSearchParams(req.nextUrl.searchParams, querySchema);
  if (!parsed.ok) return parsed.response;
  const { limit = 100, offset = 0 } = parsed.data;

  try {
    const data = await getPayouts({ limit, offset });
    return NextResponse.json(data);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Intigriti API error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
