"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

interface Events {
  newCritical: boolean;
  scanComplete: boolean;
  syncComplete: boolean;
  complianceViolation: boolean;
  scanError: boolean;
}

export function NotificationsTab() {
  const [telegram, setTelegram] = useState("");
  const [slack, setSlack] = useState("");
  const [discord, setDiscord] = useState("");
  const [events, setEvents] = useState<Events>({
    newCritical: true, scanComplete: true, syncComplete: false,
    complianceViolation: true, scanError: true,
  });
  const [saved, setSaved] = useState(false);

  const save = () => { setSaved(true); setTimeout(() => setSaved(false), 2000); };
  const toggle = (k: keyof Events) => setEvents(p => ({ ...p, [k]: !p[k] }));

  return (
    <div className="pt-4 space-y-4 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Channels</CardTitle>
          <CardDescription>Webhooks — pas encore persistés, backend à brancher sur /api/settings/notifications.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div><Label htmlFor="tg">Telegram bot webhook</Label><Input id="tg" value={telegram} onChange={e => setTelegram(e.target.value)} placeholder="https://api.telegram.org/bot…/sendMessage" /></div>
          <div><Label htmlFor="sl">Slack webhook</Label><Input id="sl" value={slack} onChange={e => setSlack(e.target.value)} placeholder="https://hooks.slack.com/services/…" /></div>
          <div><Label htmlFor="ds">Discord webhook</Label><Input id="ds" value={discord} onChange={e => setDiscord(e.target.value)} placeholder="https://discord.com/api/webhooks/…" /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Events</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <EventRow label="New critical finding" hint="Notify immediately on critical severity" checked={events.newCritical} onChange={() => toggle("newCritical")} priority="critical" />
          <EventRow label="Scan complete" hint="When a scan finishes" checked={events.scanComplete} onChange={() => toggle("scanComplete")} />
          <EventRow label="Sync complete" hint="When an Intigriti sync finishes" checked={events.syncComplete} onChange={() => toggle("syncComplete")} />
          <EventRow label="Compliance violation" hint="When a scope violation is detected" checked={events.complianceViolation} onChange={() => toggle("complianceViolation")} priority="high" />
          <EventRow label="Scan error" hint="When a scan fails" checked={events.scanError} onChange={() => toggle("scanError")} priority="high" />
          <Button onClick={save}>{saved ? "✓ Saved" : "Save"}</Button>
        </CardContent>
      </Card>
    </div>
  );
}

function EventRow({ label, hint, checked, onChange, priority }: { label: string; hint: string; checked: boolean; onChange: () => void; priority?: "critical" | "high" }) {
  return (
    <label className="flex items-start justify-between rounded-md border p-3 cursor-pointer hover:bg-accent/30">
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{label}</span>
          {priority && <Badge variant={priority === "critical" ? "destructive" : "outline"} className="text-[10px]">{priority}</Badge>}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}
