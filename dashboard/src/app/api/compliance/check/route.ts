import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { parseJsonBody } from "@/lib/validation";
import { auditCompliance } from "@/lib/intigriti-ruleset";

/**
 * POST /api/compliance/check
 *
 * Pre-scan audit endpoint. Accepts a scan config and returns the
 * Intigriti-ruleset checklist verdict (blockers / warnings /
 * recommendations) without persisting anything.
 *
 * Used by:
 *   - UI pre-scan modal     (show the user what will block)
 *   - /api/scans/scheduled  (skip programs whose merged config fails)
 */

const timeWindowSchema = z
  .object({
    startHour: z.number().int().min(0).max(23),
    endHour: z.number().int().min(0).max(23),
    timezone: z.string().min(1).max(64),
  })
  .strict();

const rulesOfEngagementSchema = z
  .object({
    safeHarbour: z.boolean().optional(),
    userAgent: z.string().max(200).optional(),
    customHeaders: z
      .record(z.string(), z.string())
      .refine(
        (rec) => Object.keys(rec).length <= 20,
        "customHeaders may have at most 20 entries"
      )
      .optional(),
    excludePaths: z.array(z.string()).max(50).optional(),
    destructivePayloadsAllowed: z.boolean().optional(),
    redactPII: z.boolean().optional(),
    respectRobotsTxt: z.boolean().optional(),
    timeWindow: timeWindowSchema.nullable().optional(),
  })
  .strict();

const scanConfigSchema = z
  .object({
    rateLimit: z.number().int().min(1).max(1000).optional(),
    userAgent: z.string().max(200).optional(),
    scope: z.array(z.string().max(253)).max(100).optional(),
    rulesOfEngagement: rulesOfEngagementSchema.optional(),
  })
  .strict();

const bodySchema = z
  .object({
    scanConfig: scanConfigSchema,
  })
  .strict();

export async function POST(req: NextRequest) {
  const parsed = await parseJsonBody(req, bodySchema);
  if (!parsed.ok) return parsed.response;

  const verdict = auditCompliance(parsed.data.scanConfig);

  return NextResponse.json({
    ok: verdict.ok,
    blockers: verdict.blockers,
    warnings: verdict.warnings,
    recommendations: verdict.recommendations,
  });
}
