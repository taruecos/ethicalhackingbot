"use client";

import React, { useState } from "react";
import { Send, Loader2 } from "lucide-react";
import { ds } from "@/components/ds/tokens";
import { DSButton } from "@/components/ds/DSButton";
import { SettingsCard, SettingsRow, SettingsRowLast, FormInput, StatusBadge } from "./shared";

interface NotificationsTabProps {
  onSave: (msg?: string) => void;
  onError: (msg?: string) => void;
}

type TestState = "idle" | "loading" | "ok" | "fail";

interface ChannelRowProps {
  label: string;
  hint: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  last?: boolean;
}

function ChannelRow({ label, hint, placeholder, value, onChange, last }: ChannelRowProps) {
  const [state, setState] = useState<TestState>("idle");
  const [failMsg, setFailMsg] = useState("");

  const test = () => {
    if (!value.trim()) {
      setState("fail");
      setFailMsg("URL is required");
      return;
    }
    setState("loading");
    setTimeout(() => {
      const ok = value.includes("hooks.") || value.includes("t.me") || value.includes("discord.com");
      if (ok) setState("ok");
      else {
        setState("fail");
        setFailMsg("Connection refused (check URL)");
      }
    }, 1400);
  };

  const Row = last ? SettingsRowLast : SettingsRow;

  return (
    <Row label={label} hint={hint}>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <FormInput
          value={value}
          onChange={(v) => {
            onChange(v);
            setState("idle");
          }}
          placeholder={placeholder}
          monospace
        />
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={test} disabled={state === "loading"} style={{ display: "inline-flex", alignItems: "center", gap: 5, height: 26, padding: "0 10px", borderRadius: ds.radius.md, border: `1px solid ${ds.border.default}`, backgroundColor: "transparent", cursor: state === "loading" ? "wait" : "pointer", fontSize: 10, fontFamily: "Inter, sans-serif", color: ds.text.secondary }}>
            {state === "loading" ? <Loader2 size={10} className="animate-spin" /> : <Send size={10} />}
            Send test
          </button>
          {state === "ok" && <StatusBadge type="success" text="Delivered" />}
          {state === "fail" && <StatusBadge type="error" text={failMsg} />}
        </div>
      </div>
    </Row>
  );
}

interface Events {
  newCritical: boolean;
  scanComplete: boolean;
  syncComplete: boolean;
  complianceViolation: boolean;
  scanError: boolean;
}

export function NotificationsTab({ onSave }: NotificationsTabProps) {
  const [telegram, setTelegram] = useState("");
  const [slack, setSlack] = useState("");
  const [discord, setDiscord] = useState("");
  const [saving, setSaving] = useState(false);

  const [events, setEvents] = useState<Events>({
    newCritical: true,
    scanComplete: true,
    syncComplete: false,
    complianceViolation: true,
    scanError: true,
  });

  const toggle = (key: keyof Events) => setEvents((p) => ({ ...p, [key]: !p[key] }));

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      onSave("Notification settings saved");
    }, 800);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <SettingsCard title="Notification channels" description="Configure where alerts are sent when events occur">
        <ChannelRow label="Telegram" hint="Bot webhook URL" placeholder="https://api.telegram.org/bot123456:ABC-DEF/sendMessage" value={telegram} onChange={setTelegram} />
        <ChannelRow label="Slack" hint="Incoming webhook URL from your Slack app" placeholder="https://hooks.slack.com/services/T000/B000/xxxx" value={slack} onChange={setSlack} />
        <ChannelRow label="Discord" hint="Webhook URL from your Discord server settings" placeholder="https://discord.com/api/webhooks/000/xxxx" value={discord} onChange={setDiscord} last />
      </SettingsCard>

      <SettingsCard
        title="Events"
        description="Choose which events trigger a notification"
        action={
          <DSButton variant="primary" size="sm" forceState={saving ? "loading" : undefined} onClick={handleSave}>
            Save
          </DSButton>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <EventRow label="New critical finding" hint="Notify immediately when a Critical severity finding is detected" checked={events.newCritical} onChange={() => toggle("newCritical")} priority="critical" />
          <EventRow label="Scan complete" hint="Notify when a scanner task finishes" checked={events.scanComplete} onChange={() => toggle("scanComplete")} />
          <EventRow label="Sync complete" hint="Notify when an Intigriti sync finishes" checked={events.syncComplete} onChange={() => toggle("syncComplete")} />
          <EventRow label="Compliance violation" hint="Notify on compliance policy breaches" checked={events.complianceViolation} onChange={() => toggle("complianceViolation")} priority="high" />
          <EventRow label="Scan error" hint="Notify when a scan fails" checked={events.scanError} onChange={() => toggle("scanError")} priority="high" />
        </div>
      </SettingsCard>
    </div>
  );
}

function EventRow({ label, hint, checked, onChange, priority }: { label: string; hint: string; checked: boolean; onChange: () => void; priority?: "critical" | "high" }) {
  const color = priority === "critical" ? ds.severity.critical : priority === "high" ? ds.severity.high : undefined;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 12,
        padding: "10px 12px",
        backgroundColor: checked ? (priority === "critical" ? `${ds.severity.critical}08` : ds.accent.bg15 + "80") : ds.bg.elevated,
        borderRadius: ds.radius.md,
        border: `1px solid ${checked ? (color ? `${color}30` : ds.border.accent20) : ds.border.default}`,
        cursor: "pointer",
        transition: "all 0.1s ease",
      }}
      onClick={onChange}
    >
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: ds.size.xs, fontWeight: ds.weight.medium, color: ds.text.primary }}>{label}</span>
          {priority && (
            <span style={{ fontSize: 9, fontWeight: ds.weight.bold, textTransform: "uppercase", color: color, backgroundColor: `${color}15`, padding: "1px 5px", borderRadius: 4, letterSpacing: "0.05em" }}>{priority}</span>
          )}
        </div>
        <div style={{ fontSize: 10, color: ds.text.muted, marginTop: 2, lineHeight: 1.5 }}>{hint}</div>
      </div>
      <div
        style={{
          width: 36,
          height: 20,
          borderRadius: 10,
          flexShrink: 0,
          marginTop: 1,
          backgroundColor: checked ? (priority === "critical" ? ds.severity.critical : ds.accent.default) : "rgba(63,63,70,0.8)",
          position: "relative",
          transition: "background 0.2s ease",
        }}
        onClick={(e) => {
          e.stopPropagation();
          onChange();
        }}
      >
        <span style={{ position: "absolute", top: 2, left: checked ? 18 : 2, width: 16, height: 16, borderRadius: "50%", backgroundColor: "#fff", transition: "left 0.2s ease", boxShadow: "0 1px 3px rgba(0,0,0,0.4)", display: "block" }} />
      </div>
    </div>
  );
}
