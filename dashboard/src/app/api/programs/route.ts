import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const compliant = searchParams.get("compliant");
  const search = searchParams.get("search");
  const limit = Number(searchParams.get("limit") || "200");

  const where: Record<string, unknown> = {};

  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { slug: { contains: search, mode: "insensitive" } },
    ];
  }

  const programs = await prisma.program.findMany({
    where,
    orderBy: { syncedAt: "desc" },
    take: limit,
  });

  // Filter by compliance in app layer (JSON field filtering)
  let filtered = programs;
  if (compliant === "true") {
    filtered = programs.filter((p) => {
      const c = p.compliance as Record<string, unknown> | null;
      return c?.automatedToolingStatus === "allowed";
    });
  }

  return NextResponse.json({ programs: filtered, total: filtered.length });
}
