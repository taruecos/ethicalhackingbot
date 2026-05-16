import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseIdParam } from "@/lib/validation";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const idCheck = parseIdParam(rawId);
  if (!idCheck.ok) return idCheck.response;
  const { id } = idCheck;

  const scan = await prisma.scan.findUnique({
    where: { id },
    include: { findings: true },
  });
  if (!scan) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(scan);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const idCheck = parseIdParam(rawId);
  if (!idCheck.ok) return idCheck.response;
  const { id } = idCheck;

  await prisma.finding.deleteMany({ where: { scanId: id } });
  await prisma.scan.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
