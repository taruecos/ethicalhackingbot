/**
 * Intigriti compliance ruleset — the defaults every scan must inherit
 * to be acceptable on an Intigriti program.
 *
 * Each rule has a `severity`:
 *   - "blocker"     — scan refuses to start
 *   - "required"    — scan starts but flags violation as warning
 *   - "recommended" — logged only
 *
 * The ruleset is the SOURCE OF TRUTH for what an Intigriti-grade scan
 * looks like. It is consumed by:
 *   - `/api/compliance/check`     (pre-scan audit endpoint)
 *   - `/api/scans/scheduled`      (cron-style scheduled scans)
 *   - `src/lib/scheduler.ts`      (config merger for scheduled scans)
 */

export type RuleSeverity = "blocker" | "required" | "recommended";

export interface ComplianceRule {
  id: string;
  description: string;
  severity: RuleSeverity;
  defaultValue: unknown;
  validate: (value: unknown) => { ok: true } | { ok: false; reason: string };
}

// ── Defaults applied by the scheduler before launching any scan ──

export const INTIGRITI_DEFAULTS = {
  rateLimit: 30,
  userAgent:
    "EthicalHackingBot/1.0 (+https://torjoman.app/ehb-bot; contact=tariq@torjoman.app)",
  customHeaders: { "X-EHB-Scan-Id": "{scanId}" },
  respectRobotsTxt: true,
  destructivePayloadsAllowed: false,
  redactPII: true,
  safeHarbour: true,
  scopeStrict: true,
  timeWindow: null as null | {
    startHour: number;
    endHour: number;
    timezone: string;
  },
};

// ── Helpers ───────────────────────────────────────────────────────────

const EHB_UA_PREFIX = "EthicalHackingBot/";
const REQUIRED_CUSTOM_HEADER = "X-EHB-Scan-Id";
const MAX_HARD_RATE_LIMIT = 100;
const DEFAULT_RATE_LIMIT = 30;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

// ── Rules ─────────────────────────────────────────────────────────────

export const INTIGRITI_RULESET: Record<string, ComplianceRule> = {
  scopeStrict: {
    id: "scopeStrict",
    description:
      "Every request must be in-scope; out-of-scope targets abort the scan.",
    severity: "blocker",
    defaultValue: true,
    validate(value) {
      // We accept an array of scope entries OR a boolean flag.
      if (Array.isArray(value)) {
        if (value.length === 0) {
          return { ok: false, reason: "scope array is empty" };
        }
        return { ok: true };
      }
      if (typeof value === "boolean") {
        return value
          ? { ok: true }
          : { ok: false, reason: "scopeStrict must be true" };
      }
      return { ok: false, reason: "scope must be boolean or non-empty array" };
    },
  },

  safeHarbour: {
    id: "safeHarbour",
    description:
      "Safe harbour acknowledgment is required — scanner refuses if missing.",
    severity: "blocker",
    defaultValue: true,
    validate(value) {
      return value === true
        ? { ok: true }
        : { ok: false, reason: "safeHarbour must be acknowledged (true)" };
    },
  },

  rateLimit: {
    id: "rateLimit",
    description:
      "Max 30 req/min per target by default; absolute ceiling is 100 req/min.",
    severity: "blocker",
    defaultValue: DEFAULT_RATE_LIMIT,
    validate(value) {
      if (typeof value !== "number" || !Number.isFinite(value)) {
        return { ok: false, reason: "rateLimit must be a finite number" };
      }
      if (value < 1) {
        return { ok: false, reason: "rateLimit must be >= 1" };
      }
      if (value > MAX_HARD_RATE_LIMIT) {
        return {
          ok: false,
          reason: `rateLimit ${value} exceeds hard ceiling of ${MAX_HARD_RATE_LIMIT} req/min`,
        };
      }
      return { ok: true };
    },
  },

  userAgent: {
    id: "userAgent",
    description:
      "Identifiable EthicalHackingBot User-Agent so target ops can identify our traffic.",
    severity: "required",
    defaultValue: INTIGRITI_DEFAULTS.userAgent,
    validate(value) {
      if (typeof value !== "string" || value.length === 0) {
        return { ok: false, reason: "userAgent is missing" };
      }
      if (!value.startsWith(EHB_UA_PREFIX)) {
        return {
          ok: false,
          reason: `userAgent must start with "${EHB_UA_PREFIX}"`,
        };
      }
      return { ok: true };
    },
  },

  destructivePayloadsAllowed: {
    id: "destructivePayloadsAllowed",
    description:
      "Read-only scanners only — no INSERT/UPDATE/DELETE, no file uploads, no destructive payloads.",
    severity: "blocker",
    defaultValue: false,
    validate(value) {
      return value === false
        ? { ok: true }
        : {
            ok: false,
            reason: "destructive payloads are not permitted on Intigriti",
          };
    },
  },

  redactPII: {
    id: "redactPII",
    description:
      "Findings must redact session tokens, cookies, JWT, emails, phones before persisting.",
    severity: "required",
    defaultValue: true,
    validate(value) {
      return value === true
        ? { ok: true }
        : { ok: false, reason: "redactPII must be enabled" };
    },
  },

  customHeaders: {
    id: "customHeaders",
    description:
      "Custom X-EHB-Scan-Id header required so target ops can correlate traffic.",
    severity: "required",
    defaultValue: INTIGRITI_DEFAULTS.customHeaders,
    validate(value) {
      if (!isRecord(value)) {
        return { ok: false, reason: "customHeaders must be an object" };
      }
      const hasHeader = Object.keys(value).some(
        (k) => k.toLowerCase() === REQUIRED_CUSTOM_HEADER.toLowerCase()
      );
      if (!hasHeader) {
        return {
          ok: false,
          reason: `missing required custom header "${REQUIRED_CUSTOM_HEADER}"`,
        };
      }
      return { ok: true };
    },
  },

  respectRobotsTxt: {
    id: "respectRobotsTxt",
    description:
      "Respect robots.txt by default — some programs may opt out via compliance overrides.",
    severity: "recommended",
    defaultValue: true,
    validate(value) {
      if (typeof value !== "boolean") {
        return { ok: false, reason: "respectRobotsTxt must be boolean" };
      }
      return value
        ? { ok: true }
        : { ok: false, reason: "robots.txt disabled — verify program permits" };
    },
  },

  timeWindow: {
    id: "timeWindow",
    description:
      "Optional scan time window (default 24/7). Programs can restrict to e.g. 08:00–20:00 target TZ.",
    severity: "recommended",
    defaultValue: null,
    validate(value) {
      if (value === null || value === undefined) return { ok: true };
      if (!isRecord(value)) {
        return { ok: false, reason: "timeWindow must be object or null" };
      }
      const { startHour, endHour, timezone } = value as Record<string, unknown>;
      if (
        typeof startHour !== "number" ||
        typeof endHour !== "number" ||
        typeof timezone !== "string"
      ) {
        return {
          ok: false,
          reason: "timeWindow requires startHour, endHour, timezone",
        };
      }
      if (startHour < 0 || startHour > 23 || endHour < 0 || endHour > 23) {
        return { ok: false, reason: "timeWindow hours must be 0-23" };
      }
      return { ok: true };
    },
  },
};

