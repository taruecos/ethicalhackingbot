"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
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

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Programs</h1>
      </div>

      <Tabs value={activeTab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="synced">Synced</TabsTrigger>
          <TabsTrigger value="live">Live</TabsTrigger>
          <TabsTrigger value="activities">Activities</TabsTrigger>
          <TabsTrigger value="payouts">Payouts</TabsTrigger>
        </TabsList>
        <TabsContent value="synced"><SyncedTab syncingExternal={false} /></TabsContent>
        <TabsContent value="live"><LiveTab /></TabsContent>
        <TabsContent value="activities"><ActivitiesTab /></TabsContent>
        <TabsContent value="payouts"><PayoutsTab /></TabsContent>
      </Tabs>
    </div>
  );
}
