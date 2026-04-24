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

const ROE_DEFAULT = `Testing is permitted Monday–Friday, 08:00–20:00 CET. Maximum 2 concurrent connections per target. Rate limit enforced at 30 req/min by WAF — exceeding this will result in a temporary IP ban.

Do not access, modify, or exfiltrate real user data beyond what is necessary to demonstrate a vulnerability. Always use test accounts provided by the program.

Out of scope: social engineering attacks, physical security, DoS/DDoS, CSRF with negligible security impact, UI/UX bugs without security implications, self-XSS.

Report all findings within 90 days of discovery through the official platform portal. Duplicate submissions receive a reduced payout. Provide a working PoC for all P1 and P2 severity findings.`;

const ROE_STRICT = `Automated scanners are conditionally permitted subject to prior written approval from the security team. Submit a scan request form at least 48 hours before testing.

Scanning must be performed from an approved IP range. User-Agent must match the registered scanner profile. All scan traffic must include the X-Bug-Bounty header.

Rate limit: strictly 10 req/min. Exceeding this limit will permanently revoke scanner access.`;

export const PROGRAMS: Program[] = [
  { id: "hackerone", name: "HackerOne Main", companyName: "HackerOne", complianceStatus: "allowed", bountyType: "bounty", bountyMin: 50, bountyMax: 15000, currency: "EUR", industry: "Technology", confidentiality: "public", safeHarbour: true, lastSynced: "2026-04-24 09:00", synced: true, scope: [{ tier: "in_scope", endpoint: "*.hackerone.com", type: "wildcard", description: "All main subdomains" }, { tier: "in_scope", endpoint: "api.hackerone.com", type: "url", description: "REST API" }, { tier: "in_scope", endpoint: "app.hackerone.com", type: "url", description: "Web application" }, { tier: "out_scope", endpoint: "support.hackerone.com", type: "url", description: "Customer support portal" }, { tier: "out_scope", endpoint: "status.hackerone.com", type: "url", description: "Status page" }], userAgent: "EHBScanner/1.0", reqHeaders: ["X-Scanner-ID: ehb-{scan_id}"], rulesOfEngagement: ROE_DEFAULT },
  { id: "bugcrowd", name: "Bugcrowd Platform", companyName: "Bugcrowd", complianceStatus: "not_allowed", bountyType: "bounty", bountyMin: 25, bountyMax: 5000, currency: "EUR", industry: "Technology", confidentiality: "public", safeHarbour: true, lastSynced: "2026-04-24 08:55", synced: true, scope: [{ tier: "in_scope", endpoint: "*.bugcrowd.com", type: "wildcard", description: "All subdomains" }, { tier: "in_scope", endpoint: "app.bugcrowd.com", type: "url", description: "Main platform" }, { tier: "out_scope", endpoint: "cdn.bugcrowd.com", type: "url", description: "CDN — read-only assets" }], userAgent: "Not allowed", reqHeaders: [], rulesOfEngagement: "Automated scanning is explicitly prohibited. Manual testing only." },
  { id: "intigriti", name: "Intigriti Core", companyName: "Intigriti", complianceStatus: "conditional", bountyType: "bounty", bountyMin: 50, bountyMax: 10000, currency: "EUR", industry: "Technology", confidentiality: "public", safeHarbour: true, lastSynced: "2026-04-24 09:05", synced: true, scope: [{ tier: "in_scope", endpoint: "*.intigriti.com", type: "wildcard", description: "All subdomains" }, { tier: "in_scope", endpoint: "api.intigriti.com", type: "url", description: "REST API v2" }, { tier: "out_scope", endpoint: "legacy.intigriti.com", type: "url", description: "Legacy system — no longer maintained" }], userAgent: "EHBScanner/1.0", reqHeaders: ["X-Bug-Bounty: true", "X-Rate-Limit: 30"], rulesOfEngagement: ROE_STRICT },
  { id: "yeswehack", name: "YesWeHack", companyName: "YesWeHack", complianceStatus: "allowed", bountyType: "bounty", bountyMin: 50, bountyMax: 8000, currency: "EUR", industry: "Technology", confidentiality: "public", safeHarbour: true, lastSynced: "2026-04-23 22:00", synced: true, scope: [{ tier: "in_scope", endpoint: "*.yeswehack.com", type: "wildcard", description: "All main subdomains" }, { tier: "in_scope", endpoint: "auth.yeswehack.com", type: "url", description: "Authentication service" }], userAgent: "EHBScanner/1.0", reqHeaders: [], rulesOfEngagement: ROE_DEFAULT },
  { id: "toyota", name: "Toyota Security", companyName: "Toyota Motor", complianceStatus: "allowed", bountyType: "bounty", bountyMin: 100, bountyMax: 20000, currency: "EUR", industry: "Automotive", confidentiality: "application_only", safeHarbour: true, lastSynced: "2026-04-23 18:30", synced: true, scope: [{ tier: "in_scope", endpoint: "api.toyota-security.com", type: "url", description: "Connected vehicle API" }, { tier: "in_scope", endpoint: "10.0.0.0/8", type: "ip", description: "Internal test network" }, { tier: "out_scope", endpoint: "prod.toyota.com", type: "url", description: "Production systems — strictly OOB" }], userAgent: "EHBScanner/1.0", reqHeaders: ["X-Pentest-Auth: {token}"], rulesOfEngagement: ROE_DEFAULT },
  { id: "ing-bank", name: "ING Security", companyName: "ING Bank", complianceStatus: "conditional", bountyType: "bounty", bountyMin: 250, bountyMax: 25000, currency: "EUR", industry: "Finance", confidentiality: "application_only", safeHarbour: true, lastSynced: "2026-04-23 16:00", synced: true, scope: [{ tier: "in_scope", endpoint: "security-api.ing.com", type: "url", description: "Security testing API" }, { tier: "in_scope", endpoint: "sandbox.ing.com", type: "url", description: "Sandbox environment" }, { tier: "out_scope", endpoint: "*.ing.com", type: "wildcard", description: "All production systems" }], userAgent: "EHBScanner/1.0", reqHeaders: ["X-ING-Scanner: approved", "Authorization: Bearer {token}"], rulesOfEngagement: ROE_STRICT },
  { id: "philips", name: "Philips Healthcare", companyName: "Philips", complianceStatus: "allowed", bountyType: "responsible_disclosure", bountyMin: null, bountyMax: null, currency: "EUR", industry: "Healthcare", confidentiality: "public", safeHarbour: true, lastSynced: "2026-04-23 14:00", synced: true, scope: [{ tier: "in_scope", endpoint: "api.philips-health.com", type: "url", description: "Health platform API" }, { tier: "in_scope", endpoint: "*.philips-health.com", type: "wildcard", description: "Health subdomains" }, { tier: "out_scope", endpoint: "medical-devices.philips.com", type: "url", description: "Connected devices — out of scope" }], userAgent: "EHBScanner/1.0", reqHeaders: [], rulesOfEngagement: ROE_DEFAULT },
  { id: "bouygues", name: "Bouygues Telecom", companyName: "Bouygues", complianceStatus: "not_allowed", bountyType: "bounty", bountyMin: 50, bountyMax: 5000, currency: "EUR", industry: "Telecom", confidentiality: "public", safeHarbour: false, lastSynced: "2026-04-23 12:00", synced: true, scope: [{ tier: "in_scope", endpoint: "api.bouygues-telecom.fr", type: "url", description: "Telecom API" }, { tier: "out_scope", endpoint: "*.bouygues.com", type: "wildcard", description: "Corporate group" }], userAgent: "Not allowed", reqHeaders: [], rulesOfEngagement: "Automated scanning is strictly prohibited." },
  { id: "bnpparibas", name: "BNP Paribas", companyName: "BNP Paribas", complianceStatus: "allowed", bountyType: "bounty", bountyMin: 500, bountyMax: 50000, currency: "EUR", industry: "Finance", confidentiality: "application_only", safeHarbour: true, lastSynced: "2026-04-22 09:00", synced: true, scope: [{ tier: "in_scope", endpoint: "sandbox.bnpparibas.com", type: "url", description: "Sandbox environment" }, { tier: "in_scope", endpoint: "api-test.bnpparibas.com", type: "url", description: "Test API" }, { tier: "out_scope", endpoint: "*.bnpparibas.com", type: "wildcard", description: "All production systems" }], userAgent: "EHBScanner/1.0", reqHeaders: ["X-BNP-Auth: {token}"], rulesOfEngagement: ROE_DEFAULT },
  { id: "orange", name: "Orange SA", companyName: "Orange", complianceStatus: "allowed", bountyType: "bounty", bountyMin: 100, bountyMax: 15000, currency: "EUR", industry: "Telecom", confidentiality: "public", safeHarbour: true, lastSynced: "2026-04-22 12:00", synced: true, scope: [{ tier: "in_scope", endpoint: "*.orange.com", type: "wildcard", description: "All orange.com subdomains" }, { tier: "in_scope", endpoint: "api.orange.com", type: "url", description: "Public API" }, { tier: "out_scope", endpoint: "billing.orange.com", type: "url", description: "Billing system" }], userAgent: "EHBScanner/1.0", reqHeaders: [], rulesOfEngagement: ROE_DEFAULT },
  { id: "carrefour", name: "Carrefour Tech", companyName: "Carrefour", complianceStatus: "conditional", bountyType: "bounty", bountyMin: 50, bountyMax: 5000, currency: "EUR", industry: "Retail", confidentiality: "public", safeHarbour: true, lastSynced: "2026-04-21 18:00", synced: true, scope: [{ tier: "in_scope", endpoint: "api.carrefour.fr", type: "url", description: "E-commerce API" }, { tier: "in_scope", endpoint: "shop.carrefour.fr", type: "url", description: "Online shop" }, { tier: "out_scope", endpoint: "pos.carrefour.fr", type: "url", description: "Point of sale systems" }], userAgent: "EHBScanner/1.0", reqHeaders: ["X-Scanner: true"], rulesOfEngagement: ROE_STRICT },
  { id: "totalenergies", name: "TotalEnergies Digital", companyName: "TotalEnergies", complianceStatus: "allowed", bountyType: "bounty", bountyMin: 100, bountyMax: 10000, currency: "EUR", industry: "Energy", confidentiality: "application_only", safeHarbour: true, lastSynced: "2026-04-21 10:00", synced: true, scope: [{ tier: "in_scope", endpoint: "digital-api.total.com", type: "url", description: "Digital platform API" }, { tier: "out_scope", endpoint: "scada.total.com", type: "url", description: "SCADA systems — critical infra" }], userAgent: "EHBScanner/1.0", reqHeaders: [], rulesOfEngagement: ROE_DEFAULT },
  { id: "dassault", name: "Dassault Systèmes", companyName: "Dassault", complianceStatus: "allowed", bountyType: "responsible_disclosure", bountyMin: null, bountyMax: null, currency: "EUR", industry: "Technology", confidentiality: "public", safeHarbour: true, lastSynced: "—", synced: false, scope: [{ tier: "in_scope", endpoint: "*.3ds.com", type: "wildcard", description: "3DEXPERIENCE platform" }], userAgent: "EHBScanner/1.0", reqHeaders: [], rulesOfEngagement: ROE_DEFAULT },
  { id: "worldline", name: "Worldline Security", companyName: "Worldline", complianceStatus: "conditional", bountyType: "bounty", bountyMin: 200, bountyMax: 30000, currency: "EUR", industry: "Finance", confidentiality: "application_only", safeHarbour: true, lastSynced: "—", synced: false, scope: [{ tier: "in_scope", endpoint: "sandbox.worldline.com", type: "url", description: "Payment sandbox" }], userAgent: "EHBScanner/1.0", reqHeaders: ["X-WL-Scanner: {id}"], rulesOfEngagement: ROE_STRICT },
];

