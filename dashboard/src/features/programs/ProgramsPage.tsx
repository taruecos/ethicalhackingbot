"use client";

import React, { useEffect, useState } from "react";
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

export function ProgramsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const activeTab = (searchParams.get("tab") as Tab) || "synced";
  const setTab = (t: Tab) => router.replace(`${pathname}?tab=${t}`, { scroll: false });

  const [syncing, setSyncing] = useState(false);
  const [lastSyncIso, setLastSyncIso] = useState<string | null>(null);
  const [syncStats, setSyncStats] = useState<{ total: number; synced: number; compliant: number } | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncDone, setSyncDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const loadLastSync = async () => {
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
    loadLastSync();
    return () => {
      cancelled = true;
    };
  }, []);

  const startSync = async () => {
    if (syncing) return;
    setSyncing(true);
    setSyncError(null);
    setSyncDone(false);
    try {
      const res = await fetch("/api/programs/sync", { method: "POST", credentials: "same-origin" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      const json = await res.json();
      setSyncStats({ total: json.total ?? 0, synced: json.synced ?? 0, compliant: json.compliant ?? 0 });
      setLastSyncIso(new Date().toISOString());
      setSyncDone(true);
      setTimeout(() => setSyncDone(false), 3000);
    } catch (e: any) {
      setSyncError(e?.message ?? "Sync failed");
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
            {syncDone && syncStats ? (
              <span style={{ color: ds.accent.default }}>✓ Synced {syncStats.synced} programs</span>
            ) : (
              `Last sync: ${relativeTime(lastSyncIso)}`
            )}
          </span>

          <DSButton variant="primary" size="md" icon={syncing ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} onClick={startSync} disabled={syncing}>
            {syncing ? "Syncing…" : "Sync Intigriti"}
          </DSButton>
        </div>
      </div>

      {syncing && (
        <div style={{ marginBottom: 16, padding: "12px 16px", backgroundColor: ds.bg.elevated, border: `1px solid ${ds.border.default}`, borderRadius: ds.radius.lg }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Loader2 size={12} className="animate-spin" style={{ color: ds.accent.default }} />
            <span style={{ fontSize: ds.size.sm, color: ds.text.primary }}>Syncing programs with Intigriti — this may take a minute…</span>
          </div>
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
