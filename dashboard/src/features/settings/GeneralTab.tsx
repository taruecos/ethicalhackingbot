"use client";

import React, { useState } from "react";
import { Moon, Info } from "lucide-react";
import { ds } from "@/components/ds/tokens";
import { DSButton } from "@/components/ds/DSButton";
import { SettingsCard, SettingsRow, SettingsRowLast, FormInput, FormSelect, Toggle, HR } from "./shared";

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
  const [name, setName] = useState("Alex Dupont");
  const [timezone, setTimezone] = useState("Europe/Paris");
  const [saving, setSaving] = useState(false);
  const [showTip, setShowTip] = useState(false);

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      if (name.trim().length < 2) {
        onError("Name must be at least 2 characters");
        return;
      }
      onSave("Account settings saved");
    }, 900);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <SettingsCard title="Account" description="Manage your profile information">
        <SettingsRow label="Email" hint="Cannot be changed — contact support">
          <FormInput value="alex.dupont@ehbsec.io" readOnly />
        </SettingsRow>

        <SettingsRow label="Display name" hint="Used in reports and notifications">
          <FormInput value={name} onChange={setName} placeholder="Your name" />
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

      <SettingsCard title="Appearance" description="Customize the interface theme">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: ds.radius.md, flexShrink: 0, backgroundColor: ds.bg.elevated, border: `1px solid ${ds.border.default}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Moon size={15} style={{ color: ds.severity.info }} />
            </div>
            <div>
              <div style={{ fontSize: ds.size.xs, fontWeight: ds.weight.medium, color: ds.text.primary }}>Dark mode</div>
              <div style={{ fontSize: 10, color: ds.text.muted, marginTop: 2 }}>Dark theme is always active</div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Toggle checked={true} onChange={() => {}} disabled />
            <div style={{ position: "relative", cursor: "help" }} onMouseEnter={() => setShowTip(true)} onMouseLeave={() => setShowTip(false)}>
              <Info size={13} style={{ color: ds.text.muted }} />
              {showTip && (
                <div style={{ position: "absolute", bottom: "calc(100% + 6px)", right: 0, whiteSpace: "nowrap", padding: "5px 9px", backgroundColor: ds.bg.elevated, border: `1px solid ${ds.border.default}`, borderRadius: ds.radius.md, fontSize: 10, color: ds.text.secondary, boxShadow: "0 4px 16px rgba(0,0,0,0.5)", zIndex: 10 }}>
                  Light mode coming soon
                </div>
              )}
            </div>
          </div>
        </div>

        <HR />

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {["Default", "Compact", "Comfortable"].map((d, i) => (
            <button key={d} style={{ height: 28, padding: "0 12px", backgroundColor: i === 0 ? ds.accent.bg15 : "transparent", border: `1px solid ${i === 0 ? ds.accent.default : ds.border.default}`, borderRadius: ds.radius.md, cursor: i === 0 ? "default" : "not-allowed", fontSize: ds.size.xs, fontFamily: "Inter, sans-serif", color: i === 0 ? ds.accent.default : ds.text.muted, opacity: i === 0 ? 1 : 0.4 }}>
              {d}
            </button>
          ))}
          <span style={{ fontSize: 10, color: ds.text.muted }}>Density control — coming soon</span>
        </div>
      </SettingsCard>
    </div>
  );
}
