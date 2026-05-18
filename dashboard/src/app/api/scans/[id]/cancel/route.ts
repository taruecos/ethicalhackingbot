import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { parseIdParam } from "@/lib/validation";

// /cancel expects no body. Reject anything else.
const cancelBodySchema = z.object({}).strict();

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const idCheck = parseIdParam(rawId);
  if (!idCheck.ok) return idCheck.response;
  const { id } = idCheck;

  const contentLength = Number(req.headers.get("content-length") || 0);
  if (contentLength > 0) {
    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const result = cancelBodySchema.safeParse(raw);
    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: result.error.format() },
        { status: 400 }
      );
    }
  }

  await prisma.scan.update({
    where: { id },
    data: { status: "CANCELLED", finishedAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
