"use client";

import React, { useState } from "react";
import { Settings, KeyRound, Bell, Code2, ShieldAlert, ChevronRight } from "lucide-react";
import { ds } from "@/components/ds/tokens";
import { ToastContainer, useToast } from "./Toast";
import { GeneralTab } from "./GeneralTab";
import { IntigratiTab } from "./IntigratiTab";
import { NotificationsTab } from "./NotificationsTab";
import { ApiTab } from "./ApiTab";
import { DangerZoneTab } from "./DangerZoneTab";

type Tab = "general" | "intigriti" | "notifications" | "api" | "danger";

const NAV_ITEMS: Array<{ id: Tab; label: string; icon: React.ReactNode; danger?: boolean }> = [
  { id: "general", label: "General", icon: <Settings size={14} /> },
  { id: "intigriti", label: "Intigriti", icon: <KeyRound size={14} /> },
  { id: "notifications", label: "Notifications", icon: <Bell size={14} /> },
  { id: "api", label: "API", icon: <Code2 size={14} /> },
  { id: "danger", label: "Danger Zone", icon: <ShieldAlert size={14} />, danger: true },
];

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("general");
  const { items, show, dismiss } = useToast();

  const handleSave = (msg = "Settings saved") => show(msg, "success");
  const handleError = (msg = "Something went wrong") => show(msg, "error");

  return (
    <>
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: ds.size.xs, color: ds.text.muted }}>Dashboard</span>
          <ChevronRight size={11} style={{ color: ds.text.muted }} />
          <span style={{ fontSize: ds.size.xs, color: ds.text.secondary }}>Settings</span>
        </div>
        <h1 style={{ margin: 0, fontSize: ds.size["3xl"], fontWeight: ds.weight.bold, color: ds.text.primary, lineHeight: 1.2 }}>Settings</h1>
      </div>

      <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
        <nav style={{ width: 200, flexShrink: 0, position: "sticky", top: 24 }}>
          <div style={{ backgroundColor: ds.bg.surface, border: `1px solid ${ds.border.default}`, borderRadius: ds.radius.xl, overflow: "hidden", padding: 4 }}>
            {NAV_ITEMS.map((item) => {
              const isActive = activeTab === item.id;
              const color = item.danger ? (isActive ? ds.severity.critical : ds.text.muted) : isActive ? ds.accent.default : ds.text.secondary;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", height: 34, padding: "0 10px", borderRadius: ds.radius.md, backgroundColor: isActive ? (item.danger ? `${ds.severity.critical}12` : ds.bg.elevated) : "transparent", border: "none", cursor: "pointer", borderLeft: `2px solid ${isActive ? (item.danger ? ds.severity.critical : ds.accent.default) : "transparent"}`, color, fontSize: ds.size.xs, fontWeight: isActive ? ds.weight.semibold : ds.weight.regular, fontFamily: "Inter, sans-serif", textAlign: "left", transition: "all 0.1s ease" }}
                >
                  <span style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>{item.icon}</span>
                  {item.label}
                </button>
              );
            })}
          </div>

          <div style={{ marginTop: 12, padding: "10px 12px", backgroundColor: ds.bg.surface, border: `1px solid ${ds.border.default}`, borderRadius: ds.radius.lg }}>
            <div style={{ fontSize: 9, color: ds.text.muted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>Scanner</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {[{ label: "Version", val: "v3.4.1" }, { label: "Build", val: "a1b2c3d" }, { label: "Engine", val: "EHB-Core 2.1" }].map((r) => (
                <div key={r.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 10, color: ds.text.muted }}>{r.label}</span>
                  <span style={{ fontSize: 10, fontFamily: "monospace", color: ds.text.secondary }}>{r.val}</span>
                </div>
              ))}
            </div>
          </div>
        </nav>

        <div style={{ flex: 1, minWidth: 0 }}>
          {activeTab === "general" && <GeneralTab onSave={handleSave} onError={handleError} />}
          {activeTab === "intigriti" && <IntigratiTab onSave={handleSave} onError={handleError} />}
          {activeTab === "notifications" && <NotificationsTab onSave={handleSave} onError={handleError} />}
          {activeTab === "api" && <ApiTab onSave={handleSave} onError={handleError} />}
          {activeTab === "danger" && <DangerZoneTab onSave={handleSave} onError={handleError} />}
        </div>
      </div>

      <ToastContainer items={items} onDismiss={dismiss} />
    </>
  );
}
