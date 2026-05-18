import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { verifyBearer, verifyCookie } from "@/lib/auth";
import { idParamSchema, parseJsonBody } from "@/lib/validation";
import { submitFinding, type FindingPayload } from "@/lib/intigriti";

const submitBodySchema = z
  .object({
    findingIds: z.array(idParamSchema).min(1).max(100),
  })
  .strict();

type SubmittedRecord = {
  findingId: string;
  submissionId: string | null;
  programId: string;
  stubbed: boolean;
};

type SkippedRecord = {
  findingId: string;
  reason: string;
};

export async function POST(req: NextRequest) {
  // Mirror existing auth pattern (bearer for API, cookie for UI).
  if (!verifyBearer(req) && !verifyCookie(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = await parseJsonBody(req, submitBodySchema);
  if (!parsed.ok) return parsed.response;
  const { findingIds } = parsed.data;

  const findings = await prisma.finding.findMany({
    where: { id: { in: findingIds } },
    include: { scan: { include: { program: true } } },
  });

  const foundIds = new Set(findings.map((f) => f.id));
  const submitted: SubmittedRecord[] = [];
  const skipped: SkippedRecord[] = [];

  // IDs that didn't match any DB row.
  for (const id of findingIds) {
    if (!foundIds.has(id)) {
      skipped.push({ findingId: id, reason: "not_found" });
    }
  }

  for (const finding of findings) {
    if (finding.status !== "CONFIRMED") {
      skipped.push({
        findingId: finding.id,
        reason: `status_${finding.status.toLowerCase()}`,
      });
      continue;
    }

    const programId = finding.scan?.program?.intigritiId;
    if (!programId) {
      skipped.push({ findingId: finding.id, reason: "no_intigriti_program" });
      continue;
    }

    const payload: FindingPayload = {
      module: finding.module,
      severity: finding.severity.toLowerCase(),
      title: finding.title,
      description: finding.description,
      url: finding.url,
      evidence: finding.evidence,
      cweId: finding.cweId,
    };

    try {
      const result = await submitFinding(payload, programId);

      if (result.status === "rejected_info_severity") {
        skipped.push({ findingId: finding.id, reason: "info_severity" });
        continue;
      }

      // Mark as REPORTED on stub or real submit; dedup is also a success path.
      await prisma.finding.update({
        where: { id: finding.id },
        data: { status: "REPORTED" },
      });

      submitted.push({
        findingId: finding.id,
        submissionId: result.submissionId,
        programId,
        stubbed: result.stubbed,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "unknown_error";
      skipped.push({
        findingId: finding.id,
        reason: `submit_failed: ${message}`,
      });
    }
  }

  return NextResponse.json({ submitted, skipped });
}
