/**
 * Intigriti Researcher API client — server-side only.
 * Replaces the Python proxy; Next.js calls Intigriti directly.
 */

import crypto from "crypto";

const DEFAULT_BASE_URL = "https://api.intigriti.com/external/researcher/v1";
const STUB_TOKEN_SENTINEL = "stub-mode";

const BASE_URL = process.env.INTIGRITI_API_URL || DEFAULT_BASE_URL;

function getToken(): string {
  return process.env.INTIGRITI_API_TOKEN || "";
}

/** Mirror of src/reporter/intigriti_submitter.py SEVERITY_MAP. info => null. */
const SEVERITY_MAP: Record<string, string | null> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
  info: null,
};

/** Mirror of src/reporter/intigriti_submitter.py TYPE_MAP. */
const TYPE_MAP: Record<string, string> = {
  idor: "Insecure Direct Object Reference",
  xss: "Cross-Site Scripting",
  sqli: "SQL Injection",
  ssrf: "Server-Side Request Forgery",
  csrf: "Cross-Site Request Forgery",
  access_control: "Broken Access Control",
  info_disclosure: "Information Disclosure",
  differential: "Authorization Flaw",
};

export type FindingPayload = {
  module: string;
  severity: string;
  title: string;
  description: string;
  url?: string | null;
  evidence?: unknown;
  cvssVector?: string | null;
  cweId?: string | null;
};

export type SubmissionResult = {
  submissionId: string | null;
  status: "stubbed" | "submitted" | "deduped" | "rejected_info_severity";
  deduped: boolean;
  stubbed: boolean;
};

export function isStubMode(): boolean {
  const t = getToken();
  return !t || t === STUB_TOKEN_SENTINEL;
}

/** SHA256(programId|module|title|url|cweId) — matches Python `compute_dedup_hash`. */
export function computeDedupHash(finding: FindingPayload, programId: string): string {
  const material = [
    programId,
    finding.module ?? "",
    finding.title ?? "",
    finding.url ?? "",
    finding.cweId ?? "",
  ].join("|");
  return crypto.createHash("sha256").update(material).digest("hex");
}

/**
 * Submit a single confirmed finding to Intigriti.
 * When INTIGRITI_API_TOKEN is missing or 'stub-mode', logs intent and
 * returns a deterministic fake id without any HTTP call.
 */
export async function submitFinding(
  finding: FindingPayload,
  programId: string
): Promise<SubmissionResult> {
  const dedupHash = computeDedupHash(finding, programId);
  const severityLabel = SEVERITY_MAP[(finding.severity || "").toLowerCase()];

  if (severityLabel === null || severityLabel === undefined) {
    return {
      submissionId: null,
      status: "rejected_info_severity",
      deduped: false,
      stubbed: isStubMode(),
    };
  }

  if (isStubMode()) {
    const stubId = `stub-${dedupHash.slice(0, 12)}`;
    console.log(`[STUB] would submit ${finding.title} to ${programId}`);
    return {
      submissionId: stubId,
      status: "stubbed",
      deduped: false,
      stubbed: true,
    };
  }

  const payload: Record<string, unknown> = {
    programId,
    title: finding.title,
    description: finding.description,
    severity: severityLabel,
    type: TYPE_MAP[(finding.module || "").toLowerCase()] || "Other",
  };
  if (finding.url) payload.endpoint = finding.url;
  if (finding.evidence) payload.evidence = finding.evidence;
  if (finding.cvssVector) payload.cvssVector = finding.cvssVector;
  if (finding.cweId) payload.cweId = finding.cweId;

  const res = await fetch(`${BASE_URL}/submissions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getToken()}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Intigriti submit failed: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as Record<string, unknown>;
  const submissionId =
    (data.id as string) ||
    (data.submissionId as string) ||
    (data.submission_id as string) ||
    "";
  if (!submissionId) {
    throw new Error("Intigriti response missing submission id");
  }
  return {
    submissionId,
    status: "submitted",
    deduped: false,
    stubbed: false,
  };
}

async function intigritiGet(path: string, params?: Record<string, string>) {
  const url = new URL(`${BASE_URL}${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v) url.searchParams.set(k, v);
    });
  }
  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${getToken()}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Intigriti API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export async function listPrograms(opts: {
  limit?: number;
  offset?: number;
  following?: boolean;
  statusId?: number;
  typeId?: number;
} = {}) {
  const params: Record<string, string> = {
    limit: String(opts.limit ?? 100),
    offset: String(opts.offset ?? 0),
  };
  if (opts.following) params.following = "true";
  if (opts.statusId !== undefined) params.statusId = String(opts.statusId);
  if (opts.typeId !== undefined) params.typeId = String(opts.typeId);
  return intigritiGet("/programs", params);
}

