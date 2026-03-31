import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const scanServiceUrl = process.env.SCAN_SERVICE_URL || "http://localhost:8000";

export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get("status");
  const where = status ? { status: status as "QUEUED" | "RUNNING" | "COMPLETE" | "ERROR" | "CANCELLED" } : {};

  const scans = await prisma.scan.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { _count: { select: { findings: true } } },
  });

  return NextResponse.json({ scans });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { domain, programId, depth, modules, rateLimit, rulesOfEngagement } = body;

  if (!domain) {
    return NextResponse.json({ error: "Domain required" }, { status: 400 });
  }

  const target = domain.replace(/^https?:\/\//, "").replace(/\/$/, "");

  // Create scan in DB
  const scan = await prisma.scan.create({
    data: {
      target,
      status: "QUEUED",
      config: { depth: depth || "standard", modules: modules || [], rateLimit: rateLimit || 30 },
      programId: programId || null,
    },
  });

  // Scan stays QUEUED — user starts it manually from Live Monitor
  return NextResponse.json(scan, { status: 201 });
}
