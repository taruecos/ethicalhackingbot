import { NextRequest, NextResponse } from "next/server";
import { getPayouts } from "@/lib/intigriti";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = Number(searchParams.get("limit") || "100");
  const offset = Number(searchParams.get("offset") || "0");

  try {
    const data = await getPayouts({ limit, offset });
    return NextResponse.json(data);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Intigriti API error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
