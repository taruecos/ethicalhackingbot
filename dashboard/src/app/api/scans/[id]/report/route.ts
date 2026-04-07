import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * Generate a scan report with findings and stats.
 * GET /api/scans/:id/report
 * Query params:
 *   format=json (default) | markdown
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const scan = await prisma.scan.findUnique({
    where: { id },
    include: {
      findings: { orderBy: { severity: "asc" } },
      program: true,
      checkpoint: true,
    },
  });

  if (!scan) {
    return NextResponse.json({ error: "Scan not found" }, { status: 404 });
  }

  const config = scan.config as Record<string, unknown>;
  const severityOrder: Record<string, number> = {
    CRITICAL: 0,
    HIGH: 1,
    MEDIUM: 2,
    LOW: 3,
    INFO: 4,
  };

  const sortedFindings = [...scan.findings].sort(
    (a, b) => (severityOrder[a.severity] ?? 99) - (severityOrder[b.severity] ?? 99)
  );

  const stats: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0, total: scan.findings.length };
  for (const f of scan.findings) {
    const key = f.severity.toLowerCase();
    if (key in stats) stats[key]++;
  }

  const report = {
    meta: {
      scan_id: scan.id,
      target: scan.target,
      status: scan.status,
      program: scan.program?.name || null,
      started_at: scan.startedAt?.toISOString() || null,
      finished_at: scan.finishedAt?.toISOString() || null,
      duration_seconds: scan.duration,
      modules: (config.modules as string[]) || [],
    },
    stats,
    findings: sortedFindings.map((f) => ({
      severity: f.severity,
      module: f.module,
      title: f.title,
      description: f.description,
      url: f.url,
      confidence: f.confidence,
      evidence: f.evidence,
      cwe_id: f.cweId,
      status: f.status,
    })),
  };

  const format = req.nextUrl.searchParams.get("format") || "json";

  if (format === "markdown") {
    const lines = [
      `# Scan Report — ${report.meta.target}`,
      `**Scan ID:** \`${report.meta.scan_id}\`  `,
      `**Status:** ${report.meta.status}  `,
      report.meta.program ? `**Program:** ${report.meta.program}  ` : null,
      report.meta.started_at ? `**Started:** ${report.meta.started_at}  ` : null,
      report.meta.finished_at ? `**Finished:** ${report.meta.finished_at}  ` : null,
      report.meta.duration_seconds ? `**Duration:** ${report.meta.duration_seconds}s  ` : null,
      "",
      "## Summary",
      "| Severity | Count |",
      "|----------|-------|",
      ...["critical", "high", "medium", "low", "info"]
        .filter((s) => stats[s] > 0)
        .map((s) => `| ${s.toUpperCase()} | ${stats[s]} |`),
      `| **Total** | **${stats.total}** |`,
      "",
      "## Findings",
      ...report.findings.map(
        (f, i) =>
          `### ${i + 1}. [${f.severity}] ${f.title}\n**Module:** ${f.module} | **Confidence:** ${Math.round(f.confidence * 100)}%${f.url ? `\n**URL:** \`${f.url}\`` : ""}${f.cwe_id ? `\n**CWE:** ${f.cwe_id}` : ""}\n\n${f.description || ""}\n`
      ),
    ]
      .filter(Boolean)
      .join("\n");

    return new NextResponse(lines, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="scan-report-${id}.md"`,
      },
    });
  }

  return NextResponse.json(report);
}
