"use client";

import { useCallback, useEffect, useState } from "react";
import { ScanLine, Bug, AlertTriangle, Activity, RefreshCw } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

interface RecentScan {
  id: string;
  target: string;
  status: string;
  startedAt: string | null;
  finishedAt: string | null;
}

interface OverviewData {
  totalScans: number;
  activeScans: number;
  totalFindings: number;
  criticalFindings: number;
  recentScans: RecentScan[];
}

interface AnalyticsData {
  totalBounties: number;
  totalRevenue: number;
  acceptanceRate: number;
  totalTargets: number;
}

function formatDuration(start: string | null, end: string | null): string {
  if (!start) return "—";
  const ms = (end ? new Date(end).getTime() : Date.now()) - new Date(start).getTime();
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

function StatusBadge({ status }: { status: string }) {
  const s = status.toUpperCase();
  const variant: "default" | "secondary" | "destructive" | "outline" =
    s === "COMPLETE" || s === "COMPLETED" ? "default" :
    s === "FAILED" ? "destructive" :
    s === "RUNNING" ? "secondary" : "outline";
  return <Badge variant={variant}>{s.charAt(0) + s.slice(1).toLowerCase()}</Badge>;
}

export function DashboardPage() {
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ov, an] = await Promise.all([
        fetch("/api/stats/overview").then(r => r.ok ? r.json() : Promise.reject(r.statusText)),
        fetch("/api/stats/analytics").then(r => r.ok ? r.json() : Promise.reject(r.statusText)),
      ]);
      setOverview(ov);
      setAnalytics(an);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (error) {
    return (
      <div className="p-8 text-center space-y-4">
        <p className="text-destructive">Erreur : {error}</p>
        <Button onClick={load} variant="outline"><RefreshCw className="mr-2 h-4 w-4" />Réessayer</Button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <Button onClick={load} variant="outline" size="sm" disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh
        </Button>
      </div>

      <Tabs defaultValue="today">
        <TabsList>
          <TabsTrigger value="today">Today</TabsTrigger>
          <TabsTrigger value="historical">Historical</TabsTrigger>
        </TabsList>

        <TabsContent value="today" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Total scans" value={overview?.totalScans ?? 0} icon={ScanLine} loading={loading} />
            <StatCard label="Active" value={overview?.activeScans ?? 0} icon={Activity} loading={loading} />
            <StatCard label="Findings" value={overview?.totalFindings ?? 0} icon={Bug} loading={loading} />
            <StatCard label="Critical" value={overview?.criticalFindings ?? 0} icon={AlertTriangle} loading={loading} />
          </div>

          <div className="rounded-lg border">
            <div className="p-4 border-b"><h2 className="font-medium">Recent scans</h2></div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Target</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Started</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={4}><Skeleton className="h-4 w-full" /></TableCell>
                  </TableRow>
                ))}
                {!loading && overview?.recentScans.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Aucun scan</TableCell></TableRow>
                )}
                {!loading && overview?.recentScans.map(scan => (
                  <TableRow key={scan.id}>
                    <TableCell className="font-mono text-sm">{scan.target}</TableCell>
                    <TableCell><StatusBadge status={scan.status} /></TableCell>
                    <TableCell className="tabular-nums">{formatDuration(scan.startedAt, scan.finishedAt)}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{scan.startedAt ? new Date(scan.startedAt).toLocaleString("fr-FR") : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="historical" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Targets" value={analytics?.totalTargets ?? 0} icon={ScanLine} loading={loading} />
            <StatCard label="Bounties" value={analytics?.totalBounties ?? 0} icon={Bug} loading={loading} />
            <StatCard label="Revenue" value={`€${(analytics?.totalRevenue ?? 0).toLocaleString("fr-FR")}`} icon={Activity} loading={loading} />
            <StatCard label="Acceptance" value={`${Math.round((analytics?.acceptanceRate ?? 0) * 100)}%`} icon={AlertTriangle} loading={loading} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
