import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

interface ScopeEntry {
  endpoint: string;
  tier: string;
  type: string;
  description: string;
}

interface ComplianceCheck {
  target: string;
  programName: string | null;
  programPlatform: string | null;
  scope: {
    entries: string[];
    tiers: Record<string, ScopeEntry[]>;
    source: "program" | "config" | "default";
    warnings: string[];
  };
  roe: {
    userAgent: string | null;
    requestHeader: string | null;
    safeHarbour: boolean;
    rateLimit: number;
    automatedTooling: string | null;
    intigritiMe: boolean;
    description: string;
    source: "program" | "config" | "default";
    warnings: string[];
  };
  modules: {
    enabled: string[];
    descriptions: Record<string, string>;
  };
  risks: string[];
  compliant: boolean;
  bounty: {
    min: number | null;
    max: number | null;
    currency: string;
  } | null;
}

const MODULE_DESCRIPTIONS: Record<string, string> = {
  idor: "IDOR Scanner — Tests for insecure direct object references by swapping IDs in endpoints",
  access_control: "Access Control — Tests for authorization bypass via headers and HTTP methods",
  info_disclosure: "Info Disclosure — Scans for sensitive data leaks in responses and common endpoints",
};

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const scan = await prisma.scan.findUnique({
      where: { id },
      include: { program: true },
    });

    if (!scan) {
      return NextResponse.json({ error: "Scan not found" }, { status: 404 });
    }

  const config = (scan.config as Record<string, unknown>) || {};
  const compliance = scan.program?.compliance as Record<string, unknown> | null;
  const rawProgramScope = scan.program?.scope as unknown;
  const rawConfigScope = config.scope as unknown;

  // Parse scope entries with tier info
  function parseScopeWithTiers(raw: unknown): { flat: string[]; tiers: Record<string, ScopeEntry[]> } {
    const flat: string[] = [];
    const tiers: Record<string, ScopeEntry[]> = {};

    if (!raw) return { flat, tiers };

    // Handle JSON string
    let parsed = raw;
    if (typeof raw === "string") {
      try { parsed = JSON.parse(raw); } catch { return { flat: [raw], tiers: { "default": [{ endpoint: raw, tier: "default", type: "url", description: "" }] } }; }
    }

    if (!Array.isArray(parsed)) return { flat, tiers };

    for (const entry of parsed) {
      if (typeof entry === "string") {
        flat.push(entry.trim());
        const tierKey = "default";
        if (!tiers[tierKey]) tiers[tierKey] = [];
        tiers[tierKey].push({ endpoint: entry.trim(), tier: tierKey, type: "url", description: "" });
      } else if (entry && typeof entry === "object") {
        const obj = entry as Record<string, unknown>;
        const endpoint = ((obj.endpoint || obj.domain || obj.url || obj.value || obj.host || "") as string).trim();
        const tier = ((obj.tier as string) || "default").trim();
        const type = ((obj.type as string) || "url").trim();
        const description = ((obj.description as string) || "").trim();
        if (endpoint) {
          flat.push(endpoint);
          if (!tiers[tier]) tiers[tier] = [];
          tiers[tier].push({ endpoint, tier, type, description });
        }
      }
    }

    return { flat, tiers };
  }

  // Normalize flat scope entries (legacy fallback)
  function normalizeScope(raw: unknown): string[] {
    return parseScopeWithTiers(raw).flat;
  }

  const programScopeData = parseScopeWithTiers(rawProgramScope);
  const configScope = normalizeScope(rawConfigScope);
  const configRoe = config.rulesOfEngagement as Record<string, unknown> | undefined;

  const risks: string[] = [];
  const scopeWarnings: string[] = [];
  const roeWarnings: string[] = [];

  // Determine scope source and entries
  let scopeEntries: string[];
  let scopeTiers: Record<string, ScopeEntry[]>;
  let scopeSource: "program" | "config" | "default";

  if (programScopeData.flat.length > 0) {
    scopeEntries = programScopeData.flat;
    scopeTiers = programScopeData.tiers;
    scopeSource = "program";
  } else if (configScope.length > 0) {
    scopeEntries = configScope;
    scopeTiers = { "default": configScope.map(e => ({ endpoint: e, tier: "default", type: "url", description: "" })) };
    scopeSource = "config";
  } else {
    scopeEntries = [scan.target, `*.${scan.target}`];
    scopeTiers = { "default": scopeEntries.map(e => ({ endpoint: e, tier: "default", type: "url", description: "" })) };
    scopeSource = "default";
    scopeWarnings.push("No explicit scope defined — using target domain + wildcard as default");
  }

  if (scopeEntries.length === 0) {
    risks.push("CRITICAL: Empty scope — all URLs will be blocked (fail-closed)");
  }

  // Escape regex special chars except * (which we convert to .*)
  function scopeToRegex(entry: string): RegExp | null {
    try {
      const clean = entry.replace(/^https?:\/\//, "").replace(/\/$/, "");
      const escaped = clean.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\\\*/g, ".*");
      return new RegExp(`^${escaped}$`, "i");
    } catch {
      return null;
    }
  }

  // Check if target is covered by scope
  const cleanTarget = scan.target.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const targetCovered = scopeEntries.some((entry) => {
    const regex = scopeToRegex(entry);
    return regex ? regex.test(cleanTarget) : false;
  });
  if (!targetCovered) {
    risks.push("Target domain is NOT covered by scope entries — scan will block its own target");
  }

  // Determine ROE
  let userAgent: string | null = null;
  let requestHeader: string | null = null;
  let safeHarbour = false;
  let automatedTooling: string | null = null;
  let intigritiMe = false;
  let roeDescription = "";
  let roeSource: "program" | "config" | "default";
  const rateLimit = (config.rateLimit as number) || 30;

  if (compliance) {
    userAgent = (compliance.userAgent as string) || null;
    requestHeader = (compliance.requestHeader as string) || null;
    safeHarbour = !!(compliance.safeHarbour);
    automatedTooling = (compliance.automatedToolingStatus as string) || null;
    intigritiMe = !!(compliance.intigritiMe);
    roeDescription = (compliance.description as string) || "";
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
  if (automatedTooling === "not_allowed") {
    risks.push("CRITICAL: Automated tooling is NOT allowed by this program");
  }

  // Modules
  const enabledModules = (config.modules as string[]) || [];
  if (enabledModules.length === 0) {
    risks.push("No scan modules selected — scan will run recon only");
  }

  const compliant = risks.filter((r) => r.startsWith("CRITICAL")).length === 0;

  // Bounty info
  const bounty = scan.program ? {
    min: (scan.program.minBounty as number) || null,
    max: (scan.program.maxBounty as number) || null,
    currency: (scan.program.currency as string) || "EUR",
  } : null;

  const result: ComplianceCheck = {
    target: scan.target,
    programName: scan.program?.name || null,
    programPlatform: scan.program?.platform || null,
    scope: {
      entries: scopeEntries,
      tiers: scopeTiers,
      source: scopeSource,
      warnings: scopeWarnings,
    },
    roe: {
      userAgent,
      requestHeader,
      safeHarbour,
      rateLimit,
      automatedTooling,
      intigritiMe,
      description: roeDescription,
      source: roeSource,
      warnings: roeWarnings,
    },
    modules: {
      enabled: enabledModules,
      descriptions: MODULE_DESCRIPTIONS,
    },
    risks,
    compliant,
    bounty,
  };

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to check compliance", details: message },
      { status: 500 }
    );
  }
}
