import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { verifyBearer } from "@/lib/auth";
import { parseIdParam, parseSearchParams } from "@/lib/validation";

const VALID_LEVELS = new Set(["INFO", "WARN", "ERROR", "DEBUG", "CRITICAL"]);

const logsQuerySchema = z
  .object({
    after: z
      .string()
      .min(1)
      .max(64)
      .regex(/^[A-Za-z0-9_-]+$/, "invalid cursor id")
      .optional(),
    limit: z
      .string()
      .regex(/^\d+$/, "limit must be a positive integer")
      .optional(),
  })
  .strict();
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
  const { id: rawId } = await params;
  const idCheck = parseIdParam(rawId);
  if (!idCheck.ok) return idCheck.response;
  const { id } = idCheck;

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
  const { id: rawId } = await params;
  const idCheck = parseIdParam(rawId);
  if (!idCheck.ok) return idCheck.response;
  const { id } = idCheck;

  const parsedQuery = parseSearchParams(req.nextUrl.searchParams, logsQuerySchema);
  if (!parsedQuery.ok) return parsedQuery.response;
  const { after, limit: limitStr } = parsedQuery.data;
  const limitRaw = limitStr ? parseInt(limitStr, 10) : 500;
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
