"use client";

import { useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { SyncedTab } from "./SyncedTab";
import { LiveTab } from "./LiveTab";
import { ActivitiesTab } from "./ActivitiesTab";
import { PayoutsTab } from "./PayoutsTab";

type Tab = "synced" | "live" | "activities" | "payouts";

export function ProgramsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const activeTab = (searchParams.get("tab") as Tab) || "synced";
  const setTab = (t: string) => router.replace(`${pathname}?tab=${t}`, { scroll: false });

  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncInfo, setSyncInfo] = useState<string | null>(null);

  const startSync = async () => {
    if (syncing) return;
    setSyncing(true); setSyncError(null); setSyncInfo(null);
    try {
      const res = await fetch("/api/programs/sync", { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
      setSyncInfo(`Synced ${json.synced ?? 0}/${json.total ?? 0}`);
    } catch (e) {
      setSyncError(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="p-6 space-y-4">
      {syncError && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">{syncError}</div>
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Programs</h1>
        <div className="flex items-center gap-3">
          {syncInfo && <span className="text-xs text-primary">✓ {syncInfo}</span>}
          <Button onClick={startSync} disabled={syncing} size="sm">
            {syncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            {syncing ? "Syncing…" : "Sync Intigriti"}
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="synced">Synced</TabsTrigger>
          <TabsTrigger value="live">Live</TabsTrigger>
          <TabsTrigger value="activities">Activities</TabsTrigger>
          <TabsTrigger value="payouts">Payouts</TabsTrigger>
        </TabsList>
        <TabsContent value="synced"><SyncedTab syncingExternal={syncing} /></TabsContent>
        <TabsContent value="live"><LiveTab /></TabsContent>
        <TabsContent value="activities"><ActivitiesTab /></TabsContent>
        <TabsContent value="payouts"><PayoutsTab /></TabsContent>
      </Tabs>
    </div>
  );
}
