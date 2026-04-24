"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ComposeTab } from "./ComposeTab";
import { ActiveTab } from "./ActiveTab";
import { HistoryTab } from "./HistoryTab";

type Tab = "compose" | "active" | "history";

export function ScansPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const activeTab = (searchParams.get("tab") as Tab) || "compose";
  const setTab = (t: string) => router.replace(`${pathname}?tab=${t}`, { scroll: false });

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Scans</h1>
      <Tabs value={activeTab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="compose">Compose</TabsTrigger>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>
        <TabsContent value="compose"><ComposeTab /></TabsContent>
        <TabsContent value="active"><ActiveTab /></TabsContent>
        <TabsContent value="history"><HistoryTab /></TabsContent>
      </Tabs>
    </div>
  );
}
