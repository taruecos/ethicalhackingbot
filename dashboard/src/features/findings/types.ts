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

interface ApiFinding {
  id: string;
  scanId: string;
  module: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
  confidence: number;
  title: string;
  description: string;
  url: string | null;
  evidence: Record<string, unknown> | null;
  remediation: string | null;
  status: FindingStatus;
  falsePositive: boolean;
  cweId: string | null;
  cvssScore: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  scan?: { target: string };
}

export function apiToFinding(api: ApiFinding): Finding {
  const sev = api.severity.toLowerCase() as Severity;
  let conf: Finding["confidence"] = "medium";
  if (api.confidence >= 0.75) conf = "high";
  else if (api.confidence < 0.4) conf = "low";

  return {
    id: api.id,
    severity: sev,
    status: api.status,
    title: api.title,
    module: api.module,
    url: api.url ?? "",
    cvss: api.cvssScore ?? 0,
    cwe: api.cweId ?? "—",
    confidence: conf,
    firstSeen: api.createdAt,
    scanId: api.scanId,
    scanName: api.scan?.target ?? api.scanId.slice(0, 8),
    program: api.scan?.target ?? "—",
    description: api.description,
    evidence: api.evidence ?? {},
    remediation: api.remediation ?? "",
    notes: api.notes ?? "",
    notesUpdatedAt: api.notes ? api.updatedAt : null,
  };
}
