import { NextRequest, NextResponse } from "next/server";
import { Prisma, ScanStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { verifyBearer } from "@/lib/auth";
import { parseIdParam } from "@/lib/validation";

// Scanner sends lowercase status strings ("running", "complete", "error",
// "cancelled", "blocked"). Prisma enum requires uppercase. Map at the boundary.
function normalizeStatus(raw: unknown): ScanStatus | null {
  if (typeof raw !== "string") return null;
  switch (raw.toLowerCase()) {
    case "queued":
      return ScanStatus.QUEUED;
    case "running":
      return ScanStatus.RUNNING;
    case "complete":
    case "completed":
      return ScanStatus.COMPLETE;
    case "error":
    case "blocked":
      return ScanStatus.ERROR;
    case "cancelled":
    case "canceled":
      return ScanStatus.CANCELLED;
    default:
      return null;
  }
}

/**
 * Bot callback endpoint — receives scan progress updates from the Python bot.
 * PATCH /api/scans/:id/progress
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const idCheck = parseIdParam(rawId);
  if (!idCheck.ok) return idCheck.response;
  const { id } = idCheck;

  if (!verifyBearer(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { status, phases, findings, duration, error } = body;

  // Validate scan exists
  const scan = await prisma.scan.findUnique({ where: { id } });
  if (!scan) {
    return NextResponse.json({ error: "Scan not found" }, { status: 404 });
  }

  // Build update data
  const updateData: Record<string, unknown> = {};

  const normalizedStatus = normalizeStatus(status);
  if (normalizedStatus) {
    updateData.status = normalizedStatus;
  }
  if (phases) {
    updateData.phases = phases;
  }
  if (duration !== undefined) {
    updateData.duration = duration;
  }
  if (error) {
    updateData.error = error;
  }
  if (normalizedStatus === ScanStatus.COMPLETE || normalizedStatus === ScanStatus.ERROR) {
    updateData.finishedAt = new Date();
  }

  // Update scan record
  await prisma.scan.update({
    where: { id },
    data: updateData,
  });

  // If findings are provided, create them in DB
  if (findings && Array.isArray(findings) && findings.length > 0) {
    const findingData = findings.map((f: Record<string, unknown>) => {
      const severity = ((f.severity as string) || "INFO").toUpperCase();
      return {
        scanId: id,
        module: (f.module as string) || "unknown",
        severity: severity as "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO",
        confidence: (f.confidence as number) || 0.5,
        title: (f.title as string) || "Finding",
        description: (f.description as string) || "",
        url: (f.url as string) || null,
        evidence: (f.evidence || {}) as Prisma.InputJsonValue,
      };
    });

    // Deduplicate findings by (module, title, url) before inserting
    const seen = new Set<string>();
    const uniqueFindings = findingData.filter((f) => {
      const key = `${f.module}::${f.title}::${f.url || ""}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Compute stats from the deduped set so Scan.stats matches Finding rows.
    const stats: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0, total: 0 };
    for (const f of uniqueFindings) {
      const sevKey = f.severity.toLowerCase();
      if (sevKey in stats) stats[sevKey]++;
      stats.total++;
    }

    // Delete existing findings for this scan to prevent duplicates on resume
    await prisma.finding.deleteMany({ where: { scanId: id } });
    await prisma.finding.createMany({ data: uniqueFindings });
    await prisma.scan.update({
      where: { id },
      data: { stats },
    });
  }

  return NextResponse.json({ ok: true });
}
