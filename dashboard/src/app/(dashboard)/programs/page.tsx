"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  Loader2,
  Globe,
  ExternalLink,
  Search,
  DollarSign,
  Shield,
  Filter,
  CheckCircle2,
  Crosshair,
  Eye,
  X,
  Clock,
  Activity,
  Wallet,
  ChevronRight,
  Star,
  Lock,
  AlertTriangle,
  Zap,
  ShieldCheck,
  ShieldX,
  ShieldQuestion,
} from "lucide-react";
import { usePrograms, type DBProgram } from "@/components/programs-context";

// ── Types ──

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

interface IntigritiProgram {
  id: string;
  handle: string;
  name: string;
  following: boolean;
  minBounty: { value: number; currency: string } | null;
  maxBounty: { value: number; currency: string } | null;
  confidentialityLevel: { id: number; value: string };
  status: { id: number; value: string };
  type: { id: number; value: string };
  webLinks: { detail: string };
  industry: string;
  domains?: {
    content: {
      id: string;
      type: { id: number; value: string };
      endpoint: string;
      tier: { id: number; value: string };
      description: string;
      requiredSkills: { id: string; name: string }[];
    }[];
  };
  rulesOfEngagement?: {
    content: {
      description: string;
      testingRequirements: {
        intigritiMe: boolean;
        automatedTooling: boolean | null;
        userAgent: string | null;
        requestHeader: string | null;
      };
      safeHarbour: boolean;
    };
  };
}

interface IntigritiActivity {
  programId: string;
  activity: Record<string, unknown>;
  type: { id: number; value: string };
  createdAt: number;
  following: boolean;
}

interface IntigritiPayout {
  id: string;
  amount: { value: number; currency: string };
  status: { id: number; value: string };
  createdAt: number;
  paidAt: number | null;
}

// ── Constants ──

const TIER_COLORS: Record<string, string> = {
  tier1: "text-[var(--red)]",
  tier2: "text-[var(--orange)]",
  tier3: "text-[var(--blue)]",
  tier4: "text-[var(--dim)]",
};

const TAB_LIST = [
  { id: "programs", label: "Programs", icon: Globe },
  { id: "live", label: "Live (Intigriti)", icon: Zap },
  { id: "activities", label: "Activities", icon: Activity },
  { id: "payouts", label: "Payouts", icon: Wallet },
] as const;

type TabId = (typeof TAB_LIST)[number]["id"];

// ── Main Page ──

export default function ProgramsPage() {
  const [activeTab, setActiveTab] = useState<TabId>("programs");

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 bg-[var(--surface)] border border-[var(--border)] rounded-lg p-1">
          {TAB_LIST.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  isActive
                    ? "bg-[var(--accent)] text-black"
                    : "text-[var(--dim)] hover:text-[var(--text)]"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {activeTab === "programs" && <DBProgramsTab />}
      {activeTab === "live" && <LiveProgramsTab />}
      {activeTab === "activities" && <ActivitiesTab />}
      {activeTab === "payouts" && <PayoutsTab />}
    </div>
  );
}

// ── DB Programs Tab (synced, with compliance) ──

