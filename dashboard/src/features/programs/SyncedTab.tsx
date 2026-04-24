"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { ProgramSheet } from "./ProgramSheet";
import type { Program, ComplianceStatus, ScopeEntry } from "./types";

interface ApiProgram {
  id: string; platform: string; name: string; slug: string; url: string;
  intigritiId: string | null; scope: unknown; compliance: Record<string, unknown> | null;
  maxBounty: number | null; minBounty: number | null; currency: string;
  industry: string | null; confidentiality: string | null; active: boolean; syncedAt: string;
}

function dbToProgram(p: ApiProgram): Program {
  const compliance = (p.compliance ?? {}) as Record<string, unknown>;
  const toolingStatus = compliance.automatedToolingStatus as string | undefined;
  let complianceStatus: ComplianceStatus = "conditional";
  if (toolingStatus === "allowed") complianceStatus = "allowed";
  else if (toolingStatus === "not_allowed") complianceStatus = "not_allowed";

  const scopeArr: ScopeEntry[] = [];
  if (Array.isArray(p.scope)) {
    for (const e of p.scope) {
      const entry = e as Record<string, unknown>;
      const isOut = /out/i.test((entry.tier as string) || "");
      scopeArr.push({
        tier: isOut ? "out_scope" : "in_scope",
        endpoint: (entry.endpoint as string) ?? "",
        type: ((entry.type as string) === "ip" ? "ip" : (entry.type as string) === "wildcard" ? "wildcard" : "url") as ScopeEntry["type"],
        description: (entry.description as string) ?? "",
      });
    }
  }

  return {
    id: p.id, intigritiId: p.intigritiId, name: p.name, companyName: p.name,
    complianceStatus,
    bountyType: p.maxBounty && p.maxBounty > 0 ? "bounty" : "responsible_disclosure",
    bountyMin: p.minBounty, bountyMax: p.maxBounty, currency: p.currency || "EUR",
    industry: p.industry || "Other",
    confidentiality: p.confidentiality === "Public" ? "public" : "application_only",
    safeHarbour: Boolean(compliance.safeHarbour),
    lastSynced: p.syncedAt ? new Date(p.syncedAt).toISOString().slice(0, 10) : "—",
    synced: true, scope: scopeArr,
    userAgent: (compliance.requestHeader as string) || "EHBScanner/1.0",
    reqHeaders: [], rulesOfEngagement: (compliance.description as string) ?? "",
  };
}

const COMPLIANCE_BADGE: Record<ComplianceStatus, string> = {
  allowed: "bg-green-500/15 text-green-400 border-green-500/30",
  conditional: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  not_allowed: "bg-red-500/15 text-red-400 border-red-500/30",
};

export function SyncedTab({ syncingExternal }: { syncingExternal: boolean }) {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [active, setActive] = useState<Program | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/programs", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setPrograms(((json.programs ?? []) as ApiProgram[]).map(dbToProgram));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (!syncingExternal) void load(); }, [syncingExternal, load]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return q ? programs.filter(p => p.name.toLowerCase().includes(q) || p.industry.toLowerCase().includes(q)) : programs;
  }, [programs, search]);

  return (
    <div className="space-y-4 pt-4">
      {error && <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>}

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…" className="pl-8" />
        </div>
        <span className="text-sm text-muted-foreground">{filtered.length} program{filtered.length !== 1 ? "s" : ""}</span>
        <Button onClick={load} variant="outline" size="sm" disabled={loading} className="ml-auto">
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh
        </Button>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Program</TableHead>
              <TableHead>Industry</TableHead>
              <TableHead>Compliance</TableHead>
              <TableHead>Bounty</TableHead>
              <TableHead>Synced</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}><TableCell colSpan={5}><Skeleton className="h-4 w-full" /></TableCell></TableRow>
            ))}
            {!loading && filtered.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Aucun programme</TableCell></TableRow>
            )}
            {!loading && filtered.map(p => (
              <TableRow key={p.id} className="cursor-pointer" onClick={() => setActive(p)}>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell className="text-muted-foreground">{p.industry}</TableCell>
                <TableCell><span className={`inline-block rounded px-2 py-0.5 text-xs font-medium border ${COMPLIANCE_BADGE[p.complianceStatus]}`}>{p.complianceStatus.replace("_", " ")}</span></TableCell>
                <TableCell className="tabular-nums">
                  {p.bountyMax ? `${p.currency} ${p.bountyMin ?? 0}–${p.bountyMax}` : <Badge variant="outline">VDP</Badge>}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">{p.lastSynced}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ProgramSheet program={active} onClose={() => setActive(null)} />
    </div>
  );
}
