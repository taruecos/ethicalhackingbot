import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const range = req.nextUrl.searchParams.get("range") || "all";

  // Calculate date filter
  let dateFilter: Date | undefined;
  if (range === "7d") dateFilter = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  else if (range === "30d") dateFilter = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  else if (range === "90d") dateFilter = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  const dateWhere = dateFilter ? { createdAt: { gte: dateFilter } } : {};

  const [
    bounties,
    findingsByModule,
    findingsBySeverity,
    scans,
    totalFindings,
    falsePositiveCount,
    topVulns,
    uniqueTargets,
  ] = await Promise.all([
    prisma.bountyRecord.findMany({
      where: dateFilter ? { awardedAt: { gte: dateFilter } } : {},
      orderBy: { awardedAt: "desc" },
    }),
    prisma.finding.groupBy({
      by: ["module"],
      where: { falsePositive: false, ...dateWhere },
      _count: true,
      orderBy: { _count: { module: "desc" } },
      take: 10,
    }),
    prisma.finding.groupBy({
      by: ["severity"],
      where: { falsePositive: false, ...dateWhere },
      _count: true,
    }),
    prisma.scan.findMany({
      where: dateFilter ? { createdAt: { gte: dateFilter } } : {},
      select: { createdAt: true, status: true, target: true },
    }),
    prisma.finding.count({ where: { ...dateWhere, falsePositive: false } }),
    prisma.finding.count({ where: { ...dateWhere, falsePositive: true } }),
    prisma.finding.groupBy({
      by: ["title", "severity", "module"],
      where: { falsePositive: false, ...dateWhere },
      _count: true,
      orderBy: { _count: { title: "desc" } },
      take: 10,
    }),
    prisma.scan.groupBy({
      by: ["target"],
      where: dateFilter ? { createdAt: { gte: dateFilter } } : {},
    }),
  ]);

  const totalRevenue = bounties.reduce((sum, b) => sum + b.amount, 0);
  const accepted = bounties.filter((b) => b.status === "accepted");

  // Severity breakdown
  const severityMap: Record<string, number> = {};
  for (const s of findingsBySeverity) {
    severityMap[s.severity] = s._count;
  }

  // Scans by month
  const scansByMonth: Record<string, number> = {};
  const completedScans = scans.filter((s) => s.status === "COMPLETE");
  for (const s of scans) {
    const month = s.createdAt.toISOString().slice(0, 7);
    scansByMonth[month] = (scansByMonth[month] || 0) + 1;
  }

  // Revenue by month
  const revenueByMonth: Record<string, number> = {};
  for (const b of bounties) {
    const month = b.awardedAt.toISOString().slice(0, 7);
    revenueByMonth[month] = (revenueByMonth[month] || 0) + b.amount;
  }

  // Platform stats from bounty records
  const platformStatsMap: Record<string, { scans: number; findings: number; reported: number; accepted: number; bounty: number }> = {};
  for (const b of bounties) {
    if (!platformStatsMap[b.platform]) {
      platformStatsMap[b.platform] = { scans: 0, findings: 0, reported: 0, accepted: 0, bounty: 0 };
    }
    platformStatsMap[b.platform].bounty += b.amount;
    if (b.status === "accepted") platformStatsMap[b.platform].accepted += 1;
    platformStatsMap[b.platform].reported += 1;
  }

  // Scan success rate
  const totalScansCount = scans.length;
  const scanSuccessRate = totalScansCount > 0
    ? Math.round((completedScans.length / totalScansCount) * 100)
    : 0;

  // Findings per scan
  const findingsPerScan = completedScans.length > 0
    ? totalFindings / completedScans.length
    : 0;

  // False positive rate
  const allFindingsCount = totalFindings + falsePositiveCount;
  const falsePositiveRate = allFindingsCount > 0
    ? Math.round((falsePositiveCount / allFindingsCount) * 100)
    : 0;

  return NextResponse.json({
    totalBounties: bounties.length,
    totalRevenue,
    acceptanceRate: bounties.length > 0 ? Math.round((accepted.length / bounties.length) * 100) : 0,
    avgResponseTime: 0,
    totalTargets: uniqueTargets.length,
    scanSuccessRate,
    findingsPerScan: Math.round(findingsPerScan * 10) / 10,
    falsePositiveRate,
    scansByMonth: Object.entries(scansByMonth)
      .sort()
      .slice(-12)
      .map(([month, count]) => ({ month, count })),
    findingsBySeverity: severityMap,
    topModules: findingsByModule.map((m) => ({
      module: m.module,
      findings: m._count,
    })),
    revenueByMonth: Object.entries(revenueByMonth)
      .sort()
      .slice(-12)
      .map(([month, amount]) => ({ month, amount })),
    platformStats: Object.entries(platformStatsMap).map(([platform, stats]) => ({
      platform,
      ...stats,
    })),
    topVulnerabilities: topVulns.map((v) => ({
      title: v.title,
      severity: v.severity,
      module: v.module,
      count: v._count,
    })),
  });
}
