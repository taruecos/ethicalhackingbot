"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, Search, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { apiToFinding, relativeTime, type Finding, type FindingStatus, type Severity } from "./types";

const SEV_COLORS: Record<Severity, string> = {
  critical: "bg-red-500/15 text-red-400 border-red-500/30",
  high: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  medium: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  low: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  info: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
};

const STATUSES: FindingStatus[] = ["NEW", "CONFIRMED", "FALSE_POSITIVE", "FIXED", "ACCEPTED", "REPORTED"];

export function FindingsPage() {
  const [findings, setFindings] = useState<Finding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sevFilter, setSevFilter] = useState<Severity | "all">("all");
  const [statusFilter, setStatusFilter] = useState<FindingStatus | "all">("all");
  const [active, setActive] = useState<Finding | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/findings", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setFindings(((json.findings ?? []) as Parameters<typeof apiToFinding>[0][]).map(apiToFinding));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => findings.filter(f => {
    if (sevFilter !== "all" && f.severity !== sevFilter) return false;
    if (statusFilter !== "all" && f.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!f.title.toLowerCase().includes(q) && !f.url.toLowerCase().includes(q)) return false;
    }
    return true;
  }), [findings, sevFilter, statusFilter, search]);

  const patchStatus = async (id: string, status: FindingStatus) => {
    try {
      const res = await fetch(`/api/findings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, falsePositive: status === "FALSE_POSITIVE" }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setFindings(prev => prev.map(f => f.id === id ? { ...f, status } : f));
      setActive(prev => prev?.id === id ? { ...prev, status } : prev);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    }
  };

  const exportCsv = () => {
    const csv = [
      ["ID", "Title", "Severity", "Status", "CVSS", "CWE", "URL", "First Seen"],
      ...filtered.map(f => [f.id, f.title, f.severity, f.status, f.cvss, f.cwe, f.url, f.firstSeen]),
    ].map(r => r.join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "findings.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Findings</h1>
        <div className="flex gap-2">
          <Button onClick={exportCsv} variant="outline" size="sm" disabled={!filtered.length}>
            <Download className="mr-2 h-4 w-4" />Export CSV
          </Button>
          <Button onClick={load} variant="outline" size="sm" disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search title or URL…" className="pl-8" />
        </div>
        <Select value={sevFilter} onValueChange={v => setSevFilter(v as Severity | "all")}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Severity" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All severities</SelectItem>
            {(["critical", "high", "medium", "low", "info"] as Severity[]).map(s => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={v => setStatusFilter(v as FindingStatus | "all")}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Severity</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>CVSS</TableHead>
              <TableHead>Module</TableHead>
              <TableHead>Seen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}><TableCell colSpan={6}><Skeleton className="h-4 w-full" /></TableCell></TableRow>
            ))}
            {!loading && filtered.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Aucun finding</TableCell></TableRow>
            )}
            {!loading && filtered.map(f => (
              <TableRow key={f.id} className="cursor-pointer" onClick={() => setActive(f)}>
                <TableCell><span className={`inline-block rounded px-2 py-0.5 text-xs font-medium border ${SEV_COLORS[f.severity]}`}>{f.severity}</span></TableCell>
                <TableCell className="max-w-md truncate">{f.title}</TableCell>
                <TableCell><Badge variant="outline">{f.status}</Badge></TableCell>
                <TableCell className="tabular-nums">{f.cvss.toFixed(1)}</TableCell>
                <TableCell className="text-muted-foreground">{f.module}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{relativeTime(f.firstSeen)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Sheet open={!!active} onOpenChange={open => !open && setActive(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {active && (
            <>
              <SheetHeader>
                <SheetTitle>{active.title}</SheetTitle>
                <SheetDescription className="flex gap-2 flex-wrap pt-2">
                  <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium border ${SEV_COLORS[active.severity]}`}>{active.severity}</span>
                  <Badge variant="outline">{active.status}</Badge>
                  <Badge variant="secondary">CVSS {active.cvss.toFixed(1)}</Badge>
                  {active.cwe !== "—" && <Badge variant="secondary">{active.cwe}</Badge>}
                </SheetDescription>
              </SheetHeader>
              <div className="space-y-4 mt-6">
                <section><h3 className="text-sm font-medium mb-1">URL</h3><p className="text-sm font-mono text-muted-foreground break-all">{active.url || "—"}</p></section>
                <section><h3 className="text-sm font-medium mb-1">Description</h3><p className="text-sm text-muted-foreground whitespace-pre-wrap">{active.description}</p></section>
                {active.remediation && (
                  <section><h3 className="text-sm font-medium mb-1">Remediation</h3><p className="text-sm text-muted-foreground whitespace-pre-wrap">{active.remediation}</p></section>
                )}
                <section className="flex flex-wrap gap-2">
                  {(["CONFIRMED", "FALSE_POSITIVE", "FIXED", "ACCEPTED"] as FindingStatus[]).map(s => (
                    <Button key={s} variant="outline" size="sm" onClick={() => patchStatus(active.id, s)} disabled={active.status === s}>
                      Mark {s.toLowerCase().replace("_", " ")}
                    </Button>
                  ))}
                </section>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
