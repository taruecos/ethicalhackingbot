import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const scanServiceUrl = process.env.SCAN_SERVICE_URL || "http://localhost:8000";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const scan = await prisma.scan.findUnique({
    where: { id },
    include: { program: true },
  });

  if (!scan) {
    return NextResponse.json({ error: "Scan not found" }, { status: 404 });
  }

  if (scan.status !== "QUEUED") {
    return NextResponse.json({ error: `Scan is ${scan.status}, not QUEUED` }, { status: 400 });
  }

  const config = scan.config as Record<string, unknown>;
  const dashboardUrl = process.env.DASHBOARD_URL || "http://localhost:3000";
  const token = process.env.DASHBOARD_TOKEN || "";

  try {
    const compliance = scan.program?.compliance as Record<string, unknown> | null;

    await fetch(`${scanServiceUrl}/api/scan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        domain: scan.target,
        scan_id: scan.id,
        callback_url: `${dashboardUrl}/api/scans/${scan.id}/progress`,
        callback_token: token,
        depth: config.depth || "standard",
        modules: config.modules || [],
        rate_limit: config.rateLimit || 30,
        rules_of_engagement: compliance
          ? {
              userAgent: compliance.userAgent || null,
              requestHeader: compliance.requestHeader || null,
              safeHarbour: compliance.safeHarbour || null,
            }
          : null,
      }),
    });

    const updated = await prisma.scan.update({
      where: { id },
      data: { status: "RUNNING", startedAt: new Date() },
    });

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Scan service unreachable" }, { status: 502 });
  }
}