// ── Audit ─────────────────────────────────────────────────────────────

export interface ScanConfigAuditInput {
  rateLimit?: number;
  userAgent?: string;
  rulesOfEngagement?: {
    safeHarbour?: boolean;
    userAgent?: string;
    customHeaders?: Record<string, string>;
    excludePaths?: string[];
    destructivePayloadsAllowed?: boolean;
    redactPII?: boolean;
    respectRobotsTxt?: boolean;
    timeWindow?: {
      startHour: number;
      endHour: number;
      timezone: string;
    } | null;
  };
  scope?: string[];
}

export interface AuditResult {
  ok: boolean;
  blockers: string[];
  warnings: string[];
  recommendations: string[];
}

/**
 * Run every rule in the ruleset against the given scan config.
 *
 * Returns:
 *   - ok          — true iff zero blockers
 *   - blockers    — fatal violations; scan must not start
 *   - warnings    — required-severity violations; scan can start but
 *                   the violation is recorded
 *   - recommendations — informational; logged only
 */
export function auditCompliance(
  scanConfig: ScanConfigAuditInput
): AuditResult {
  const roe = scanConfig.rulesOfEngagement ?? {};

  // Map each rule id to the value extracted from the scan config.
  const values: Record<string, unknown> = {
    scopeStrict: scanConfig.scope ?? [],
    safeHarbour: roe.safeHarbour,
    rateLimit: scanConfig.rateLimit ?? INTIGRITI_DEFAULTS.rateLimit,
    userAgent:
      roe.userAgent ?? scanConfig.userAgent ?? INTIGRITI_DEFAULTS.userAgent,
    destructivePayloadsAllowed:
      roe.destructivePayloadsAllowed ??
      INTIGRITI_DEFAULTS.destructivePayloadsAllowed,
    redactPII: roe.redactPII ?? INTIGRITI_DEFAULTS.redactPII,
    customHeaders: roe.customHeaders ?? INTIGRITI_DEFAULTS.customHeaders,
    respectRobotsTxt:
      roe.respectRobotsTxt ?? INTIGRITI_DEFAULTS.respectRobotsTxt,
    timeWindow: roe.timeWindow ?? INTIGRITI_DEFAULTS.timeWindow,
  };

  const blockers: string[] = [];
  const warnings: string[] = [];
  const recommendations: string[] = [];

  for (const rule of Object.values(INTIGRITI_RULESET)) {
    const verdict = rule.validate(values[rule.id]);
    if (verdict.ok) continue;
    const line = `${rule.id}: ${verdict.reason}`;
    if (rule.severity === "blocker") blockers.push(line);
    else if (rule.severity === "required") warnings.push(line);
    else recommendations.push(line);
  }

  return {
    ok: blockers.length === 0,
    blockers,
    warnings,
    recommendations,
  };
}
