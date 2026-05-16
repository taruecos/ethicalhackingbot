"use client";

import React, { useState } from "react";
import { Moon, Info, AlertCircle } from "lucide-react";
import { ds } from "@/components/ds/tokens";
import { DSButton } from "@/components/ds/DSButton";
import { SettingsCard, SettingsRow, SettingsRowLast, FormInput, FormSelect, HR } from "./shared";

const ACCOUNT_EMAIL = "j.doe@sec.io";

interface GeneralTabProps {
  onSave: (msg?: string) => void;
  onError: (msg?: string) => void;
}

const TIMEZONES = [
  { value: "UTC", label: "UTC +0:00" },
  { value: "Europe/Paris", label: "Europe/Paris (UTC+1/+2)" },
  { value: "Europe/London", label: "Europe/London (UTC+0/+1)" },
  { value: "America/New_York", label: "America/New_York (UTC-5/-4)" },
  { value: "America/Los_Angeles", label: "America/Los_Angeles (UTC-8/-7)" },
  { value: "Asia/Tokyo", label: "Asia/Tokyo (UTC+9)" },
  { value: "Asia/Singapore", label: "Asia/Singapore (UTC+8)" },
];

export function GeneralTab({ onSave, onError }: GeneralTabProps) {
  const [name, setName] = useState("John Doe");
  const [timezone, setTimezone] = useState("Europe/Paris");
  const [saving, setSaving] = useState(false);
  const [showTip, setShowTip] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  const validateName = (value: string): string | null => {
    const trimmed = value.trim();
    if (trimmed.length === 0) return "Display name is required";
    if (trimmed.length < 2) return "Display name must be at least 2 characters";
    if (trimmed.length > 80) return "Display name must be 80 characters or less";
    return null;
  };

  const handleNameChange = (value: string) => {
    setName(value);
    if (nameError) setNameError(validateName(value));
  };

  const handleSave = () => {
    const err = validateName(name);
    if (err) {
      setNameError(err);
      onError(err);
      return;
    }
    setNameError(null);
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      onSave("Account settings saved");
    }, 600);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <SettingsCard title="Account" description="Manage your profile information">
        <SettingsRow label="Email" hint="Cannot be changed — contact support">
          <FormInput value={ACCOUNT_EMAIL} readOnly />
        </SettingsRow>

        <SettingsRow label="Display name" hint="Used in reports and notifications">
          <div>
            <FormInput value={name} onChange={handleNameChange} placeholder="Your name" />
            {nameError && (
              <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 6, fontSize: ds.size.xs, color: ds.severity.critical }}>
                <AlertCircle size={11} />
                {nameError}
              </div>
            )}
          </div>
        </SettingsRow>

        <SettingsRowLast label="Timezone" hint="Used for scan scheduling and timestamps">
          <FormSelect value={timezone} onChange={setTimezone} options={TIMEZONES} />
        </SettingsRowLast>

        <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end" }}>
          <DSButton variant="primary" size="md" forceState={saving ? "loading" : undefined} onClick={handleSave}>
            Save changes
          </DSButton>
        </div>
      </SettingsCard>

      <SettingsCard title="Appearance" description="Theme and density preferences">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: ds.radius.md, flexShrink: 0, backgroundColor: ds.bg.elevated, border: `1px solid ${ds.border.default}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Moon size={15} style={{ color: ds.severity.info }} />
            </div>
            <div>
              <div style={{ fontSize: ds.size.xs, fontWeight: ds.weight.medium, color: ds.text.primary }}>Theme</div>
              <div style={{ fontSize: 10, color: ds.text.muted, marginTop: 2 }}>Dark only — light mode coming soon</div>
            </div>
          </div>

          <div
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: ds.radius.md, backgroundColor: ds.bg.elevated, border: `1px solid ${ds.border.default}`, color: ds.text.muted, fontSize: 10, fontWeight: ds.weight.medium }}
            onMouseEnter={() => setShowTip(true)}
            onMouseLeave={() => setShowTip(false)}
          >
            <span>Dark</span>
            <Info size={11} />
            {showTip && (
              <div style={{ position: "absolute", marginTop: 28, padding: "5px 9px", backgroundColor: ds.bg.elevated, border: `1px solid ${ds.border.default}`, borderRadius: ds.radius.md, fontSize: 10, color: ds.text.secondary, boxShadow: "0 4px 16px rgba(0,0,0,0.5)", zIndex: 10, whiteSpace: "nowrap" }}>
                Light theme is not yet available
              </div>
            )}
          </div>
        </div>

        <HR />

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {["Default", "Compact", "Comfortable"].map((d, i) => (
            <button key={d} disabled={i !== 0} style={{ height: 28, padding: "0 12px", backgroundColor: i === 0 ? ds.accent.bg15 : "transparent", border: `1px solid ${i === 0 ? ds.accent.default : ds.border.default}`, borderRadius: ds.radius.md, cursor: i === 0 ? "default" : "not-allowed", fontSize: ds.size.xs, fontFamily: "Inter, sans-serif", color: i === 0 ? ds.accent.default : ds.text.muted, opacity: i === 0 ? 1 : 0.4 }}>
              {d}
            </button>
          ))}
          <span style={{ fontSize: 10, color: ds.text.muted }}>Density control — coming soon</span>
        </div>
      </SettingsCard>
    </div>
  );
}
