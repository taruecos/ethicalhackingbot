import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { auditCompliance } from "@/lib/intigriti-ruleset";
import {
  buildScanConfig,
  needsScan,
  inScanWindow,
} from "@/lib/scheduler";

/**
 * POST /api/scans/scheduled
 *
 * Cron-style endpoint. Iterates every active program, finds the ones
 * that have not been scanned in the last 24h (or never), merges
 * Intigriti defaults with per-program overrides, audits the merged
 * config, and creates a QUEUED scan for each.
 *
 * Authentication: Bearer `CRON_SECRET`. Returns 401 if missing/wrong,
 * 503 if the secret is not configured server-side (safer than allowing
 * unauth requests through by default).
 *
 * Response shape:
 *   { triggered: [{ programId, scanId }],
 *     skipped:   [{ programId, reason }] }
 *
 * Per-program errors are caught and reported in `skipped`; one failing
 * program never aborts the whole run.
 */

interface TriggerResult {
  programId: string;
  scanId: string;
}

interface SkipResult {
  programId: string;
  reason: string;
}

function authorize(req: NextRequest): NextResponse | null {
  const expected = process.env.CRON_SECRET;
  if (!expected || expected.length < 8) {
    return NextResponse.json(
      { error: "Server misconfigured: CRON_SECRET not set" },
      { status: 503 }
    );
  }
  const header = req.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match || match[1] !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export async function POST(req: NextRequest) {
  const authErr = authorize(req);
  if (authErr) return authErr;

  const now = new Date();
  const triggered: TriggerResult[] = [];
  const skipped: SkipResult[] = [];

  const programs = await prisma.program.findMany({
    where: { active: true },
    include: {
      scans: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { createdAt: true },
      },
    },
  });

  for (const program of programs) {
    try {
      const lastScanAt = program.scans[0]?.createdAt ?? null;

      if (!needsScan({ id: program.id, active: program.active }, lastScanAt, now)) {
        skipped.push({
          programId: program.id,
          reason: "last scan within 24h",
        });
        continue;
      }

      const compliance = (program.compliance ?? {}) as Record<string, unknown>;
      const config = buildScanConfig({
        id: program.id,
        name: program.name,
        slug: program.slug,
        active: program.active,
        scope: program.scope,
        compliance,
      });

      if (!inScanWindow(now, config.rulesOfEngagement.timeWindow)) {
        skipped.push({
          programId: program.id,
          reason: "outside configured scan window",
        });
        continue;
      }

      // Audit the merged config — refuse to schedule if it would be
      // blocked by the ruleset.
      const verdict = auditCompliance({
        rateLimit: config.rateLimit,
        userAgent: config.rulesOfEngagement.userAgent,
        scope: config.scope,
        rulesOfEngagement: {
          safeHarbour: config.rulesOfEngagement.safeHarbour,
          userAgent: config.rulesOfEngagement.userAgent,
          customHeaders: config.rulesOfEngagement.customHeaders,
          destructivePayloadsAllowed:
            config.rulesOfEngagement.destructivePayloadsAllowed,
          redactPII: config.rulesOfEngagement.redactPII,
          respectRobotsTxt: config.rulesOfEngagement.respectRobotsTxt,
          timeWindow: config.rulesOfEngagement.timeWindow,
        },
      });

      if (!verdict.ok) {
        skipped.push({
          programId: program.id,
          reason: `compliance blockers: ${verdict.blockers.join("; ")}`,
        });
        continue;
      }

      // Pick a target from the program scope. Fall back to slug as a
      // last resort so we never crash here; the scan itself will refuse
      // to start if no real target is resolvable.
      const target = config.scope[0] ?? program.slug ?? program.name;
      if (!target) {
        skipped.push({
          programId: program.id,
          reason: "no resolvable target in scope",
        });
        continue;
      }

      const scan = await prisma.scan.create({
        data: {
          target,
          status: "QUEUED",
          programId: program.id,
          config: {
            depth: config.depth,
            modules: config.modules,
            rateLimit: config.rateLimit,
            scope: config.scope,
            rulesOfEngagement: config.rulesOfEngagement as unknown as Prisma.InputJsonValue,
            scheduled: true,
            scheduledAt: now.toISOString(),
          },
        },
      });

      triggered.push({ programId: program.id, scanId: scan.id });
    } catch (err) {
      const reason = err instanceof Error ? err.message : "unknown error";
      skipped.push({ programId: program.id, reason });
    }
  }

  return NextResponse.json({ triggered, skipped });
}
