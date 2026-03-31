import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const scanServiceUrl = process.env.SCAN_SERVICE_URL || "http://localhost:8000";

export async function GET() {
  let online = false;
  let metrics = null;
  let botLogs: Array<{ id: string; timestamp: string; level: string; module: string; message: string; scanId?: string }> = [];
  let liveScans: Array<Record<string, unknown>> = [];
  let aiInsights: Array<Record<string, unknown>> = [];

  // Fetch live data from Python scan service
  try {
    const res = await fetch(`${scanServiceUrl}/api/monitor`, {
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      const data = await res.json();
      online = true;
      metrics = data.metrics || null;
      botLogs = data.logs || [];
      liveScans = data.activeScans || [];
      aiInsights = data.aiInsights || [];
    }
  } catch {
    // Scan service unreachable
  }

  // Get active scans from DB as fallback
  const runningScans = await prisma.scan.findMany({
    where: { status: "RUNNING" },
    include: { _count: { select: { findings: true } } },
    orderBy: { startedAt: "asc" },
  });

  // Get queued scans waiting to be started
  const queuedScans = await prisma.scan.findMany({
    where: { status: "QUEUED" },
    include: { program: true, _count: { select: { findings: true } } },
    orderBy: { createdAt: "asc" },
  });

  // Merge: prefer live scan data, fallback to DB
  const activeScans = liveScans.length > 0 ? liveScans : runningScans.map((scan) => {
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
      modulesTotal: modules.length || 3,
      modulesDone: completedPhases,
      currentModule: currentPhase?.name || "",
      startedAt: scan.startedAt?.toISOString() || "",
      elapsed: scan.startedAt ? Date.now() - scan.startedAt.getTime() : 0,
      findingsCount: scan._count.findings,
      stats: stats || {},
    };
  });

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

  const queuedScansMapped = queuedScans.map((scan) => ({
    id: scan.id,
    target: scan.target,
    status: "QUEUED",
    programName: scan.program?.name || null,
    config: scan.config,
    createdAt: scan.createdAt.toISOString(),
  }));

  return NextResponse.json({
    online,
    activeScans,
    queuedScans: queuedScansMapped,
    metrics,
    logs: botLogs,
    aiInsights,
  });
}
