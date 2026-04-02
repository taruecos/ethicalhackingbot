import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * Save/update scan checkpoint (called by Python scanner after each module).
 * PATCH /api/scans/:id/checkpoint
 *
 * Also: GET to retrieve last checkpoint (for resume).
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const expectedToken = process.env.DASHBOARD_TOKEN || "";
  if (!token || token !== expectedToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const scan = await prisma.scan.findUnique({ where: { id } });
  if (!scan) {
    return NextResponse.json({ error: "Scan not found" }, { status: 404 });
  }

  const body = await req.json();
  const { lastModule, lastModuleName, endpointsTotal, findingsCount, stats, phase, progress } = body;

  const checkpoint = await prisma.scanCheckpoint.upsert({
    where: { scanId: id },
    update: {
      lastModule: lastModule ?? undefined,
      lastModuleName: lastModuleName ?? undefined,
      endpointsTotal: endpointsTotal ?? undefined,
      findingsCount: findingsCount ?? undefined,
      stats: stats ?? undefined,
      phase: phase ?? undefined,
      progress: progress ?? undefined,
    },
    create: {
      scanId: id,
      lastModule: lastModule ?? 0,
      lastModuleName: lastModuleName ?? "",
      endpointsTotal: endpointsTotal ?? 0,
      findingsCount: findingsCount ?? 0,
      stats: stats ?? {},
      phase: phase ?? "recon",
      progress: progress ?? 0,
    },
  });

  return NextResponse.json({ ok: true, checkpoint });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

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