export async function getProgramDetail(programId: string) {
  return intigritiGet(`/programs/${programId}`);
}

export async function getActivities(opts: {
  limit?: number;
  offset?: number;
  following?: boolean;
} = {}) {
  const params: Record<string, string> = {
    limit: String(opts.limit ?? 50),
    offset: String(opts.offset ?? 0),
  };
  if (opts.following) params.following = "true";
  return intigritiGet("/programs/activities", params);
}

export async function getPayouts(opts: {
  limit?: number;
  offset?: number;
} = {}) {
  const params: Record<string, string> = {
    limit: String(opts.limit ?? 100),
    offset: String(opts.offset ?? 0),
  };
  return intigritiGet("/payouts", params);
}

/** Extract compliance/ROE info from program detail response */
export function extractCompliance(programDetail: Record<string, unknown>) {
  const roe = programDetail.rulesOfEngagement as Record<string, unknown> | undefined;
  const content = (roe?.content ?? {}) as Record<string, unknown>;
  const testing = (content.testingRequirements ?? {}) as Record<string, unknown>;

  const automated = testing.automatedTooling as number | boolean | null | undefined;
  let toolingStatus: string;
  if (automated === null || automated === undefined) {
    toolingStatus = "unknown";
  } else if (automated === 1 || automated === true) {
    toolingStatus = "allowed";
  } else if (automated === 0 || automated === false) {
    toolingStatus = "not_allowed";
  } else {
    toolingStatus = "conditional";
  }

  return {
    automatedTooling: automated,
    automatedToolingStatus: toolingStatus,
    safeHarbour: Boolean(content.safeHarbour),
    userAgent: (testing.userAgent as string) || null,
    requestHeader: (testing.requestHeader as string) || null,
    description: (content.description as string) || "",
    intigritiMe: Boolean(testing.intigritiMe),
  };
}

/** Normalize an Intigriti program to our DB format */
export function normalizeProgram(raw: Record<string, unknown>) {
  const domains: unknown[] = [];
  const domainsData = raw.domains as Record<string, unknown> | undefined;
  if (domainsData?.content && Array.isArray(domainsData.content)) {
    for (const d of domainsData.content) {
      const domain = d as Record<string, unknown>;
      const type = domain.type as Record<string, unknown> | undefined;
      const tier = domain.tier as Record<string, unknown> | undefined;
      domains.push({
        id: domain.id || "",
        type: type?.value || "url",
        endpoint: domain.endpoint || "",
        tier: tier?.value || "",
        description: domain.description || "",
      });
    }
  }

  const minBounty = raw.minBounty as Record<string, unknown> | undefined;
  const maxBounty = raw.maxBounty as Record<string, unknown> | undefined;
  const status = raw.status as Record<string, unknown> | undefined;
  const pType = raw.type as Record<string, unknown> | undefined;
  const conf = raw.confidentialityLevel as Record<string, unknown> | undefined;
  const webLinks = raw.webLinks as Record<string, unknown> | undefined;
  const compliance = raw.rulesOfEngagement ? extractCompliance(raw) : null;

  return {
    platform: "INTIGRITI" as const,
    name: (raw.name as string) || "",
    slug: (raw.handle as string) || "",
    url: (webLinks?.detail as string) || "",
    intigritiId: (raw.id as string) || "",
    scope: domains,
    compliance: compliance || {},
    minBounty: minBounty?.value as number | undefined,
    maxBounty: maxBounty?.value as number | undefined,
    currency: (maxBounty?.currency as string) || "EUR",
    industry: (raw.industry as string) || null,
    programType: (pType?.value as string) || null,
    confidentiality: (conf?.value as string) || null,
    active: (status?.value as string)?.toLowerCase() === "open",
  };
}
