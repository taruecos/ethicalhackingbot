import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const programs = await prisma.program.findMany({
    orderBy: { syncedAt: "desc" },
    take: 100,
  });
  return NextResponse.json({ programs, total: programs.length });
}
