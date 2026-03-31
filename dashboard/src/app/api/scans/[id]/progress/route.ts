import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

/**
 * Bot callback endpoint — receives scan progress updates from the Python bot.
 * PATCH /api/scans/:id/progress
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Verify bot token
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const expectedToken = process.env.DASHBOARD_TOKEN || "";
  if (!token || token !== expectedToken) {
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

  if (status) {
    updateData.status = status as "RUNNING" | "COMPLETE" | "ERROR" | "CANCELLED";
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
  if (status === "COMPLETE") {
    updateData.finishedAt = new Date();
  }
  if (status === "ERROR") {
    updateData.finishedAt = new Date();
  }

  // Update scan record
  await prisma.scan.update({
    where: { id },
    data: updateData,
  });

  // If findings are provided, create them in DB
  if (findings && Array.isArray(findings) && findings.length > 0) {
    // Build stats from findings
    const stats: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0, total: 0 };

    const findingData = findings.map((f: Record<string, unknown>) => {
      const severity = ((f.severity as string) || "INFO").toUpperCase();
      const sevKey = severity.toLowerCase();
      if (sevKey in stats) stats[sevKey]++;
      stats.total++;

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

    await prisma.finding.createMany({ data: findingData });
    await prisma.scan.update({
      where: { id },
      data: { stats },
    });
  }

  return NextResponse.json({ ok: true });
}
