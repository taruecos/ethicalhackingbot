import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { verifyBearer } from "@/lib/auth";
import { parseIdParam, parseJsonBody } from "@/lib/validation";

const checkpointBodySchema = z
  .object({
    lastModule: z.number().int().min(0).max(8),
    lastModuleName: z.string().max(50),
    endpointsTotal: z.number().int().min(0),
    findingsCount: z.number().int().min(0),
    stats: z.record(z.string(), z.unknown()).optional(),
    phase: z.string().max(30).optional(),
    progress: z.number().min(0).max(100).optional(),
  })
  .strict();

/**
 * Save/update scan checkpoint (called by Python scanner after each module).
 * PATCH /api/scans/:id/checkpoint
 *
 * Also: GET to retrieve last checkpoint (for resume).
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const idCheck = parseIdParam(rawId);
  if (!idCheck.ok) return idCheck.response;
  const { id } = idCheck;

  if (!verifyBearer(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const scan = await prisma.scan.findUnique({ where: { id } });
  if (!scan) {
    return NextResponse.json({ error: "Scan not found" }, { status: 404 });
  }

  const parsed = await parseJsonBody(req, checkpointBodySchema);
  if (!parsed.ok) return parsed.response;
  const { lastModule, lastModuleName, endpointsTotal, findingsCount, stats, phase, progress } =
    parsed.data;

  const checkpoint = await prisma.scanCheckpoint.upsert({
    where: { scanId: id },
    update: {
      lastModule,
      lastModuleName,
      endpointsTotal,
      findingsCount,
      stats: (stats ?? undefined) as Prisma.InputJsonValue | undefined,
      phase: phase ?? undefined,
      progress: progress ?? undefined,
    },
    create: {
      scanId: id,
      lastModule,
      lastModuleName,
      endpointsTotal,
      findingsCount,
      stats: (stats ?? {}) as Prisma.InputJsonValue,
      phase: phase ?? "recon",
      progress: progress ?? 0,
    },
  });

  return NextResponse.json({ ok: true, checkpoint });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const idCheck = parseIdParam(rawId);
  if (!idCheck.ok) return idCheck.response;
  const { id } = idCheck;

  const checkpoint = await prisma.scanCheckpoint.findUnique({
    where: { scanId: id },
  });

  const endpoints = await prisma.crawlEndpoint.findMany({
    where: { scanId: id },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({
    checkpoint,
    endpoints: endpoints.map((ep) => ({ url: ep.url, method: ep.method, params: ep.params })),
    endpointCount: endpoints.length,
  });
}
