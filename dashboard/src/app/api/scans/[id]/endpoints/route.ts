import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { verifyBearer } from "@/lib/auth";
import { parseIdParam, parseJsonBody } from "@/lib/validation";

const endpointSchema = z
  .object({
    url: z.string().url(),
    method: z.string().max(10),
    params: z.unknown().optional(),
    source: z.string().max(100).optional(),
  })
  .strict();

const endpointsBodySchema = z
  .object({
    endpoints: z.array(endpointSchema).max(5000),
  })
  .strict();

/**
 * Save crawled endpoints for a scan (called by Python scanner after recon).
 * POST /api/scans/:id/endpoints
 *
 * Also: GET to retrieve saved endpoints (for resume).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const idCheck = parseIdParam(rawId);
  if (!idCheck.ok) return idCheck.response;
  const { id } = idCheck;

  if (!verifyBearer(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const scan = await prisma.scan.findUnique({ where: { id } });
  if (!scan) {
    return NextResponse.json({ error: "Scan not found" }, { status: 404 });
  }

  const parsed = await parseJsonBody(req, endpointsBodySchema);
  if (!parsed.ok) return parsed.response;
  const { endpoints } = parsed.data;

  if (endpoints.length === 0) {
    return NextResponse.json({ error: "No endpoints provided" }, { status: 400 });
  }

  // Upsert endpoints (skip duplicates)
  let saved = 0;
  for (const ep of endpoints) {
    try {
      await prisma.crawlEndpoint.upsert({
        where: {
          scanId_url_method: { scanId: id, url: ep.url, method: ep.method || "GET" },
        },
        update: {},
        create: {
          scanId: id,
          url: ep.url,
          method: ep.method || "GET",
          params: (ep.params || []) as never,
          source: ep.source || null,
        },
      });
      saved++;
    } catch {
      // Skip duplicates or invalid entries
    }
  }

  return NextResponse.json({ ok: true, saved, total: endpoints.length });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const idCheck = parseIdParam(rawId);
  if (!idCheck.ok) return idCheck.response;
  const { id } = idCheck;

  const endpoints = await prisma.crawlEndpoint.findMany({
    where: { scanId: id },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ endpoints, count: endpoints.length });
}
