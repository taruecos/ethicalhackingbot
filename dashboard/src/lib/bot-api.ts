const SCAN_SERVICE_URL = process.env.SCAN_SERVICE_URL || "http://localhost:8000";
const DASHBOARD_TOKEN = process.env.DASHBOARD_TOKEN || "";

export async function scanServiceFetch(path: string, options: RequestInit = {}) {
  const url = `${SCAN_SERVICE_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${DASHBOARD_TOKEN}`,
      ...options.headers,
    },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Scan service error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}
