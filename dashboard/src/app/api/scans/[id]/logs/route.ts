import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { verifyBearer } from "@/lib/auth";
import { parseIdParam, parseJsonBody, parseSearchParams } from "@/lib/validation";

const LOG_LEVELS = ["INFO", "WARN", "ERROR", "DEBUG", "CRITICAL"] as const;
const VALID_LEVELS = new Set<string>(LOG_LEVELS);

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

// Single log entry. Loose-ish to mirror what the scanner already sends
// (the route normalises level + truncates strings before insert).
const logEntrySchema = z
  .object({
    level: z.string().max(20).optional(),
    module: z.string().max(64).optional(),
    message: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
    timestamp: z.string().max(64).optional(),
  })
  .passthrough();

// Existing route key is `logs` (not `entries`); keep it to avoid breaking
// the Python scanner. Cap batch at MAX_BATCH (we additionally slice below).
const logsBodySchema = z
  .object({
    logs: z.array(logEntrySchema).max(MAX_BATCH),
  })
  .strict();

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

  const parsed = await parseJsonBody(req, logsBodySchema);
  if (!parsed.ok) return parsed.response;
  const incoming = parsed.data.logs;

  if (incoming.length === 0) {
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
      const parsedDate = new Date(entry.timestamp);
      if (!Number.isNaN(parsedDate.getTime())) timestamp = parsedDate;
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
