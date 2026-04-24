"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Depth = "quick" | "standard" | "deep";
type ScopeType = "wildcard" | "exact" | "ip";
type ComplianceStatus = "ok" | "forbidden" | "conditional" | "unknown";

interface ScopeEntry { id: string; url: string; type: ScopeType; }

interface ApiProgram {
  id: string; name: string; industry: string | null;
  minBounty: number | null; maxBounty: number | null;
  scope: unknown; compliance: Record<string, unknown> | null;
}

interface Program {
  id: string; name: string; industry: string;
  automatedStatus: ComplianceStatus;
  scope: string[]; userAgent: string; reqHeaders: string[];
}

function mapProgram(p: ApiProgram): Program {
  const c = (p.compliance ?? {}) as Record<string, unknown>;
  const t = c.automatedToolingStatus as string | undefined;
  const automatedStatus: ComplianceStatus = t === "allowed" ? "ok" : t === "not_allowed" ? "forbidden" : t === "conditional" ? "conditional" : "unknown";
  const scopeArr: string[] = [];
  if (Array.isArray(p.scope)) for (const e of p.scope) {
    const ep = (e as Record<string, unknown>)?.endpoint as string | undefined;
    if (ep) scopeArr.push(ep);
  }
  return {
    id: p.id, name: p.name, industry: p.industry ?? "—",
    automatedStatus, scope: scopeArr,
    userAgent: (c.userAgent as string) || "EHBScanner/1.0",
    reqHeaders: c.requestHeader ? [c.requestHeader as string] : [],
  };
}

const MODULES = [
  { id: "sqli", label: "SQLi" },
  { id: "xss", label: "XSS" },
  { id: "ssrf", label: "SSRF" },
  { id: "idor", label: "IDOR" },
  { id: "csrf", label: "CSRF" },
  { id: "access_control", label: "Access control" },
  { id: "info_disclosure", label: "Info disclosure" },
  { id: "differential", label: "Differential" },
];

