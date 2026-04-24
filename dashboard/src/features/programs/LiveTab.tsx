"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, Download, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

interface LivePlatformProgram {
  id: string;
  name: string;
  handle?: string;
  company?: { name?: string };
  industry?: string;
  automatedTooling?: string;
  minBounty?: { value?: number };
  maxBounty?: { value?: number; currency?: string };
  confidentialityLevel?: { value?: string };
}

export function LiveTab() {
  const [programs, setPrograms] = useState<LivePlatformProgram[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [importedIds, setImportedIds] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [live, db] = await Promise.all([
        fetch("/api/intigriti/programs", { cache: "no-store" }).then(r => r.ok ? r.json() : Promise.reject(`HTTP ${r.status}`)),
        fetch("/api/programs", { cache: "no-store" }).then(r => r.ok ? r.json() : { programs: [] }),
      ]);
      const list = (live?.programs ?? live?.data ?? live ?? []) as LivePlatformProgram[];
      setPrograms(Array.isArray(list) ? list : []);
      setImportedIds(new Set(((db.programs ?? []) as { intigritiId: string | null }[]).map(p => p.intigritiId).filter(Boolean) as string[]));
    } catch (e) {
      setError(typeof e === "string" ? e : e instanceof Error ? e.message : "Network error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const importOne = async (id: string) => {
    setImporting(id);
    try {
      const res = await fetch(`/api/intigriti/programs/${id}`, { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setImportedIds(prev => new Set(prev).add(id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setImporting(null);
    }
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return q ? programs.filter(p => (p.name || "").toLowerCase().includes(q)) : programs;
  }, [programs, search]);

  return (
    <div className="space-y-4 pt-4">
      {error && <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>}

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search live…" className="pl-8" />
        </div>
        <span className="text-sm text-muted-foreground">{filtered.length} live program{filtered.length !== 1 ? "s" : ""}</span>
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
              <TableHead>Bounty</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}><TableCell colSpan={4}><Skeleton className="h-4 w-full" /></TableCell></TableRow>
            ))}
            {!loading && filtered.length === 0 && (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Aucun programme live</TableCell></TableRow>
            )}
            {!loading && filtered.map(p => {
              const max = p.maxBounty?.value;
              const min = p.minBounty?.value;
              const currency = p.maxBounty?.currency ?? "EUR";
              const imported = importedIds.has(p.id);
              return (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell className="text-muted-foreground">{p.industry || "Other"}</TableCell>
                  <TableCell className="tabular-nums">
                    {max ? `${currency} ${min ?? 0}–${max}` : <Badge variant="outline">VDP</Badge>}
                  </TableCell>
                  <TableCell className="text-right">
                    {imported ? (
                      <Badge variant="outline">Imported</Badge>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => importOne(p.id)} disabled={importing === p.id}>
                        <Download className={`mr-2 h-3 w-3 ${importing === p.id ? "animate-spin" : ""}`} />Import
                      </Button>
                    )}
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
