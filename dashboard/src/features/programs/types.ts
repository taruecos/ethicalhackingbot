export type ComplianceStatus = "allowed" | "conditional" | "not_allowed";
export type BountyType = "bounty" | "responsible_disclosure";
export type Confidentiality = "public" | "application_only";
export type ActivityType =
  | "scope_added"
  | "scope_removed"
  | "bounty_changed"
  | "compliance_changed"
  | "program_synced"
  | "program_disabled";
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
  intigritiId?: string | null;
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
