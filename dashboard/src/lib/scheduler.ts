/**
 * Scheduler — pure helpers used by the cron-style scheduled scan endpoint.
 *
 * No DB, no fetch, no side effects. Easy to unit-test.
 */

import { INTIGRITI_DEFAULTS } from "./intigriti-ruleset";

// ── Types ─────────────────────────────────────────────────────────────

export interface SchedulerProgram {
  id: string;
  name?: string;
  slug?: string;
  active?: boolean;
  scope?: unknown;
  // Free-form per-program overrides stored in `Program.compliance` JSON.
  compliance?: Record<string, unknown> | null;
}

export interface TimeWindow {
  startHour: number;
  endHour: number;
  timezone: string;
}

export interface ScanRulesOfEngagement {
  safeHarbour: boolean;
  userAgent: string;
  customHeaders: Record<string, string>;
  respectRobotsTxt: boolean;
  destructivePayloadsAllowed: boolean;
  redactPII: boolean;
  timeWindow: TimeWindow | null;
}

export interface ScanConfig {
  depth: "quick" | "standard" | "deep";
  modules: string[];
  rateLimit: number;
  scope: string[];
  rulesOfEngagement: ScanRulesOfEngagement;
}

const DEFAULT_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24h

// ── Helpers ───────────────────────────────────────────────────────────

/**
 * True if this program needs a new scan now — i.e. no scan in the last
 * 24h (or never scanned). Inactive programs always return false.
 */
export function needsScan(
  program: SchedulerProgram,
  lastScanAt: Date | null | undefined,
  now: Date = new Date(),
  intervalMs: number = DEFAULT_INTERVAL_MS
): boolean {
  if (program.active === false) return false;
  if (!lastScanAt) return true;
  const last = lastScanAt instanceof Date ? lastScanAt : new Date(lastScanAt);
  if (Number.isNaN(last.getTime())) return true;
  return now.getTime() - last.getTime() >= intervalMs;
}

/**
 * True if `now` is within the configured scan window (or window is null,
 * meaning 24/7 is allowed).
 *
 * Time-window crossing midnight (e.g. 22→06) is supported.
 */
export function inScanWindow(
  now: Date,
  timeWindow: TimeWindow | null | undefined
): boolean {
  if (!timeWindow) return true;
  const { startHour, endHour, timezone } = timeWindow;

  // Use Intl to resolve the hour in the configured timezone. Fall back
  // to local hour if the timezone is unknown.
  let hour: number;
  try {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      hour12: false,
    });
    const parts = fmt.formatToParts(now);
    const raw = parts.find((p) => p.type === "hour")?.value ?? "0";
    hour = Number.parseInt(raw, 10);
    // Intl can return "24" for midnight on some platforms — normalize.
    if (hour === 24) hour = 0;
  } catch {
    hour = now.getHours();
  }

  if (startHour === endHour) return true;
  if (startHour < endHour) {
    return hour >= startHour && hour < endHour;
  }
  // Window crosses midnight.
  return hour >= startHour || hour < endHour;
}

/**
 * Merge INTIGRITI_DEFAULTS with program-specific overrides (from
 * `program.compliance` JSON) and optional caller-supplied ROE overrides.
 *
 * Precedence (highest first):
 *   1. baseRoeOverrides     — caller-supplied (e.g. one-off override)
 *   2. program.compliance   — per-program JSON
 *   3. INTIGRITI_DEFAULTS   — Intigriti baseline
 */
export function buildScanConfig(
  program: SchedulerProgram,
  baseRoeOverrides: Partial<ScanRulesOfEngagement> & {
    rateLimit?: number;
    depth?: "quick" | "standard" | "deep";
    modules?: string[];
  } = {}
): ScanConfig {
  const compliance = (program.compliance ?? {}) as Record<string, unknown>;

  const programUserAgent =
    typeof compliance.userAgent === "string" && compliance.userAgent.length > 0
      ? compliance.userAgent
      : undefined;

  const programRateLimit =
    typeof compliance.rateLimit === "number" ? compliance.rateLimit : undefined;

  const programRespectRobots =
    typeof compliance.respectRobotsTxt === "boolean"
      ? compliance.respectRobotsTxt
      : undefined;

  const programTimeWindow =
    compliance.timeWindow && typeof compliance.timeWindow === "object"
      ? (compliance.timeWindow as TimeWindow)
      : undefined;

  const programCustomHeaders =
    compliance.customHeaders && typeof compliance.customHeaders === "object"
      ? (compliance.customHeaders as Record<string, string>)
      : undefined;

  const rateLimit =
    baseRoeOverrides.rateLimit ??
    programRateLimit ??
    INTIGRITI_DEFAULTS.rateLimit;

  const userAgent =
    baseRoeOverrides.userAgent ??
    programUserAgent ??
    INTIGRITI_DEFAULTS.userAgent;

  const customHeaders = {
    ...INTIGRITI_DEFAULTS.customHeaders,
    ...(programCustomHeaders ?? {}),
    ...(baseRoeOverrides.customHeaders ?? {}),
  };

  const respectRobotsTxt =
    baseRoeOverrides.respectRobotsTxt ??
    programRespectRobots ??
    INTIGRITI_DEFAULTS.respectRobotsTxt;

  const timeWindow =
    baseRoeOverrides.timeWindow ??
    programTimeWindow ??
    INTIGRITI_DEFAULTS.timeWindow;

  // Normalize program scope (it can be an array of strings OR an array
  // of {endpoint, tier, ...} objects per the Prisma model).
  const scope = normalizeProgramScope(program.scope);

  return {
    depth: baseRoeOverrides.depth ?? "standard",
    modules:
      baseRoeOverrides.modules ?? [
        "idor",
        "access_control",
        "info_disclosure",
      ],
    rateLimit,
    scope,
    rulesOfEngagement: {
      safeHarbour:
        baseRoeOverrides.safeHarbour ?? INTIGRITI_DEFAULTS.safeHarbour,
      userAgent,
      customHeaders,
      respectRobotsTxt,
      destructivePayloadsAllowed:
        baseRoeOverrides.destructivePayloadsAllowed ??
        INTIGRITI_DEFAULTS.destructivePayloadsAllowed,
      redactPII:
        baseRoeOverrides.redactPII ?? INTIGRITI_DEFAULTS.redactPII,
      timeWindow,
    },
  };
}

/**
 * Flatten a program scope (string[] or {endpoint}[] or JSON string) to
 * a clean string[]. Matches the shape used by `/api/scans/[id]/start`.
 */
export function normalizeProgramScope(raw: unknown): string[] {
  if (!raw) return [];
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return normalizeProgramScope(parsed);
      return [raw];
    } catch {
      return [raw];
    }
  }
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry: unknown) => {
      if (typeof entry === "string") return entry.trim();
      if (entry && typeof entry === "object") {
        const obj = entry as Record<string, unknown>;
        const val =
          (obj.endpoint as string) ||
          (obj.domain as string) ||
          (obj.url as string) ||
          (obj.value as string) ||
          (obj.host as string) ||
          "";
        return typeof val === "string" ? val.trim() : "";
      }
      return "";
    })
    .filter((s): s is string => Boolean(s));
}
