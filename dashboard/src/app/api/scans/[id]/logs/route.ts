import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyBearer } from "@/lib/auth";

const VALID_LEVELS = new Set(["INFO", "WARN", "ERROR", "DEBUG", "CRITICAL"]);
const MAX_BATCH = 500;
const MAX_MESSAGE_LEN = 4000;

type IncomingLog = {
  level?: unknown;
  module?: unknown;
  message?: unknown;
  timestamp?: unknown;
};

/**
 * Bot callback — append a batch of log entries for a scan.
 * POST /api/scans/:id/logs
 * Body: { logs: [{ level, module, message, timestamp? }] }
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (!verifyBearer(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const scan = await prisma.scan.findUnique({ where: { id }, select: { id: true } });
  if (!scan) {
    return NextResponse.json({ error: "Scan not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const incoming = (body as { logs?: IncomingLog[] })?.logs;
  if (!Array.isArray(incoming) || incoming.length === 0) {
    return NextResponse.json({ error: "No logs provided" }, { status: 400 });
  }

  const batch = incoming.slice(0, MAX_BATCH).map((entry) => {
    const rawLevel = typeof entry.level === "string" ? entry.level.toUpperCase() : "INFO";
    const level = VALID_LEVELS.has(rawLevel) ? rawLevel : "INFO";
    const module = typeof entry.module === "string" ? entry.module.slice(0, 64) : "unknown";
    const message =
      typeof entry.message === "string"
        ? entry.message.slice(0, MAX_MESSAGE_LEN)
        : String(entry.message ?? "").slice(0, MAX_MESSAGE_LEN);
    let timestamp: Date | undefined;
    if (typeof entry.timestamp === "string") {
      const parsed = new Date(entry.timestamp);
      if (!Number.isNaN(parsed.getTime())) timestamp = parsed;
    }
    return {
      scanId: id,
      level,
      module,
      message,
      ...(timestamp ? { timestamp } : {}),
    };
  });

  await prisma.scanLog.createMany({ data: batch });

  return NextResponse.json({ ok: true, saved: batch.length });
}

/**
 * Dashboard UI poll — fetch logs for a scan, optionally after a given log id.
 * GET /api/scans/:id/logs?after=<logId>&limit=<n>
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const url = new URL(req.url);
  const after = url.searchParams.get("after");
  const limitRaw = parseInt(url.searchParams.get("limit") || "500", 10);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 1000) : 500;

  let afterCreatedAt: Date | null = null;
  if (after) {
    const cursor = await prisma.scanLog.findUnique({
      where: { id: after },
      select: { createdAt: true, scanId: true },
    });
    if (cursor && cursor.scanId === id) {
      afterCreatedAt = cursor.createdAt;
    }
  }

  const logs = await prisma.scanLog.findMany({
    where: {
      scanId: id,
      ...(afterCreatedAt ? { createdAt: { gt: afterCreatedAt } } : {}),
    },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: {
      id: true,
      timestamp: true,
      level: true,
      module: true,
      message: true,
    },
  });

  return NextResponse.json({ logs, count: logs.length });
}
