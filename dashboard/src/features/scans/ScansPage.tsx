"use client";

import React, { useEffect, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { ds } from "@/components/ds/tokens";
import { ComposeTab } from "./ComposeTab";
import { ActiveTab } from "./ActiveTab";
import { HistoryTab } from "./HistoryTab";

type Tab = "compose" | "active" | "history";

interface ScanCounts {
  queued: number;
  running: number;
  completedToday: number;
}

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "compose", label: "Compose" },
  { id: "active", label: "Active" },
  { id: "history", label: "History" },
];

function useScanCounts(): ScanCounts {
  const [counts, setCounts] = useState<ScanCounts>({ queued: 0, running: 0, completedToday: 0 });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/scans", { credentials: "same-origin" });
        if (!res.ok) return;
        const json = await res.json();
        const scans: Array<{ status: string; finishedAt?: string | null }> = json.scans ?? [];
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        const next: ScanCounts = {
          queued: scans.filter((s) => s.status === "QUEUED").length,
          running: scans.filter((s) => s.status === "RUNNING").length,
          completedToday: scans.filter(
            (s) => s.status === "COMPLETE" && s.finishedAt && new Date(s.finishedAt) >= startOfToday,
          ).length,
        };
        if (!cancelled) setCounts(next);
      } catch {
        // keep zeros
      }
    };
    load();
    const interval = setInterval(load, 10000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return counts;
}

export function ScansPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const activeTab = (searchParams.get("tab") as Tab) || "compose";
  const counts = useScanCounts();

  const setTab = (tab: Tab) => router.replace(`${pathname}?tab=${tab}`, { scroll: false });

  const headerPills = [
    { label: "Queued", count: counts.queued, color: ds.text.muted, bg: "rgba(113,113,122,0.12)" },
    { label: "Running", count: counts.running, color: ds.severity.info, bg: ds.severity.infoBg },
    { label: "Completed today", count: counts.completedToday, color: ds.accent.default, bg: ds.accent.bg15 },
  ];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, gap: 16, flexWrap: "wrap" }}>
        <h1 style={{ margin: 0, fontSize: ds.size["3xl"], fontWeight: ds.weight.bold, color: ds.text.primary, lineHeight: 1.2 }}>Scans</h1>

        <div style={{ display: "flex", gap: 8 }}>
          {headerPills.map(({ label, count, color, bg }) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 7, height: 28, padding: "0 11px", borderRadius: ds.radius.xl, backgroundColor: bg, border: `1px solid ${color}30` }}>
              <span style={{ fontSize: ds.size.sm, fontWeight: ds.weight.bold, color, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{count}</span>
              <span style={{ fontSize: ds.size.xs, color: ds.text.muted }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", borderBottom: `1px solid ${ds.border.default}`, marginBottom: 24 }}>
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            style={{ height: 38, padding: "0 16px", border: "none", borderBottom: `2px solid ${activeTab === id ? ds.accent.default : "transparent"}`, backgroundColor: "transparent", color: activeTab === id ? ds.text.primary : ds.text.muted, fontSize: ds.size.sm, fontWeight: activeTab === id ? ds.weight.semibold : ds.weight.regular, cursor: "pointer", fontFamily: "Inter, sans-serif", transition: "all 0.15s ease", marginBottom: -1 }}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === "compose" && <ComposeTab />}
      {activeTab === "active" && <ActiveTab />}
      {activeTab === "history" && <HistoryTab />}
    </div>
  );
}
