"use client";

import React, { useState } from "react";
import { AlertCircle, RefreshCw, Wifi, WifiOff, CheckCircle2 } from "lucide-react";
import { ds } from "@/components/ds/tokens";
import { DSButton } from "@/components/ds/DSButton";
import { ProgramCard } from "./ProgramCard";
import { ProgramDrawer } from "./ProgramDrawer";
import { LIVE_PROGRAMS } from "./mockData";
import type { Program } from "./mockData";

type ApiState = "ok" | "error" | "loading";

export function LiveTab() {
  const [apiState, setApiState] = useState<ApiState>("ok");
  const [selectedProgram, setSelectedProgram] = useState<Program | null>(null);
  const [importedIds, setImportedIds] = useState<Set<string>>(new Set(LIVE_PROGRAMS.filter((p) => p.synced).map((p) => p.id)));
  const [retrying, setRetrying] = useState(false);

  const handleRetry = () => {
    setRetrying(true);
    setTimeout(() => {
      setApiState("ok");
      setRetrying(false);
    }, 1800);
  };

  const handleImport = (program: Program) => {
    setImportedIds((prev) => new Set([...prev, program.id]));
  };

  const displayPrograms = LIVE_PROGRAMS.map((p) => ({ ...p, synced: importedIds.has(p.id) }));
  const notSyncedCount = displayPrograms.filter((p) => !p.synced).length;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, padding: "7px 12px", backgroundColor: ds.bg.elevated, border: `1px solid ${ds.border.default}`, borderRadius: ds.radius.lg, flexWrap: "wrap" }}>
        <span style={{ fontSize: ds.size.xs, color: ds.text.muted, fontWeight: ds.weight.semibold, textTransform: "uppercase", letterSpacing: "0.06em" }}>API State</span>
        {(["ok", "error", "loading"] as ApiState[]).map((s) => (
          <button key={s} onClick={() => setApiState(s)} style={{ height: 24, padding: "0 10px", borderRadius: ds.radius.md, cursor: "pointer", border: `1px solid ${apiState === s ? ds.accent.default : ds.border.default}`, backgroundColor: apiState === s ? ds.accent.bg15 : "transparent", color: apiState === s ? ds.accent.default : ds.text.secondary, fontSize: ds.size.xs, fontFamily: "Inter, sans-serif", transition: "all 0.1s ease" }}>
            {s}
          </button>
        ))}
      </div>

      {apiState === "error" && (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 16px", marginBottom: 20, backgroundColor: ds.severity.criticalBg, border: `1px solid ${ds.severity.critical}40`, borderRadius: ds.radius.lg }}>
          <WifiOff size={16} style={{ color: ds.severity.critical, flexShrink: 0, marginTop: 1 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: ds.size.sm, fontWeight: ds.weight.semibold, color: ds.severity.critical, marginBottom: 3 }}>Intigriti API unreachable</div>
            <div style={{ fontSize: ds.size.xs, color: ds.text.muted }}>Cannot fetch live program data. Showing last cached results. Error: ECONNREFUSED api.intigriti.com:443</div>
          </div>
          <DSButton variant="secondary" size="sm" icon={retrying ? <RefreshCw size={12} className="animate-spin" /> : <RefreshCw size={12} />} onClick={handleRetry}>
            {retrying ? "Retrying…" : "Retry"}
          </DSButton>
        </div>
      )}

      {apiState === "loading" && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 14, padding: "60px 32px", backgroundColor: ds.bg.surface, border: `1px solid ${ds.border.default}`, borderRadius: ds.radius.lg }}>
          <RefreshCw size={32} className="animate-spin" style={{ color: ds.accent.default }} />
          <div style={{ fontSize: ds.size.base, fontWeight: ds.weight.medium, color: ds.text.secondary }}>Fetching live programs from Intigriti…</div>
          <div style={{ fontSize: ds.size.xs, color: ds.text.muted }}>Connected to api.intigriti.com</div>
        </div>
      )}

      {apiState !== "loading" && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, padding: "10px 14px", backgroundColor: ds.bg.elevated, border: `1px solid ${ds.border.default}`, borderRadius: ds.radius.md }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {apiState === "ok" ? <Wifi size={13} style={{ color: ds.accent.default }} /> : <WifiOff size={13} style={{ color: ds.severity.critical }} />}
              <span style={{ fontSize: ds.size.xs, color: ds.text.muted }}>{apiState === "ok" ? "Live · Intigriti API" : "Offline · Cached data"}</span>
            </div>
            <div style={{ height: 12, width: 1, backgroundColor: ds.border.default }} />
            <span style={{ fontSize: ds.size.xs, color: ds.text.muted }}>{displayPrograms.length} programs in feed</span>
            {notSyncedCount > 0 && (
              <>
                <div style={{ height: 12, width: 1, backgroundColor: ds.border.default }} />
                <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: ds.size.xs, color: ds.severity.high }}>
                  <AlertCircle size={11} />
                  {notSyncedCount} not yet imported to DB
                </span>
              </>
            )}
            {notSyncedCount === 0 && (
              <>
                <div style={{ height: 12, width: 1, backgroundColor: ds.border.default }} />
                <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: ds.size.xs, color: ds.accent.default }}>
                  <CheckCircle2 size={11} /> All programs synced
                </span>
              </>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
            {displayPrograms.map((program) => (
              <ProgramCard key={program.id} program={program} forLive onDetails={setSelectedProgram} onImport={handleImport} />
            ))}
          </div>
        </>
      )}

      <ProgramDrawer program={selectedProgram} onClose={() => setSelectedProgram(null)} onScan={() => setSelectedProgram(null)} />
    </div>
  );
}
