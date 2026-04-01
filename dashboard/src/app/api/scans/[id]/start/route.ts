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
    const programScope = scan.program?.scope as string[] | null;
    const configScope = config.scope as string[] | undefined;
    const configRoe = config.rulesOfEngagement as Record<string, unknown> | undefined;

    // Build scope: program scope > config scope > default to target domain
    const scope = programScope && programScope.length > 0
      ? programScope
      : configScope && configScope.length > 0
        ? configScope
        : [scan.target, `*.${scan.target}`];

    // Build ROE: program compliance > config ROE > null
    const roe = compliance
      ? {
          userAgent: compliance.userAgent || null,
          requestHeader: compliance.requestHeader || null,
          safeHarbour: compliance.safeHarbour || null,
        }
      : configRoe
        ? {
            userAgent: configRoe.userAgent || null,
            requestHeader: configRoe.requestHeader || null,
            safeHarbour: configRoe.safeHarbour || null,
          }
        : null;

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
        scope,
        rules_of_engagement: roe,
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
