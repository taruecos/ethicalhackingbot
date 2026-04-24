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

export function ProgramsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const activeTab = (searchParams.get("tab") as Tab) || "synced";
  const setTab = (t: Tab) => router.replace(`${pathname}?tab=${t}`, { scroll: false });

  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [lastSync, setLastSync] = useState("12 min ago");
  const [apiErrorBanner, setApiErrorBanner] = useState(false);
  const [syncDone, setSyncDone] = useState(false);

  const startSync = () => {
    if (syncing) return;
    setSyncing(true);
    setSyncProgress(0);
    setSyncDone(false);

    let pct = 0;
    const iv = setInterval(() => {
      pct += Math.random() * 6 + 2;
      if (pct >= 100) {
        pct = 100;
        clearInterval(iv);
        setSyncing(false);
        setSyncProgress(100);
        setSyncDone(true);
        setLastSync("just now");
        setTimeout(() => setSyncDone(false), 3000);
      }
      setSyncProgress(pct);
    }, 100);
  };

  const syncCount = Math.round(syncProgress * 1.2);

  return (
    <div>
      {apiErrorBanner && (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 20, padding: "12px 16px", backgroundColor: ds.severity.criticalBg, border: `1px solid ${ds.severity.critical}40`, borderRadius: ds.radius.lg }}>
          <AlertCircle size={15} style={{ color: ds.severity.critical, flexShrink: 0, marginTop: 1 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: ds.size.sm, fontWeight: ds.weight.semibold, color: ds.severity.critical, marginBottom: 3 }}>Intigriti sync failed</div>
            <div style={{ fontSize: ds.size.xs, color: ds.text.muted }}>Could not reach api.intigriti.com. Check your API token in Settings or try again.</div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
            <DSButton variant="secondary" size="sm" icon={<RefreshCw size={11} />} onClick={startSync}>
              Retry
            </DSButton>
            <button onClick={() => setApiErrorBanner(false)} style={{ background: "none", border: "none", cursor: "pointer", color: ds.text.muted, padding: 2 }}>
              <X size={13} />
            </button>
          </div>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, gap: 16, flexWrap: "wrap" }}>
        <h1 style={{ margin: 0, fontSize: ds.size["3xl"], fontWeight: ds.weight.bold, color: ds.text.primary, lineHeight: 1.2 }}>Programs</h1>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: ds.size.xs, color: ds.text.muted }}>{syncDone ? <span style={{ color: ds.accent.default }}>✓ Synced just now</span> : `Last sync: ${lastSync}`}</span>

          <button onClick={() => setApiErrorBanner(!apiErrorBanner)} style={{ height: 28, padding: "0 10px", borderRadius: ds.radius.md, cursor: "pointer", border: `1px solid ${ds.border.default}`, backgroundColor: "transparent", color: ds.text.muted, fontSize: ds.size.xs, fontFamily: "Inter, sans-serif" }}>
            {apiErrorBanner ? "Hide error" : "Simulate error"}
          </button>

          <DSButton variant="primary" size="md" icon={syncing ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} onClick={startSync}>
            {syncing ? "Syncing…" : "Sync Intigriti"}
          </DSButton>
        </div>
      </div>

      {syncing && (
        <div style={{ marginBottom: 16, padding: "12px 16px", backgroundColor: ds.bg.elevated, border: `1px solid ${ds.border.default}`, borderRadius: ds.radius.lg }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Loader2 size={12} className="animate-spin" style={{ color: ds.accent.default }} />
              <span style={{ fontSize: ds.size.sm, color: ds.text.primary }}>Syncing programs with Intigriti…</span>
            </div>
            <span style={{ fontSize: ds.size.xs, color: ds.accent.default, fontWeight: ds.weight.semibold, fontVariantNumeric: "tabular-nums" }}>{Math.min(syncCount, 120)} / 120</span>
          </div>
          <div style={{ height: 4, backgroundColor: ds.bg.base, borderRadius: 2, overflow: "hidden" }}>
            <div style={{ width: `${syncProgress}%`, height: "100%", backgroundColor: ds.accent.default, borderRadius: 2, transition: "width 0.12s linear" }} />
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