export const ACTIVITIES: Activity[] = [
  { id: "a01", timestamp: "2026-04-24 09:05", type: "program_synced", program: "Intigriti Core", diff: "Program synced — 2 scope changes detected" },
  { id: "a02", timestamp: "2026-04-24 09:00", type: "program_synced", program: "HackerOne Main", diff: "Program synced — no changes detected" },
  { id: "a03", timestamp: "2026-04-24 08:45", type: "scope_added", program: "Intigriti Core", diff: "Added api2.intigriti.com → in-scope (URL)" },
  { id: "a04", timestamp: "2026-04-24 08:45", type: "scope_removed", program: "Intigriti Core", diff: "Removed beta.intigriti.com from in-scope" },
  { id: "a05", timestamp: "2026-04-23 22:15", type: "bounty_changed", program: "Toyota Security", diff: "Bounty max: €15,000 → €20,000" },
  { id: "a06", timestamp: "2026-04-23 20:00", type: "compliance_changed", program: "Carrefour Tech", diff: "Automation policy: Allowed → Conditional" },
  { id: "a07", timestamp: "2026-04-23 18:30", type: "program_synced", program: "Toyota Security", diff: "Program synced — 1 bounty change detected" },
  { id: "a08", timestamp: "2026-04-23 16:00", type: "scope_added", program: "ING Security", diff: "Added sandbox.ing.com → in-scope (URL)" },
];

