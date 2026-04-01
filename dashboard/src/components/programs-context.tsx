"use client";

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";

interface ScopeItem {
  id?: string;
  type?: string;
  endpoint?: string;
  asset?: string;
  tier?: string;
  description?: string;
}

interface Compliance {
  automatedTooling?: number | boolean | null;
  automatedToolingStatus?: string;
  safeHarbour?: boolean;
  userAgent?: string | null;
  requestHeader?: string | null;
  description?: string;
  intigritiMe?: boolean;
}

export interface DBProgram {
  id: string;
  platform: string;
  name: string;
  slug: string;
  url: string;
  intigritiId: string | null;
  scope: ScopeItem[];
  compliance: Compliance;
  maxBounty: number | null;
  minBounty: number | null;
  currency: string;
  industry: string | null;
  programType: string | null;
  confidentiality: string | null;
  active: boolean;
  syncedAt: string;
}

interface ProgramsContextType {
  programs: DBProgram[];
  industries: string[];
  loading: boolean;
  syncing: boolean;
  synced: boolean;
  fetchPrograms: (params?: Record<string, string>) => Promise<void>;
  resync: () => Promise<void>;
}

const ProgramsContext = createContext<ProgramsContextType>({
  programs: [],
  industries: [],
  loading: true,
  syncing: false,
  synced: false,
  fetchPrograms: async () => {},
  resync: async () => {},
});

export function ProgramsProvider({ children }: { children: ReactNode }) {
  const [programs, setPrograms] = useState<DBProgram[]>([]);
  const [industries, setIndustries] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [synced, setSynced] = useState(false);

  const fetchPrograms = useCallback(async (params?: Record<string, string>) => {
    try {
      const searchParams = new URLSearchParams({ limit: "500", ...params });
      const res = await fetch(`/api/programs?${searchParams}`);
      if (res.ok) {
        const data = await res.json();
        setPrograms(data.programs || []);
        if (data.industries) setIndustries(data.industries);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  const resync = useCallback(async () => {
    setSyncing(true);
    try {
      await fetch("/api/programs/sync", { method: "POST" });
      await fetchPrograms();
      setSynced(true);
    } catch {
      // silent
    } finally {
      setSyncing(false);
    }
  }, [fetchPrograms]);

  // Initial load: fetch from DB then sync from Intigriti once
  useEffect(() => {
    let cancelled = false;
    fetchPrograms().then(() => {
      if (cancelled || synced) return;
      setSyncing(true);
      fetch("/api/programs/sync", { method: "POST" })
        .then(() => { if (!cancelled) fetchPrograms(); })
        .catch(() => {})
        .finally(() => {
          if (!cancelled) {
            setSyncing(false);
            setSynced(true);
          }
        });
    });
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <ProgramsContext.Provider value={{ programs, industries, loading, syncing, synced, fetchPrograms, resync }}>
      {children}
    </ProgramsContext.Provider>
  );
}

export function usePrograms() {
  return useContext(ProgramsContext);
}
