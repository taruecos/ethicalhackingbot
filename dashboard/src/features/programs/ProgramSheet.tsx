"use client";

import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import type { Program } from "./types";

export function ProgramSheet({ program, onClose }: { program: Program | null; onClose: () => void }) {
  return (
    <Sheet open={!!program} onOpenChange={open => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        {program && (
          <>
            <SheetHeader>
              <SheetTitle>{program.name}</SheetTitle>
              <SheetDescription className="flex gap-2 flex-wrap pt-2">
                <Badge variant="outline">{program.industry}</Badge>
                <Badge variant="secondary">{program.complianceStatus.replace("_", " ")}</Badge>
                {program.bountyMax && <Badge variant="secondary">{program.currency} {program.bountyMin ?? 0}–{program.bountyMax}</Badge>}
                {program.safeHarbour && <Badge variant="outline">Safe harbour</Badge>}
              </SheetDescription>
            </SheetHeader>
            <div className="space-y-4 mt-6">
              {program.rulesOfEngagement && (
                <section><h3 className="text-sm font-medium mb-1">Rules of engagement</h3><p className="text-sm text-muted-foreground whitespace-pre-wrap">{program.rulesOfEngagement}</p></section>
              )}
              {program.scope.length > 0 && (
                <section>
                  <h3 className="text-sm font-medium mb-2">Scope ({program.scope.length})</h3>
                  <div className="space-y-1">
                    {program.scope.slice(0, 20).map((s, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <Badge variant={s.tier === "in_scope" ? "default" : "destructive"} className="text-[10px]">{s.tier === "in_scope" ? "IN" : "OUT"}</Badge>
                        <span className="font-mono text-muted-foreground truncate">{s.endpoint}</span>
                      </div>
                    ))}
                    {program.scope.length > 20 && <p className="text-xs text-muted-foreground">+ {program.scope.length - 20} more…</p>}
                  </div>
                </section>
              )}
              <section className="text-xs text-muted-foreground">Last synced: {program.lastSynced}</section>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
