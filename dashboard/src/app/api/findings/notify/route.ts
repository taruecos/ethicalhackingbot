/**
 * POST /api/findings/notify
 *
 * Pings the configured Telegram chat about a specific finding. Called by
 * scan_service (or any internal job) when a high-value finding lands.
 *
 * Auth: Bearer DASHBOARD_TOKEN (shared scan_service ↔ dashboard secret).
 * Body: { findingId: string, scanId: string }
 *
 * Stub mode: if TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is missing we return
 * 200 with { sent: false, reason: "telegram_not_configured" } so callers
 * don't crash in dev / unconfigured environments.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { verifyBearer } from "@/lib/auth";
import { idParamSchema, parseJsonBody } from "@/lib/validation";

const notifyBodySchema = z
  .object({
    findingId: idParamSchema,
    scanId: idParamSchema,
  })
  .strict();

const TELEGRAM_API = "https://api.telegram.org";
const TELEGRAM_TIMEOUT_MS = 10_000;
const MAX_DESCRIPTION_CHARS = 500;

const SEVERITY_EMOJI: Record<string, string> = {
  CRITICAL: "🔴",
  HIGH: "🟠",
  MEDIUM: "🟡",
  LOW: "🟢",
  INFO: "⚪",
};

// Escape HTML entities so user-controlled fields (title, description, url)
// can't break Telegram's parse_mode=HTML rendering.
function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function truncate(input: string, max: number): string {
  if (input.length <= max) return input;
  return input.slice(0, max).trimEnd() + "…";
}

type FindingForMessage = {
  severity: string;
  module: string;
  title: string;
  description: string;
  url: string | null;
  cvssScore: number | null;
};

type ScanForMessage = {
  id: string;
  target: string;
};

function formatFindingMessage(
  finding: FindingForMessage,
  scan: ScanForMessage,
): string {
  const sev = finding.severity.toUpperCase();
  const emoji = SEVERITY_EMOJI[sev] ?? "⚪";
  const parts: string[] = [
    `🚨 <b>${emoji} ${escapeHtml(sev)}</b> — ${escapeHtml(finding.module)}`,
    "",
    `<b>${escapeHtml(finding.title)}</b>`,
    "",
    `Target: <code>${escapeHtml(scan.target)}</code>`,
  ];
  if (finding.url) parts.push(`URL: <code>${escapeHtml(finding.url)}</code>`);
  if (finding.cvssScore !== null && finding.cvssScore !== undefined) {
    parts.push(`CVSS: ${finding.cvssScore}`);
  }
  if (finding.description) {
    parts.push("");
    parts.push(escapeHtml(truncate(finding.description, MAX_DESCRIPTION_CHARS)));
  }
  parts.push("");
  parts.push(`Scan: <code>${escapeHtml(scan.id)}</code>`);
  return parts.join("\n");
}

export async function POST(req: NextRequest) {
  if (!verifyBearer(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = await parseJsonBody(req, notifyBodySchema);
  if (!parsed.ok) return parsed.response;
  const { findingId, scanId } = parsed.data;

  const finding = await prisma.finding.findUnique({ where: { id: findingId } });
  if (!finding || finding.scanId !== scanId) {
    return NextResponse.json({ error: "Finding not found" }, { status: 404 });
  }

  const scan = await prisma.scan.findUnique({ where: { id: scanId } });
  if (!scan) {
    return NextResponse.json({ error: "Scan not found" }, { status: 404 });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();

  // Stub mode — happy path for unconfigured environments.
  if (!token || !chatId) {
    return NextResponse.json({ sent: false, reason: "telegram_not_configured" });
  }

  const message = formatFindingMessage(
    {
      severity: finding.severity,
      module: finding.module,
      title: finding.title,
      description: finding.description,
      url: finding.url,
      cvssScore: finding.cvssScore,
    },
    { id: scan.id, target: scan.target },
  );

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TELEGRAM_TIMEOUT_MS);

  try {
    const tgResponse = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
      signal: controller.signal,
    });

    if (!tgResponse.ok) {
      return NextResponse.json(
        {
          sent: false,
          reason: "telegram_http_error",
          status: tgResponse.status,
        },
        { status: 502 },
      );
    }

    const body = (await tgResponse.json().catch(() => null)) as
      | { ok?: boolean; result?: { message_id?: number }; description?: string }
      | null;

    if (!body || body.ok !== true) {
      return NextResponse.json(
        {
          sent: false,
          reason: "telegram_not_ok",
          description: body?.description ?? null,
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      sent: true,
      messageId: body.result?.message_id ?? null,
    });
  } catch (err) {
    const reason =
      err instanceof Error && err.name === "AbortError"
        ? "telegram_timeout"
        : "telegram_fetch_failed";
    return NextResponse.json({ sent: false, reason }, { status: 502 });
  } finally {
    clearTimeout(timeoutId);
  }
}
