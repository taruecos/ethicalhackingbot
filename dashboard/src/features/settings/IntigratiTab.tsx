"use client";

import React, { useEffect, useState } from "react";
import { Wifi, WifiOff, Loader2 } from "lucide-react";
import { ds } from "@/components/ds/tokens";
import { DSButton } from "@/components/ds/DSButton";
import { SettingsCard, SettingsRow, SettingsRowLast, FormSelect, Toggle, StatusBadge } from "./shared";

interface IntigratiTabProps {
  onSave: (msg?: string) => void;
  onError: (msg?: string) => void;
}

type ConnState = "idle" | "testing" | "ok" | "fail";

const INTERVALS = [
  { value: "off", label: "Off" },
  { value: "1h", label: "Every hour" },
  { value: "6h", label: "Every 6 hours" },
  { value: "daily", label: "Daily" },
];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function relativeTime(iso: string | null): string {
  if (!iso) return "never";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function formatLocalTimestamp(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const day = String(d.getDate()).padStart(2, "0");
  const month = MONTHS[d.getMonth()];
  const year = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const offsetMin = -d.getTimezoneOffset();
  const sign = offsetMin >= 0 ? "+" : "-";
  const absMin = Math.abs(offsetMin);
  const offH = String(Math.floor(absMin / 60)).padStart(2, "0");
  const offM = String(absMin % 60).padStart(2, "0");
  return `${day} ${month} ${year}, ${hh}:${mm} (UTC${sign}${offH}:${offM})`;
}

export function IntigratiTab({ onSave }: IntigratiTabProps) {
  const [connState, setConnState] = useState<ConnState>("idle");
  const [failReason, setFailReason] = useState("");
  const [lastSyncIso, setLastSyncIso] = useState<string | null>(null);
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [interval, setInterval] = useState("off");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/programs?limit=1&sortBy=syncedAt&sortDir=desc", { credentials: "same-origin" });
        if (!res.ok) return;
        const json = await res.json();
        const latest = json.programs?.[0];
        if (latest?.syncedAt && !cancelled) setLastSyncIso(latest.syncedAt);
      } catch {
        // ignore
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const testConnection = async () => {
    setConnState("testing");
    setFailReason("");
    try {
      const res = await fetch("/api/intigriti/programs?limit=1", { credentials: "same-origin" });
      if (res.ok) {
        setConnState("ok");
      } else {
        const body = await res.json().catch(() => ({}));
        setConnState("fail");
        setFailReason(body?.error ?? `HTTP ${res.status}`);
      }
    } catch (e: any) {
      setConnState("fail");
      setFailReason(e?.message ?? "Network error");
    }
  };

  const saveSyncSettings = () => {
    onSave("Sync settings saved (note: scheduled sync requires server-side cron — not yet enabled).");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <SettingsCard title="Intigriti API connection" description="The API key is configured server-side via the INTIGRITI_API_KEY environment variable.">
        <SettingsRowLast label="Connection test" hint="Sends a request to the Intigriti API using the server-side credentials">
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <button onClick={testConnection} disabled={connState === "testing"} style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 30, padding: "0 12px", borderRadius: ds.radius.md, border: `1px solid ${ds.border.default}`, backgroundColor: "transparent", cursor: connState === "testing" ? "wait" : "pointer", fontSize: ds.size.xs, fontFamily: "Inter, sans-serif", color: ds.text.secondary }}>
              {connState === "testing" ? <Loader2 size={12} className="animate-spin" /> : connState === "ok" ? <Wifi size={12} style={{ color: ds.accent.default }} /> : connState === "fail" ? <WifiOff size={12} style={{ color: ds.severity.critical }} /> : <Wifi size={12} />}
              Test connection
            </button>

            {connState === "ok" && <StatusBadge type="success" text="Connected" />}
            {connState === "fail" && <StatusBadge type="error" text={`Failed: ${failReason}`} />}
          </div>
        </SettingsRowLast>
      </SettingsCard>

      <SettingsCard title="Auto-sync" description="Automatically sync programs and scope from Intigriti on a schedule">
        <SettingsRow label="Enable auto-sync" hint="Pulls programs, scope changes and new payouts">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Toggle checked={syncEnabled} onChange={setSyncEnabled} />
            <span style={{ fontSize: ds.size.xs, color: syncEnabled ? ds.accent.default : ds.text.muted, fontWeight: ds.weight.medium }}>{syncEnabled ? "Enabled" : "Disabled"}</span>
          </div>
        </SettingsRow>

        <SettingsRow label="Sync interval" hint="How often to pull changes from Intigriti">
          <FormSelect value={interval} onChange={setInterval} options={INTERVALS} disabled={!syncEnabled} />
        </SettingsRow>

        <SettingsRowLast label="Last sync" hint="Most recent successful synchronization">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: ds.size.xs, fontFamily: "monospace", color: ds.text.muted }}>{lastSyncIso ? formatLocalTimestamp(lastSyncIso) : "—"}</span>
            {lastSyncIso && <StatusBadge type="success" text={relativeTime(lastSyncIso)} />}
          </div>
        </SettingsRowLast>

        <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end" }}>
          <DSButton variant="primary" size="md" onClick={saveSyncSettings}>
            Save
          </DSButton>
        </div>
      </SettingsCard>
    </div>
  );
}
