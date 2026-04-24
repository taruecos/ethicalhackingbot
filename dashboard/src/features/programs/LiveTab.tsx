"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, RefreshCw, Wifi, WifiOff, CheckCircle2 } from "lucide-react";
import { ds } from "@/components/ds/tokens";
import { DSButton } from "@/components/ds/DSButton";
import { ProgramCard } from "./ProgramCard";
import { ProgramDrawer } from "./ProgramDrawer";
import type { Program, ComplianceStatus } from "./types";

type ApiState = "ok" | "error" | "loading";

function intigritiToProgram(raw: Record<string, unknown>, importedIntigritiIds: Set<string>): Program {
  const id = (raw.id as string) ?? "";
  const handle = (raw.handle as string) ?? "";
  const name = (raw.name as string) ?? handle;
  const company = raw.company as Record<string, unknown> | undefined;
  const companyName = (company?.name as string) ?? name;
  const minBountyObj = raw.minBounty as Record<string, unknown> | undefined;
  const maxBountyObj = raw.maxBounty as Record<string, unknown> | undefined;
  const conf = raw.confidentialityLevel as Record<string, unknown> | undefined;

  // Compliance fields aren't usually in the list endpoint — default to "conditional"
  // (drawer can fetch detail). Tooling not_allowed comes from program detail.
  const automatedTooling = raw.automatedTooling as string | undefined;
  let complianceStatus: ComplianceStatus = "conditional";
  if (automatedTooling === "allowed") complianceStatus = "allowed";
  else if (automatedTooling === "not_allowed") complianceStatus = "not_allowed";

  return {
    id,
    intigritiId: id,
    name,
    companyName,
    complianceStatus,
    bountyType: maxBountyObj?.value ? "bounty" : "responsible_disclosure",
    bountyMin: typeof minBountyObj?.value === "number" ? (minBountyObj.value as number) : null,
    bountyMax: typeof maxBountyObj?.value === "number" ? (maxBountyObj.value as number) : null,
    currency: ((maxBountyObj?.currency as string) ?? "EUR").toUpperCase(),
    industry: (raw.industry as string) ?? "Other",
    confidentiality: (conf?.value as string) === "Public" ? "public" : "application_only",
    safeHarbour: true,
    lastSynced: importedIntigritiIds.has(id) ? "imported" : "—",
    synced: importedIntigritiIds.has(id),
    scope: [],
    userAgent: "EHBScanner/1.0",
    reqHeaders: [],
    rulesOfEngagement: "",
  };
}

export function LiveTab() {
  const [apiState, setApiState] = useState<ApiState>("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [rawPrograms, setRawPrograms] = useState<Record<string, unknown>[]>([]);
  const [importedIds, setImportedIds] = useState<Set<string>>(new Set());
  const [selectedProgram, setSelectedProgram] = useState<Program | null>(null);
  const [importing, setImporting] = useState(false);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    setApiState("loading");
    setErrorMsg(null);
    try {
      const [liveRes, dbRes] = await Promise.all([
        fetch("/api/intigriti/programs?limit=100", { cache: "no-store" }),
        fetch("/api/programs?limit=500", { cache: "no-store" }),
      ]);
      if (!liveRes.ok) {
        const j = await liveRes.json().catch(() => ({}));
        throw new Error(j?.error || `HTTP ${liveRes.status}`);
      }
      const liveJson = await liveRes.json();
      const records = (liveJson.records ?? liveJson.programs ?? []) as Record<string, unknown>[];

      // Track which intigritiIds are already in DB
      let imported: Set<string> = new Set();
      if (dbRes.ok) {
        const dbJson = await dbRes.json();
        const dbProgs = (dbJson.programs ?? []) as Array<{ intigritiId: string | null }>;
        imported = new Set(dbProgs.map((p) => p.intigritiId).filter((id): id is string => Boolean(id)));
      }

      setRawPrograms(records);
      setImportedIds(imported);
      setApiState("ok");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Network error";
      setErrorMsg(msg);
      setApiState("error");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const displayPrograms = useMemo(
    () => rawPrograms.map((p) => intigritiToProgram(p, importedIds)),
    [rawPrograms, importedIds],
  );
  const notSyncedCount = displayPrograms.filter((p) => !p.synced).length;

  const handleImport = async (program: Program) => {
    // No per-program POST exists — we trigger a full Intigriti sync via /api/programs/sync.
    setImporting(true);
    setImportSuccess(null);
    try {
      const res = await fetch("/api/programs/sync", { method: "POST" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || `HTTP ${res.status}`);
      }
      setImportSuccess(`Synced — ${program.name} should now be in your DB`);
      await load();
      setTimeout(() => setImportSuccess(null), 4000);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Import failed");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div>
      {apiState === "error" && (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 16px", marginBottom: 20, backgroundColor: ds.severity.criticalBg, border: `1px solid ${ds.severity.critical}40`, borderRadius: ds.radius.lg }}>
          <WifiOff size={16} style={{ color: ds.severity.critical, flexShrink: 0, marginTop: 1 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: ds.size.sm, fontWeight: ds.weight.semibold, color: ds.severity.critical, marginBottom: 3 }}>Intigriti API unreachable</div>
            <div style={{ fontSize: ds.size.xs, color: ds.text.muted }}>{errorMsg ?? "Cannot fetch live program data."}</div>
          </div>
          <DSButton variant="secondary" size="sm" icon={<RefreshCw size={12} />} onClick={load}>Retry</DSButton>
        </div>
      )}

      {apiState === "loading" && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 14, padding: "60px 32px", backgroundColor: ds.bg.surface, border: `1px solid ${ds.border.default}`, borderRadius: ds.radius.lg }}>
          <RefreshCw size={32} className="animate-spin" style={{ color: ds.accent.default }} />
          <div style={{ fontSize: ds.size.base, fontWeight: ds.weight.medium, color: ds.text.secondary }}>Fetching live programs from Intigriti…</div>
          <div style={{ fontSize: ds.size.xs, color: ds.text.muted }}>Connected to api.intigriti.com</div>
        </div>
      )}

      {apiState === "ok" && (
        <>
          {importSuccess && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", marginBottom: 16, backgroundColor: ds.accent.bg15, border: `1px solid ${ds.border.accent20}`, borderRadius: ds.radius.lg }}>
              <CheckCircle2 size={14} style={{ color: ds.accent.default }} />
              <span style={{ fontSize: ds.size.xs, color: ds.accent.default }}>{importSuccess}</span>
            </div>
          )}

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
            ) : (
              <>
                <div style={{ height: 12, width: 1, backgroundColor: ds.border.default }} />
                <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: ds.size.xs, color: ds.accent.default }}>
                  <CheckCircle2 size={11} /> All programs synced
                </span>
              </>
            )}
            <DSButton variant="secondary" size="sm" icon={<RefreshCw size={11} className={importing ? "animate-spin" : ""} />} onClick={load} style={{ marginLeft: "auto" }}>
              {importing ? "Syncing…" : "Refresh"}
            </DSButton>
          </div>

          {displayPrograms.length === 0 ? (
            <div style={{ padding: "60px 32px", textAlign: "center", backgroundColor: ds.bg.surface, border: `1px solid ${ds.border.default}`, borderRadius: ds.radius.lg }}>
              <div style={{ fontSize: ds.size.lg, fontWeight: ds.weight.semibold, color: ds.text.secondary, marginBottom: 8 }}>No programs in feed</div>
              <div style={{ fontSize: ds.size.sm, color: ds.text.muted }}>Intigriti returned an empty list. Check your API token or try again.</div>
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
