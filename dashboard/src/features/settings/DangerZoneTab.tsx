"use client";

import { useState } from "react";
import { Trash2, UserX } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

export function DangerZoneTab() {
  const [purgeOpen, setPurgeOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [purgeConfirm, setPurgeConfirm] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState("");

  const canPurge = purgeConfirm === "PURGE";
  const canDelete = deleteConfirm === "DELETE";

  return (
    <div className="pt-4 space-y-4 max-w-2xl">
      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-destructive">Danger zone</CardTitle>
          <CardDescription>Opérations irréversibles. Aucune route backend n'est branchée — boutons sans effet pour l'instant.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-md border border-destructive/30 p-3">
            <div>
              <p className="text-sm font-medium">Purge all scan data</p>
              <p className="text-xs text-muted-foreground">Scans, findings, reports — tout effacé.</p>
            </div>
            <Button variant="outline" size="sm" className="text-destructive border-destructive/40 hover:bg-destructive/10" onClick={() => setPurgeOpen(true)}>
              <Trash2 className="mr-2 h-3 w-3" />Purge data
            </Button>
          </div>

          <div className="flex items-center justify-between rounded-md border border-destructive/30 p-3">
            <div>
              <p className="text-sm font-medium">Delete account</p>
              <p className="text-xs text-muted-foreground">Compte + toutes les données associées.</p>
            </div>
            <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
              <UserX className="mr-2 h-3 w-3" />Delete account
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={purgeOpen} onOpenChange={setPurgeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Purge all scan data?</DialogTitle>
            <DialogDescription>Tape <code className="font-mono text-destructive">PURGE</code> pour confirmer.</DialogDescription>
          </DialogHeader>
          <Input value={purgeConfirm} onChange={e => setPurgeConfirm(e.target.value)} placeholder="PURGE" />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setPurgeOpen(false); setPurgeConfirm(""); }}>Cancel</Button>
            <Button variant="destructive" disabled={!canPurge} onClick={() => { setPurgeOpen(false); setPurgeConfirm(""); }}>Purge</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete account?</DialogTitle>
            <DialogDescription>Tape <code className="font-mono text-destructive">DELETE</code> pour confirmer.</DialogDescription>
          </DialogHeader>
          <Input value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)} placeholder="DELETE" />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeleteOpen(false); setDeleteConfirm(""); }}>Cancel</Button>
            <Button variant="destructive" disabled={!canDelete} onClick={() => { setDeleteOpen(false); setDeleteConfirm(""); }}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
