export type ComplianceStatus = "allowed" | "conditional" | "not_allowed";
export type BountyType = "bounty" | "responsible_disclosure";
export type Confidentiality = "public" | "application_only";
export type ActivityType = "scope_added" | "scope_removed" | "bounty_changed" | "compliance_changed" | "program_synced" | "program_disabled";
export type PayoutStatus = "paid" | "pending";

export interface ScopeEntry {
  tier: "in_scope" | "out_scope";
  endpoint: string;
  type: "wildcard" | "url" | "ip";
  description: string;
}

export interface Program {
  id: string;
  name: string;
  companyName: string;
  complianceStatus: ComplianceStatus;
  bountyType: BountyType;
  bountyMin: number | null;
  bountyMax: number | null;
  currency: string;
  industry: string;
  confidentiality: Confidentiality;
  safeHarbour: boolean;
  lastSynced: string;
  synced: boolean;
  scope: ScopeEntry[];
  userAgent: string;
  reqHeaders: string[];
  rulesOfEngagement: string;
}

export interface Activity {
  id: string;
  timestamp: string;
  type: ActivityType;
  program: string;
  diff: string;
}

export interface Payout {
  id: string;
  amount: number;
  currency: string;
  status: PayoutStatus;
  awardedAt: string;
  program: string;
  scanRef: string;
  finding: string;
}

interface ApiProgram {
  id: string;
  platform: string;
  name: string;
  slug: string;
  url: string;
  scope: any;
  compliance: any;
  maxBounty: number | null;
  minBounty: number | null;
  currency: string;
  industry: string | null;
  programType: string | null;
  confidentiality: string | null;
  active: boolean;
  syncedAt: string;
}

function mapAutomatedStatus(compliance: any): ComplianceStatus {
  const s = compliance?.automatedToolingStatus;
  if (s === "allowed") return "allowed";
  if (s === "conditional") return "conditional";
  if (s === "forbidden" || s === "not_allowed") return "not_allowed";
  return "not_allowed";
}

function mapScopeEntries(scope: any): ScopeEntry[] {
  if (!Array.isArray(scope)) return [];
  return scope
    .map((entry): ScopeEntry | null => {
      if (typeof entry === "string") {
        return { tier: "in_scope", endpoint: entry, type: "url", description: "" };
      }
      if (entry && typeof entry === "object") {
        const endpoint = entry.url ?? entry.endpoint ?? entry.target ?? "";
        if (!endpoint) return null;
        const tier = entry.tier === "out_scope" || entry.outOfScope ? "out_scope" : "in_scope";
        let type: ScopeEntry["type"] = "url";
        if (entry.type === "wildcard" || endpoint.includes("*")) type = "wildcard";
        else if (entry.type === "ip" || /\d+\.\d+\.\d+\.\d+/.test(endpoint)) type = "ip";
        return { tier, endpoint, type, description: entry.description ?? "" };
      }
      return null;
    })
    .filter((e): e is ScopeEntry => e !== null);
}

export function mapApiProgram(api: ApiProgram): Program {
  const compliance = api.compliance ?? {};
  const bountyType: BountyType = api.maxBounty && api.maxBounty > 0 ? "bounty" : "responsible_disclosure";
  const confidentiality: Confidentiality = api.confidentiality === "application_only" ? "application_only" : "public";
  const requiredHeaders: string[] = Array.isArray(compliance.requiredHeaders) ? compliance.requiredHeaders.filter((h: any) => typeof h === "string") : [];
  return {
    id: api.id,
    name: api.name,
    companyName: api.name,
    complianceStatus: mapAutomatedStatus(compliance),
    bountyType,
    bountyMin: api.minBounty,
    bountyMax: api.maxBounty,
    currency: api.currency,
    industry: api.industry ?? "Other",
    confidentiality,
    safeHarbour: Boolean(compliance.safeHarbour ?? compliance.safe_harbour ?? compliance.hasSafeHarbour),
    lastSynced: api.syncedAt,
    synced: true,
    scope: mapScopeEntries(api.scope),
    userAgent: compliance.requiredUserAgent ?? compliance.userAgent ?? "Not specified",
    reqHeaders: requiredHeaders,
    rulesOfEngagement: compliance.rulesOfEngagement ?? compliance.roe ?? "No rules of engagement provided.",
  };
}
