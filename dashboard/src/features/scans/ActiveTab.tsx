"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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

function phase(stats: Record<string, unknown> | null): { pct: number; label: string } {
  if (!stats) return { pct: 0, label: "—" };
  const p = Number(stats.progress ?? stats.percentage ?? 0);
  const label = (stats.phase as string) || (stats.currentModule as string) || "Running";
  return { pct: Math.min(100, Math.max(0, Math.round(p))), label };
}

function elapsed(startedAt: string | null): string {
  if (!startedAt) return "—";
  const ms = Date.now() - new Date(startedAt).getTime();
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

export function ActiveTab() {
  const [scans, setScans] = useState<Scan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/scans", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const all = (json.scans ?? []) as Scan[];
      setScans(all.filter(s => ["QUEUED", "RUNNING", "PENDING"].includes((s.status ?? "").toUpperCase())));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); const iv = setInterval(load, 5000); return () => clearInterval(iv); }, [load]);

  const cancel = async (id: string) => {
    try {
      const res = await fetch(`/api/scans/${id}/cancel`, { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setScans(prev => prev.filter(s => s.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Cancel failed");
    }
  };

  return (
    <div className="space-y-4 pt-4">
      {error && <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>}

      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{scans.length} scan{scans.length !== 1 ? "s" : ""} actif{scans.length !== 1 ? "s" : ""} (auto-refresh 5s)</span>
        <Button onClick={load} variant="outline" size="sm" disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh
        </Button>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Target</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Progress</TableHead>
              <TableHead>Elapsed</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && Array.from({ length: 3 }).map((_, i) => (
              <TableRow key={i}><TableCell colSpan={5}><Skeleton className="h-4 w-full" /></TableCell></TableRow>
            ))}
            {!loading && scans.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Aucun scan actif</TableCell></TableRow>
            )}
            {!loading && scans.map(s => {
              const p = phase(s.stats);
              return (
                <TableRow key={s.id}>
                  <TableCell className="font-mono text-sm">{s.target}</TableCell>
                  <TableCell><Badge variant={(s.status ?? "").toUpperCase() === "RUNNING" ? "default" : "outline"}>{s.status}</Badge></TableCell>
                  <TableCell className="space-y-1 min-w-[200px]">
                    <Progress value={p.pct} className="h-1.5" />
                    <p className="text-xs text-muted-foreground">{p.label} — {p.pct}%</p>
                  </TableCell>
                  <TableCell className="tabular-nums">{elapsed(s.startedAt)}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => cancel(s.id)}>
                      <X className="h-4 w-4" />
                    </Button>
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
