import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * Relaunch a scan that is COMPLETE, ERROR, or CANCELLED.
 * POST /api/scans/:id/relaunch
 *
 * Body options:
 * - resume: true → reuse same scan, keep saved endpoints + checkpoint, resume from last module
 * - resume: false/omitted → create a fresh new QUEUED scan with same config
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const scan = await prisma.scan.findUnique({
    where: { id },
    include: { program: true, checkpoint: true },
  });

  if (!scan) {
    return NextResponse.json({ error: "Scan not found" }, { status: 404 });
  }

  if (scan.status === "QUEUED" || scan.status === "RUNNING") {
    return NextResponse.json(
      { error: `Scan is ${scan.status} — cannot relaunch an active scan` },
      { status: 400 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const wantsResume = body.resume === true;
  const canResume = wantsResume && scan.checkpoint !== null;

  if (canResume) {
    // Resume mode: reset status on same scan, keep endpoints + checkpoint
    const updated = await prisma.scan.update({
      where: { id },
      data: {
        status: "QUEUED",
        finishedAt: null,
        error: null,
      },
    });

    return NextResponse.json({ ...updated, mode: "resume" });
  }

  // Fresh mode: create a new scan with the same config
  // Clean up old data from the original scan
  await prisma.$transaction([
    prisma.crawlEndpoint.deleteMany({ where: { scanId: id } }),
    prisma.scanCheckpoint.deleteMany({ where: { scanId: id } }),
  ]);

  const newScan = await prisma.scan.create({
    data: {
      target: scan.target,
      status: "QUEUED",
      config: scan.config as object,
      programId: scan.programId,
    },
  });

  return NextResponse.json({ ...newScan, mode: "fresh" });
}
