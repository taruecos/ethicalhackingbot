"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Globe,
  ScanLine,
  Bug,
  Settings,
  Search,
  Bell,
  ChevronLeft,
  ChevronRight,
  Shield,
  ChevronDown,
} from "lucide-react";
import { ds } from "@/components/ds/tokens";

const NAV_ITEMS = [
  { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { path: "/programs", label: "Programs", icon: Globe },
  { path: "/scans", label: "Scans", icon: ScanLine },
  { path: "/findings", label: "Findings", icon: Bug },
  { path: "/settings", label: "Settings", icon: Settings },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [hoveredNav, setHoveredNav] = useState<string | null>(null);
  const pathname = usePathname();

  const sidebarW = collapsed ? 64 : 240;

  const isActivePath = (p: string) => pathname === p || pathname.startsWith(p + "/");

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        backgroundColor: ds.bg.base,
        fontFamily: "Inter, sans-serif",
      }}
    >
      <aside
        style={{
          width: sidebarW,
          flexShrink: 0,
          backgroundColor: ds.bg.surface,
          borderRight: `1px solid ${ds.border.default}`,
          display: "flex",
          flexDirection: "column",
          position: "sticky",
          top: 0,
          height: "100vh",
          overflow: "hidden",
          transition: "width 0.2s ease",
          zIndex: 20,
        }}
      >
        <div
          style={{
            padding: collapsed ? "18px 18px 16px" : "18px 16px 16px",
            borderBottom: `1px solid ${ds.border.default}`,
            display: "flex",
            alignItems: "center",
            justifyContent: collapsed ? "center" : "flex-start",
            gap: 10,
            minHeight: 64,
          }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: ds.radius.md,
              backgroundColor: ds.accent.default,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Shield size={14} style={{ color: "#000" }} />
          </div>
          {!collapsed && (
            <div>
              <div
                style={{
                  fontSize: ds.size.sm,
                  fontWeight: ds.weight.semibold,
                  color: ds.text.primary,
                  lineHeight: 1.2,
                  whiteSpace: "nowrap",
                }}
              >
                EHB Scanner
              </div>
              <div
                style={{
                  fontSize: ds.size.xs,
                  color: ds.text.muted,
                  lineHeight: 1.3,
                  whiteSpace: "nowrap",
                }}
              >
                Bug Bounty Platform
              </div>
            </div>
          )}
        </div>

        <nav style={{ padding: "10px 8px", flex: 1 }}>
          {!collapsed && (
            <div
              style={{
                fontSize: ds.size.xs,
                fontWeight: ds.weight.semibold,
                color: ds.text.muted,
                padding: "6px 8px 8px",
                textTransform: "uppercase",
                letterSpacing: "0.07em",
              }}
            >
              Navigation
            </div>
          )}
          {NAV_ITEMS.map(({ path, label, icon: Icon }) => {
            const isActive = isActivePath(path);
            return (
              <Link
                key={path}
                href={path}
                title={collapsed ? label : undefined}
                onMouseEnter={() => setHoveredNav(path)}
                onMouseLeave={() => setHoveredNav(null)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: collapsed ? "9px 0" : "7px 8px",
                  borderRadius: ds.radius.md,
                  fontSize: ds.size.sm,
                  fontWeight: isActive ? ds.weight.medium : ds.weight.regular,
                  color: isActive
                    ? ds.text.primary
                    : hoveredNav === path
                    ? ds.text.primary
                    : ds.text.secondary,
                  backgroundColor: isActive
                    ? "rgba(39,39,42,0.35)"
                    : hoveredNav === path
                    ? "rgba(39,39,42,0.2)"
                    : "transparent",
                  textDecoration: "none",
                  marginBottom: 2,
                  transition: "all 0.1s ease",
                  justifyContent: collapsed ? "center" : "space-between",
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Icon
                    size={15}
                    style={{
                      color: isActive
                        ? ds.accent.default
                        : hoveredNav === path
                        ? ds.text.secondary
                        : ds.text.muted,
                      flexShrink: 0,
                      transition: "color 0.1s ease",
                    }}
                  />
                  {!collapsed && label}
                </span>
                {!collapsed && isActive && (
                  <ChevronRight size={11} style={{ color: ds.text.muted }} />
                )}
              </Link>
            );
          })}
        </nav>

        <div style={{ borderTop: `1px solid ${ds.border.default}`, padding: "8px" }}>
          {!collapsed ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "7px 8px",
                borderRadius: ds.radius.md,
                cursor: "pointer",
                marginBottom: 4,
              }}
            >
              <div
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: "50%",
                  backgroundColor: ds.accent.bg20,
                  border: `1px solid ${ds.border.accent20}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: ds.weight.semibold,
                    color: ds.accent.default,
                  }}
                >
                  JD
                </span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: ds.size.xs,
                    fontWeight: ds.weight.medium,
                    color: ds.text.primary,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  j.doe@sec.io
                </div>
                <div style={{ fontSize: ds.size.xs, color: ds.text.muted }}>Pro Plan</div>
              </div>
              <ChevronDown size={11} style={{ color: ds.text.muted }} />
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                marginBottom: 4,
                padding: "7px 0",
              }}
            >
              <div
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: "50%",
                  backgroundColor: ds.accent.bg20,
                  border: `1px solid ${ds.border.accent20}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span style={{ fontSize: 10, fontWeight: ds.weight.semibold, color: ds.accent.default }}>JD</span>
              </div>
            </div>
          )}

          <button
            onClick={() => setCollapsed(!collapsed)}
            style={{
              width: "100%",
              height: 30,
              display: "flex",
              alignItems: "center",
              justifyContent: collapsed ? "center" : "flex-start",
              paddingLeft: collapsed ? 0 : 8,
              gap: 6,
              borderRadius: ds.radius.md,
              border: "none",
              backgroundColor: "transparent",
              color: ds.text.muted,
              cursor: "pointer",
              fontSize: ds.size.xs,
            }}
          >
            {collapsed ? (
              <ChevronRight size={13} />
            ) : (
              <>
                <ChevronLeft size={13} />
                <span>Collapse</span>
              </>
            )}
          </button>
        </div>
      </aside>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <header
          style={{
            height: 56,
            flexShrink: 0,
            borderBottom: `1px solid ${ds.border.default}`,
            display: "flex",
            alignItems: "center",
            padding: "0 20px",
            gap: 12,
            backgroundColor: ds.bg.surface,
            position: "sticky",
            top: 0,
            zIndex: 10,
          }}
        >
          <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                width: "100%",
                maxWidth: 460,
                height: 33,
                padding: "0 10px",
                backgroundColor: ds.bg.elevated,
                borderRadius: ds.radius.md,
                border: `1px solid ${ds.border.default}`,
                cursor: "text",
              }}
            >
              <Search size={13} style={{ color: ds.text.muted, flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: ds.size.sm, color: ds.text.muted }}>
                Search scans, findings, programs...
              </span>
              <kbd
                style={{
                  fontSize: ds.size.xs,
                  color: ds.text.muted,
                  padding: "2px 5px",
                  backgroundColor: ds.bg.surface,
                  border: `1px solid ${ds.border.zinc50}`,
                  borderRadius: 4,
                  fontFamily: "Inter, sans-serif",
                }}
              >
                ⌘K
              </kbd>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              style={{
                width: 33,
                height: 33,
                borderRadius: ds.radius.md,
                border: `1px solid ${ds.border.default}`,
                backgroundColor: "transparent",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                position: "relative",
              }}
            >
              <Bell size={14} style={{ color: ds.text.secondary }} />
              <span
                style={{
                  position: "absolute",
                  top: 6,
                  right: 7,
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  backgroundColor: ds.severity.critical,
                  border: `1.5px solid ${ds.bg.surface}`,
                }}
              />
            </button>

            <div
              style={{
                width: 33,
                height: 33,
                borderRadius: "50%",
                backgroundColor: ds.accent.bg20,
                border: `1px solid ${ds.border.accent20}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  fontSize: ds.size.xs,
                  fontWeight: ds.weight.semibold,
                  color: ds.accent.default,
                }}
              >
                JD
              </span>
            </div>
          </div>
        </header>

        <main style={{ flex: 1, overflowY: "auto", padding: 32 }}>
          <div style={{ maxWidth: 1440, margin: "0 auto" }}>{children}</div>
        </main>
      </div>
    </div>
  );
}
