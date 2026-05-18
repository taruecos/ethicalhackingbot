import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  idParamSchema,
  parseJsonBody,
  parseSearchParams,
} from "@/lib/validation";

const SCAN_STATUS_VALUES = [
  "QUEUED",
  "RUNNING",
  "COMPLETE",
  "ERROR",
  "CANCELLED",
] as const;

const scansQuerySchema = z
  .object({
    status: z.enum(SCAN_STATUS_VALUES).optional(),
  })
  .strict();

const SCAN_MODULES = [
  "idor",
  "xss",
  "sqli",
  "ssrf",
  "csrf",
  "access_control",
  "info_disclosure",
  "differential",
] as const;

const SCAN_DEPTHS = ["quick", "standard", "deep"] as const;

// Domain must be a bare hostname: no protocol, no path, max 253 chars.
const domainSchema = z
  .string()
  .max(253, "domain too long")
  .regex(
    /^[a-z0-9.-]+\.[a-z]{2,}$/,
    "domain must be a bare hostname (no protocol or path)"
  );

const rulesOfEngagementSchema = z
  .object({
    safeHarbour: z.literal(true, { message: "safeHarbour must be true" }),
    userAgent: z.string().max(200).optional(),
    customHeaders: z
      .record(z.string(), z.string())
      .refine(
        (rec) => Object.keys(rec).length <= 20,
        "customHeaders may have at most 20 entries"
      )
      .optional(),
    excludePaths: z.array(z.string()).max(50).optional(),
  })
  .strict();

const createScanBodySchema = z
  .object({
    domain: domainSchema,
    programId: idParamSchema.optional(),
    depth: z.enum(SCAN_DEPTHS).default("standard"),
    modules: z.array(z.enum(SCAN_MODULES)).max(8).default([]),
    rateLimit: z.number().int().min(1).max(100).default(30),
    scope: z.array(z.string().max(253)).max(50).default([]),
    rulesOfEngagement: rulesOfEngagementSchema,
  })
  .strict();

export async function GET(req: NextRequest) {
  const parsed = parseSearchParams(req.nextUrl.searchParams, scansQuerySchema);
  if (!parsed.ok) return parsed.response;
  const { status } = parsed.data;

  const where = status ? { status } : {};

  const scans = await prisma.scan.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { _count: { select: { findings: true } } },
  });

  return NextResponse.json({ scans });
}

export async function POST(req: NextRequest) {
  const parsed = await parseJsonBody(req, createScanBodySchema);
  if (!parsed.ok) return parsed.response;
  const { domain, programId, depth, modules, rateLimit, scope, rulesOfEngagement } =
    parsed.data;

  // HARD BLOCK: refuse to create scan without safe harbour protection.
  // Zod already enforces this structurally, but keep the runtime check
  // for compliance reasoning / belt-and-suspenders.
  if (!rulesOfEngagement || !rulesOfEngagement.safeHarbour) {
    return NextResponse.json(
      { error: "BLOCKED — no safe harbour protection. Cannot create scan without legal safe harbour." },
      { status: 403 }
    );
  }

  const target = domain.replace(/^https?:\/\//, "").replace(/\/$/, "");

  // Create scan in DB — scope and ROE stored in config for the scanner
  const scan = await prisma.scan.create({
    data: {
      target,
      status: "QUEUED",
      config: {
        depth,
        modules,
        rateLimit,
        scope,
        rulesOfEngagement,
      },
      programId: programId || null,
    },
  });

  // Scan stays QUEUED — user starts it manually from Live Monitor
  return NextResponse.json(scan, { status: 201 });
}
