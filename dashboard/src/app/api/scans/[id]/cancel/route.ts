import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.scan.update({
    where: { id },
    data: { status: "CANCELLED", finishedAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
