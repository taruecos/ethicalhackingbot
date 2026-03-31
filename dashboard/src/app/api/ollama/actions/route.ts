import { NextRequest, NextResponse } from "next/server";

const DASHBOARD_URL = process.env.DASHBOARD_URL || "http://localhost:3000";

// Proxy API actions from Ollama to the dashboard's own API
export async function POST(req: NextRequest) {
  try {
    const { method, endpoint, body } = await req.json();

    if (!endpoint) {
      return NextResponse.json({ error: "endpoint required" }, { status: 400 });
    }

    // Only allow /api/* endpoints
    if (!endpoint.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Only /api/* endpoints allowed" },
        { status: 400 }
      );
    }

    // Block recursive calls to ollama endpoints
    if (endpoint.startsWith("/api/ollama")) {
      return NextResponse.json(
        { error: "Cannot call ollama endpoints recursively" },
        { status: 400 }
      );
    }

    const url = `${DASHBOARD_URL}${endpoint}`;
    const fetchOptions: RequestInit = {
      method: method || "GET",
      headers: { "Content-Type": "application/json" },
    };

    if (body && method !== "GET") {
      fetchOptions.body = JSON.stringify(body);
    }

    const response = await fetch(url, fetchOptions);
    const data = await response.json();

    return NextResponse.json({
      status: response.status,
      data,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
