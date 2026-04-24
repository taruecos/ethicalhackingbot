"use client";

import { useState } from "react";
import { Plus, Trash2, Copy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

interface Key { id: string; label: string; token: string; createdAt: string; }

function generateToken(): string {
  return "ehb_" + Array.from(crypto.getRandomValues(new Uint8Array(24))).map(b => b.toString(36).padStart(2, "0")).join("").slice(0, 40);
}

export function ApiTab() {
  const [keys, setKeys] = useState<Key[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newToken, setNewToken] = useState<string | null>(null);

  const create = () => {
    if (!newLabel.trim()) return;
    const token = generateToken();
    setKeys(prev => [...prev, { id: String(Date.now()), label: newLabel.trim(), token, createdAt: new Date().toISOString().slice(0, 10) }]);
    setNewToken(token);
    setNewLabel("");
  };

  const del = (id: string) => setKeys(prev => prev.filter(k => k.id !== id));
  const copy = (t: string) => navigator.clipboard?.writeText(t);

  return (
    <div className="pt-4 space-y-4 max-w-3xl">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>API keys</CardTitle>
            <CardDescription>Gérées en local uniquement — pas de persistence pour l'instant.</CardDescription>
          </div>
          <Button onClick={() => { setCreateOpen(true); setNewToken(null); }} size="sm"><Plus className="mr-2 h-3 w-3" />Create key</Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {keys.length === 0 && <p className="text-sm text-muted-foreground">No keys.</p>}
          {keys.map(k => (
            <div key={k.id} className="flex items-center justify-between rounded-md border px-3 py-2">
              <div>
                <p className="text-sm font-medium">{k.label}</p>
                <p className="text-xs text-muted-foreground font-mono">{k.token.slice(0, 14)}… <span className="ml-2">{k.createdAt}</span></p>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" onClick={() => copy(k.token)}><Copy className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => del(k.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{newToken ? "Key created" : "Create API key"}</DialogTitle>
            <DialogDescription>
              {newToken ? "Copy this token — il ne sera plus affiché." : "Donne un nom à ta clé pour la retrouver."}
            </DialogDescription>
          </DialogHeader>
          {newToken ? (
            <div className="flex gap-2">
              <Input readOnly value={newToken} className="font-mono" />
              <Button variant="outline" onClick={() => copy(newToken)}><Copy className="h-4 w-4" /></Button>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="label">Label</Label>
              <Input id="label" value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="My scanner integration" />
            </div>
          )}
          <DialogFooter>
            {newToken ? (
              <Button onClick={() => setCreateOpen(false)}>Done</Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                <Button onClick={create} disabled={!newLabel.trim()}>Create</Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <p className="text-xs text-muted-foreground">
        <Badge variant="outline" className="mr-2">Note</Badge>
        Les clés ne sont pas encore vérifiées côté serveur — branche `/api/keys` quand prêt.
      </p>
    </div>
  );
}
