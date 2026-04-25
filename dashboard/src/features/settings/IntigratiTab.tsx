"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

interface ConfigResponse {
  token: string;
  hasToken: boolean;
  autoSync: boolean;
  syncInterval: number;
  updatedAt?: string;
  error?: string;
}

export function IntigratiTab() {
  const [token, setToken] = useState("");
  const [hasToken, setHasToken] = useState(false);
  const [autoSync, setAutoSync] = useState(true);
  const [syncInterval, setSyncInterval] = useState(15);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/settings/intigriti", { cache: "no-store" });
        const json: ConfigResponse = await res.json();
        if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
        setToken(json.token);
        setHasToken(json.hasToken);
        setAutoSync(json.autoSync);
        setSyncInterval(json.syncInterval);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const save = async () => {
    setSaving(true); setError(null);
    try {
      const payload: Record<string, unknown> = { autoSync, syncInterval };
      if (token && !token.includes("*")) payload.token = token;
      const res = await fetch("/api/settings/intigriti", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json: ConfigResponse = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setToken(json.token);
      setHasToken(json.hasToken);
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
      setStatus("error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="pt-4 space-y-4 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Intigriti</CardTitle>
          <CardDescription>
            Token Researcher API stocké en DB (table <code>IntigritiConfig</code>). Génère-le sur{" "}
            <a href="https://app.intigriti.com" target="_blank" rel="noreferrer" className="underline">app.intigriti.com</a>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {error && <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
          <div>
            <Label htmlFor="token">Researcher token {hasToken && <span className="text-xs text-muted-foreground">(set)</span>}</Label>
            <Input
              id="token"
              type="password"
              value={token}
              onChange={e => setToken(e.target.value)}
              placeholder={hasToken ? "•••• déjà configuré, recoller pour changer" : "Paste your Intigriti API token"}
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground mt-1">Le token affiché est masqué côté serveur. Recolle un nouveau token pour le remplacer.</p>
          </div>
          <label className="flex items-center justify-between pt-2">
            <div>
              <p className="text-sm font-medium">Auto-sync programs</p>
              <p className="text-xs text-muted-foreground">Rafraîchir la liste des programmes automatiquement.</p>
            </div>
            <Switch checked={autoSync} onCheckedChange={setAutoSync} disabled={loading} />
          </label>
          <div>
            <Label htmlFor="interval">Sync interval (minutes)</Label>
            <Input
              id="interval"
              type="number"
              min={5}
              max={1440}
              value={syncInterval}
              onChange={e => setSyncInterval(Number(e.target.value) || 15)}
              disabled={!autoSync || loading}
            />
          </div>
          <Button onClick={save} disabled={saving || loading}>
            {saving ? "Saving…" : status === "saved" ? "✓ Saved" : "Save"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
