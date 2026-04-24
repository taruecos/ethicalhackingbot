"use client";

import React, { useState, useEffect, useRef } from "react";
import { X, Copy, Check, ChevronDown, CheckCircle2, XCircle, FileText, Trash2, ScanLine, ExternalLink } from "lucide-react";
import { ds } from "@/components/ds/tokens";
import { DSButton } from "@/components/ds/DSButton";
import { DSBadge } from "@/components/ds/DSBadge";
import { DSDialog } from "@/components/ds/DSDialog";
import type { Finding, FindingStatus, Severity } from "./mockData";

const STATUS_LIST: FindingStatus[] = ["NEW", "CONFIRMED", "FALSE_POSITIVE", "FIXED", "ACCEPTED", "REPORTED"];
const STATUS_COLORS: Record<FindingStatus, string> = {
  NEW: ds.severity.info,
  CONFIRMED: ds.severity.high,
  FALSE_POSITIVE: ds.text.muted,
  FIXED: ds.accent.default,
  ACCEPTED: ds.severity.medium,
  REPORTED: ds.severity.info,
};
const STATUS_LABELS: Record<FindingStatus, string> = { NEW: "New", CONFIRMED: "Confirmed", FALSE_POSITIVE: "False Positive", FIXED: "Fixed", ACCEPTED: "Accepted", REPORTED: "Reported" };