function DBProgramsTab() {
  const { programs: allPrograms, industries, loading, syncing } = usePrograms();
  const [search, setSearch] = useState("");
  const [complianceFilter, setComplianceFilter] = useState(true);
  const [bountyFilter, setBountyFilter] = useState<"all" | "bounty" | "disclosure">("all");
  const [industryFilter, setIndustryFilter] = useState<string>("");
  const [confidentialityFilter, setConfidentialityFilter] = useState<string>("");
  const [safeHarbourFilter, setSafeHarbourFilter] = useState<"all" | "yes" | "no">("all");
  const [sortBy, setSortBy] = useState<"syncedAt" | "maxBounty" | "name">("syncedAt");
  const [showFilters, setShowFilters] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [scanning, setScanning] = useState<string | null>(null);
  const [scannedIds, setScannedIds] = useState<Set<string>>(new Set());

  const activeFilterCount = [
    complianceFilter,
    bountyFilter !== "all",
    industryFilter !== "",
    confidentialityFilter !== "",
    safeHarbourFilter !== "all",
    sortBy !== "syncedAt",
  ].filter(Boolean).length;

  // Client-side filtering and sorting on context data
  const programs = useMemo(() => {
    let filtered = [...allPrograms];

    if (complianceFilter) {
      filtered = filtered.filter((p) => {
        const c = p.compliance;
        if (!c) return false;
        const tooling = c.automatedTooling;
        return tooling === true || tooling === 1 || c.automatedToolingStatus === "allowed";
      });
    }

    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter((p) =>
        p.name.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q)
      );
    }

    if (bountyFilter === "bounty") {
      filtered = filtered.filter((p) => p.maxBounty && p.maxBounty > 0);
    } else if (bountyFilter === "disclosure") {
      filtered = filtered.filter((p) => !p.maxBounty || p.maxBounty === 0);
    }

    if (industryFilter) {
      filtered = filtered.filter((p) => p.industry === industryFilter);
    }

    if (confidentialityFilter) {
      filtered = filtered.filter((p) => p.confidentiality === confidentialityFilter);
    }

    if (safeHarbourFilter !== "all") {
      filtered = filtered.filter((p) => {
        const sh = p.compliance?.safeHarbour;
        return safeHarbourFilter === "yes" ? sh === true : sh === false;
      });
    }

    filtered.sort((a, b) => {
      if (sortBy === "maxBounty") return (b.maxBounty || 0) - (a.maxBounty || 0);
      if (sortBy === "name") return a.name.localeCompare(b.name);
      return new Date(b.syncedAt).getTime() - new Date(a.syncedAt).getTime();
    });

    return filtered;
  }, [allPrograms, complianceFilter, search, bountyFilter, industryFilter, confidentialityFilter, safeHarbourFilter, sortBy]);

  async function launchScan(program: DBProgram) {
    setScanning(program.id);
    try {
      const scope = program.scope || [];
      const firstDomain = scope[0]?.endpoint || scope[0]?.asset || program.slug;
      const domain = (firstDomain || "").replace(/^\*\./, "");

      const compliance = program.compliance as Record<string, unknown> | null;
      const rulesOfEngagement = {
        userAgent: compliance?.userAgent as string | null,
        requestHeader: compliance?.requestHeader as string | null,
        safeHarbour: compliance?.safeHarbour as boolean | null,
      };

      await fetch("/api/scans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain,
          programId: program.id,
          depth: "standard",
          modules: ["idor", "access_control", "info_disclosure"],
          rateLimit: 30,
          rulesOfEngagement,
        }),
      });
      setScannedIds((prev) => new Set([...prev, program.id]));
    } catch {
      // silent
    } finally {
      setScanning(null);
    }
  }

  const compliantCount = programs.length;
  const totalBounty = programs.reduce((s, p) => s + (p.maxBounty || 0), 0);

  return (
    <>
      {/* Filters */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--dim)]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search programs..."
              className="w-full pl-10 pr-4 py-2.5 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:border-[var(--accent)] transition-colors"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors border ${
              showFilters || activeFilterCount > 1
                ? "bg-[var(--accent-dim)] text-[var(--accent)] border-[var(--accent)]/30"
                : "bg-[var(--bg)] text-[var(--dim)] border-[var(--border)] hover:text-[var(--text)]"
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            Filters
            {activeFilterCount > 1 && (
              <span className="w-4 h-4 rounded-full bg-[var(--accent)] text-black text-[9px] font-bold flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* Quick filter: compliance */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setComplianceFilter(!complianceFilter)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
              complianceFilter
                ? "bg-[var(--accent-dim)] text-[var(--accent)] border border-[var(--accent)]/30"
                : "bg-[var(--bg)] text-[var(--dim)] border border-[var(--border)]"
            }`}
          >
            <ShieldCheck className="w-3 h-3" />
            Automated Tooling Allowed
          </button>
          {/* Quick bounty filter pills */}
          {(["all", "bounty", "disclosure"] as const).map((val) => {
            const labels = { all: "All Programs", bounty: "Has Bounty", disclosure: "Responsible Disclosure" };
            const icons = { all: Globe, bounty: DollarSign, disclosure: Shield };
            const Icon = icons[val];
            return (
              <button
                key={val}
                onClick={() => setBountyFilter(val)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                  bountyFilter === val
                    ? "bg-[var(--accent-dim)] text-[var(--accent)] border border-[var(--accent)]/30"
                    : "bg-[var(--bg)] text-[var(--dim)] border border-[var(--border)]"
                }`}
              >
                <Icon className="w-3 h-3" />
                {labels[val]}
              </button>
            );
          })}
        </div>

        {/* Extended filters panel */}
        {showFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-[var(--border)]">
            {/* Industry */}
            <div>
              <label className="text-[10px] uppercase tracking-widest text-[var(--dim)] font-semibold mb-1 block">Industry</label>
              <select
                value={industryFilter}
                onChange={(e) => setIndustryFilter(e.target.value)}
                className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-xs focus:outline-none focus:border-[var(--accent)] transition-colors"
              >
                <option value="">All Industries</option>
                {industries.map((ind) => (
                  <option key={ind} value={ind}>{ind}</option>
                ))}
              </select>
            </div>

            {/* Confidentiality */}
            <div>
              <label className="text-[10px] uppercase tracking-widest text-[var(--dim)] font-semibold mb-1 block">Confidentiality</label>
              <select
                value={confidentialityFilter}
                onChange={(e) => setConfidentialityFilter(e.target.value)}
                className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-xs focus:outline-none focus:border-[var(--accent)] transition-colors"
              >
                <option value="">All</option>
                <option value="public">Public</option>
                <option value="application_only">Application Only</option>
              </select>
            </div>

            {/* Safe Harbour */}
            <div>
              <label className="text-[10px] uppercase tracking-widest text-[var(--dim)] font-semibold mb-1 block">Safe Harbour</label>
              <select
                value={safeHarbourFilter}
                onChange={(e) => setSafeHarbourFilter(e.target.value as "all" | "yes" | "no")}
                className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-xs focus:outline-none focus:border-[var(--accent)] transition-colors"
              >
                <option value="all">All</option>
                <option value="yes">Safe Harbour Only</option>
                <option value="no">No Safe Harbour</option>
              </select>
            </div>

            {/* Sort by */}
            <div>
              <label className="text-[10px] uppercase tracking-widest text-[var(--dim)] font-semibold mb-1 block">Sort By</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as "syncedAt" | "maxBounty" | "name")}
                className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-xs focus:outline-none focus:border-[var(--accent)] transition-colors"
              >
                <option value="syncedAt">Recently Synced</option>
                <option value="maxBounty">Highest Bounty</option>
                <option value="name">Name (A-Z)</option>
              </select>
            </div>

            {/* Reset all */}
            {activeFilterCount > 1 && (
              <button
                onClick={() => {
                  setComplianceFilter(true);
                  setBountyFilter("all");
                  setIndustryFilter("");
                  setConfidentialityFilter("");
                  setSafeHarbourFilter("all");
                  setSortBy("syncedAt");
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-[var(--red)] bg-[var(--red)]/10 border border-[var(--red)]/20 hover:bg-[var(--red)]/20 transition-colors self-end"
              >
                <X className="w-3 h-3" />
                Reset Filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
        <StatBox icon={ShieldCheck} label="Compliant" value={compliantCount} color="accent" />
        <StatBox icon={DollarSign} label="Max Bounty Pool" value={`€${Math.round(totalBounty).toLocaleString()}`} color="accent" />
        <StatBox icon={Filter} label="Showing" value={programs.length} color="dim" />
      </div>

      {/* Programs list */}
      {syncing ? (
        <div className="flex flex-col items-center justify-center py-16 gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-[var(--accent)]" />
          <span className="text-xs text-[var(--dim)]">Syncing from Intigriti...</span>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-5 h-5 animate-spin text-[var(--accent)]" />
        </div>
      ) : programs.length === 0 ? (
        <EmptyState message="No programs found" sub="Adjust filters or wait for sync to complete" />
      ) : (
        <div className="space-y-3">
          {programs.map((program) => (
            <DBProgramCard
              key={program.id}
              program={program}
              isExpanded={expandedId === program.id}
              onToggle={() => setExpandedId(expandedId === program.id ? null : program.id)}
              onScan={() => launchScan(program)}
              isScanning={scanning === program.id}
              isScanned={scannedIds.has(program.id)}
            />
          ))}
        </div>
      )}
    </>
  );
}

// ── DB Program Card ──

function DBProgramCard({
  program,
  isExpanded,
  onToggle,
  onScan,
  isScanning,
  isScanned,
}: {
  program: DBProgram;
  isExpanded: boolean;
  onToggle: () => void;
  onScan: () => void;
  isScanning: boolean;
  isScanned: boolean;
}) {
  const compliance = program.compliance || {};
  const toolingStatus = compliance.automatedToolingStatus || "unknown";
  const scope = program.scope || [];

  const isToolingAllowed = toolingStatus === "allowed" || toolingStatus === "conditional";
  const ToolingIcon = toolingStatus === "allowed" ? ShieldCheck : toolingStatus === "conditional" ? ShieldQuestion : toolingStatus === "not_allowed" ? ShieldX : ShieldQuestion;
  const toolingColor = toolingStatus === "allowed" ? "text-[var(--accent)]" : toolingStatus === "conditional" ? "text-[var(--orange)]" : toolingStatus === "not_allowed" ? "text-[var(--red)]" : "text-[var(--dim)]";
  const toolingLabel = toolingStatus === "allowed" ? "Automated OK" : toolingStatus === "conditional" ? "Conditional" : toolingStatus === "not_allowed" ? "No Automated" : "Unknown";

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-hidden hover:border-[var(--accent)]/30 transition-colors">
      {/* Header */}
      <div className="p-4 flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-blue-500/15 flex items-center justify-center flex-shrink-0">
          <Shield className="w-5 h-5 text-blue-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold truncate">{program.name}</h3>
            {program.confidentiality === "application_only" && (
              <Lock className="w-3 h-3 text-[var(--orange)]" />
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-[10px] uppercase font-bold text-blue-400">INTIGRITI</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
              program.active ? "bg-[var(--accent-dim)] text-[var(--accent)]" : "bg-[var(--red)]/15 text-[var(--red)]"
            }`}>
              {program.active ? "open" : "closed"}
            </span>
            {program.industry && <span className="text-[10px] text-[var(--dim)]">· {program.industry}</span>}
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold flex items-center gap-1 ${
              toolingStatus === "allowed" ? "bg-[var(--accent-dim)] text-[var(--accent)]" : toolingStatus === "conditional" ? "bg-[var(--orange)]/15 text-[var(--orange)]" : "bg-[var(--red)]/15 text-[var(--red)]"
            }`}>
              <ToolingIcon className="w-3 h-3" />
              {toolingLabel}
            </span>
          </div>
          {/* Bounty */}
          <div className="flex items-center gap-1 mt-2 text-xs text-[var(--accent)]">
            <DollarSign className="w-3 h-3" />
            {(program.maxBounty != null && program.maxBounty > 0) ? (
              <>
                {program.minBounty != null && program.minBounty > 0 && `${program.currency} ${program.minBounty.toLocaleString()}`}
                {program.minBounty != null && program.minBounty > 0 && program.maxBounty != null && " — "}
                {`${program.currency} ${program.maxBounty.toLocaleString()}`}
              </>
            ) : (
              <span className="text-[var(--dim)]">Responsible Disclosure</span>
            )}
          </div>
          <p className="text-[10px] text-[var(--dim)] mt-1">
            {scope.length} domain{scope.length > 1 ? "s" : ""} in scope
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-1 shrink-0">
          <button
            onClick={onToggle}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] bg-[var(--surface2)] text-[var(--dim)] hover:text-[var(--text)] transition-colors whitespace-nowrap font-bold"
          >
            <Eye className="w-3 h-3" />
            {isExpanded ? "Hide" : "Scope"}
          </button>
          <button
            onClick={onScan}
            disabled={isScanning || isScanned || !program.active || !isToolingAllowed}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all whitespace-nowrap ${
              isScanned
                ? "bg-[var(--accent-dim)] text-[var(--accent)]"
                : !isToolingAllowed
                  ? "bg-[var(--surface2)] text-[var(--dim)] opacity-40 cursor-not-allowed"
                  : "bg-[var(--surface2)] text-[var(--dim)] hover:text-[var(--accent)] hover:bg-[var(--accent-dim)]"
            } disabled:opacity-40`}
          >
            {isScanning ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : isScanned ? (
              <CheckCircle2 className="w-3 h-3" />
            ) : (
              <Crosshair className="w-3 h-3" />
            )}
            {isScanned ? "Queued" : "Scan"}
          </button>
          {program.url && (
            <a
              href={program.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] bg-[var(--surface2)] text-[var(--dim)] hover:text-[var(--text)] transition-colors whitespace-nowrap"
            >
              <ExternalLink className="w-3 h-3" />
              Intigriti
            </a>
          )}
        </div>
      </div>

      {/* Expanded: Scope + Compliance */}
      {isExpanded && (
        <div className="border-t border-[var(--border)] p-4 space-y-3">
          {/* Compliance details */}
          <div className="bg-[var(--bg)] border border-[var(--border)] rounded-lg p-3 space-y-2">
            <h4 className="text-[10px] uppercase tracking-widest text-[var(--dim)] font-semibold">Rules of Engagement</h4>
            <div className="flex flex-wrap gap-3 text-xs">
              <div className="flex items-center gap-1.5">
                <ToolingIcon className={`w-3.5 h-3.5 ${toolingColor}`} />
                <span>Automated Tooling: <strong>{toolingLabel}</strong></span>
              </div>
              {compliance.safeHarbour !== undefined && (
                <div className="flex items-center gap-1.5">
                  <Shield className={`w-3.5 h-3.5 ${compliance.safeHarbour ? "text-[var(--accent)]" : "text-[var(--red)]"}`} />
                  <span>Safe Harbour: <strong>{compliance.safeHarbour ? "Yes" : "No"}</strong></span>
                </div>
              )}
            </div>
            {compliance.userAgent && (
              <div className="text-xs">
                <span className="text-[var(--dim)]">Required User-Agent: </span>
                <code className="text-[var(--blue)] font-mono text-[11px]">{compliance.userAgent}</code>
              </div>
            )}
            {compliance.requestHeader && (
              <div className="text-xs">
                <span className="text-[var(--dim)]">Required Header: </span>
                <code className="text-[var(--blue)] font-mono text-[11px]">{compliance.requestHeader}</code>
              </div>
            )}
            {compliance.description && (
              <p className="text-xs text-[var(--dim)] mt-1 max-h-24 overflow-y-auto whitespace-pre-wrap">
                {compliance.description}
              </p>
            )}
          </div>

          {/* Scope domains */}
          <div>
            <h4 className="text-[10px] uppercase tracking-widest text-[var(--dim)] font-semibold mb-2">
              Scope ({scope.length} domains)
            </h4>
            {scope.length > 0 ? (
              <div className="space-y-1.5">
                {scope.map((d, i) => (
                  <div key={i} className="bg-[var(--bg)] border border-[var(--border)] rounded-lg p-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <code className="text-sm font-mono text-[var(--text)]">{d.endpoint || d.asset}</code>
                      <span className={`text-[9px] uppercase font-bold ${TIER_COLORS[d.tier || ""] || "text-[var(--dim)]"}`}>
                        {d.tier || "no tier"}
                      </span>
                    </div>
                    <span className="text-[10px] uppercase text-[var(--dim)] font-medium">{d.type}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[var(--dim)]">No scope data — try re-syncing</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Live Programs Tab (direct from Intigriti API) ──

function LiveProgramsTab() {
  const [programs, setPrograms] = useState<IntigritiProgram[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedProgram, setSelectedProgram] = useState<IntigritiProgram | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchPrograms = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/intigriti/programs?limit=200");
      if (res.ok) {
        const data = await res.json();
        setPrograms(data.programs || data.records || []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPrograms();
  }, [fetchPrograms]);

  async function openDetail(programId: string) {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/intigriti/programs/${programId}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedProgram(data);
      }
    } catch {
      // silent
    } finally {
      setDetailLoading(false);
    }
  }

  const filtered = programs.filter((p) => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !p.handle.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <>
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--dim)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search live programs..."
            className="w-full pl-10 pr-4 py-2.5 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:border-[var(--accent)] transition-colors"
          />
        </div>
      </div>

      <StatBox icon={Globe} label="Live from Intigriti" value={filtered.length} color="blue" />

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-5 h-5 animate-spin text-[var(--accent)]" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState message="No programs found" sub="Check your Intigriti API token" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map((program) => (
            <div
              key={program.id}
              className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 hover:border-[var(--accent)]/30 transition-colors cursor-pointer"
              onClick={() => openDetail(program.id)}
            >
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold truncate">{program.name}</h3>
                {program.following && <Star className="w-3 h-3 text-[var(--accent)] fill-[var(--accent)]" />}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] uppercase font-bold text-blue-400">INTIGRITI</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                  program.status?.value === "open" ? "bg-[var(--accent-dim)] text-[var(--accent)]" : "bg-[var(--red)]/15 text-[var(--red)]"
                }`}>
                  {program.status?.value}
                </span>
              </div>
              {program.maxBounty && (
                <div className="flex items-center gap-1 mt-2 text-xs text-[var(--accent)]">
                  <DollarSign className="w-3 h-3" />
                  {program.maxBounty.currency} {program.maxBounty.value.toLocaleString()}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {(selectedProgram || detailLoading) && (
        <ProgramDetailModal
          program={selectedProgram}
          loading={detailLoading}
          onClose={() => setSelectedProgram(null)}
        />
      )}
    </>
  );
}

// ── Program Detail Modal ──

function ProgramDetailModal({
  program,
  loading,
  onClose,
}: {
  program: IntigritiProgram | null;
  loading: boolean;
  onClose: () => void;
}) {
  if (loading) {
    return (
      <ModalWrapper onClose={onClose}>
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-[var(--accent)]" />
        </div>
      </ModalWrapper>
    );
  }
  if (!program) return null;

  const domains = program.domains?.content || [];
  const rules = program.rulesOfEngagement?.content;
  const testing = rules?.testingRequirements;

  return (
    <ModalWrapper onClose={onClose}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            {program.name}
            {program.following && <Star className="w-4 h-4 text-[var(--accent)] fill-[var(--accent)]" />}
          </h2>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] uppercase font-bold text-blue-400">INTIGRITI</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
              program.status?.value === "open" ? "bg-[var(--accent-dim)] text-[var(--accent)]" : "bg-[var(--red)]/15 text-[var(--red)]"
            }`}>
              {program.status?.value}
            </span>
          </div>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-[var(--surface2)] rounded-lg transition-colors">
          <X className="w-5 h-5 text-[var(--dim)]" />
        </button>
      </div>

      {(program.maxBounty && program.maxBounty.value > 0) && (
        <div className="bg-[var(--accent-dim)] border border-[var(--accent)]/20 rounded-lg p-3 mb-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--accent)]">
            <DollarSign className="w-4 h-4" />
            Bounty Range
          </div>
          <p className="text-xl font-bold mt-1">
            {program.minBounty && program.minBounty.value > 0 && `${program.minBounty.currency} ${program.minBounty.value.toLocaleString()}`}
            {program.minBounty && program.minBounty.value > 0 && program.maxBounty && " — "}
            {program.maxBounty && `${program.maxBounty.currency} ${program.maxBounty.value.toLocaleString()}`}
          </p>
        </div>
      )}

      {/* Scope */}
      <SectionHeader title="Scope" count={domains.length} icon={Globe} />
      {domains.length > 0 ? (
        <div className="space-y-2 mb-4">
          {domains.map((d, i) => (
            <div key={i} className="bg-[var(--bg)] border border-[var(--border)] rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <code className="text-sm font-mono text-[var(--text)]">{d.endpoint}</code>
                  <span className={`text-[9px] uppercase font-bold ${TIER_COLORS[d.tier?.value] || "text-[var(--dim)]"}`}>
                    {d.tier?.value || "no tier"}
                  </span>
                </div>
                <span className="text-[10px] uppercase text-[var(--dim)] font-medium">{d.type?.value}</span>
              </div>
              {d.description && <p className="text-xs text-[var(--dim)] mt-1">{d.description}</p>}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-[var(--dim)] mb-4">No scope data</p>
      )}

      {/* ROE */}
      {rules && (
        <>
          <SectionHeader title="Rules of Engagement" icon={Shield} />
          <div className="bg-[var(--bg)] border border-[var(--border)] rounded-lg p-3 mb-4 space-y-2">
            {rules.safeHarbour !== undefined && (
              <div className="flex items-center gap-2 text-xs">
                <Shield className={`w-3.5 h-3.5 ${rules.safeHarbour ? "text-[var(--accent)]" : "text-[var(--red)]"}`} />
                <span>Safe Harbour: {rules.safeHarbour ? "Yes" : "No"}</span>
              </div>
            )}
            {testing?.automatedTooling !== undefined && testing.automatedTooling !== null && (
              <div className="flex items-center gap-2 text-xs">
                <AlertTriangle className={`w-3.5 h-3.5 ${testing.automatedTooling ? "text-[var(--accent)]" : "text-[var(--orange)]"}`} />
                <span>Automated Tooling: {testing.automatedTooling ? "Allowed" : "Restricted"}</span>
              </div>
            )}
            {testing?.userAgent && (
              <div className="text-xs">
                <span className="text-[var(--dim)]">Required User-Agent: </span>
                <code className="text-[var(--blue)] font-mono text-[11px]">{testing.userAgent}</code>
              </div>
            )}
          </div>
        </>
      )}

      <a
        href={program.webLinks?.detail || "#"}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-blue-500/15 text-blue-400 text-sm font-medium hover:bg-blue-500/25 transition-colors"
      >
        <ExternalLink className="w-4 h-4" />
        View on Intigriti
      </a>
    </ModalWrapper>
  );
}

// ── Activities Tab ──

function ActivitiesTab() {
  const [activities, setActivities] = useState<IntigritiActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/intigriti/activities?limit=50");
        if (res.ok) {
          const data = await res.json();
          setActivities(data.records || []);
        }
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-[var(--accent)]" /></div>;
  }
  if (activities.length === 0) {
    return <EmptyState message="No recent activities" sub="Activity feed shows scope and rule changes" />;
  }

  return (
    <div className="space-y-2">
      {activities.map((a, i) => (
        <div key={i} className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[var(--cyan)]/15 flex items-center justify-center shrink-0">
            <Activity className="w-4 h-4 text-[var(--cyan)]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium truncate">{a.programId.slice(0, 8)}...</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--cyan)]/15 text-[var(--cyan)] font-bold">
                {a.type?.value || "update"}
              </span>
            </div>
            <p className="text-[10px] text-[var(--dim)] mt-0.5">
              <Clock className="w-3 h-3 inline mr-1" />
              {new Date(a.createdAt * 1000).toLocaleString()}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Payouts Tab ──

function PayoutsTab() {
  const [payouts, setPayouts] = useState<IntigritiPayout[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/intigriti/payouts?limit=100");
        if (res.ok) {
          const data = await res.json();
          setPayouts(data.records || []);
        }
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const totalPaid = payouts.filter((p) => p.status?.value === "paid").reduce((s, p) => s + (p.amount?.value || 0), 0);
  const totalPending = payouts.filter((p) => p.status?.value !== "paid").reduce((s, p) => s + (p.amount?.value || 0), 0);

  if (loading) {
    return <div className="flex items-center justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-[var(--accent)]" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatBox icon={Wallet} label="Total Payouts" value={payouts.length} color="accent" />
        <StatBox icon={DollarSign} label="Total Paid" value={`€${totalPaid.toLocaleString()}`} color="accent" />
        <StatBox icon={Clock} label="Pending" value={`€${totalPending.toLocaleString()}`} color="orange" />
      </div>
      {payouts.length === 0 ? (
        <EmptyState message="No payouts yet" sub="Payouts from Intigriti will appear here" />
      ) : (
        <div className="space-y-2">
          {payouts.map((p) => (
            <div key={p.id} className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  p.status?.value === "paid" ? "bg-[var(--accent-dim)]" : "bg-[var(--orange)]/15"
                }`}>
                  <DollarSign className={`w-4 h-4 ${p.status?.value === "paid" ? "text-[var(--accent)]" : "text-[var(--orange)]"}`} />
                </div>
                <div>
                  <p className="text-sm font-semibold">{p.amount?.currency || "EUR"} {p.amount?.value?.toLocaleString() || "0"}</p>
                  <p className="text-[10px] text-[var(--dim)]">{new Date(p.createdAt * 1000).toLocaleDateString()}</p>
                </div>
              </div>
              <span className={`text-[10px] px-2 py-1 rounded font-bold ${
                p.status?.value === "paid"
                  ? "bg-[var(--accent-dim)] text-[var(--accent)]"
                  : "bg-[var(--orange)]/15 text-[var(--orange)]"
              }`}>
                {p.status?.value || "pending"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Shared UI Components ──

function StatBox({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  color: string;
}) {
  const colorMap: Record<string, { bg: string; text: string }> = {
    accent: { bg: "bg-[var(--accent-dim)]", text: "text-[var(--accent)]" },
    blue: { bg: "bg-[var(--blue)]/15", text: "text-[var(--blue)]" },
    orange: { bg: "bg-[var(--orange)]/15", text: "text-[var(--orange)]" },
    dim: { bg: "bg-[var(--surface2)]", text: "text-[var(--dim)]" },
  };
  const c = colorMap[color] || colorMap.dim;
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
      <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg ${c.bg} flex items-center justify-center shrink-0`}>
        <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${c.text}`} />
      </div>
      <div>
        <p className="text-[10px] sm:text-xs text-[var(--dim)]">{label}</p>
        <p className="text-lg sm:text-xl font-bold">{value}</p>
      </div>
    </div>
  );
}

function SectionHeader({
  title,
  count,
  icon: Icon,
}: {
  title: string;
  count?: number;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <Icon className="w-4 h-4 text-[var(--dim)]" />
      <h3 className="text-sm font-semibold">{title}</h3>
      {count !== undefined && (
        <span className="text-[10px] bg-[var(--surface2)] text-[var(--dim)] px-1.5 py-0.5 rounded">{count}</span>
      )}
    </div>
  );
}

function EmptyState({ message, sub }: { message: string; sub: string }) {
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-12 text-center">
      <Globe className="w-8 h-8 text-[var(--dim)] mx-auto mb-3" />
      <p className="text-sm text-[var(--dim)]">{message}</p>
      <p className="text-xs text-[var(--dim)] mt-1">{sub}</p>
    </div>
  );
}

function ModalWrapper({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 w-full max-w-2xl max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
