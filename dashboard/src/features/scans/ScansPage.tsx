"use client";

import React from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { ds } from "@/components/ds/tokens";
import { ComposeTab } from "./ComposeTab";
import { ActiveTab } from "./ActiveTab";
import { HistoryTab } from "./HistoryTab";

type Tab = "compose" | "active" | "history";

const HEADER_PILLS = [
  { label: "Queued", count: 3, color: ds.text.muted, bg: "rgba(113,113,122,0.12)" },
  { label: "Running", count: 1, color: ds.severity.info, bg: ds.severity.infoBg },
  { label: "Completed today", count: 12, color: ds.accent.default, bg: ds.accent.bg15 },
];

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "compose", label: "Compose" },
  { id: "active", label: "Active" },
  { id: "history", label: "History" },
];

export function ScansPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const activeTab = (searchParams.get("tab") as Tab) || "compose";

  const setTab = (tab: Tab) => router.replace(`${pathname}?tab=${tab}`, { scroll: false });

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, gap: 16, flexWrap: "wrap" }}>
        <h1 style={{ margin: 0, fontSize: ds.size["3xl"], fontWeight: ds.weight.bold, color: ds.text.primary, lineHeight: 1.2 }}>Scans</h1>

        <div style={{ display: "flex", gap: 8 }}>
          {HEADER_PILLS.map(({ label, count, color, bg }) => (
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