function StatusDropdown({ value, onChange }: { value: FindingStatus; onChange: (v: FindingStatus) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const color = STATUS_COLORS[value];
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button onClick={() => setOpen(!open)} style={{ display: "flex", alignItems: "center", gap: 6, height: 28, padding: "0 10px", backgroundColor: `${color}18`, border: `1px solid ${color}40`, borderRadius: ds.radius.md, cursor: "pointer", fontFamily: "Inter, sans-serif", color, fontSize: ds.size.xs, fontWeight: ds.weight.semibold }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: color }} />
        {STATUS_LABELS[value]}
        <ChevronDown size={10} />
      </button>
      {open && (
        <div style={{ position: "absolute", top: "100%", right: 0, zIndex: 60, marginTop: 4, backgroundColor: ds.bg.elevated, border: `1px solid ${ds.border.default}`, borderRadius: ds.radius.lg, overflow: "hidden", minWidth: 160, boxShadow: "0 8px 32px rgba(0,0,0,0.6)" }}>
          {STATUS_LIST.map((s) => (
            <div
              key={s}
              onClick={() => {
                onChange(s);
                setOpen(false);
              }}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", cursor: "pointer", fontSize: ds.size.xs, color: value === s ? STATUS_COLORS[s] : ds.text.secondary, backgroundColor: value === s ? `${STATUS_COLORS[s]}15` : "transparent" }}
            >
              <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: STATUS_COLORS[s] }} />
              {STATUS_LABELS[s]}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CopyValue({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
      <span title={value} style={{ fontSize: 11, fontFamily: "monospace", color: ds.severity.info, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
        {value.slice(0, 50)}
        {value.length > 50 ? "…" : ""}
      </span>
      <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
        <button onClick={copy} style={{ background: "none", border: "none", cursor: "pointer", color: copied ? ds.accent.default : ds.text.muted, display: "flex", padding: 2 }}>
          {copied ? <Check size={11} /> : <Copy size={11} />}
        </button>
        <a href={value} target="_blank" rel="noopener noreferrer" style={{ color: ds.text.muted, display: "flex", padding: 2 }}>
          <ExternalLink size={11} />
        </a>
      </div>
    </div>
  );
}

interface FindingDrawerProps {
  finding: Finding | null;
  onClose: () => void;
  onStatusChange: (id: string, status: FindingStatus) => void;
  onDelete: (id: string) => void;
}

export function FindingDrawer({ finding, onClose, onStatusChange, onDelete }: FindingDrawerProps) {
  const [visible, setVisible] = useState(false);
  const [notes, setNotes] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const prevId = useRef<string | null>(null);

  useEffect(() => {
    if (finding) {
      if (finding.id !== prevId.current) {
        setNotes(finding.notes);
        prevId.current = finding.id;
      }
      setVisible(false);
      requestAnimationFrame(() => setVisible(true));
    }
  }, [finding?.id]);

  if (!finding) return null;

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 40, backgroundColor: "rgba(0,0,0,0.5)", backdropFilter: "blur(3px)", opacity: visible ? 1 : 0, transition: "opacity 0.2s ease" }} />

      <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: 640, backgroundColor: ds.bg.surface, borderLeft: `1px solid ${ds.border.default}`, zIndex: 50, display: "flex", flexDirection: "column", transform: visible ? "translateX(0)" : "translateX(100%)", transition: "transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)", boxShadow: "-24px 0 72px rgba(0,0,0,0.7)" }}>
        <div style={{ flexShrink: 0, padding: "14px 20px", borderBottom: `1px solid ${ds.border.default}`, display: "flex", flexDirection: "column", gap: 10, backgroundColor: ds.bg.surface }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <DSBadge type="severity" severity={finding.severity as Severity} size="md" />
            <h2 style={{ flex: 1, margin: 0, fontSize: ds.size.xl, fontWeight: ds.weight.semibold, color: ds.text.primary, lineHeight: 1.3, minWidth: 0 }}>{finding.title}</h2>
            <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: ds.radius.md, flexShrink: 0, border: `1px solid ${ds.border.default}`, backgroundColor: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: ds.text.muted }}>
              <X size={14} />
            </button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <StatusDropdown value={finding.status as FindingStatus} onChange={(v) => onStatusChange(finding.id, v)} />
            <span style={{ fontSize: ds.size.xs, color: ds.text.muted }}>·</span>
            <span style={{ fontSize: ds.size.xs, color: ds.text.muted }}>{finding.program}</span>
            <span style={{ fontSize: ds.size.xs, color: ds.text.muted }}>·</span>
            <span style={{ fontSize: ds.size.xs, color: ds.text.muted }}>{finding.scanName}</span>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <Section title="Metadata">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0, backgroundColor: ds.bg.elevated, borderRadius: ds.radius.md, border: `1px solid ${ds.border.default}`, overflow: "hidden" }}>
                <MetaCell label="URL">
                  <CopyValue value={finding.url} />
                </MetaCell>
                <MetaCell label="CWE">
                  <span style={{ fontSize: ds.size.xs, fontWeight: ds.weight.semibold, color: ds.text.primary }}>{finding.cwe}</span>
                </MetaCell>
                <MetaCell label="CVSS Score">
                  <span style={{ fontSize: ds.size.sm, fontWeight: ds.weight.bold, color: finding.cvss >= 9 ? ds.severity.critical : finding.cvss >= 7 ? ds.severity.high : finding.cvss >= 4 ? ds.severity.medium : ds.severity.low, fontFamily: "monospace" }}>{finding.cvss.toFixed(1)} / 10</span>
                </MetaCell>
                <MetaCell label="Confidence">
                  <span style={{ fontSize: ds.size.xs, fontWeight: ds.weight.semibold, color: finding.confidence === "high" ? ds.accent.default : finding.confidence === "medium" ? ds.severity.high : ds.text.muted, textTransform: "capitalize" }}>{finding.confidence}</span>
                </MetaCell>
                <MetaCell label="First Seen">
                  <span style={{ fontSize: ds.size.xs, color: ds.text.secondary, fontFamily: "monospace" }}>{new Date(finding.firstSeen).toLocaleString("en-GB")}</span>
                </MetaCell>
                <MetaCell label="Scan" noBorder>
                  <a href={`/scans?id=${finding.scanId}`} style={{ fontSize: ds.size.xs, color: ds.severity.info, textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}>
                    <ScanLine size={11} /> {finding.scanName}
                  </a>
                </MetaCell>
              </div>
            </Section>

            <Section title="Description">
              <div style={{ padding: "14px 16px", backgroundColor: ds.bg.elevated, borderRadius: ds.radius.md, border: `1px solid ${ds.border.default}`, fontSize: ds.size.xs, color: ds.text.secondary, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{finding.description}</div>
            </Section>

            <Section title="Evidence">
              <div style={{ backgroundColor: "#0d1117", borderRadius: ds.radius.md, border: `1px solid ${ds.border.default}`, padding: "12px 14px", overflowX: "auto", fontFamily: "monospace", fontSize: 12, lineHeight: 1.6, maxHeight: 320, overflowY: "auto" }}>
                <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", color: "#e6edf3" }}>{JSON.stringify(finding.evidence, null, 2)}</pre>
              </div>
            </Section>

            <Section title="Remediation">
              <div style={{ padding: "14px 16px", backgroundColor: `${ds.accent.default}08`, borderRadius: ds.radius.md, border: `1px solid ${ds.border.accent20}`, fontSize: ds.size.xs, color: ds.text.secondary, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{finding.remediation}</div>
            </Section>

            <Section title="Notes">
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Add notes about this finding… (auto-saved on blur)" style={{ width: "100%", minHeight: 100, boxSizing: "border-box", padding: "10px 12px", backgroundColor: ds.bg.elevated, border: `1px solid ${ds.border.default}`, borderRadius: ds.radius.md, resize: "vertical", color: ds.text.primary, fontSize: ds.size.xs, fontFamily: "Inter, sans-serif", lineHeight: 1.6, outline: "none" }} />
            </Section>
          </div>
        </div>

        <div style={{ flexShrink: 0, padding: "12px 20px", borderTop: `1px solid ${ds.border.default}`, display: "flex", gap: 8, flexWrap: "wrap", backgroundColor: ds.bg.surface }}>
          <DSButton variant="primary" size="md" icon={<CheckCircle2 size={14} />} onClick={() => onStatusChange(finding.id, "CONFIRMED")}>
            Mark Confirmed
          </DSButton>
          <DSButton variant="secondary" size="md" icon={<XCircle size={14} />} onClick={() => onStatusChange(finding.id, "FALSE_POSITIVE")}>
            Mark False Positive
          </DSButton>
          <DSButton variant="ghost" size="md" icon={<FileText size={14} />}>
            Generate Report
          </DSButton>
          <DSButton variant="ghost" size="md" icon={<Trash2 size={14} />} onClick={() => setDeleteConfirm(true)} style={{ marginLeft: "auto", color: ds.severity.critical }}>
            Delete
          </DSButton>
        </div>
      </div>

      <DSDialog
        isOpen={deleteConfirm}
        onClose={() => setDeleteConfirm(false)}
        title="Delete finding?"
        footer={
          <>
            <DSButton variant="ghost" size="md" onClick={() => setDeleteConfirm(false)}>
              Cancel
            </DSButton>
            <DSButton
              variant="danger"
              size="md"
              icon={<Trash2 size={14} />}
              onClick={() => {
                onDelete(finding.id);
                setDeleteConfirm(false);
                onClose();
              }}
            >
              Delete finding
            </DSButton>
          </>
        }
      >
        <p style={{ margin: 0, fontSize: ds.size.sm, color: ds.text.secondary, lineHeight: 1.6 }}>
          Permanently delete <strong style={{ color: ds.text.primary }}>{finding.title}</strong>? This action cannot be undone.
        </p>
      </DSDialog>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: ds.weight.semibold, color: ds.text.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  );
}

function MetaCell({ label, children, noBorder }: { label: string; children: React.ReactNode; noBorder?: boolean }) {
  return (
    <div style={{ padding: "10px 14px", borderBottom: noBorder ? "none" : `1px solid ${ds.border.default}`, borderRight: `1px solid ${ds.border.default}` }}>
      <div style={{ fontSize: 10, color: ds.text.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>{label}</div>
      {children}
    </div>
  );
}
