"use client";

import React, { useState, forwardRef } from "react";
import { ds } from "@/components/ds/tokens";

interface SettingsCardProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  danger?: boolean;
  action?: React.ReactNode;
}

export function SettingsCard({ title, description, children, danger, action }: SettingsCardProps) {
  return (
    <div style={{ backgroundColor: ds.bg.surface, border: `1px solid ${danger ? `${ds.severity.critical}50` : ds.border.default}`, borderRadius: ds.radius.xl, overflow: "hidden" }}>
      <div style={{ padding: "14px 20px", borderBottom: `1px solid ${danger ? `${ds.severity.critical}30` : ds.border.default}`, backgroundColor: danger ? `${ds.severity.critical}08` : "transparent", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontSize: ds.size.sm, fontWeight: ds.weight.semibold, color: danger ? ds.severity.critical : ds.text.primary }}>{title}</div>
          {description && <div style={{ fontSize: ds.size.xs, color: ds.text.muted, marginTop: 3, lineHeight: 1.5 }}>{description}</div>}
        </div>
        {action}
      </div>
      <div style={{ padding: "20px" }}>{children}</div>
    </div>
  );
}

export function SettingsRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20, paddingBottom: 16, marginBottom: 16, borderBottom: `1px solid ${ds.border.default}` }}>
      <div style={{ flex: "0 0 180px" }}>
        <div style={{ fontSize: ds.size.xs, fontWeight: ds.weight.medium, color: ds.text.secondary }}>{label}</div>
        {hint && <div style={{ fontSize: 10, color: ds.text.muted, marginTop: 3, lineHeight: 1.5 }}>{hint}</div>}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
    </div>
  );
}

export function SettingsRowLast({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20 }}>
      <div style={{ flex: "0 0 180px" }}>
        <div style={{ fontSize: ds.size.xs, fontWeight: ds.weight.medium, color: ds.text.secondary }}>{label}</div>
        {hint && <div style={{ fontSize: 10, color: ds.text.muted, marginTop: 3, lineHeight: 1.5 }}>{hint}</div>}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
    </div>
  );
}

interface FormInputProps {
  value: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  disabled?: boolean;
  type?: string;
  monospace?: boolean;
  rightElement?: React.ReactNode;
  style?: React.CSSProperties;
}

export const FormInput = forwardRef<HTMLInputElement, FormInputProps>(function FormInput({ value, onChange, placeholder, readOnly, disabled, type = "text", monospace, rightElement, style }, ref) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
      <input
        ref={ref}
        type={type}
        value={value}
        readOnly={readOnly}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{ width: "100%", height: 34, boxSizing: "border-box", padding: `0 ${rightElement ? 80 : 10}px 0 10px`, backgroundColor: readOnly || disabled ? ds.bg.base : ds.bg.elevated, border: `1px solid ${focused ? ds.accent.default : ds.border.default}`, borderRadius: ds.radius.md, fontSize: ds.size.xs, fontFamily: monospace ? "monospace" : "Inter, sans-serif", color: readOnly ? ds.text.muted : ds.text.primary, outline: "none", cursor: readOnly ? "default" : "text", opacity: disabled ? 0.4 : 1, ...style }}
      />
      {rightElement && <div style={{ position: "absolute", right: 6, display: "flex", gap: 4, alignItems: "center" }}>{rightElement}</div>}
    </div>
  );
});

export function FormSelect({ value, onChange, options, disabled }: { value: string; onChange: (v: string) => void; options: Array<{ value: string; label: string }>; disabled?: boolean }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      style={{ height: 34, padding: "0 10px", backgroundColor: ds.bg.elevated, border: `1px solid ${ds.border.default}`, borderRadius: ds.radius.md, fontSize: ds.size.xs, fontFamily: "Inter, sans-serif", color: ds.text.primary, outline: "none", cursor: disabled ? "not-allowed" : "pointer", appearance: "none", WebkitAppearance: "none", backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6' fill='none'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%2371717a' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center", paddingRight: 28, opacity: disabled ? 0.4 : 1 }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value} style={{ backgroundColor: ds.bg.elevated }}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button onClick={() => !disabled && onChange(!checked)} type="button" style={{ width: 40, height: 22, borderRadius: 11, flexShrink: 0, backgroundColor: checked ? ds.accent.default : "rgba(63,63,70,0.8)", border: "none", cursor: disabled ? "not-allowed" : "pointer", position: "relative", transition: "background 0.2s ease", opacity: disabled ? 0.4 : 1 }}>
      <span style={{ position: "absolute", top: 3, left: checked ? 21 : 3, width: 16, height: 16, borderRadius: "50%", backgroundColor: "#fff", transition: "left 0.2s ease", boxShadow: "0 1px 3px rgba(0,0,0,0.4)", display: "block" }} />
    </button>
  );
}

export function Checkbox({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", userSelect: "none" }} onClick={() => onChange(!checked)}>
      <div style={{ width: 16, height: 16, borderRadius: 4, flexShrink: 0, marginTop: 1, backgroundColor: checked ? ds.accent.default : "transparent", border: `1.5px solid ${checked ? ds.accent.default : "rgba(113,113,122,0.5)"}`, display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.1s ease" }}>
        {checked && (
          <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
            <path d="M1 3.5L3.5 6L8 1" stroke="#000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
      <div>
        <div style={{ fontSize: ds.size.xs, fontWeight: ds.weight.medium, color: ds.text.secondary }}>{label}</div>
        {hint && <div style={{ fontSize: 10, color: ds.text.muted, marginTop: 2 }}>{hint}</div>}
      </div>
    </label>
  );
}

export function StatusBadge({ type, text }: { type: "success" | "error" | "warning"; text: string }) {
  const color = type === "success" ? ds.accent.default : type === "error" ? ds.severity.critical : ds.severity.high;
  const bg = type === "success" ? ds.accent.bg15 : type === "error" ? ds.severity.criticalBg : ds.severity.highBg;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, height: 24, padding: "0 8px", backgroundColor: bg, borderRadius: ds.radius.md, border: `1px solid ${color}40`, fontSize: ds.size.xs, fontWeight: ds.weight.semibold, color, whiteSpace: "nowrap" }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: color, flexShrink: 0 }} />
      {text}
    </span>
  );
}

export function HR() {
  return <div style={{ height: 1, backgroundColor: ds.border.default, margin: "16px 0" }} />;
}
