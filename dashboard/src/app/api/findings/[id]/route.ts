import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseIdParam } from "@/lib/validation";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const idCheck = parseIdParam(rawId);
  if (!idCheck.ok) return idCheck.response;
  const { id } = idCheck;

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
