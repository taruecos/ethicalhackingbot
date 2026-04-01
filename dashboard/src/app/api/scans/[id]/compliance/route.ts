import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

interface ComplianceCheck {
  target: string;
  programName: string | null;
  scope: {
    entries: string[];
    source: "program" | "config" | "default";
    warnings: string[];
  };
  roe: {
    userAgent: string | null;
    requestHeader: string | null;
    safeHarbour: boolean;
    rateLimit: number;
    source: "program" | "config" | "default";
    warnings: string[];
  };
  modules: {
    enabled: string[];
    descriptions: Record<string, string>;
  };
  risks: string[];
  compliant: boolean;
}

const MODULE_DESCRIPTIONS: Record<string, string> = {
  idor: "IDOR Scanner — Tests for insecure direct object references by swapping IDs in endpoints",
  access_control: "Access Control — Tests for authorization bypass via headers and HTTP methods",
  info_disclosure: "Info Disclosure — Scans for sensitive data leaks in responses and common endpoints",
};

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const scan = await prisma.scan.findUnique({
    where: { id },
    include: { program: true },
  });

  if (!scan) {
    return NextResponse.json({ error: "Scan not found" }, { status: 404 });
  }

  const config = scan.config as Record<string, unknown>;
  const compliance = scan.program?.compliance as Record<string, unknown> | null;
  const programScope = scan.program?.scope as string[] | null;
  const configScope = config.scope as string[] | undefined;
  const configRoe = config.rulesOfEngagement as Record<string, unknown> | undefined;

  const risks: string[] = [];
  const scopeWarnings: string[] = [];
  const roeWarnings: string[] = [];

  // Determine scope source and entries
  let scopeEntries: string[];
  let scopeSource: "program" | "config" | "default";

  if (programScope && programScope.length > 0) {
    scopeEntries = programScope;
    scopeSource = "program";
  } else if (configScope && configScope.length > 0) {
    scopeEntries = configScope;
    scopeSource = "config";
  } else {
    scopeEntries = [scan.target, `*.${scan.target}`];
    scopeSource = "default";
    scopeWarnings.push("No explicit scope defined — using target domain + wildcard as default");
  }

  if (scopeEntries.length === 0) {
    risks.push("CRITICAL: Empty scope — all URLs will be blocked (fail-closed)");
  }

  // Check if target is covered by scope
  const targetCovered = scopeEntries.some((entry) => {
    const pattern = entry.replace(/\*/g, ".*");
    return new RegExp(`^${pattern}$`, "i").test(scan.target);
  });
  if (!targetCovered) {
    risks.push("Target domain is NOT covered by scope entries — scan will block its own target");
  }

  // Determine ROE
  let userAgent: string | null = null;
  let requestHeader: string | null = null;
  let safeHarbour = false;
  let roeSource: "program" | "config" | "default";
  const rateLimit = (config.rateLimit as number) || 30;

  if (compliance) {
    userAgent = (compliance.userAgent as string) || null;
    requestHeader = (compliance.requestHeader as string) || null;
    safeHarbour = !!(compliance.safeHarbour);
    roeSource = "program";
  } else if (configRoe) {
    userAgent = (configRoe.userAgent as string) || null;
    requestHeader = (configRoe.requestHeader as string) || null;
    safeHarbour = !!(configRoe.safeHarbour);
    roeSource = "config";
  } else {
    roeSource = "default";
    roeWarnings.push("No Rules of Engagement defined — using defaults only");
  }

  if (!userAgent) {
    roeWarnings.push("No custom User-Agent — bot will use a generic identifier");
  }
  if (!safeHarbour) {
    roeWarnings.push("No Safe Harbour policy detected for this target");
  }
  if (rateLimit > 60) {
    risks.push(`High rate limit (${rateLimit} req/min) — may trigger WAF or violate program rules`);
  }

  // Modules
  const enabledModules = (config.modules as string[]) || [];
  if (enabledModules.length === 0) {
    risks.push("No scan modules selected — scan will run recon only");
  }

  const compliant = risks.filter((r) => r.startsWith("CRITICAL")).length === 0;

  const result: ComplianceCheck = {
    target: scan.target,
    programName: scan.program?.name || null,
    scope: {
      entries: scopeEntries,
      source: scopeSource,
      warnings: scopeWarnings,
    },
    roe: {
      userAgent,
      requestHeader,
      safeHarbour,
      rateLimit,
      source: roeSource,
      warnings: roeWarnings,
    },
    modules: {
      enabled: enabledModules,
      descriptions: MODULE_DESCRIPTIONS,
    },
    risks,
    compliant,
  };

  return NextResponse.json(result);
}
