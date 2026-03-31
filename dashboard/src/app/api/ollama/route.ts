import { NextRequest, NextResponse } from "next/server";

const OLLAMA_URL = process.env.OLLAMA_URL || "http://ollama:11434";

const SYSTEM_PROMPT = `You are an AI assistant embedded in a Bug Bounty Dashboard. You have full access to:

1. **Dashboard source code** — You can read and modify any React component, API route, or configuration file in the dashboard project.
2. **Dashboard API actions** — You can trigger scans, sync programs, query findings, generate reports, and manage the entire dashboard through its API.
3. **File system** — You can read/write files within the dashboard project directory.

When the user asks you to change something in the dashboard, you should:
- First explain what you'll change
- Use the available tools to read the current code, modify it, and confirm the change

Available tools (use JSON in your response to invoke them):

**Read a file:**
\`\`\`json
{"tool": "read_file", "path": "src/app/(dashboard)/overview/page.tsx"}
\`\`\`

**Write a file:**
\`\`\`json
{"tool": "write_file", "path": "src/components/my-component.tsx", "content": "...file content..."}
\`\`\`

**List files:**
\`\`\`json
{"tool": "list_files", "path": "src/components"}
\`\`\`

**Execute a dashboard API action:**
\`\`\`json
{"tool": "api_action", "method": "GET", "endpoint": "/api/stats/overview"}
\`\`\`

**Run a shell command (within the project directory):**
\`\`\`json
{"tool": "shell", "command": "ls -la src/"}
\`\`\`

Always respond conversationally, but embed tool calls when needed. The system will execute them and return results.
Be concise and direct. You're a senior developer helping manage this dashboard.`;

export async function POST(req: NextRequest) {
  try {
    const { messages, model } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: "messages array required" }, { status: 400 });
    }

    const ollamaMessages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...messages,
    ];

    const response = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: model || "qwen2:0.5b",
        messages: ollamaMessages,
        stream: true,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return NextResponse.json(
        { error: `Ollama error: ${error}` },
        { status: response.status }
      );
    }

    // Stream the response back
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body?.getReader();
        if (!reader) {
          controller.close();
          return;
        }

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const parsed = JSON.parse(line);
              if (parsed.message?.content) {
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ content: parsed.message.content, done: parsed.done })}\n\n`)
                );
              }
              if (parsed.done) {
                controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              }
            } catch {
              // skip malformed lines
            }
          }
        }
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: `Failed to connect to Ollama: ${error}` },
      { status: 500 }
    );
  }
}

// GET — check Ollama status and available models
export async function GET() {
  try {
    const response = await fetch(`${OLLAMA_URL}/api/tags`);
    if (!response.ok) {
      return NextResponse.json({ status: "offline" }, { status: 503 });
    }
    const data = await response.json();
    return NextResponse.json({
      status: "online",
      models: data.models || [],
    });
  } catch {
    return NextResponse.json({ status: "offline" }, { status: 503 });
  }
}
