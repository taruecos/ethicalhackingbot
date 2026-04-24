export type Severity = "critical" | "high" | "medium" | "low" | "info";
export type FindingStatus = "NEW" | "CONFIRMED" | "FALSE_POSITIVE" | "FIXED" | "ACCEPTED" | "REPORTED";

export interface Finding {
  id: string;
  severity: Severity;
  status: FindingStatus;
  title: string;
  module: string;
  url: string;
  cvss: number;
  cwe: string;
  confidence: "high" | "medium" | "low";
  firstSeen: string;
  scanId: string;
  scanName: string;
  program: string;
  description: string;
  evidence: Record<string, unknown>;
  remediation: string;
  notes: string;
  notesUpdatedAt: string | null;
}

export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

const baseEvidence = {
  request: "POST /api/search HTTP/1.1\nHost: api.example.com\nContent-Type: application/json\n\n{\"q\":\"' OR 1=1--\"}",
  response: "HTTP/1.1 500 Internal Server Error\nContent-Type: text/html\n\nMySQL Error: syntax error near '''",
  payload: "' OR 1=1--",
  response_time_ms: 4320,
};

const baseRemediation = `## Fix steps

1. Switch to **parameterized queries** (prepared statements) for every SQL call.
2. Validate and sanitise inputs at the API boundary (allow-list, not deny-list).
3. Enforce the principle of least privilege on the database user.
4. Add WAF rules blocking common SQL meta-characters on this endpoint.

## References
- CWE-89: SQL Injection
- OWASP ASVS v4 — V5.3.4`;

