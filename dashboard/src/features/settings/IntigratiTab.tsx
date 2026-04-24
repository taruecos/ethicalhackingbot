"use client";

import React, { useState } from "react";
import { Eye, EyeOff, Copy, Check, RotateCcw, Wifi, WifiOff, Loader2 } from "lucide-react";
import { ds } from "@/components/ds/tokens";
import { DSButton } from "@/components/ds/DSButton";
import { DSDialog } from "@/components/ds/DSDialog";
import { SettingsCard, SettingsRow, SettingsRowLast, FormInput, FormSelect, Toggle, StatusBadge } from "./shared";

interface IntigratiTabProps {
  onSave: (msg?: string) => void;
  onError: (msg?: string) => void;
}

type ConnState = "idle" | "testing" | "ok" | "fail";

const MOCK_KEY = "iti_live_sk_abc123def456ghi789jkl012mno345pqr678";
const MASKED = "••••••••••••••••••••••••••••" + MOCK_KEY.slice(-4);

const INTERVALS = [
  { value: "off", label: "Off" },
  { value: "1h", label: "Every hour" },
  { value: "6h", label: "Every 6 hours" },
  { value: "daily", label: "Daily" },
];

function IconBtn({ icon, onClick, title }: { icon: React.ReactNode; onClick: () => void; title?: string }) {
  return (
    <button onClick={onClick} title={title} style={{ width: 24, height: 24, borderRadius: ds.radius.md, backgroundColor: ds.bg.surface, border: `1px solid ${ds.border.default}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: ds.text.muted, flexShrink: 0 }}>
      {icon}
    </button>
  );
}

export function IntigratiTab({ onSave }: IntigratiTabProps) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [rotateOpen, setRotateOpen] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [connState, setConnState] = useState<ConnState>("idle");
  const [failReason, setFailReason] = useState("");

  const [syncEnabled, setSyncEnabled] = useState(true);
  const [interval, setInterval] = useState("6h");
  const [savingSyncs, setSavingSyncs] = useState(false);

  const displayKey = revealed ? MOCK_KEY : MASKED;

  const copyKey = () => {
    navigator.clipboard.writeText(MOCK_KEY);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const testConnection = () => {
    setConnState("testing");
    setTimeout(() => {
      const ok = Math.random() > 0.3;
      if (ok) setConnState("ok");
      else {
        setConnState("fail");
        setFailReason("Rate limit exceeded (429)");
      }
    }, 1600);
  };

  const rotateKey = () => {
    setRotating(true);
    setTimeout(() => {
      setRotating(false);
      setRotateOpen(false);
      setRevealed(false);
      onSave("API key rotated — update your integrations");
    }, 1200);
  };

  const saveSyncSettings = () => {
    setSavingSyncs(true);
    setTimeout(() => {
      setSavingSyncs(false);
      onSave("Sync settings saved");
    }, 800);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <SettingsCard title="Intigriti API Key" description="Used to sync programs, scope and findings from the Intigriti platform">
        <SettingsRow label="API Key" hint="Keep this secret — never share publicly">
          <FormInput
            value={displayKey}
            readOnly
            monospace
            type={revealed ? "text" : "password"}
            rightElement={
              <>
                <IconBtn icon={revealed ? <EyeOff size={12} /> : <Eye size={12} />} onClick={() => setRevealed(!revealed)} title={revealed ? "Hide key" : "Reveal key"} />
                <IconBtn icon={copied ? <Check size={12} style={{ color: ds.accent.default }} /> : <Copy size={12} />} onClick={copyKey} title="Copy key" />
              </>
            }
          />
        </SettingsRow>

        <SettingsRowLast label="Actions" hint="Rotate invalidates the current key immediately">
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <button onClick={testConnection} disabled={connState === "testing"} style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 30, padding: "0 12px", borderRadius: ds.radius.md, border: `1px solid ${ds.border.default}`, backgroundColor: "transparent", cursor: connState === "testing" ? "wait" : "pointer", fontSize: ds.size.xs, fontFamily: "Inter, sans-serif", color: ds.text.secondary }}>
              {connState === "testing" ? <Loader2 size={12} className="animate-spin" /> : connState === "ok" ? <Wifi size={12} style={{ color: ds.accent.default }} /> : connState === "fail" ? <WifiOff size={12} style={{ color: ds.severity.critical }} /> : <Wifi size={12} />}
              Test connection
            </button>

            {connState === "ok" && <StatusBadge type="success" text="Connected" />}
            {connState === "fail" && <StatusBadge type="error" text={`Failed: ${failReason}`} />}

            <div style={{ marginLeft: "auto" }}>
              <DSButton variant="ghost" size="sm" icon={<RotateCcw size={12} />} onClick={() => setRotateOpen(true)} style={{ color: ds.severity.high }}>
                Rotate key
              </DSButton>
            </div>
          </div>
        </SettingsRowLast>
      </SettingsCard>

      <SettingsCard title="Auto-sync" description="Automatically sync programs and scope from Intigriti on a schedule">
        <SettingsRow label="Enable auto-sync" hint="Pulls programs, scope changes and new payouts">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Toggle checked={syncEnabled} onChange={setSyncEnabled} />
            <span style={{ fontSize: ds.size.xs, color: syncEnabled ? ds.accent.default : ds.text.muted, fontWeight: ds.weight.medium }}>{syncEnabled ? "Enabled" : "Disabled"}</span>
          </div>
        </SettingsRow>

        <SettingsRow label="Sync interval" hint="How often to pull changes from Intigriti">
          <FormSelect value={interval} onChange={setInterval} options={INTERVALS} disabled={!syncEnabled} />
        </SettingsRow>

        <SettingsRowLast label="Last sync" hint="Most recent successful synchronization">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: ds.size.xs, fontFamily: "monospace", color: ds.text.muted }}>2026-04-24 06:00 UTC</span>
            <StatusBadge type="success" text="OK" />
          </div>
        </SettingsRowLast>

        <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end" }}>
          <DSButton variant="primary" size="md" forceState={savingSyncs ? "loading" : undefined} onClick={saveSyncSettings}>
            Save
          </DSButton>
        </div>
      </SettingsCard>

      <DSDialog
        isOpen={rotateOpen}
        onClose={() => setRotateOpen(false)}
        title="Rotate API Key?"
        footer={
          <>
            <DSButton variant="ghost" size="md" onClick={() => setRotateOpen(false)}>
              Cancel
            </DSButton>
            <DSButton variant="danger" size="md" icon={<RotateCcw size={14} />} forceState={rotating ? "loading" : undefined} onClick={rotateKey}>
              Rotate key
            </DSButton>
          </>
        }
      >
        <p style={{ margin: 0, fontSize: ds.size.sm, color: ds.text.secondary, lineHeight: 1.6 }}>
          Rotating the API key will <strong style={{ color: ds.text.primary }}>immediately invalidate</strong> the current key. Any integration using the old key will stop working until updated.
        </p>
        <div style={{ padding: "10px 12px", backgroundColor: ds.severity.highBg, borderRadius: ds.radius.md, border: `1px solid ${ds.severity.high}30`, fontSize: ds.size.xs, color: ds.severity.high, lineHeight: 1.5 }}>
          Make sure to update your CI/CD pipelines, webhooks, and any external tools before rotating.
        </div>
      </DSDialog>
    </div>
  );
}
