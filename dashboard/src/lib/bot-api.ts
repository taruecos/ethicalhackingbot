const BOT_API_URL = process.env.BOT_API_URL || "http://localhost:8080";
const DASHBOARD_TOKEN = process.env.DASHBOARD_TOKEN || "";

export async function botFetch(path: string, options: RequestInit = {}) {
  const url = `${BOT_API_URL}${path}`;
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
    throw new Error(`Bot API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}
