import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();

  const data: Record<string, unknown> = {};
  if (body.status) data.status = body.status;
  if (body.falsePositive !== undefined) data.falsePositive = body.falsePositive;
  if (body.notes !== undefined) data.notes = body.notes;

  const finding = await prisma.finding.update({
    where: { id },
    data,
  });

  return NextResponse.json(finding);
}
