"use client";

import React, { useState } from "react";
import { Plus, Minus, DollarSign, Shield, RefreshCw, EyeOff, ChevronDown } from "lucide-react";
import { ds } from "@/components/ds/tokens";
import { ACTIVITIES, SYNCED_PROGRAMS } from "./mockData";
import type { ActivityType } from "./mockData";

const EVENT_CFG: Record<ActivityType, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  scope_added: { label: "Scope Added", icon: <Plus size={12} />, color: ds.accent.default, bg: ds.accent.bg15 },
  scope_removed: { label: "Scope Removed", icon: <Minus size={12} />, color: ds.severity.critical, bg: ds.severity.criticalBg },
  bounty_changed: { label: "Bounty Updated", icon: <DollarSign size={12} />, color: ds.severity.high, bg: ds.severity.highBg },
  compliance_changed: { label: "Compliance Changed", icon: <Shield size={12} />, color: ds.severity.medium, bg: ds.severity.mediumBg },
  program_synced: { label: "Synced", icon: <RefreshCw size={12} />, color: ds.text.muted, bg: "rgba(113,113,122,0.1)" },
  program_disabled: { label: "Disabled", icon: <EyeOff size={12} />, color: ds.severity.critical, bg: ds.severity.criticalBg },
};

const ALL_EVENT_TYPES = Object.keys(EVENT_CFG) as ActivityType[];
const ALL_PROGRAMS_NAMES = ["All programs", ...SYNCED_PROGRAMS.map((p) => p.name)];

export function ActivitiesTab() {
  const [programFilter, setProgramFilter] = useState("All programs");
  const [typeFilter, setTypeFilter] = useState<Set<ActivityType>>(new Set(ALL_EVENT_TYPES));
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false);

  const toggleType = (t: ActivityType) => {
    setTypeFilter((prev) => {
      const next = new Set(prev);
      if (next.has(t)) {
        if (next.size > 1) next.delete(t);
      } else next.add(t);
      return next;
    });
  };

  const filtered = ACTIVITIES.filter((a) => {
    if (!typeFilter.has(a.type)) return false;
    if (programFilter !== "All programs" && a.program !== programFilter) return false;
    return true;
  });

  const grouped: Record<string, typeof filtered> = {};
  filtered.forEach((a) => {
    const date = a.timestamp.split(" ")[0];
    if (!grouped[date]) grouped[date] = [];
    grouped[date].push(a);
  });

  const DATE_LABELS: Record<string, string> = {
    "2026-04-24": "Today",
    "2026-04-23": "Yesterday",
    "2026-04-22": "Apr 22",
    "2026-04-21": "Apr 21",
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        <select value={programFilter} onChange={(e) => setProgramFilter(e.target.value)} style={{ height: 30, padding: "0 8px", backgroundColor: ds.bg.elevated, border: `1px solid ${ds.border.default}`, borderRadius: ds.radius.md, color: ds.text.secondary, fontSize: ds.size.xs, cursor: "pointer", outline: "none", fontFamily: "Inter, sans-serif", colorScheme: "dark" as const }}>
          {ALL_PROGRAMS_NAMES.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>

        <div style={{ position: "relative" }}>
          <button onClick={() => setTypeDropdownOpen(!typeDropdownOpen)} style={{ height: 30, padding: "0 10px", display: "flex", alignItems: "center", gap: 5, backgroundColor: ds.bg.elevated, border: `1px solid ${ds.border.default}`, borderRadius: ds.radius.md, color: ds.text.secondary, fontSize: ds.size.xs, cursor: "pointer", fontFamily: "Inter, sans-serif" }}>
            Event type {typeFilter.size < ALL_EVENT_TYPES.length && `(${typeFilter.size})`}
            <ChevronDown size={11} />
          </button>
          {typeDropdownOpen && (
            <div style={{ position: "absolute", top: "100%", left: 0, zIndex: 60, marginTop: 4, backgroundColor: ds.bg.elevated, border: `1px solid ${ds.border.default}`, borderRadius: ds.radius.md, overflow: "hidden", minWidth: 200, boxShadow: "0 8px 24px rgba(0,0,0,0.5)" }}>
              {ALL_EVENT_TYPES.map((type) => {
                const cfg = EVENT_CFG[type];
                const active = typeFilter.has(type);
                return (
                  <div key={type} onClick={() => toggleType(type)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", cursor: "pointer", backgroundColor: active ? cfg.bg : "transparent", transition: "background 0.1s" }}>
                    <div style={{ width: 14, height: 14, borderRadius: 4, flexShrink: 0, backgroundColor: active ? cfg.color : "transparent", border: `1.5px solid ${active ? cfg.color : "rgba(113,113,122,0.5)"}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {active && (
                        <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                          <path d="M1 3L3 5L7 1" stroke="#000" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                      )}
                    </div>
                    <span style={{ color: cfg.color }}>{cfg.label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <span style={{ fontSize: ds.size.xs, color: ds.text.muted, marginLeft: "auto" }}>
          {filtered.length} event{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {filtered.length === 0 ? (
        <div style={{ padding: "48px 32px", textAlign: "center", backgroundColor: ds.bg.surface, border: `1px solid ${ds.border.default}`, borderRadius: ds.radius.lg }}>
          <RefreshCw size={32} style={{ color: ds.text.muted, margin: "0 auto 12px" }} />
          <div style={{ fontSize: ds.size.base, color: ds.text.muted }}>No activity matches your filters</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {Object.entries(grouped).map(([date, events]) => (
            <div key={date}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, marginTop: 8 }}>
                <div style={{ height: 1, flex: 1, backgroundColor: ds.border.default }} />
                <span style={{ fontSize: 10, fontWeight: ds.weight.semibold, color: ds.text.muted, textTransform: "uppercase", letterSpacing: "0.07em", padding: "2px 8px", backgroundColor: ds.bg.elevated, borderRadius: ds.radius.md, border: `1px solid ${ds.border.default}` }}>
                  {DATE_LABELS[date] || date}
                </span>
                <div style={{ height: 1, flex: 1, backgroundColor: ds.border.default }} />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 0, marginBottom: 4 }}>
                {events.map((event) => {
                  const cfg = EVENT_CFG[event.type];
                  return (
                    <div key={event.id} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 14px", borderRadius: ds.radius.md, border: `1px solid ${ds.border.default}`, backgroundColor: ds.bg.surface, marginBottom: 6, transition: "border-color 0.1s" }}>
                      <div style={{ width: 28, height: 28, borderRadius: "50%", flexShrink: 0, backgroundColor: cfg.bg, border: `1px solid ${cfg.color}30`, display: "flex", alignItems: "center", justifyContent: "center", color: cfg.color }}>{cfg.icon}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 10, fontWeight: ds.weight.semibold, color: cfg.color, backgroundColor: cfg.bg, padding: "1px 6px", borderRadius: ds.radius.md }}>{cfg.label}</span>
                          <span style={{ fontSize: ds.size.xs, fontWeight: ds.weight.medium, color: ds.text.primary }}>{event.program}</span>
                        </div>
                        <div style={{ fontSize: ds.size.xs, color: ds.text.secondary, lineHeight: 1.5 }}>{event.diff}</div>
                      </div>
                      <span style={{ fontSize: 10, color: ds.text.muted, flexShrink: 0, fontVariantNumeric: "tabular-nums", fontFamily: "monospace" }}>{event.timestamp.split(" ")[1]}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
