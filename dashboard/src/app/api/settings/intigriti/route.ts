import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const SINGLETON_ID = "singleton";

function maskToken(token: string | null | undefined): string {
  if (!token) return "";
  if (token.length <= 8) return "*".repeat(token.length);
  return `${token.slice(0, 4)}${"*".repeat(token.length - 8)}${token.slice(-4)}`;
}

export async function GET() {
  try {
    const config = await prisma.intigritiConfig.findUnique({ where: { id: SINGLETON_ID } });
    if (!config) {
      return NextResponse.json({ token: "", hasToken: false, autoSync: true, syncInterval: 15 });
    }
    return NextResponse.json({
      token: maskToken(config.token),
      hasToken: Boolean(config.token),
      autoSync: config.autoSync,
      syncInterval: config.syncInterval,
      updatedAt: config.updatedAt,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed to load config" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { token, autoSync, syncInterval } = body as { token?: string; autoSync?: boolean; syncInterval?: number };

    const data: { token?: string; autoSync?: boolean; syncInterval?: number } = {};
    if (typeof token === "string" && token.trim() && !token.includes("*")) {
      data.token = token.trim();
    }
    if (typeof autoSync === "boolean") data.autoSync = autoSync;
    if (typeof syncInterval === "number" && syncInterval >= 5 && syncInterval <= 1440) {
      data.syncInterval = syncInterval;
    }

    const config = await prisma.intigritiConfig.upsert({
      where: { id: SINGLETON_ID },
      create: { id: SINGLETON_ID, ...data },
      update: data,
    });

    return NextResponse.json({
      token: maskToken(config.token),
      hasToken: Boolean(config.token),
      autoSync: config.autoSync,
      syncInterval: config.syncInterval,
      updatedAt: config.updatedAt,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed to save config" }, { status: 500 });
  }
}
