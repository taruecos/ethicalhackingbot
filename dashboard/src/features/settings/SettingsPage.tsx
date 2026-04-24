"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { GeneralTab } from "./GeneralTab";
import { ApiTab } from "./ApiTab";
import { IntigratiTab } from "./IntigratiTab";
import { NotificationsTab } from "./NotificationsTab";
import { DangerZoneTab } from "./DangerZoneTab";

type Tab = "general" | "api" | "intigriti" | "notifications" | "danger";

export function SettingsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const activeTab = (searchParams.get("tab") as Tab) || "general";
  const setTab = (t: string) => router.replace(`${pathname}?tab=${t}`, { scroll: false });

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <Tabs value={activeTab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="api">API</TabsTrigger>
          <TabsTrigger value="intigriti">Intigriti</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="danger">Danger zone</TabsTrigger>
        </TabsList>
        <TabsContent value="general"><GeneralTab /></TabsContent>
        <TabsContent value="api"><ApiTab /></TabsContent>
        <TabsContent value="intigriti"><IntigratiTab /></TabsContent>
        <TabsContent value="notifications"><NotificationsTab /></TabsContent>
        <TabsContent value="danger"><DangerZoneTab /></TabsContent>
      </Tabs>
    </div>
  );
}
