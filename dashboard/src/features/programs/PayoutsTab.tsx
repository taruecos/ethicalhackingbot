"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Download, TrendingUp, Clock, CheckCircle2, MoreHorizontal, ExternalLink, RefreshCw, WifiOff, RotateCcw } from "lucide-react";
import { ds } from "@/components/ds/tokens";
import { DSButton } from "@/components/ds/DSButton";
import type { Payout, PayoutStatus } from "./types";

const STATUS_CFG: Record<PayoutStatus, { label: string; color: string; bg: string }> = {
  paid: { label: "Paid", color: ds.accent.default, bg: ds.accent.bg15 },
  pending: { label: "Pending", color: ds.severity.high, bg: ds.severity.highBg },
};

function normalizePayout(raw: Record<string, unknown>, idx: number): Payout {
  const id = (raw.id as string) || `payout-${idx}`;
  const amountObj = raw.amount as Record<string, unknown> | number | undefined;
  let amount = 0;
  let currency = "EUR";
  if (typeof amountObj === "number") {
    amount = amountObj;
  } else if (amountObj && typeof amountObj === "object") {
    amount = Number(amountObj.value ?? 0);
    currency = (amountObj.currency as string) ?? currency;
  }
  if (typeof raw.currency === "string") currency = raw.currency;

  const rawStatus = ((raw.status as Record<string, unknown> | string | undefined) ?? "") as string | Record<string, unknown>;
  const statusStr = (typeof rawStatus === "string" ? rawStatus : (rawStatus.value as string) || "").toLowerCase();
  const status: PayoutStatus = statusStr.includes("pend") ? "pending" : "paid";

  const programObj = raw.program as Record<string, unknown> | undefined;
  const program = (programObj?.name as string) || (raw.programName as string) || (raw.program as string) || "—";

  const submission = raw.submission as Record<string, unknown> | undefined;
  const finding = (submission?.title as string) || (raw.finding as string) || (raw.title as string) || "—";

  const awardedAt = (raw.awardedAt as string) || (raw.paidAt as string) || (raw.createdAt as string) || "";
  const formattedDate = awardedAt ? new Date(awardedAt).toISOString().slice(0, 10) : "—";

  const scanRef = (raw.scanRef as string) || (submission?.id as string) || "—";

  return {
    id,
    amount,
    currency,
    status,
    awardedAt: formattedDate,
    program,
    scanRef,
    finding,
  };
}

