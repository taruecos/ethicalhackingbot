import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
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

    // Fetch details in parallel batches of 5 and upsert to DB
    let synced = 0;
    let compliant = 0;
    const BATCH_SIZE = 5;

    for (let i = 0; i < allRaw.length; i += BATCH_SIZE) {
      const batch = allRaw.slice(i, i + BATCH_SIZE);

      const detailResults = await Promise.allSettled(
        batch.map(async (raw) => {
          const programId = raw.id as string;
          if (!programId) return { raw, detail: raw };
          try {
            const detail = await getProgramDetail(programId);
            return { raw, detail };
          } catch {
            return { raw, detail: raw };
          }
        })
      );

      for (const result of detailResults) {
        if (result.status !== "fulfilled") continue;
        const { raw, detail } = result.value;

        // Merge list data into detail — the detail endpoint omits some fields
        const merged = { ...detail };
        if (merged.minBounty === undefined && raw.minBounty !== undefined) {
          merged.minBounty = raw.minBounty;
        }
        if (merged.maxBounty === undefined && raw.maxBounty !== undefined) {
          merged.maxBounty = raw.maxBounty;
        }

        const normalized = normalizeProgram(merged);
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
            scope: normalized.scope as Prisma.InputJsonValue,
            compliance: normalized.compliance as Prisma.InputJsonValue,
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
            scope: normalized.scope as Prisma.InputJsonValue,
            compliance: normalized.compliance as Prisma.InputJsonValue,
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
