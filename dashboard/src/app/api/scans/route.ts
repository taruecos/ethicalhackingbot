import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

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
  const { domain, depth, modules, rateLimit } = body;

  if (!domain) {
    return NextResponse.json({ error: "Domain required" }, { status: 400 });
  }

  // Create scan in DB
  const scan = await prisma.scan.create({
    data: {
      target: domain.replace(/^https?:\/\//, "").replace(/\/$/, ""),
      status: "QUEUED",
      config: { depth: depth || "standard", modules: modules || [], rateLimit: rateLimit || 30 },
    },
  });

  // Forward to bot API to actually run the scan
  try {
    const botUrl = process.env.BOT_API_URL || "http://localhost:8080";
    const token = process.env.DASHBOARD_TOKEN || "";
    await fetch(`${botUrl}/api/scan`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ domain: scan.target, scan_id: scan.id, depth, modules, rateLimit }),
    });

    await prisma.scan.update({
      where: { id: scan.id },
      data: { status: "RUNNING", startedAt: new Date() },
    });
  } catch {
    // Bot unreachable — scan stays queued
  }

  return NextResponse.json(scan, { status: 201 });
}