export function PayoutsTab() {
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | PayoutStatus>("all");
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/intigriti/payouts?limit=100", { cache: "no-store" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || `HTTP ${res.status}`);
      }
      const json = await res.json();
      const records = (json.records ?? json.payouts ?? json) as unknown;
      const list = Array.isArray(records) ? (records as Record<string, unknown>[]) : [];
      setPayouts(list.map(normalizePayout));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(
    () => payouts.filter((p) => statusFilter === "all" || p.status === statusFilter),
    [payouts, statusFilter],
  );

  const totalPaid = useMemo(() => payouts.filter((p) => p.status === "paid").reduce((s, p) => s + p.amount, 0), [payouts]);
  const totalPending = useMemo(() => payouts.filter((p) => p.status === "pending").reduce((s, p) => s + p.amount, 0), [payouts]);
  const totalAll = totalPaid + totalPending;

  const handleExportCSV = () => {
    const headers = ["ID", "Program", "Finding", "Amount (EUR)", "Status", "Awarded At", "Scan Ref"];
    const rows = payouts.map((p) => [p.id, p.program, p.finding, p.amount, p.status, p.awardedAt, p.scanRef]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ehb-payouts.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 24 }}>
        <RevenueCard label="Total Revenue" amount={totalAll} sub={`${payouts.length} payouts total`} color={ds.accent.default} icon={<TrendingUp size={14} style={{ color: ds.text.muted }} />} />
        <RevenueCard label="Received" amount={totalPaid} sub={`${payouts.filter((p) => p.status === "paid").length} paid`} color={ds.accent.default} icon={<CheckCircle2 size={14} style={{ color: ds.text.muted }} />} />
        <RevenueCard label="Pending" amount={totalPending} sub={`${payouts.filter((p) => p.status === "pending").length} awaiting`} color={ds.severity.high} icon={<Clock size={14} style={{ color: ds.text.muted }} />} />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 4 }}>
          {(["all", "paid", "pending"] as const).map((s) => {
            const active = statusFilter === s;
            const cfg = s !== "all" ? STATUS_CFG[s] : null;
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                style={{ height: 28, padding: "0 12px", borderRadius: ds.radius.md, cursor: "pointer", border: `1px solid ${active && cfg ? `${cfg.color}50` : ds.border.default}`, backgroundColor: active && cfg ? cfg.bg : active ? ds.bg.elevated : "transparent", color: active && cfg ? cfg.color : active ? ds.text.primary : ds.text.muted, fontSize: ds.size.xs, fontWeight: active ? ds.weight.semibold : ds.weight.medium, fontFamily: "Inter, sans-serif", transition: "all 0.1s ease", display: "flex", alignItems: "center", gap: 5, textTransform: "capitalize" }}
              >
                {cfg && <span style={{ width: 5, height: 5, borderRadius: "50%", backgroundColor: cfg.color }} />}
                {s}
              </button>
            );
          })}
        </div>

        <span style={{ fontSize: ds.size.xs, color: ds.text.muted, marginLeft: "auto" }}>
          {filtered.length} payout{filtered.length !== 1 ? "s" : ""} · €{filtered.reduce((s, p) => s + p.amount, 0).toLocaleString()}
        </span>

        <DSButton variant="secondary" size="sm" icon={<RefreshCw size={11} className={loading ? "animate-spin" : ""} />} onClick={load}>
          {loading ? "Loading…" : "Refresh"}
        </DSButton>
        <DSButton variant="secondary" size="sm" icon={<Download size={12} />} onClick={handleExportCSV}>
          Export CSV
        </DSButton>
      </div>

      {error && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderRadius: ds.radius.lg, backgroundColor: ds.severity.criticalBg, border: `1px solid ${ds.severity.critical}40`, marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <WifiOff size={16} style={{ color: ds.severity.critical, flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: ds.size.sm, fontWeight: ds.weight.semibold, color: ds.severity.critical }}>Unable to load payouts</div>
              <div style={{ fontSize: ds.size.xs, color: ds.text.muted, marginTop: 2 }}>{error}</div>
            </div>
          </div>
          <DSButton variant="danger" size="sm" icon={<RotateCcw size={12} />} onClick={load}>Retry</DSButton>
        </div>
      )}

      {!error && (
        <div style={{ backgroundColor: ds.bg.surface, border: `1px solid ${ds.border.default}`, borderRadius: ds.radius.lg, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "110px 1fr 140px 100px 90px 90px 36px", gap: 8, padding: "9px 16px", backgroundColor: ds.bg.elevated, borderBottom: `1px solid ${ds.border.default}` }}>
            {["Amount", "Finding", "Program", "Awarded", "Status", "Scan ref", ""].map((h) => (
              <span key={h || "act"} style={{ fontSize: 10, fontWeight: ds.weight.semibold, color: ds.text.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {h}
              </span>
            ))}
          </div>

          {loading && payouts.length === 0 ? (
            <div style={{ padding: 32, textAlign: "center", color: ds.text.muted, fontSize: ds.size.sm }}>Loading payouts…</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 32, textAlign: "center", color: ds.text.muted, fontSize: ds.size.sm }}>{payouts.length === 0 ? "No payouts yet" : "No payouts match the current filter"}</div>
          ) : (
            filtered.map((payout, i) => {
              const cfg = STATUS_CFG[payout.status];
              const isLast = i === filtered.length - 1;
              const hovered = hoveredRow === payout.id;

              return (
                <div
                  key={payout.id}
                  onMouseEnter={() => setHoveredRow(payout.id)}
                  onMouseLeave={() => setHoveredRow(null)}
                  style={{ display: "grid", gridTemplateColumns: "110px 1fr 140px 100px 90px 90px 36px", gap: 8, padding: "12px 16px", alignItems: "center", borderBottom: isLast ? "none" : `1px solid ${ds.border.default}`, backgroundColor: hovered ? ds.bg.elevated : "transparent", transition: "background 0.1s ease" }}
                >
                  <div>
                    <span style={{ fontSize: ds.size.sm, fontWeight: ds.weight.bold, color: payout.status === "paid" ? ds.accent.default : ds.text.primary, fontVariantNumeric: "tabular-nums" }}>€{payout.amount.toLocaleString()}</span>
                    <span style={{ fontSize: 10, color: ds.text.muted, marginLeft: 3 }}>{payout.currency}</span>
                  </div>
                  <span style={{ fontSize: ds.size.xs, color: ds.text.secondary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{payout.finding}</span>
                  <span style={{ fontSize: ds.size.xs, color: ds.text.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{payout.program}</span>
                  <span style={{ fontSize: ds.size.xs, color: ds.text.muted, fontVariantNumeric: "tabular-nums" }}>{payout.awardedAt}</span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5, height: 20, padding: "0 8px", borderRadius: ds.radius.md, backgroundColor: cfg.bg, color: cfg.color, fontSize: ds.size.xs, fontWeight: ds.weight.medium }}>
                    <span style={{ width: 5, height: 5, borderRadius: "50%", backgroundColor: cfg.color }} />
                    {cfg.label}
                  </span>
                  <button style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", color: ds.severity.info, fontSize: 10, fontFamily: "monospace", padding: 0 }}>
                    {payout.scanRef} <ExternalLink size={9} />
                  </button>
                  <button style={{ width: 24, height: 24, borderRadius: ds.radius.md, border: "none", backgroundColor: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: ds.text.muted }}>
                    <MoreHorizontal size={13} />
                  </button>
                </div>
              );
            })
          )}

          <div style={{ padding: "10px 16px", borderTop: `1px solid ${ds.border.default}`, display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: ds.bg.elevated }}>
            <span style={{ fontSize: ds.size.xs, color: ds.text.muted }}>
              {filtered.length} payout{filtered.length !== 1 ? "s" : ""}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <span style={{ fontSize: ds.size.xs, color: ds.text.muted }}>
                Received:{" "}
                <span style={{ color: ds.accent.default, fontWeight: ds.weight.semibold }}>
                  €
                  {filtered
                    .filter((p) => p.status === "paid")
                    .reduce((s, p) => s + p.amount, 0)
                    .toLocaleString()}
                </span>
              </span>
              <span style={{ fontSize: ds.size.xs, color: ds.text.muted }}>
                Pending:{" "}
                <span style={{ color: ds.severity.high, fontWeight: ds.weight.semibold }}>
                  €
                  {filtered
                    .filter((p) => p.status === "pending")
                    .reduce((s, p) => s + p.amount, 0)
                    .toLocaleString()}
                </span>
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RevenueCard({ label, amount, sub, color, icon }: { label: string; amount: number; sub: string; color: string; icon: React.ReactNode }) {
  return (
    <div style={{ backgroundColor: ds.bg.surface, border: `1px solid ${ds.border.default}`, borderRadius: ds.radius.lg, padding: "16px 18px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <span style={{ fontSize: ds.size.xs, color: ds.text.muted, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: ds.weight.medium }}>{label}</span>
        <div style={{ width: 28, height: 28, borderRadius: ds.radius.md, backgroundColor: ds.bg.elevated, border: `1px solid ${ds.border.default}`, display: "flex", alignItems: "center", justifyContent: "center" }}>{icon}</div>
      </div>
      <div style={{ fontSize: 28, fontWeight: ds.weight.bold, color, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>€{amount.toLocaleString()}</div>
      <div style={{ fontSize: ds.size.xs, color: ds.text.muted, marginTop: 6 }}>{sub}</div>
    </div>
  );
}
