import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { parseSearchParams } from "@/lib/validation";

const SEVERITY_VALUES = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"] as const;
const FINDING_STATUS_VALUES = [
  "NEW",
  "CONFIRMED",
  "FALSE_POSITIVE",
  "FIXED",
  "ACCEPTED",
  "REPORTED",
] as const;

// Comma-separated list of enum values, e.g. "HIGH,CRITICAL".
function csvEnum<T extends readonly [string, ...string[]]>(values: T) {
  return z
    .string()
    .min(1)
    .transform((raw, ctx) => {
      const parts = raw
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean);
      if (parts.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "must contain at least one value",
        });
        return z.NEVER;
      }
      const valid = new Set(values as readonly string[]);
      for (const p of parts) {
        if (!valid.has(p)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `invalid value "${p}", expected one of ${values.join(", ")}`,
          });
          return z.NEVER;
        }
      }
      return parts as unknown as T[number][];
    });
}

const findingsQuerySchema = z
  .object({
    scanId: z
      .string()
      .min(1)
      .max(64)
      .regex(/^[A-Za-z0-9_-]+$/, "invalid scanId format")
      .optional(),
    severity: csvEnum(SEVERITY_VALUES).optional(),
    status: csvEnum(FINDING_STATUS_VALUES).optional(),
    module: z.string().min(1).max(128).optional(),
    search: z.string().min(1).max(256).optional(),
  })
  .strict();

export async function GET(req: NextRequest) {
  const parsed = parseSearchParams(req.nextUrl.searchParams, findingsQuerySchema);
  if (!parsed.ok) return parsed.response;
  const { scanId, severity, status, module, search } = parsed.data;

  const where: Prisma.FindingWhereInput = {};

  if (scanId) where.scanId = scanId;
  if (severity) where.severity = { in: severity };
  if (status) where.status = { in: status };
  if (module) where.module = module;
  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
      { url: { contains: search, mode: "insensitive" } },
    ];
  }

  const findings = await prisma.finding.findMany({
    where,
    orderBy: [
      { severity: "asc" }, // CRITICAL first
      { createdAt: "desc" },
    ],
    take: 200,
    include: { scan: { select: { target: true } } },
  });

  return NextResponse.json({ findings, total: findings.length });
}
