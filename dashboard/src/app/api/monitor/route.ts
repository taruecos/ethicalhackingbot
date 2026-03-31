import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const botUrl = process.env.BOT_API_URL || "http://localhost:8080";
  const token = process.env.DASHBOARD_TOKEN || "";

  let online = false;
  let metrics = null;
  let botLogs: Array<{ id: string; timestamp: string; level: string; module: string; message: string; scanId?: string }> = [];

  // Try to fetch live data from the bot
  try {
    const res = await fetch(`${botUrl}/api/monitor?token=${encodeURIComponent(token)}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      const data = await res.json();
      online = true;
      metrics = data.metrics || null;
      botLogs = data.logs || [];
    }
  } catch {
    // Bot unreachable
  }

  // Get active scans from DB
  const runningScans = await prisma.scan.findMany({
    where: { status: "RUNNING" },
    include: { _count: { select: { findings: true } } },
    orderBy: { startedAt: "asc" },
  });

  const activeScans = runningScans.map((scan) => {
    const config = scan.config as Record<string, unknown>;
    const phases = scan.phases as Array<{ name: string; time: string; status?: string }>;
    const stats = scan.stats as Record<string, number>;
    const modules = (config.modules || []) as string[];
    const completedPhases = phases.filter((p) => p.status === "done").length;
    const totalPhases = 5;
    const progress = totalPhases > 0 ? Math.min((completedPhases / totalPhases) * 100, 99) : 0;
    const currentPhase = phases.length > 0 ? phases[phases.length - 1] : null;

    return {
      id: scan.id,
      target: scan.target,
      status: scan.status,
      phase: currentPhase?.name || "init",
      progress,
      modulesTotal: modules.length || 8,
      modulesDone: completedPhases,
      currentModule: currentPhase?.name || "",
      startedAt: scan.startedAt?.toISOString() || "",
      elapsed: scan.startedAt ? Date.now() - scan.startedAt.getTime() : 0,
      findingsCount: scan._count.findings,
      stats: stats || {},
    };
  });

  // Fallback metrics from DB if bot is offline
  if (!metrics) {
    const [totalScans, runningCount] = await Promise.all([
      prisma.scan.count(),
      prisma.scan.count({ where: { status: "RUNNING" } }),
    ]);
    metrics = {
      cpuPercent: 0,
      memoryUsed: 0,
      memoryTotal: 0,
      diskUsed: 0,
      diskTotal: 0,
      uptime: 0,
      requestsPerMinute: 0,
      activeConnections: runningCount,
      totalScans,
    };
  }

  return NextResponse.json({
    online,
    activeScans,
    metrics,
    logs: botLogs,
  });
}
