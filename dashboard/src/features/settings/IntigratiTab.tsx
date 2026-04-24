"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export function IntigratiTab() {
  const [token, setToken] = useState("");
  const [autoSync, setAutoSync] = useState(true);
  const [syncInterval, setSyncInterval] = useState(15);
  const [saved, setSaved] = useState(false);

  const save = () => { setSaved(true); setTimeout(() => setSaved(false), 2000); };

  return (
    <div className="pt-4 space-y-4 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Intigriti</CardTitle>
          <CardDescription>Config du client Intigriti. Le token est stocké côté serveur via `.env.docker`.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label htmlFor="token">Researcher token</Label>
            <Input id="token" type="password" value={token} onChange={e => setToken(e.target.value)} placeholder="Paste your Intigriti API token" />
            <p className="text-xs text-muted-foreground mt-1">Pour l'instant, configure via `INTIGRITI_TOKEN` dans l'env. Ce champ sera branché quand on aura une route /api/settings/intigriti.</p>
          </div>
          <label className="flex items-center justify-between pt-2">
            <div>
              <p className="text-sm font-medium">Auto-sync programs</p>
              <p className="text-xs text-muted-foreground">Rafraîchir la liste des programmes automatiquement.</p>
            </div>
            <Switch checked={autoSync} onCheckedChange={setAutoSync} />
          </label>
          <div>
            <Label htmlFor="interval">Sync interval (minutes)</Label>
            <Input id="interval" type="number" min={5} max={1440} value={syncInterval} onChange={e => setSyncInterval(Number(e.target.value) || 15)} disabled={!autoSync} />
          </div>
          <Button onClick={save}>{saved ? "✓ Saved" : "Save"}</Button>
        </CardContent>
      </Card>
    </div>
  );
}
