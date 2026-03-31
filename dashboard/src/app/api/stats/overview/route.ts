import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const [totalScans, activeScans, totalFindings, criticalFindings, recentScans] =
    await Promise.all([
      prisma.scan.count(),
      prisma.scan.count({ where: { status: "RUNNING" } }),
      prisma.finding.count({ where: { falsePositive: false } }),
      prisma.finding.count({ where: { severity: "CRITICAL", falsePositive: false } }),
      prisma.scan.findMany({
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          target: true,
          status: true,
          startedAt: true,
          finishedAt: true,
          stats: true,
        },
      }),
    ]);

  // Severity breakdown
  const severityCounts = await prisma.finding.groupBy({
    by: ["severity"],
    where: { falsePositive: false },
    _count: true,
  });

  const severityBreakdown = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const s of severityCounts) {
    const key = s.severity.toLowerCase() as keyof typeof severityBreakdown;
    if (key in severityBreakdown) severityBreakdown[key] = s._count;
  }

  return NextResponse.json({
    totalScans,
    activeScans,
    totalFindings,
    criticalFindings,
    recentScans,
    severityBreakdown,
  });
}
