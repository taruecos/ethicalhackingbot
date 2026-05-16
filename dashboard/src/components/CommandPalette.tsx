"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  LayoutDashboard,
  Globe,
  ScanLine,
  Bug,
  Settings,
  Plus,
  History,
  KeyRound,
  Bell,
  ShieldAlert,
  X,
} from "lucide-react";
import { ds } from "@/components/ds/tokens";

type Item = {
  id: string;
  label: string;
  hint?: string;
  href: string;
  icon: React.ReactNode;
  keywords: string;
  group: string;
};

const ITEMS: Item[] = [
  { id: "dashboard", label: "Dashboard", hint: "Overview & analytics", href: "/dashboard", icon: <LayoutDashboard size={14} />, keywords: "dashboard home overview analytics today historical", group: "Navigation" },
  { id: "programs", label: "Programs", hint: "Bug bounty programs", href: "/programs", icon: <Globe size={14} />, keywords: "programs bounty intigriti synced live activities payouts", group: "Navigation" },
  { id: "scans", label: "Scans", hint: "Active & historical scans", href: "/scans", icon: <ScanLine size={14} />, keywords: "scans scanner active history", group: "Navigation" },
  { id: "findings", label: "Findings", hint: "All vulnerabilities", href: "/findings", icon: <Bug size={14} />, keywords: "findings vulnerabilities bugs critical high medium low", group: "Navigation" },
  { id: "settings", label: "Settings", hint: "Account & integrations", href: "/settings", icon: <Settings size={14} />, keywords: "settings account profile preferences", group: "Navigation" },

  { id: "new-scan", label: "Launch a new scan", hint: "Open compose form", href: "/scans?tab=compose", icon: <Plus size={14} />, keywords: "new scan launch compose create start", group: "Actions" },
  { id: "scan-history", label: "Scan history", hint: "Past scan runs", href: "/scans?tab=history", icon: <History size={14} />, keywords: "history past scans completed cancelled error", group: "Actions" },
  { id: "api-tokens", label: "API tokens", hint: "Create or revoke tokens", href: "/settings", icon: <KeyRound size={14} />, keywords: "api tokens webhook integrations", group: "Actions" },
  { id: "notifications", label: "Notifications", hint: "Webhooks & alerts", href: "/settings", icon: <Bell size={14} />, keywords: "notifications webhooks slack telegram discord", group: "Actions" },
  { id: "danger", label: "Danger zone", hint: "Purge findings & account", href: "/settings", icon: <ShieldAlert size={14} />, keywords: "danger zone purge delete account", group: "Actions" },
];

interface Props {
  open: boolean;
  onClose: () => void;
}

export function CommandPalette({ open, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ITEMS;
    return ITEMS.filter(
      (i) =>
        i.label.toLowerCase().includes(q) ||
        (i.hint?.toLowerCase().includes(q) ?? false) ||
        i.keywords.includes(q) ||
        i.keywords.split(/\s+/).some((k) => k.startsWith(q)),
    );
  }, [query]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActiveIndex(0);
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => Math.min(filtered.length - 1, i + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => Math.max(0, i - 1));
      } else if (e.key === "Enter") {
        const item = filtered[activeIndex];
        if (item) {
          e.preventDefault();
          onClose();
          router.push(item.href);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, filtered, activeIndex, onClose, router]);

  if (!open) return null;

  const groups = filtered.reduce<Record<string, Item[]>>((acc, item) => {
    (acc[item.group] = acc[item.group] || []).push(item);
    return acc;
  }, {});

  let runningIndex = -1;

  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        backgroundColor: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "10vh 16px 16px",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 560,
          backgroundColor: ds.bg.surface,
          border: `1px solid ${ds.border.default}`,
          borderRadius: ds.radius.xl,
          boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          maxHeight: "min(560px, 80vh)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderBottom: `1px solid ${ds.border.default}` }}>
          <Search size={15} style={{ color: ds.text.muted, flexShrink: 0 }} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search pages, actions, settings…"
            aria-label="Search"
            style={{
              flex: 1,
              height: 28,
              backgroundColor: "transparent",
              border: "none",
              outline: "none",
              color: ds.text.primary,
              fontSize: ds.size.sm,
              fontFamily: "Inter, sans-serif",
            }}
          />
          <button
            onClick={onClose}
            aria-label="Close palette"
            style={{
              width: 22,
              height: 22,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: ds.radius.md,
              border: "none",
              backgroundColor: "transparent",
              cursor: "pointer",
              color: ds.text.muted,
            }}
          >
            <X size={13} />
          </button>
        </div>

        <div ref={listRef} style={{ flex: 1, overflowY: "auto", padding: "6px 0" }}>
          {filtered.length === 0 ? (
            <div style={{ padding: "32px 20px", textAlign: "center", color: ds.text.muted, fontSize: ds.size.sm }}>
              No results for &quot;{query}&quot;
            </div>
          ) : (
            Object.entries(groups).map(([group, items]) => (
              <div key={group}>
                <div style={{ padding: "8px 14px 4px", fontSize: 10, color: ds.text.muted, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: ds.weight.semibold }}>
                  {group}
                </div>
                {items.map((item) => {
                  runningIndex += 1;
                  const isActive = runningIndex === activeIndex;
                  return (
                    <Link
                      key={item.id}
                      href={item.href}
                      onClick={onClose}
                      style={{ textDecoration: "none" }}
                    >
                      <div
                        onMouseEnter={() => setActiveIndex(runningIndex)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "8px 14px",
                          backgroundColor: isActive ? ds.accent.bg15 : "transparent",
                          borderLeft: `2px solid ${isActive ? ds.accent.default : "transparent"}`,
                          cursor: "pointer",
                        }}
                      >
                        <span style={{ color: isActive ? ds.accent.default : ds.text.muted, display: "flex" }}>{item.icon}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: ds.size.sm, color: ds.text.primary, fontWeight: ds.weight.medium }}>{item.label}</div>
                          {item.hint && (
                            <div style={{ fontSize: 10, color: ds.text.muted, marginTop: 1 }}>{item.hint}</div>
                          )}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 14px", borderTop: `1px solid ${ds.border.default}`, backgroundColor: ds.bg.elevated, fontSize: 10, color: ds.text.muted }}>
          <div style={{ display: "flex", gap: 12 }}>
            <span><kbd style={kbd}>↑↓</kbd> navigate</span>
            <span><kbd style={kbd}>↵</kbd> open</span>
            <span><kbd style={kbd}>esc</kbd> close</span>
          </div>
          <span>{filtered.length} result{filtered.length === 1 ? "" : "s"}</span>
        </div>
      </div>
    </div>
  );
}

const kbd: React.CSSProperties = {
  fontFamily: "Inter, sans-serif",
  fontSize: 10,
  padding: "1px 4px",
  borderRadius: 3,
  backgroundColor: ds.bg.surface,
  border: `1px solid ${ds.border.default}`,
  marginRight: 3,
};