export const FINDINGS: Finding[] = [
  {
    id: "f001",
    severity: "critical",
    status: "CONFIRMED",
    title: "Remote Code Execution via Deserialization",
    module: "RCE",
    url: "https://api.toyota-security.com/v2/jobs/import",
    cvss: 9.8,
    cwe: "CWE-502",
    confidence: "high",
    firstSeen: "2026-04-24T07:12:00Z",
    scanId: "sc-h09",
    scanName: "Toyota API — Full",
    program: "Toyota Security",
    description:
      "## Remote Code Execution via Java Deserialization\n\nThe endpoint accepts a serialized Java object and deserialises it without any allow-list check. A crafted `CommonsCollections4` gadget chain achieves code execution on the application host.",
    evidence: baseEvidence,
    remediation: baseRemediation,
    notes: "",
    notesUpdatedAt: null,
  },
  {
    id: "f002",
    severity: "critical",
    status: "NEW",
    title: "SQL injection in /api/search",
    module: "SQLi",
    url: "https://api.hackerone.com/api/search",
    cvss: 9.1,
    cwe: "CWE-89",
    confidence: "high",
    firstSeen: "2026-04-24T06:45:00Z",
    scanId: "sc-h01",
    scanName: "HackerOne — Daily",
    program: "HackerOne Main",
    description: "## Time-based blind SQL injection\n\nThe `q` parameter of `/api/search` is vulnerable to blind SQL injection via timing side-channels.",
    evidence: baseEvidence,
    remediation: baseRemediation,
    notes: "",
    notesUpdatedAt: null,
  },
  {
    id: "f003",
    severity: "high",
    status: "CONFIRMED",
    title: "Reflected XSS in /search?q=",
    module: "XSS",
    url: "https://app.hackerone.com/search",
    cvss: 7.5,
    cwe: "CWE-79",
    confidence: "high",
    firstSeen: "2026-04-24T05:22:00Z",
    scanId: "sc-h01",
    scanName: "HackerOne — Daily",
    program: "HackerOne Main",
    description: "## Reflected XSS via unencoded query parameter",
    evidence: baseEvidence,
    remediation: "## Fix\n\n1. HTML-encode user input before rendering.\n2. Add a strict CSP (`default-src 'self'`).",
    notes: "",
    notesUpdatedAt: null,
  },
  {
    id: "f004",
    severity: "high",
    status: "NEW",
    title: "IDOR on /api/reports/{id}",
    module: "IDOR",
    url: "https://api.intigriti.com/reports/142",
    cvss: 8.1,
    cwe: "CWE-639",
    confidence: "high",
    firstSeen: "2026-04-23T18:30:00Z",
    scanId: "sc-h04",
    scanName: "Intigriti — Compliance",
    program: "Intigriti Core",
    description: "## Insecure Direct Object Reference\n\nSequential numeric IDs on `/api/reports/{id}` return other users' reports.",
    evidence: baseEvidence,
    remediation: "## Fix\n\n1. Enforce per-object authorisation on every read.\n2. Switch to opaque UUIDs.",
    notes: "",
    notesUpdatedAt: null,
  },
  {
    id: "f005",
    severity: "medium",
    status: "CONFIRMED",
    title: "SSRF via /api/fetch parameter",
    module: "SSRF",
    url: "https://api.intigriti.com/fetch",
    cvss: 6.5,
    cwe: "CWE-918",
    confidence: "medium",
    firstSeen: "2026-04-23T15:10:00Z",
    scanId: "sc-h04",
    scanName: "Intigriti — Compliance",
    program: "Intigriti Core",
    description: "## Server-Side Request Forgery\n\nThe `url` parameter of `/api/fetch` follows redirects to internal metadata endpoints.",
    evidence: baseEvidence,
    remediation: "## Fix\n\n1. Block `169.254.*` and `127.0.0.1`.\n2. Use an allow-list of schemes and hosts.",
    notes: "",
    notesUpdatedAt: null,
  },
  {
    id: "f006",
    severity: "medium",
    status: "FIXED",
    title: "Missing CSRF token on /api/transfer",
    module: "CSRF",
    url: "https://app.hackerone.com/api/transfer",
    cvss: 5.4,
    cwe: "CWE-352",
    confidence: "medium",
    firstSeen: "2026-04-22T09:00:00Z",
    scanId: "sc-h06",
    scanName: "HackerOne — Shop",
    program: "HackerOne Main",
    description: "## Missing CSRF token on state-change endpoint",
    evidence: baseEvidence,
    remediation: "## Fix\n\n1. Enforce anti-CSRF token on every POST.\n2. Require `SameSite=Lax` cookies.",
    notes: "Verified fix on 2026-04-23 by manual re-test.",
    notesUpdatedAt: "2026-04-23T16:10:00Z",
  },
  {
    id: "f007",
    severity: "low",
    status: "REPORTED",
    title: "Information disclosure in error responses",
    module: "Info Disclosure",
    url: "https://api.yeswehack.com/api/users",
    cvss: 3.1,
    cwe: "CWE-209",
    confidence: "medium",
    firstSeen: "2026-04-22T11:50:00Z",
    scanId: "sc-h02",
    scanName: "YesWeHack — Daily",
    program: "YesWeHack",
    description: "## Verbose stack traces\n\nError responses include Python stack traces revealing internal paths.",
    evidence: baseEvidence,
    remediation: "## Fix\n\n1. Return sanitised error responses in production.",
    notes: "",
    notesUpdatedAt: null,
  },
  {
    id: "f008",
    severity: "info",
    status: "ACCEPTED",
    title: "HSTS header missing on www subdomain",
    module: "Header Check",
    url: "https://www.hackerone.com",
    cvss: 0.0,
    cwe: "CWE-693",
    confidence: "high",
    firstSeen: "2026-04-21T20:00:00Z",
    scanId: "sc-h01",
    scanName: "HackerOne — Daily",
    program: "HackerOne Main",
    description: "## HSTS not set\n\nThe `Strict-Transport-Security` header is absent.",
    evidence: baseEvidence,
    remediation: "## Fix\n\nAdd `Strict-Transport-Security: max-age=31536000; includeSubDomains`.",
    notes: "Accepted as a known gap — tracked in ticket SEC-1209.",
    notesUpdatedAt: "2026-04-22T09:00:00Z",
  },
  {
    id: "f009",
    severity: "low",
    status: "NEW",
    title: "Cookie missing Secure flag",
    module: "Header Check",
    url: "https://app.bugcrowd.com",
    cvss: 3.4,
    cwe: "CWE-614",
    confidence: "high",
    firstSeen: "2026-04-21T12:00:00Z",
    scanId: "sc-h02",
    scanName: "Bugcrowd — Core",
    program: "Bugcrowd Platform",
    description: "## Cookie Secure flag",
    evidence: baseEvidence,
    remediation: "## Fix\n\nAdd the `Secure` and `HttpOnly` flags on the session cookie.",
    notes: "",
    notesUpdatedAt: null,
  },
  {
    id: "f010",
    severity: "high",
    status: "FALSE_POSITIVE",
    title: "Suspected open redirect on /go",
    module: "Open Redirect",
    url: "https://app.hackerone.com/go",
    cvss: 7.1,
    cwe: "CWE-601",
    confidence: "low",
    firstSeen: "2026-04-20T14:30:00Z",
    scanId: "sc-h01",
    scanName: "HackerOne — Daily",
    program: "HackerOne Main",
    description: "## Open redirect candidate\n\nThe `/go` endpoint enforces an allow-list of destinations — marked as false positive after manual review.",
    evidence: baseEvidence,
    remediation: "## Fix\n\nNo action required — behaviour is by design.",
    notes: "Manual retest on 2026-04-21 confirmed the allow-list works.",
    notesUpdatedAt: "2026-04-21T10:00:00Z",
  },
];

export const ALL_MODULES = Array.from(new Set(FINDINGS.map((f) => f.module))).sort();
export const ALL_SCANS = Array.from(new Set(FINDINGS.map((f) => f.scanName))).sort();
export const ALL_PROGRAMS = Array.from(new Set(FINDINGS.map((f) => f.program))).sort();

export const FINDING_STATS = {
  total: FINDINGS.length,
  critical: FINDINGS.filter((f) => f.severity === "critical").length,
  newCount: FINDINGS.filter((f) => f.status === "NEW").length,
};
