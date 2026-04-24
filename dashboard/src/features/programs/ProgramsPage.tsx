"use client";

import React, { useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { RefreshCw, Loader2, AlertCircle, X } from "lucide-react";
import { ds } from "@/components/ds/tokens";
import { DSButton } from "@/components/ds/DSButton";
import { SyncedTab } from "./SyncedTab";
import { LiveTab } from "./LiveTab";
import { ActivitiesTab } from "./ActivitiesTab";
import { PayoutsTab } from "./PayoutsTab";

type Tab = "synced" | "live" | "activities" | "payouts";

const TABS: Array<{ id: Tab; label: string; badge?: string }> = [
  { id: "synced", label: "Synced", badge: "DB" },
  { id: "live", label: "Live (Intigriti)" },
  { id: "activities", label: "Activities" },
  { id: "payouts", label: "Payouts" },
];

function timeAgo(date: Date | null): string {
  if (!date) return "never";
  const ms = Date.now() - date.getTime();
  const sec = Math.floor(ms / 1000);
  if (sec < 5) return "just now";
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  return `${days}d ago`;
}

export function ProgramsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const activeTab = (searchParams.get("tab") as Tab) || "synced";
  const setTab = (t: Tab) => router.replace(`${pathname}?tab=${t}`, { scroll: false });

  const [syncing, setSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const [syncDone, setSyncDone] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<{ total: number; synced: number; compliant: number } | null>(null);

  const startSync = async () => {
    if (syncing) return;
    setSyncing(true);
    setSyncError(null);
    setSyncDone(false);
    try {
      const res = await fetch("/api/programs/sync", { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
      setSyncResult({
        total: Number(json.total ?? 0),
        synced: Number(json.synced ?? 0),
        compliant: Number(json.compliant ?? 0),
      });
      setLastSyncAt(new Date());
      setSyncDone(true);
      setTimeout(() => setSyncDone(false), 4000);
    } catch (e) {
      setSyncError(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div>
      {syncError && (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 20, padding: "12px 16px", backgroundColor: ds.severity.criticalBg, border: `1px solid ${ds.severity.critical}40`, borderRadius: ds.radius.lg }}>
          <AlertCircle size={15} style={{ color: ds.severity.critical, flexShrink: 0, marginTop: 1 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: ds.size.sm, fontWeight: ds.weight.semibold, color: ds.severity.critical, marginBottom: 3 }}>Intigriti sync failed</div>
            <div style={{ fontSize: ds.size.xs, color: ds.text.muted }}>{syncError}</div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
            <DSButton variant="secondary" size="sm" icon={<RefreshCw size={11} />} onClick={startSync}>
              Retry
            </DSButton>
            <button onClick={() => setSyncError(null)} style={{ background: "none", border: "none", cursor: "pointer", color: ds.text.muted, padding: 2 }}>
              <X size={13} />
            </button>
          </div>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, gap: 16, flexWrap: "wrap" }}>
        <h1 style={{ margin: 0, fontSize: ds.size["3xl"], fontWeight: ds.weight.bold, color: ds.text.primary, lineHeight: 1.2 }}>Programs</h1>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: ds.size.xs, color: ds.text.muted }}>
            {syncDone ? (
              <span style={{ color: ds.accent.default }}>
                ✓ Synced {syncResult ? `${syncResult.synced}/${syncResult.total}` : ""}
              </span>
            ) : (
              `Last sync: ${timeAgo(lastSyncAt)}`
            )}
          </span>

          <DSButton variant="primary" size="md" icon={syncing ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} onClick={startSync}>
            {syncing ? "Syncing…" : "Sync Intigriti"}
          </DSButton>
        </div>
      </div>

      {syncing && (
        <div style={{ marginBottom: 16, padding: "12px 16px", backgroundColor: ds.bg.elevated, border: `1px solid ${ds.border.default}`, borderRadius: ds.radius.lg, display: "flex", alignItems: "center", gap: 8 }}>
          <Loader2 size={12} className="animate-spin" style={{ color: ds.accent.default }} />
          <span style={{ fontSize: ds.size.sm, color: ds.text.primary }}>Syncing programs with Intigriti…</span>
          <span style={{ fontSize: ds.size.xs, color: ds.text.muted, marginLeft: "auto" }}>This can take a minute</span>
        </div>
      )}

      <div style={{ display: "flex", borderBottom: `1px solid ${ds.border.default}`, marginBottom: 24 }}>
        {TABS.map(({ id, label, badge }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            style={{ height: 38, padding: "0 16px", border: "none", borderBottom: `2px solid ${activeTab === id ? ds.accent.default : "transparent"}`, backgroundColor: "transparent", color: activeTab === id ? ds.text.primary : ds.text.muted, fontSize: ds.size.sm, fontWeight: activeTab === id ? ds.weight.semibold : ds.weight.regular, cursor: "pointer", fontFamily: "Inter, sans-serif", transition: "all 0.15s ease", marginBottom: -1, display: "flex", alignItems: "center", gap: 6 }}
          >
            {label}
            {badge && (
              <span style={{ fontSize: 9, fontWeight: ds.weight.bold, letterSpacing: "0.04em", backgroundColor: activeTab === id ? ds.accent.default : "rgba(113,113,122,0.2)", color: activeTab === id ? "#000" : ds.text.muted, padding: "1px 5px", borderRadius: ds.radius.md }}>{badge}</span>
            )}
          </button>
        ))}
      </div>

      {activeTab === "synced" && <SyncedTab syncingExternal={syncing} />}
      {activeTab === "live" && <LiveTab />}
      {activeTab === "activities" && <ActivitiesTab />}
      {activeTab === "payouts" && <PayoutsTab />}
    </div>
  );
}
