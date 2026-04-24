"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import type { Payout, PayoutStatus } from "./types";

function normalize(raw: Record<string, unknown>, idx: number): Payout {
  const amountObj = raw.amount as Record<string, unknown> | number | undefined;
  let amount = 0;
  let currency = "EUR";
  if (typeof amountObj === "number") amount = amountObj;
  else if (amountObj && typeof amountObj === "object") {
    amount = Number(amountObj.value ?? 0);
    currency = (amountObj.currency as string) ?? currency;
  }
  if (typeof raw.currency === "string") currency = raw.currency;

  const rawStatus = (raw.status as Record<string, unknown> | string | undefined) ?? "";
  const statusStr = (typeof rawStatus === "string" ? rawStatus : (rawStatus.value as string) || "").toLowerCase();
  const status: PayoutStatus = statusStr.includes("pend") ? "pending" : "paid";

  const submission = raw.submission as Record<string, unknown> | undefined;
  const program = ((raw.program as Record<string, unknown>)?.name as string) || (raw.programName as string) || "—";
  const finding = (submission?.title as string) || (raw.finding as string) || "—";
  const awardedAt = (raw.awardedAt as string) || (raw.paidAt as string) || (raw.createdAt as string) || "";

  return {
    id: (raw.id as string) || `payout-${idx}`,
    amount, currency, status, program, finding,
    awardedAt: awardedAt ? awardedAt.slice(0, 10) : "—",
    scanRef: (raw.scanRef as string) || (submission?.id as string) || "—",
  };
}

export function PayoutsTab() {
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/intigriti/payouts", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const list = (json.payouts ?? json.data ?? json ?? []) as Record<string, unknown>[];
      setPayouts((Array.isArray(list) ? list : []).map(normalize));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const totals = useMemo(() => {
    const paid = payouts.filter(p => p.status === "paid").reduce((s, p) => s + p.amount, 0);
    const pending = payouts.filter(p => p.status === "pending").reduce((s, p) => s + p.amount, 0);
    return { paid, pending };
  }, [payouts]);

  const exportCsv = () => {
    const csv = [
      ["ID", "Date", "Program", "Finding", "Amount", "Currency", "Status"],
      ...payouts.map(p => [p.id, p.awardedAt, p.program, p.finding, p.amount, p.currency, p.status]),
    ].map(r => r.join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url; a.download = "payouts.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4 pt-4">
      {error && <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>}

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex gap-4 text-sm">
          <span className="text-muted-foreground">Paid: <span className="text-primary font-semibold tabular-nums">€{totals.paid.toLocaleString("fr-FR")}</span></span>
          <span className="text-muted-foreground">Pending: <span className="font-semibold tabular-nums">€{totals.pending.toLocaleString("fr-FR")}</span></span>
        </div>
        <div className="flex gap-2">
          <Button onClick={exportCsv} variant="outline" size="sm" disabled={!payouts.length}>
            <Download className="mr-2 h-4 w-4" />Export CSV
          </Button>
          <Button onClick={load} variant="outline" size="sm" disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh
          </Button>
        </div>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Program</TableHead>
              <TableHead>Finding</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}><TableCell colSpan={5}><Skeleton className="h-4 w-full" /></TableCell></TableRow>
            ))}
            {!loading && payouts.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Aucun payout</TableCell></TableRow>
            )}
            {!loading && payouts.map(p => (
              <TableRow key={p.id}>
                <TableCell className="text-muted-foreground text-sm">{p.awardedAt}</TableCell>
                <TableCell className="font-medium">{p.program}</TableCell>
                <TableCell className="text-muted-foreground text-sm max-w-md truncate">{p.finding}</TableCell>
                <TableCell className="tabular-nums font-medium">{p.currency} {p.amount.toLocaleString("fr-FR")}</TableCell>
                <TableCell><Badge variant={p.status === "paid" ? "default" : "outline"}>{p.status}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
