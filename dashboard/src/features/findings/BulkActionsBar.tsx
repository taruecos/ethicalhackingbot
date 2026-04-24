"use client";

import React, { useEffect, useState } from "react";
import { CheckCircle2, XCircle, FileText, Download, Trash2, X } from "lucide-react";
import { ds } from "@/components/ds/tokens";
import { DSButton } from "@/components/ds/DSButton";
import { DSDialog } from "@/components/ds/DSDialog";

interface BulkActionsBarProps {
  count: number;
  onMarkConfirmed: () => void;
  onMarkFP: () => void;
  onGenerateReport: () => void;
  onExport: () => void;
  onDelete: () => void;
  onCancel: () => void;
}

export function BulkActionsBar({ count, onMarkConfirmed, onMarkFP, onGenerateReport, onExport, onDelete, onCancel }: BulkActionsBarProps) {
  const [visible, setVisible] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(t);
  }, []);

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", backgroundColor: ds.bg.elevated, border: `1px solid ${ds.accent.default}40`, borderRadius: ds.radius.lg, transform: visible ? "translateY(0)" : "translateY(-8px)", opacity: visible ? 1 : 0, transition: "transform 0.2s ease, opacity 0.2s ease", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, paddingRight: 12, borderRight: `1px solid ${ds.border.default}` }}>
          <span style={{ width: 22, height: 22, borderRadius: ds.radius.md, backgroundColor: ds.accent.bg15, border: `1px solid ${ds.accent.default}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: ds.weight.bold, color: ds.accent.default }}>{count}</span>
          <span style={{ fontSize: ds.size.xs, fontWeight: ds.weight.semibold, color: ds.text.primary }}>selected</span>
        </div>

        <DSButton variant="secondary" size="sm" icon={<CheckCircle2 size={12} />} onClick={onMarkConfirmed}>
          Confirm
        </DSButton>
        <DSButton variant="ghost" size="sm" icon={<XCircle size={12} />} onClick={onMarkFP}>
          Mark FP
        </DSButton>
        <DSButton variant="ghost" size="sm" icon={<FileText size={12} />} onClick={onGenerateReport}>
          Generate Report
        </DSButton>
        <DSButton variant="ghost" size="sm" icon={<Download size={12} />} onClick={onExport}>
          Export
        </DSButton>

        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <DSButton variant="ghost" size="sm" icon={<Trash2 size={12} />} onClick={() => setDeleteConfirm(true)} style={{ color: ds.severity.critical }}>
            Delete
          </DSButton>
          <button onClick={onCancel} style={{ display: "flex", alignItems: "center", gap: 5, height: 28, padding: "0 10px", borderRadius: ds.radius.md, border: `1px solid ${ds.border.default}`, backgroundColor: "transparent", color: ds.text.muted, cursor: "pointer", fontSize: ds.size.xs, fontFamily: "Inter, sans-serif" }}>
            <X size={12} /> Cancel
          </button>
        </div>
      </div>

      <DSDialog
        isOpen={deleteConfirm}
        onClose={() => setDeleteConfirm(false)}
        title={`Delete ${count} finding${count !== 1 ? "s" : ""}?`}
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
                onDelete();
                setDeleteConfirm(false);
              }}
            >
              Delete {count} finding{count !== 1 ? "s" : ""}
            </DSButton>
          </>
        }
      >
        <p style={{ margin: 0, fontSize: ds.size.sm, color: ds.text.secondary, lineHeight: 1.6 }}>
          You are about to permanently delete <strong style={{ color: ds.text.primary }}>{count} finding{count !== 1 ? "s" : ""}</strong>. This action cannot be undone and will remove all associated evidence and notes.
        </p>
      </DSDialog>
    </>
  );
}
