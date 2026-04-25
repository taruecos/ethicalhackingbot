/**
 * Intigriti Researcher API client — server-side only.
 * Replaces the Python proxy; Next.js calls Intigriti directly.
 */

import { prisma } from "@/lib/db";

const BASE_URL = "https://api.intigriti.com/external/researcher/v1";

async function getToken(): Promise<string> {
  try {
    const config = await prisma.intigritiConfig.findUnique({ where: { id: "singleton" } });
    if (config?.token) return config.token;
  } catch {
    // Table may not exist yet pre-migration — fall through to env
  }
  return process.env.INTIGRITI_API_TOKEN || "";
}

async function intigritiGet(path: string, params?: Record<string, string>) {
  const url = new URL(`${BASE_URL}${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v) url.searchParams.set(k, v);
    });
  }
  const token = await getToken();
  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
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
