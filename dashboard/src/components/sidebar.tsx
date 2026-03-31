"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Crosshair,
  Activity,
  AlertTriangle,
  Globe,
  FileText,
  BarChart3,
  LogOut,
  Bug,
  Terminal,
  ChevronsLeft,
  ChevronsRight,
  X,
} from "lucide-react";
import { useSidebar } from "./sidebar-context";

const NAV = [
  { href: "/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/mission", label: "Mission Control", icon: Crosshair },
  { href: "/monitor", label: "Live Monitor", icon: Activity },
  { href: "/findings", label: "Findings", icon: AlertTriangle },
  { href: "/programs", label: "Programs", icon: Globe },
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/terminal", label: "AI Terminal", icon: Terminal },
] as const;

export function Sidebar() {
  const pathname = usePathname();
  const { collapsed, toggle, mobileOpen, closeMobile } = useSidebar();

  const handleNavClick = () => {
    closeMobile();
  };

  const sidebarContent = (isMobile: boolean) => (
    <>
      {/* Logo */}
      <div className="px-3 py-5 flex items-center gap-3 border-b border-[var(--border)] min-h-[68px]">
        <div className="w-9 h-9 rounded-lg bg-[var(--accent-dim)] flex items-center justify-center shrink-0">
          <Bug className="w-5 h-5 text-[var(--accent)]" />
        </div>
        {(!collapsed || isMobile) && (
          <div className="flex-1">
            <h1 className="text-sm font-bold text-[var(--text)]">BugBountyBot</h1>
            <p className="text-[10px] text-[var(--dim)] uppercase tracking-wider">Dashboard</p>
          </div>
        )}
        {isMobile && (
          <button
            onClick={closeMobile}
            className="p-1.5 rounded-lg text-[var(--dim)] hover:text-[var(--text)] hover:bg-[var(--surface2)]"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-4 space-y-1">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              onClick={handleNavClick}
              title={collapsed && !isMobile ? label : undefined}
              className={`flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-all ${
                active
                  ? "bg-[var(--accent-dim)] text-[var(--accent)]"
                  : "text-[var(--dim)] hover:text-[var(--text)] hover:bg-[var(--surface2)]"
              } ${collapsed && !isMobile ? "justify-center px-0" : ""}`}
            >
              <Icon className="w-[18px] h-[18px] shrink-0" />
              {(!collapsed || isMobile) && label}
            </Link>
          );
        })}
      </nav>

      {/* Collapse toggle — desktop only */}
      {!isMobile && (
        <div className="px-2 py-2">
          <button
            onClick={toggle}
            className="flex items-center justify-center w-full py-2 rounded-lg text-[var(--dim)] hover:text-[var(--text)] hover:bg-[var(--surface2)] transition-all"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <ChevronsRight className="w-[18px] h-[18px]" />
            ) : (
              <ChevronsLeft className="w-[18px] h-[18px]" />
            )}
          </button>
        </div>
      )}

      {/* Footer */}
      <div className="px-2 py-4 border-t border-[var(--border)]">
        <button
          onClick={() => {
            document.cookie = "auth_token=; path=/; max-age=0";
            window.location.href = "/login";
          }}
          title={collapsed && !isMobile ? "Logout" : undefined}
          className={`flex items-center gap-3 px-3 py-3 rounded-lg text-sm text-[var(--dim)] hover:text-[var(--red)] hover:bg-[var(--surface2)] transition-all w-full ${
            collapsed && !isMobile ? "justify-center px-0" : ""
          }`}
        >
          <LogOut className="w-[18px] h-[18px] shrink-0" />
          {(!collapsed || isMobile) && "Logout"}
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 md:hidden"
          onClick={closeMobile}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={`fixed left-0 top-0 h-screen w-[280px] bg-[var(--surface)] border-r border-[var(--border)] flex flex-col z-50 transition-transform duration-300 md:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {sidebarContent(true)}
      </aside>

      {/* Desktop sidebar */}
      <aside
        className={`hidden md:flex fixed left-0 top-0 h-screen bg-[var(--surface)] border-r border-[var(--border)] flex-col z-50 transition-all duration-200 ${
          collapsed ? "w-[60px]" : "w-[240px]"
        }`}
      >
        {sidebarContent(false)}
      </aside>
    </>
  );
}
