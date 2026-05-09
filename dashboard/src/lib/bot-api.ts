import { getDashboardToken } from "@/lib/auth";

const SCAN_SERVICE_URL = process.env.SCAN_SERVICE_URL || "http://localhost:8000";

export async function scanServiceFetch(path: string, options: RequestInit = {}) {
  const token = getDashboardToken();
  const url = `${SCAN_SERVICE_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Scan service error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}
