import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * Save crawled endpoints for a scan (called by Python scanner after recon).
 * POST /api/scans/:id/endpoints
 *
 * Also: GET to retrieve saved endpoints (for resume).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const expectedToken = process.env.DASHBOARD_TOKEN || "";
  if (!token || token !== expectedToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const scan = await prisma.scan.findUnique({ where: { id } });
  if (!scan) {
    return NextResponse.json({ error: "Scan not found" }, { status: 404 });
  }

  const body = await req.json();
  const { endpoints } = body as { endpoints: Array<{ url: string; method: string; params?: unknown; source?: string }> };

  if (!endpoints || !Array.isArray(endpoints) || endpoints.length === 0) {
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
  const { id } = await params;

  const endpoints = await prisma.crawlEndpoint.findMany({
    where: { scanId: id },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ endpoints, count: endpoints.length });
}
