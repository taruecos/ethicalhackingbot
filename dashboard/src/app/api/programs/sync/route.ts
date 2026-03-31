import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { listPrograms, getProgramDetail, normalizeProgram } from "@/lib/intigriti";

export async function POST() {
  try {
    // Fetch all programs from Intigriti
    let allRaw: Record<string, unknown>[] = [];
    let offset = 0;
    const limit = 100;

    while (true) {
      const data = await listPrograms({ limit, offset });
      const records = (data.records || []) as Record<string, unknown>[];
      if (records.length === 0) break;
      allRaw = allRaw.concat(records);
      if (records.length < limit) break;
      offset += limit;
    }

    // For each program, fetch detail (for compliance/scope) and upsert to DB
    let synced = 0;
    let compliant = 0;

    for (const raw of allRaw) {
      const programId = raw.id as string;
      if (!programId) continue;

      let detail: Record<string, unknown>;
      try {
        detail = await getProgramDetail(programId);
      } catch {
        // If detail fetch fails, use the list data
        detail = raw;
      }

      const normalized = normalizeProgram(detail);
      const compliance = normalized.compliance as Record<string, unknown>;

      if (compliance?.automatedToolingStatus === "allowed") {
        compliant++;
      }

      await prisma.program.upsert({
        where: {
          platform_slug: {
            platform: "INTIGRITI",
            slug: normalized.slug,
          },
        },
        create: {
          platform: "INTIGRITI",
          name: normalized.name,
          slug: normalized.slug,
          url: normalized.url,
          intigritiId: normalized.intigritiId,
          scope: normalized.scope as unknown as Record<string, unknown>,
          compliance: normalized.compliance as unknown as Record<string, unknown>,
          minBounty: normalized.minBounty ?? null,
          maxBounty: normalized.maxBounty ?? null,
          currency: normalized.currency,
          industry: normalized.industry,
          programType: normalized.programType,
          confidentiality: normalized.confidentiality,
          active: normalized.active,
          syncedAt: new Date(),
        },
        update: {
          name: normalized.name,
          url: normalized.url,
          intigritiId: normalized.intigritiId,
          scope: normalized.scope as unknown as Record<string, unknown>,
          compliance: normalized.compliance as unknown as Record<string, unknown>,
          minBounty: normalized.minBounty ?? null,
          maxBounty: normalized.maxBounty ?? null,
          currency: normalized.currency,
          industry: normalized.industry,
          programType: normalized.programType,
          confidentiality: normalized.confidentiality,
          active: normalized.active,
          syncedAt: new Date(),
        },
      });

      synced++;
    }

    return NextResponse.json({
      ok: true,
      total: allRaw.length,
      synced,
      compliant,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
