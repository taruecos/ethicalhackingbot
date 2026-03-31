"use client";

import { usePathname } from "next/navigation";
import { Bell, Wifi, WifiOff, Menu } from "lucide-react";
import { useEffect, useState } from "react";
import { useSidebar } from "./sidebar-context";

const PAGE_TITLES: Record<string, string> = {
  "/overview": "Overview",
  "/mission": "Mission Control",
  "/monitor": "Live Monitor",
  "/findings": "Findings",
  "/programs": "Programs",
  "/reports": "Report Builder",
  "/analytics": "Analytics",
};

export function Topbar() {
  const pathname = usePathname();
  const [botOnline, setBotOnline] = useState(false);
  const { toggleMobile } = useSidebar();

  useEffect(() => {
    async function checkBot() {
      try {
        const res = await fetch("/api/status");
        const data = await res.json();
        setBotOnline(data.online);
      } catch {
        setBotOnline(false);
      }
    }
    checkBot();
    const interval = setInterval(checkBot, 15000);
    return () => clearInterval(interval);
  }, []);

  const title = PAGE_TITLES[pathname] || "Dashboard";

  return (
    <header className="sticky top-0 z-40 h-14 bg-[var(--surface)]/80 backdrop-blur-xl border-b border-[var(--border)] flex items-center justify-between px-4 md:px-6">
      <div className="flex items-center gap-3">
        {/* Hamburger — mobile only */}
        <button
          onClick={toggleMobile}
          className="p-2 rounded-lg text-[var(--dim)] hover:text-[var(--text)] hover:bg-[var(--surface2)] transition-colors md:hidden"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <h2 className="text-base md:text-lg font-semibold">{title}</h2>
      </div>

      <div className="flex items-center gap-3 md:gap-4">
        {/* Bot status */}
        <div className="flex items-center gap-1.5 text-xs">
          {botOnline ? (
            <>
              <Wifi className="w-3.5 h-3.5 text-[var(--accent)]" />
              <span className="text-[var(--accent)] hidden sm:inline">Bot Online</span>
            </>
          ) : (
            <>
              <WifiOff className="w-3.5 h-3.5 text-[var(--red)]" />
              <span className="text-[var(--red)] hidden sm:inline">Bot Offline</span>
            </>
          )}
        </div>

        {/* Notifications */}
        <button className="relative p-2 rounded-lg hover:bg-[var(--surface2)] transition-colors">
          <Bell className="w-4 h-4 text-[var(--dim)]" />
        </button>
      </div>
    </header>
  );
}
