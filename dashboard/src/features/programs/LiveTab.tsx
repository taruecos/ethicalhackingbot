"use client";

import React, { useEffect, useState } from "react";
import { AlertCircle, RefreshCw, Wifi, WifiOff, CheckCircle2 } from "lucide-react";
import { ds } from "@/components/ds/tokens";
import { DSButton } from "@/components/ds/DSButton";
import { ProgramCard } from "./ProgramCard";
import { ProgramDrawer } from "./ProgramDrawer";
import { mapApiProgram } from "./types";
import type { Program } from "./types";

type ApiState = "ok" | "error" | "loading";

interface IntigritiListEntry {
  id: string;
  name?: string;
  handle?: string;
  webLinks?: { detail?: string };
  status?: { value?: string };
  type?: { value?: string };
  confidentialityLevel?: { value?: string };
  industry?: { value?: string };
  minBounty?: { value?: number };
  maxBounty?: { value?: number };
}

function liveEntryToProgram(entry: IntigritiListEntry, syncedIds: Set<string>): Program {
  return mapApiProgram({
    id: entry.id,
    platform: "INTIGRITI",
    name: entry.name ?? entry.handle ?? entry.id,
    slug: entry.handle ?? entry.id,
    url: entry.webLinks?.detail ?? "",
    scope: [],
    compliance: {},
    maxBounty: entry.maxBounty?.value ?? null,
    minBounty: entry.minBounty?.value ?? null,
    currency: "EUR",
    industry: entry.industry?.value ?? null,
    programType: entry.type?.value ?? null,
    confidentiality: entry.confidentialityLevel?.value ?? null,
    active: true,
    syncedAt: new Date().toISOString(),
  }) ;
}

export function LiveTab() {
  const [apiState, setApiState] = useState<ApiState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [selectedProgram, setSelectedProgram] = useState<Program | null>(null);
  const [livePrograms, setLivePrograms] = useState<Program[]>([]);
  const [syncedIds, setSyncedIds] = useState<Set<string>>(new Set());
  const [retrying, setRetrying] = useState(false);

  const loadAll = async () => {
    setApiState("loading");
    setError(null);
    try {
      const [liveRes, dbRes] = await Promise.all([
        fetch("/api/intigriti/programs?limit=200", { credentials: "same-origin" }),
        fetch("/api/programs?limit=500", { credentials: "same-origin" }),
      ]);
      if (!liveRes.ok) {
        const body = await liveRes.json().catch(() => ({}));
        throw new Error(body?.error ?? `Intigriti HTTP ${liveRes.status}`);
      }
      const liveJson = await liveRes.json();
      const records: IntigritiListEntry[] = liveJson.records ?? [];
      const intigritiIds = new Set<string>();
      if (dbRes.ok) {
        const dbJson = await dbRes.json();
        for (const p of dbJson.programs ?? []) {
          if (p.intigritiId) intigritiIds.add(p.intigritiId);
        }
      }
      setSyncedIds(intigritiIds);
      setLivePrograms(records.map((entry) => liveEntryToProgram(entry, intigritiIds)));
      setApiState("ok");
    } catch (e: any) {
      setError(e?.message ?? "Network error");
      setApiState("error");
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const handleRetry = async () => {
    setRetrying(true);
    await loadAll();
    setRetrying(false);
  };

  const handleImport = async (program: Program) => {
    try {
      await fetch("/api/programs/sync", { method: "POST", credentials: "same-origin" });
      await loadAll();
    } catch {
      // ignore — list refresh will reflect state
    }
  };

  const displayPrograms = livePrograms.map((p) => ({ ...p, synced: syncedIds.has(p.id) }));
  const notSyncedCount = displayPrograms.filter((p) => !p.synced).length;

  return (
    <div>
      {apiState === "error" && (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 16px", marginBottom: 20, backgroundColor: ds.severity.criticalBg, border: `1px solid ${ds.severity.critical}40`, borderRadius: ds.radius.lg }}>
          <WifiOff size={16} style={{ color: ds.severity.critical, flexShrink: 0, marginTop: 1 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: ds.size.sm, fontWeight: ds.weight.semibold, color: ds.severity.critical, marginBottom: 3 }}>Intigriti API unreachable</div>
            <div style={{ fontSize: ds.size.xs, color: ds.text.muted }}>{error ?? "Cannot fetch live program data."}</div>
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
          <div style={{ fontSize: ds.size.xs, color: ds.text.muted }}>Connecting to api.intigriti.com</div>
        </div>
      )}

      {apiState === "ok" && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, padding: "10px 14px", backgroundColor: ds.bg.elevated, border: `1px solid ${ds.border.default}`, borderRadius: ds.radius.md }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Wifi size={13} style={{ color: ds.accent.default }} />
              <span style={{ fontSize: ds.size.xs, color: ds.text.muted }}>Live · Intigriti API</span>
            </div>
            <div style={{ height: 12, width: 1, backgroundColor: ds.border.default }} />
            <span style={{ fontSize: ds.size.xs, color: ds.text.muted }}>{displayPrograms.length} programs in feed</span>
            {notSyncedCount > 0 ? (
              <>
                <div style={{ height: 12, width: 1, backgroundColor: ds.border.default }} />
                <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: ds.size.xs, color: ds.severity.high }}>
                  <AlertCircle size={11} />
                  {notSyncedCount} not yet imported to DB
                </span>
              </>
            ) : displayPrograms.length > 0 ? (
              <>
                <div style={{ height: 12, width: 1, backgroundColor: ds.border.default }} />
                <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: ds.size.xs, color: ds.accent.default }}>
                  <CheckCircle2 size={11} /> All programs synced
                </span>
              </>
            ) : null}
          </div>

          {displayPrograms.length === 0 ? (
            <div style={{ padding: "60px 32px", textAlign: "center", backgroundColor: ds.bg.surface, border: `1px solid ${ds.border.default}`, borderRadius: ds.radius.lg, color: ds.text.muted, fontSize: ds.size.sm }}>
              No programs returned by the Intigriti API.
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
              {displayPrograms.map((program) => (
                <ProgramCard key={program.id} program={program} forLive onDetails={setSelectedProgram} onImport={handleImport} />
              ))}
            </div>
          )}
        </>
      )}

      <ProgramDrawer program={selectedProgram} onClose={() => setSelectedProgram(null)} onScan={() => setSelectedProgram(null)} />
    </div>
  );
}
