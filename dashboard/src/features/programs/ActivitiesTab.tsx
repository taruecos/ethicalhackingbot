"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Minus, DollarSign, Shield, RefreshCw, EyeOff, ChevronDown, WifiOff, RotateCcw } from "lucide-react";
import { ds } from "@/components/ds/tokens";
import { DSButton } from "@/components/ds/DSButton";
import type { Activity, ActivityType } from "./types";

const EVENT_CFG: Record<ActivityType, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  scope_added: { label: "Scope Added", icon: <Plus size={12} />, color: ds.accent.default, bg: ds.accent.bg15 },
  scope_removed: { label: "Scope Removed", icon: <Minus size={12} />, color: ds.severity.critical, bg: ds.severity.criticalBg },
  bounty_changed: { label: "Bounty Updated", icon: <DollarSign size={12} />, color: ds.severity.high, bg: ds.severity.highBg },
  compliance_changed: { label: "Compliance Changed", icon: <Shield size={12} />, color: ds.severity.medium, bg: ds.severity.mediumBg },
  program_synced: { label: "Synced", icon: <RefreshCw size={12} />, color: ds.text.muted, bg: "rgba(113,113,122,0.1)" },
  program_disabled: { label: "Disabled", icon: <EyeOff size={12} />, color: ds.severity.critical, bg: ds.severity.criticalBg },
};

const ALL_EVENT_TYPES = Object.keys(EVENT_CFG) as ActivityType[];

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function inferType(rawType: string): ActivityType {
  const lc = (rawType || "").toLowerCase();
  if (lc.includes("scope") && lc.includes("add")) return "scope_added";
  if (lc.includes("scope") && lc.includes("remove")) return "scope_removed";
  if (lc.includes("bounty")) return "bounty_changed";
  if (lc.includes("compliance") || lc.includes("rules")) return "compliance_changed";
  if (lc.includes("disable") || lc.includes("close")) return "program_disabled";
  return "program_synced";
}

function normalizeActivity(raw: Record<string, unknown>, idx: number): Activity {
  const id = (raw.id as string) || `act-${idx}`;
  const ts = (raw.timestamp as string) || (raw.createdAt as string) || (raw.date as string) || new Date().toISOString();
  const type = inferType((raw.type as string) || (raw.eventType as string) || "");
  const programObj = raw.program as Record<string, unknown> | undefined;
  const program = (programObj?.name as string) || (raw.programName as string) || (raw.program as string) || "—";
  const diff = (raw.description as string) || (raw.diff as string) || (raw.message as string) || JSON.stringify(raw).slice(0, 200);
  return { id, timestamp: formatTimestamp(ts), type, program, diff };
}

export function ActivitiesTab() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [programFilter, setProgramFilter] = useState("All programs");
  const [typeFilter, setTypeFilter] = useState<Set<ActivityType>>(new Set(ALL_EVENT_TYPES));
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/intigriti/activities?limit=50", { cache: "no-store" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || `HTTP ${res.status}`);
      }
      const json = await res.json();
      const records = (json.records ?? json.activities ?? json) as unknown;
      const list = Array.isArray(records) ? (records as Record<string, unknown>[]) : [];
      setActivities(list.map(normalizeActivity));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const programNames = useMemo(() => {
    const set = new Set<string>();
    for (const a of activities) if (a.program && a.program !== "—") set.add(a.program);
    return ["All programs", ...Array.from(set).sort()];
  }, [activities]);

  const toggleType = (t: ActivityType) => {
    setTypeFilter((prev) => {
      const next = new Set(prev);
      if (next.has(t)) {
        if (next.size > 1) next.delete(t);
      } else next.add(t);
      return next;
    });
  };

  const filtered = useMemo(() => {
    return activities.filter((a) => {
      if (!typeFilter.has(a.type)) return false;
      if (programFilter !== "All programs" && a.program !== programFilter) return false;
      return true;
    });
  }, [activities, typeFilter, programFilter]);

  const grouped = useMemo(() => {
    const result: Record<string, Activity[]> = {};
    for (const a of filtered) {
      const date = a.timestamp.split(" ")[0];
      if (!result[date]) result[date] = [];
      result[date].push(a);
    }
    return result;
  }, [filtered]);

  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        <select value={programFilter} onChange={(e) => setProgramFilter(e.target.value)} style={{ height: 30, padding: "0 8px", backgroundColor: ds.bg.elevated, border: `1px solid ${ds.border.default}`, borderRadius: ds.radius.md, color: ds.text.secondary, fontSize: ds.size.xs, cursor: "pointer", outline: "none", fontFamily: "Inter, sans-serif", colorScheme: "dark" as const }}>
          {programNames.map((n) => (
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
        <DSButton variant="secondary" size="sm" icon={<RefreshCw size={11} className={loading ? "animate-spin" : ""} />} onClick={load}>
          {loading ? "Loading…" : "Refresh"}
        </DSButton>
      </div>

      {error && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderRadius: ds.radius.lg, backgroundColor: ds.severity.criticalBg, border: `1px solid ${ds.severity.critical}40`, marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <WifiOff size={16} style={{ color: ds.severity.critical, flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: ds.size.sm, fontWeight: ds.weight.semibold, color: ds.severity.critical }}>Unable to load activities</div>
              <div style={{ fontSize: ds.size.xs, color: ds.text.muted, marginTop: 2 }}>{error}</div>
            </div>
          </div>
          <DSButton variant="danger" size="sm" icon={<RotateCcw size={12} />} onClick={load}>Retry</DSButton>
        </div>
      )}

      {!error && loading && activities.length === 0 ? (
        <div style={{ padding: "48px 32px", textAlign: "center", backgroundColor: ds.bg.surface, border: `1px solid ${ds.border.default}`, borderRadius: ds.radius.lg }}>
          <RefreshCw size={32} className="animate-spin" style={{ color: ds.text.muted, margin: "0 auto 12px" }} />
          <div style={{ fontSize: ds.size.base, color: ds.text.muted }}>Loading activities…</div>
        </div>
      ) : !error && filtered.length === 0 ? (
        <div style={{ padding: "48px 32px", textAlign: "center", backgroundColor: ds.bg.surface, border: `1px solid ${ds.border.default}`, borderRadius: ds.radius.lg }}>
          <RefreshCw size={32} style={{ color: ds.text.muted, margin: "0 auto 12px" }} />
          <div style={{ fontSize: ds.size.base, color: ds.text.muted }}>No activity matches your filters</div>
        </div>
      ) : !error ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {Object.entries(grouped).map(([date, events]) => {
            const label = date === today ? "Today" : date === yesterday ? "Yesterday" : date;
            return (
              <div key={date}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, marginTop: 8 }}>
                  <div style={{ height: 1, flex: 1, backgroundColor: ds.border.default }} />
                  <span style={{ fontSize: 10, fontWeight: ds.weight.semibold, color: ds.text.muted, textTransform: "uppercase", letterSpacing: "0.07em", padding: "2px 8px", backgroundColor: ds.bg.elevated, borderRadius: ds.radius.md, border: `1px solid ${ds.border.default}` }}>
                    {label}
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
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
