"use client";

import React, { useState } from "react";
import { Download, TrendingUp, Clock, CheckCircle2, MoreHorizontal, ExternalLink } from "lucide-react";
import { ds } from "@/components/ds/tokens";
import { DSButton } from "@/components/ds/DSButton";
import { PAYOUTS } from "./mockData";
import type { PayoutStatus } from "./mockData";

const STATUS_CFG: Record<PayoutStatus, { label: string; color: string; bg: string }> = {
  paid: { label: "Paid", color: ds.accent.default, bg: ds.accent.bg15 },
  pending: { label: "Pending", color: ds.severity.high, bg: ds.severity.highBg },
};

export function PayoutsTab() {
  const [statusFilter, setStatusFilter] = useState<"all" | PayoutStatus>("all");
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);

  const filtered = PAYOUTS.filter((p) => statusFilter === "all" || p.status === statusFilter);

  const totalPaid = PAYOUTS.filter((p) => p.status === "paid").reduce((s, p) => s + p.amount, 0);
  const totalPending = PAYOUTS.filter((p) => p.status === "pending").reduce((s, p) => s + p.amount, 0);
  const totalAll = totalPaid + totalPending;

  const handleExportCSV = () => {
    const headers = ["ID", "Program", "Finding", "Amount (EUR)", "Status", "Awarded At", "Scan Ref"];
    const rows = PAYOUTS.map((p) => [p.id, p.program, p.finding, p.amount, p.status, p.awardedAt, p.scanRef]);
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
        <RevenueCard label="Total Revenue" amount={totalAll} sub={`${PAYOUTS.length} payouts total`} color={ds.accent.default} icon={<TrendingUp size={14} style={{ color: ds.text.muted }} />} />
        <RevenueCard label="Received" amount={totalPaid} sub={`${PAYOUTS.filter((p) => p.status === "paid").length} paid`} color={ds.accent.default} icon={<CheckCircle2 size={14} style={{ color: ds.text.muted }} />} />
        <RevenueCard label="Pending" amount={totalPending} sub={`${PAYOUTS.filter((p) => p.status === "pending").length} awaiting`} color={ds.severity.high} icon={<Clock size={14} style={{ color: ds.text.muted }} />} />
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
                style={{ height: 28, padding: "0 12px", borderRadius: ds.radius.md, cursor: "pointer", border: `1px solid ${active && cfg ? `${cfg.color}50` : active ? ds.border.default : ds.border.default}`, backgroundColor: active && cfg ? cfg.bg : active ? ds.bg.elevated : "transparent", color: active && cfg ? cfg.color : active ? ds.text.primary : ds.text.muted, fontSize: ds.size.xs, fontWeight: active ? ds.weight.semibold : ds.weight.medium, fontFamily: "Inter, sans-serif", transition: "all 0.1s ease", display: "flex", alignItems: "center", gap: 5, textTransform: "capitalize" }}
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

        <DSButton variant="secondary" size="sm" icon={<Download size={12} />} onClick={handleExportCSV}>
          Export CSV
        </DSButton>
      </div>

      <div style={{ backgroundColor: ds.bg.surface, border: `1px solid ${ds.border.default}`, borderRadius: ds.radius.lg, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "110px 1fr 140px 100px 90px 90px 36px", gap: 8, padding: "9px 16px", backgroundColor: ds.bg.elevated, borderBottom: `1px solid ${ds.border.default}` }}>
          {["Amount", "Finding", "Program", "Awarded", "Status", "Scan ref", ""].map((h) => (
            <span key={h || "act"} style={{ fontSize: 10, fontWeight: ds.weight.semibold, color: ds.text.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              {h}
            </span>
          ))}
        </div>

        {filtered.map((payout, i) => {
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
        })}

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
