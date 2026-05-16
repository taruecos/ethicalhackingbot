import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { parseSearchParams } from "@/lib/validation";

const SORT_BY_VALUES = ["syncedAt", "maxBounty", "name"] as const;
const SORT_DIR_VALUES = ["asc", "desc"] as const;
const BOOL_VALUES = ["true", "false"] as const;

const programsQuerySchema = z
  .object({
    compliant: z.enum(BOOL_VALUES).optional(),
    search: z.string().min(1).max(256).optional(),
    limit: z
      .string()
      .regex(/^\d+$/, "limit must be a positive integer")
      .transform((v) => Number(v))
      .refine((n) => n > 0 && n <= 5000, "limit must be between 1 and 5000")
      .optional(),
    industry: z.string().min(1).max(128).optional(),
    hasBounty: z.enum(BOOL_VALUES).optional(),
    confidentiality: z.string().min(1).max(64).optional(),
    sortBy: z.enum(SORT_BY_VALUES).optional(),
    sortDir: z.enum(SORT_DIR_VALUES).optional(),
  })
  .strict();

export async function GET(req: NextRequest) {
  const parsed = parseSearchParams(req.nextUrl.searchParams, programsQuerySchema);
  if (!parsed.ok) return parsed.response;
  const {
    compliant,
    search,
    limit = 500,
    industry,
    hasBounty,
    confidentiality,
    sortBy = "syncedAt",
    sortDir = "desc",
  } = parsed.data;

  const where: Record<string, unknown> = {};

  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { slug: { contains: search, mode: "insensitive" } },
    ];
  }

  if (industry) {
    where.industry = { equals: industry, mode: "insensitive" };
  }

  if (confidentiality) {
    where.confidentiality = confidentiality;
  }

  const orderBy: Record<string, string> = {};
  if (sortBy === "maxBounty") {
    orderBy.maxBounty = sortDir;
  } else if (sortBy === "name") {
    orderBy.name = sortDir;
  } else {
    orderBy.syncedAt = sortDir;
  }

  const programs = await prisma.program.findMany({
    where,
    orderBy,
    take: limit,
  });

  // Filter by compliance + bounty in app layer (JSON field filtering)
  let filtered = programs;
  if (compliant === "true") {
    filtered = filtered.filter((p) => {
      const c = p.compliance as Record<string, unknown> | null;
      return c?.automatedToolingStatus === "allowed" || c?.automatedToolingStatus === "conditional";
    });
  }

  if (hasBounty === "true") {
    filtered = filtered.filter((p) => p.maxBounty != null && p.maxBounty > 0);
  } else if (hasBounty === "false") {
    filtered = filtered.filter((p) => p.maxBounty == null || p.maxBounty === 0);
  }

  // Extract unique industries for filter dropdown
  const allPrograms = await prisma.program.findMany({ select: { industry: true }, distinct: ["industry"] });
  const industries = allPrograms.map((p) => p.industry).filter(Boolean).sort() as string[];

  return NextResponse.json({ programs: filtered, total: filtered.length, industries });
}
