"use client";

import React, { useState } from "react";
import { Trash2, UserX, ShieldAlert, AlertTriangle } from "lucide-react";
import { ds } from "@/components/ds/tokens";
import { DSButton } from "@/components/ds/DSButton";
import { DSDialog } from "@/components/ds/DSDialog";
import { SettingsCard, FormInput } from "./shared";

interface DangerZoneTabProps {
  onSave: (msg?: string) => void;
  onError: (msg?: string) => void;
}

const PROJECT_NAME = "ehb-scanner-prod";
const ACCOUNT_EMAIL = "alex.dupont@ehbsec.io";

export function DangerZoneTab({ onSave }: DangerZoneTabProps) {
  const [purgeOpen, setPurgeOpen] = useState(false);
  const [purgeInput, setPurgeInput] = useState("");
  const [purging, setPurging] = useState(false);
  const [purged, setPurged] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");
  const [deleting, setDeleting] = useState(false);

  const canPurge = purgeInput === PROJECT_NAME;
  const canDelete = deleteInput === ACCOUNT_EMAIL;

  const doPurge = () => {
    setPurging(true);
    setTimeout(() => {
      setPurging(false);
      setPurgeOpen(false);
      setPurgeInput("");
      setPurged(true);
      onSave("All findings purged — 247 findings deleted");
    }, 1400);
  };

  const doDelete = () => {
    setDeleting(true);
    setTimeout(() => {
      setDeleting(false);
      onSave("Account deletion scheduled — you will receive a confirmation email");
      setDeleteOpen(false);
      setDeleteInput("");
    }, 1400);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 16px", backgroundColor: ds.severity.criticalBg, border: `1px solid ${ds.severity.critical}40`, borderRadius: ds.radius.lg }}>
        <AlertTriangle size={15} style={{ color: ds.severity.critical, flexShrink: 0, marginTop: 1 }} />
        <div style={{ fontSize: ds.size.xs, color: ds.severity.critical, lineHeight: 1.6 }}>
          <strong>Actions on this page are irreversible.</strong> They cannot be undone by support. Read carefully before proceeding.
        </div>
      </div>

      <SettingsCard title="Danger Zone" description="Destructive operations — proceed with extreme caution" danger>
        <DangerRow
          icon={<Trash2 size={16} style={{ color: ds.severity.critical }} />}
          title="Purge all findings"
          description={
            <>
              Permanently delete all {!purged ? "247" : "0"} findings from the database including evidence, notes, and associated reports. <strong style={{ color: ds.severity.high }}>This cannot be undone.</strong>
            </>
          }
          badge={purged ? "Purged" : undefined}
        >
          <DSButton variant="ghost" size="sm" icon={<Trash2 size={12} />} onClick={() => setPurgeOpen(true)} style={{ color: ds.severity.critical, border: `1px solid ${ds.severity.critical}40` }} forceState={purged ? "disabled" : undefined}>
            Purge all findings
          </DSButton>
        </DangerRow>

        <div style={{ height: 1, backgroundColor: `${ds.severity.critical}20`, margin: "16px 0" }} />

        <DangerRow
          icon={<UserX size={16} style={{ color: ds.severity.critical }} />}
          title="Delete account"
          description={
            <>
              Permanently delete your account, all workspaces, scans, findings, and API tokens. Your Intigriti sync configuration will also be removed. <strong style={{ color: ds.severity.high }}>All data is unrecoverable.</strong>
            </>
          }
        >
          <DSButton variant="danger" size="sm" icon={<UserX size={12} />} onClick={() => setDeleteOpen(true)}>
            Delete account
          </DSButton>
        </DangerRow>
      </SettingsCard>

      <DSDialog
        isOpen={purgeOpen}
        onClose={() => {
          setPurgeOpen(false);
          setPurgeInput("");
        }}
        title="Purge all findings"
        footer={
          <>
            <DSButton
              variant="ghost"
              size="md"
              onClick={() => {
                setPurgeOpen(false);
                setPurgeInput("");
              }}
            >
              Cancel
            </DSButton>
            <DSButton variant="danger" size="md" icon={<Trash2 size={14} />} forceState={purging ? "loading" : !canPurge ? "disabled" : undefined} onClick={canPurge ? doPurge : undefined}>
              Purge 247 findings
            </DSButton>
          </>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", backgroundColor: ds.severity.criticalBg, borderRadius: ds.radius.md, border: `1px solid ${ds.severity.critical}40` }}>
            <ShieldAlert size={18} style={{ color: ds.severity.critical, flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: ds.size.xs, fontWeight: ds.weight.semibold, color: ds.severity.critical, marginBottom: 3 }}>You are about to delete 247 findings</div>
              <div style={{ fontSize: 10, color: ds.text.muted, lineHeight: 1.5 }}>All evidence, notes, CVSS scores, and remediation data will be permanently lost.</div>
            </div>
          </div>
          <p style={{ margin: 0, fontSize: ds.size.sm, color: ds.text.secondary, lineHeight: 1.6 }}>
            To confirm, type the project name{" "}
            <code style={{ fontFamily: "monospace", fontSize: ds.size.xs, color: ds.severity.high, backgroundColor: ds.bg.elevated, padding: "1px 5px", borderRadius: 3 }}>{PROJECT_NAME}</code> below:
          </p>
          <FormInput value={purgeInput} onChange={setPurgeInput} placeholder={PROJECT_NAME} monospace style={{ borderColor: purgeInput && !canPurge ? ds.severity.critical : undefined }} />
          {purgeInput && !canPurge && <div style={{ fontSize: 10, color: ds.severity.critical }}>Project name does not match — type exactly: {PROJECT_NAME}</div>}
        </div>
      </DSDialog>

      <DSDialog
        isOpen={deleteOpen}
        onClose={() => {
          setDeleteOpen(false);
          setDeleteInput("");
        }}
        title="Delete account permanently"
        footer={
          <>
            <DSButton
              variant="ghost"
              size="md"
              onClick={() => {
                setDeleteOpen(false);
                setDeleteInput("");
              }}
            >
              Cancel
            </DSButton>
            <DSButton variant="danger" size="md" icon={<UserX size={14} />} forceState={deleting ? "loading" : !canDelete ? "disabled" : undefined} onClick={canDelete ? doDelete : undefined}>
              Delete my account
            </DSButton>
          </>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", backgroundColor: ds.severity.criticalBg, borderRadius: ds.radius.md, border: `1px solid ${ds.severity.critical}40` }}>
            <UserX size={18} style={{ color: ds.severity.critical, flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: ds.size.xs, fontWeight: ds.weight.semibold, color: ds.severity.critical, marginBottom: 3 }}>Irreversible account deletion</div>
              <div style={{ fontSize: 10, color: ds.text.muted, lineHeight: 1.5 }}>Your account, workspaces, scans, 247 findings, and all API tokens will be permanently deleted.</div>
            </div>
          </div>
          <p style={{ margin: 0, fontSize: ds.size.sm, color: ds.text.secondary, lineHeight: 1.6 }}>
            To confirm, type your email address <code style={{ fontFamily: "monospace", fontSize: ds.size.xs, color: ds.severity.high, backgroundColor: ds.bg.elevated, padding: "1px 5px", borderRadius: 3 }}>{ACCOUNT_EMAIL}</code> below:
          </p>
          <FormInput value={deleteInput} onChange={setDeleteInput} placeholder={ACCOUNT_EMAIL} style={{ borderColor: deleteInput && !canDelete ? ds.severity.critical : undefined }} />
          {deleteInput && !canDelete && <div style={{ fontSize: 10, color: ds.severity.critical }}>Email address does not match</div>}
        </div>
      </DSDialog>
    </div>
  );
}

function DangerRow({ icon, title, description, children, badge }: { icon: React.ReactNode; title: string; description: React.ReactNode; children: React.ReactNode; badge?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
      <div style={{ width: 38, height: 38, borderRadius: ds.radius.lg, flexShrink: 0, backgroundColor: ds.severity.criticalBg, border: `1px solid ${ds.severity.critical}30`, display: "flex", alignItems: "center", justifyContent: "center" }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: ds.size.xs, fontWeight: ds.weight.semibold, color: ds.text.primary }}>{title}</span>
          {badge && (
            <span style={{ fontSize: 9, fontWeight: ds.weight.bold, padding: "1px 6px", borderRadius: 10, backgroundColor: ds.severity.criticalBg, color: ds.severity.critical, border: `1px solid ${ds.severity.critical}40`, textTransform: "uppercase", letterSpacing: "0.04em" }}>{badge}</span>
          )}
        </div>
        <div style={{ fontSize: 10, color: ds.text.muted, lineHeight: 1.6, marginBottom: 12 }}>{description}</div>
        {children}
      </div>
    </div>
  );
}
