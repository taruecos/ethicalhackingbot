import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseIdParam } from "@/lib/validation";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const idCheck = parseIdParam(rawId);
  if (!idCheck.ok) return idCheck.response;
  const { id } = idCheck;

  await prisma.scan.update({
    where: { id },
    data: { status: "CANCELLED", finishedAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
