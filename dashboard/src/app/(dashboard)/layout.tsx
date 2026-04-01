"use client";

import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import { SidebarProvider, useSidebar } from "@/components/sidebar-context";
import { ProgramsProvider } from "@/components/programs-context";

function DashboardContent({ children }: { children: React.ReactNode }) {
  const { collapsed } = useSidebar();
  return (
    <div className="min-h-screen">
      <Sidebar />
      {/* On mobile: no left margin (sidebar is an overlay drawer).
          On desktop: shift content right based on collapsed state. */}
      <div
        className={`transition-all duration-200 ${
          collapsed ? "md:ml-[60px]" : "md:ml-[240px]"
        }`}
      >
        <Topbar />
        <main className="p-3 sm:p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProgramsProvider>
      <SidebarProvider>
        <DashboardContent>{children}</DashboardContent>
      </SidebarProvider>
    </ProgramsProvider>
  );
}
