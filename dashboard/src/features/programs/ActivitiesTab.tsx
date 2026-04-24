"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import type { Activity, ActivityType } from "./types";

const TYPE_LABEL: Record<ActivityType, string> = {
  scope_added: "Scope added",
  scope_removed: "Scope removed",
  bounty_changed: "Bounty updated",
  compliance_changed: "Compliance changed",
  program_synced: "Synced",
  program_disabled: "Disabled",
};

function inferType(raw: string): ActivityType {
  const lc = (raw || "").toLowerCase();
  if (lc.includes("scope") && lc.includes("add")) return "scope_added";
  if (lc.includes("scope") && lc.includes("remove")) return "scope_removed";
  if (lc.includes("bounty")) return "bounty_changed";
  if (lc.includes("compliance") || lc.includes("rules")) return "compliance_changed";
  if (lc.includes("disable") || lc.includes("close")) return "program_disabled";
  return "program_synced";
}

function normalize(raw: Record<string, unknown>, idx: number): Activity {
  const ts = (raw.timestamp as string) || (raw.createdAt as string) || (raw.date as string) || new Date().toISOString();
  return {
    id: (raw.id as string) || `act-${idx}`,
    timestamp: ts,
    type: inferType((raw.type as string) || (raw.eventType as string) || ""),
    program: ((raw.program as Record<string, unknown>)?.name as string) || (raw.programName as string) || "—",
    diff: (raw.description as string) || (raw.diff as string) || "",
  };
}

export function ActivitiesTab() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/intigriti/activities", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const list = (json.activities ?? json.data ?? json ?? []) as Record<string, unknown>[];
      setActivities((Array.isArray(list) ? list : []).map(normalize));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="space-y-4 pt-4">
      {error && <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>}

      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{activities.length} event{activities.length !== 1 ? "s" : ""}</span>
        <Button onClick={load} variant="outline" size="sm" disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh
        </Button>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Program</TableHead>
              <TableHead>Detail</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}><TableCell colSpan={4}><Skeleton className="h-4 w-full" /></TableCell></TableRow>
            ))}
            {!loading && activities.length === 0 && (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Aucune activité</TableCell></TableRow>
            )}
            {!loading && activities.map(a => (
              <TableRow key={a.id}>
                <TableCell className="text-muted-foreground text-sm">{new Date(a.timestamp).toLocaleString("fr-FR")}</TableCell>
                <TableCell><Badge variant="outline">{TYPE_LABEL[a.type]}</Badge></TableCell>
                <TableCell className="font-medium">{a.program}</TableCell>
                <TableCell className="text-muted-foreground text-sm max-w-md truncate">{a.diff}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
