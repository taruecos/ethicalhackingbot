import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const compliant = searchParams.get("compliant");
  const search = searchParams.get("search");
  const limit = Number(searchParams.get("limit") || "500");
  const industry = searchParams.get("industry");
  const hasBounty = searchParams.get("hasBounty");
  const confidentiality = searchParams.get("confidentiality");
  const sortBy = searchParams.get("sortBy") || "syncedAt";
  const sortDir = searchParams.get("sortDir") || "desc";

  const where: Record<string, unknown> = {};

  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { slug: { contains: search, mode: "insensitive" } },
    ];
  }

  if (industry) {
    where.industry = { equals: industry, mode: "insensitive" };
  }

  if (confidentiality) {
    where.confidentiality = confidentiality;
  }

  const orderBy: Record<string, string> = {};
  if (sortBy === "maxBounty") {
    orderBy.maxBounty = sortDir;
  } else if (sortBy === "name") {
    orderBy.name = sortDir;
  } else {
    orderBy.syncedAt = sortDir;
  }

  const programs = await prisma.program.findMany({
    where,
    orderBy,
    take: limit,
  });

  // Filter by compliance + bounty in app layer (JSON field filtering)
  let filtered = programs;
  if (compliant === "true") {
    filtered = filtered.filter((p) => {
      const c = p.compliance as Record<string, unknown> | null;
      return c?.automatedToolingStatus === "allowed" || c?.automatedToolingStatus === "conditional";
    });
  }

  if (hasBounty === "true") {
    filtered = filtered.filter((p) => p.maxBounty != null && p.maxBounty > 0);
  } else if (hasBounty === "false") {
    filtered = filtered.filter((p) => p.maxBounty == null || p.maxBounty === 0);
  }

  // Extract unique industries for filter dropdown
  const allPrograms = await prisma.program.findMany({ select: { industry: true }, distinct: ["industry"] });
  const industries = allPrograms.map((p) => p.industry).filter(Boolean).sort() as string[];

  return NextResponse.json({ programs: filtered, total: filtered.length, industries });
}