export function ComposeTab() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [domain, setDomain] = useState("");
  const [programId, setProgramId] = useState("");
  const [useProgramScope, setUseProgramScope] = useState(false);
  const [scope, setScope] = useState<ScopeEntry[]>([{ id: "1", url: "", type: "wildcard" }]);
  const [modules, setModules] = useState<Set<string>>(new Set(["sqli", "xss", "ssrf", "idor"]));
  const [depth, setDepth] = useState<Depth>("standard");
  const [rateLimit, setRateLimit] = useState(30);
  const [safeHarbour, setSafeHarbour] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/programs?limit=500", { cache: "no-store" })
      .then(r => r.ok ? r.json() : Promise.reject(r.statusText))
      .then(json => setPrograms(((json.programs ?? []) as ApiProgram[]).map(mapProgram)))
      .catch(() => { /* swallow */ });
  }, []);

  const selectedProgram = programs.find(p => p.id === programId);
  const complianceStatus: ComplianceStatus = selectedProgram?.automatedStatus ?? "unknown";
  const blocked = complianceStatus === "forbidden";

  const onProgramChange = (id: string) => {
    setProgramId(id === "none" ? "" : id);
    if (id === "none") setUseProgramScope(false);
  };
  const applyProgramScope = (v: boolean) => {
    setUseProgramScope(v);
    if (v && selectedProgram) {
      setScope(selectedProgram.scope.map((url, i) => ({ id: `prog-${i}`, url, type: "wildcard" as const })));
    }
  };
  const addScope = () => setScope(s => [...s, { id: String(Date.now()), url: "", type: "wildcard" }]);
  const updateScope = (id: string, patch: Partial<ScopeEntry>) => setScope(s => s.map(e => e.id === id ? { ...e, ...patch } : e));
  const removeScope = (id: string) => setScope(s => s.filter(e => e.id !== id));
  const toggleModule = (id: string) => setModules(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const validScope = scope.filter(e => e.url.trim());
  const isValid = !!(domain.trim() && validScope.length > 0 && modules.size > 0 && !blocked && (complianceStatus !== "conditional" || safeHarbour));

  const launch = async () => {
    setError(null);
    if (!isValid) { setError("Formulaire incomplet ou bloqué"); return; }
    setLaunching(true);
    try {
      const res = await fetch("/api/scans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain: domain.trim(), programId: programId || null, depth, rateLimit,
          modules: Array.from(modules),
          scope: validScope.map(e => ({ url: e.url.trim(), type: e.type })),
          rulesOfEngagement: {
            safeHarbour,
            userAgent: selectedProgram?.userAgent ?? "EHBScanner/1.0",
            requestHeaders: selectedProgram?.reqHeaders ?? [],
            automatedToolingStatus: complianceStatus,
          },
        }),
      });
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j?.error || `HTTP ${res.status}`); }
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Launch failed");
    } finally {
      setLaunching(false);
    }
  };

  return (
    <div className="pt-4 grid gap-4 md:grid-cols-3">
      <div className="md:col-span-2 space-y-4">
        <Card>
          <CardHeader><CardTitle>Target</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label htmlFor="domain">Domain</Label>
              <Input id="domain" value={domain} onChange={e => setDomain(e.target.value)} placeholder="api.example.com" />
            </div>
            <div>
              <Label>Program (optional)</Label>
              <Select value={programId || "none"} onValueChange={onProgramChange}>
                <SelectTrigger><SelectValue placeholder="No program" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— No program / custom —</SelectItem>
                  {programs.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={useProgramScope} onCheckedChange={v => applyProgramScope(!!v)} disabled={!programId} />
              Use program scope
            </label>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>Scope</CardTitle>
            <Button onClick={addScope} variant="outline" size="sm" disabled={useProgramScope}>
              <Plus className="mr-2 h-3 w-3" />Add entry
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {scope.map(e => (
              <div key={e.id} className="flex gap-2">
                <Input value={e.url} onChange={ev => updateScope(e.id, { url: ev.target.value })} placeholder="*.example.com" className="flex-1" disabled={useProgramScope} />
                <Select value={e.type} onValueChange={v => updateScope(e.id, { type: v as ScopeType })}>
                  <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="wildcard">Wildcard</SelectItem>
                    <SelectItem value="exact">Exact</SelectItem>
                    <SelectItem value="ip">IP</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="ghost" size="icon" onClick={() => removeScope(e.id)} disabled={scope.length <= 1 || useProgramScope}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Modules</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            {MODULES.map(m => (
              <label key={m.id} className="flex items-center gap-2 text-sm">
                <Checkbox checked={modules.has(m.id)} onCheckedChange={() => toggleModule(m.id)} />
                {m.label}
              </label>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader><CardTitle>Settings</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Depth</Label>
              <Select value={depth} onValueChange={v => setDepth(v as Depth)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="quick">Quick (~2–5 min)</SelectItem>
                  <SelectItem value="standard">Standard (~8–15 min)</SelectItem>
                  <SelectItem value="deep">Deep (~30+ min)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="rate">Rate limit (req/s)</Label>
              <Input id="rate" type="number" value={rateLimit} onChange={e => setRateLimit(Number(e.target.value) || 0)} min={1} max={100} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Compliance</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {complianceStatus === "unknown" && <Badge variant="outline">No program selected</Badge>}
            {complianceStatus === "ok" && <Badge className="bg-green-500/15 text-green-400 border-green-500/30">Automated OK</Badge>}
            {complianceStatus === "forbidden" && <Badge variant="destructive">Automated tooling not allowed</Badge>}
            {complianceStatus === "conditional" && (
              <>
                <Badge className="bg-yellow-500/15 text-yellow-400 border-yellow-500/30">Conditional</Badge>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={safeHarbour} onCheckedChange={v => setSafeHarbour(!!v)} />
                  J'ai lu les rules of engagement
                </label>
              </>
            )}
          </CardContent>
        </Card>

        <Button onClick={launch} disabled={!isValid || launching} className="w-full" size="lg">
          {launching && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {success ? <><CheckCircle2 className="mr-2 h-4 w-4" />Scan queued</> : launching ? "Queuing…" : "Launch scan"}
        </Button>
        {error && (
          <div className="flex items-start gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 mt-0.5" /><span>{error}</span>
          </div>
        )}
      </div>
    </div>
  );
}
