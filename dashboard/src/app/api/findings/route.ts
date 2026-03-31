import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const scanId = sp.get("scanId");
  const severity = sp.get("severity");
  const status = sp.get("status");
  const module = sp.get("module");
  const search = sp.get("search");

  const where: Prisma.FindingWhereInput = {};

  if (scanId) where.scanId = scanId;
  if (severity) where.severity = { in: severity.split(",") as ("CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO")[] };
  if (status) where.status = { in: status.split(",") as ("NEW" | "CONFIRMED" | "FALSE_POSITIVE" | "FIXED" | "ACCEPTED" | "REPORTED")[] };
  if (module) where.module = module;
  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
      { url: { contains: search, mode: "insensitive" } },
    ];
  }

  const findings = await prisma.finding.findMany({
    where,
    orderBy: [
      { severity: "asc" }, // CRITICAL first
      { createdAt: "desc" },
    ],
    take: 200,
    include: { scan: { select: { target: true } } },
  });

  return NextResponse.json({ findings, total: findings.length });
}