export const PAYOUTS: Payout[] = [
  { id: "pay01", amount: 2500, currency: "EUR", status: "paid", awardedAt: "2026-04-22", program: "HackerOne Main", scanRef: "h01", finding: "SQLi in /api/search" },
  { id: "pay02", amount: 500, currency: "EUR", status: "pending", awardedAt: "2026-04-24", program: "Intigriti Core", scanRef: "h04", finding: "IDOR at /api/reports/{id}" },
  { id: "pay03", amount: 4800, currency: "EUR", status: "paid", awardedAt: "2026-04-20", program: "ING Security", scanRef: "h06", finding: "Auth bypass on /api/sessions" },
  { id: "pay04", amount: 1200, currency: "EUR", status: "paid", awardedAt: "2026-04-18", program: "Toyota Security", scanRef: "h09", finding: "Reflected XSS at /search?q=" },
  { id: "pay05", amount: 800, currency: "EUR", status: "pending", awardedAt: "2026-04-24", program: "Orange SA", scanRef: "h11", finding: "SSRF via /api/proxy endpoint" },
  { id: "pay06", amount: 350, currency: "EUR", status: "paid", awardedAt: "2026-04-15", program: "YesWeHack", scanRef: "h02", finding: "Info disclosure in error responses" },
  { id: "pay07", amount: 6000, currency: "EUR", status: "paid", awardedAt: "2026-04-10", program: "BNP Paribas", scanRef: "h14", finding: "IDOR in payment records" },
  { id: "pay08", amount: 250, currency: "EUR", status: "pending", awardedAt: "2026-04-23", program: "Carrefour Tech", scanRef: "h13", finding: "Access control bypass on /admin" },
];

export const ALL_INDUSTRIES = Array.from(new Set(PROGRAMS.map((p) => p.industry))).sort();
export const SYNCED_PROGRAMS = PROGRAMS.filter((p) => p.synced);
export const LIVE_PROGRAMS = PROGRAMS;
