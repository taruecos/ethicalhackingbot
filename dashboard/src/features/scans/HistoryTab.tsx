"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, Search, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

interface Scan {
  id: string;
  target: string;
  status: string;
  startedAt: string | null;
  finishedAt: string | null;
  stats: Record<string, unknown> | null;
}

function duration(start: string | null, end: string | null): string {
  if (!start) return "—";
  const s = new Date(start).getTime();
  const e = end ? new Date(end).getTime() : Date.now();
  const ms = e - s;
  const m = Math.floor(ms / 60000);
  const sec = Math.floor((ms % 60000) / 1000);
  return `${m}m ${String(sec).padStart(2, "0")}s`;
}

const TERMINAL_STATUSES = ["COMPLETE", "COMPLETED", "FAILED", "CANCELLED"];

export function HistoryTab() {
  const [scans, setScans] = useState<Scan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/scans", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const all = (json.scans ?? []) as Scan[];
      setScans(all.filter(s => TERMINAL_STATUSES.includes((s.status ?? "").toUpperCase())));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => scans.filter(s => {
    if (statusFilter !== "all" && (s.status ?? "").toUpperCase() !== statusFilter) return false;
    if (search && !s.target.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [scans, statusFilter, search]);

  const relaunch = async (id: string) => {
    try {
      const res = await fetch(`/api/scans/${id}/relaunch`, { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Relaunch failed");
    }
  };

  const remove = async (id: string) => {
    try {
      const res = await fetch(`/api/scans/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setScans(prev => prev.filter(s => s.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  };

  return (
    <div className="space-y-4 pt-4">
      {error && <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>}

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search target…" className="pl-8" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {TERMINAL_STATUSES.filter((s, i, a) => a.indexOf(s) === i).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">{filtered.length} scan{filtered.length !== 1 ? "s" : ""}</span>
        <Button onClick={load} variant="outline" size="sm" disabled={loading} className="ml-auto">
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh
        </Button>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Target</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Finished</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}><TableCell colSpan={5}><Skeleton className="h-4 w-full" /></TableCell></TableRow>
            ))}
            {!loading && filtered.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Aucun scan terminé</TableCell></TableRow>
            )}
            {!loading && filtered.map(s => {
              const status = (s.status ?? "").toUpperCase();
              const variant = status.startsWith("COMPLETE") ? "default" : status === "FAILED" ? "destructive" : "outline";
              return (
                <TableRow key={s.id}>
                  <TableCell className="font-mono text-sm">{s.target}</TableCell>
                  <TableCell><Badge variant={variant}>{s.status}</Badge></TableCell>
                  <TableCell className="tabular-nums">{duration(s.startedAt, s.finishedAt)}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{s.finishedAt ? new Date(s.finishedAt).toLocaleString("fr-FR") : "—"}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => relaunch(s.id)} title="Relaunch"><RotateCcw className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(s.id)} title="Delete"><Trash2 className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
