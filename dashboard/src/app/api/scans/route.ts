import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { parseSearchParams } from "@/lib/validation";

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
  const body = await req.json();
  const { domain, programId, depth, modules, rateLimit, scope, rulesOfEngagement } = body;

  if (!domain) {
    return NextResponse.json({ error: "Domain required" }, { status: 400 });
  }

  // HARD BLOCK: refuse to create scan without safe harbour protection
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
        depth: depth || "standard",
        modules: modules || [],
        rateLimit: rateLimit || 30,
        scope: scope || [],
        rulesOfEngagement: rulesOfEngagement || null,
      },
      programId: programId || null,
    },
  });

  // Scan stays QUEUED — user starts it manually from Live Monitor
  return NextResponse.json(scan, { status: 201 });
}
