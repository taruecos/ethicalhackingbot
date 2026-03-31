"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Terminal as TerminalIcon,
  Send,
  Loader2,
  Circle,
  FolderOpen,
  Trash2,
  ChevronDown,
} from "lucide-react";

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
  toolCalls?: ToolResult[];
}

interface ToolResult {
  tool: string;
  input: string;
  output: string;
  status: "success" | "error";
}

interface OllamaModel {
  name: string;
  size: number;
  modified_at: string;
}

export default function TerminalPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [ollamaStatus, setOllamaStatus] = useState<"checking" | "online" | "offline">("checking");
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [selectedModel, setSelectedModel] = useState("qwen2:0.5b");
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Check Ollama status on mount
  useEffect(() => {
    checkOllamaStatus();
  }, []);

  async function checkOllamaStatus() {
    setOllamaStatus("checking");
    try {
      const res = await fetch("/api/ollama");
      const data = await res.json();
      setOllamaStatus(data.status === "online" ? "online" : "offline");
      if (data.models) {
        setModels(data.models);
        if (data.models.length > 0 && !data.models.find((m: OllamaModel) => m.name.startsWith(selectedModel))) {
          setSelectedModel(data.models[0].name);
        }
      }
    } catch {
      setOllamaStatus("offline");
    }
  }

  // Parse and execute tool calls from assistant response
  async function executeToolCalls(content: string): Promise<ToolResult[]> {
    const toolPattern = /```json\s*\n?\s*(\{[\s\S]*?"tool"[\s\S]*?\})\s*\n?\s*```/g;
    const results: ToolResult[] = [];

    let match;
    while ((match = toolPattern.exec(content)) !== null) {
      try {
        const toolCall = JSON.parse(match[1]);
        const result = await executeToolCall(toolCall);
        results.push(result);
      } catch {
        // Skip malformed tool calls
      }
    }

    return results;
  }

  async function executeToolCall(toolCall: Record<string, unknown>): Promise<ToolResult> {
    const { tool, ...params } = toolCall;

    try {
      switch (tool) {
        case "read_file":
        case "list_files": {
          const res = await fetch(`/api/ollama/files?path=${encodeURIComponent(String(params.path || ""))}`);
          const data = await res.json();
          return {
            tool: String(tool),
            input: String(params.path || ""),
            output: JSON.stringify(data, null, 2),
            status: res.ok ? "success" : "error",
          };
        }

        case "write_file": {
          const res = await fetch("/api/ollama/files", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ path: params.path, content: params.content }),
          });
          const data = await res.json();
          return {
            tool: "write_file",
            input: String(params.path),
            output: JSON.stringify(data),
            status: res.ok ? "success" : "error",
          };
        }

        case "api_action": {
          const res = await fetch("/api/ollama/actions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              method: params.method,
              endpoint: params.endpoint,
              body: params.body,
            }),
          });
          const data = await res.json();
          return {
            tool: "api_action",
            input: `${params.method} ${params.endpoint}`,
            output: JSON.stringify(data, null, 2),
            status: res.ok ? "success" : "error",
          };
        }

        case "shell": {
          return {
            tool: "shell",
            input: String(params.command),
            output: "Shell execution disabled in browser context",
            status: "error",
          };
        }

        default:
          return {
            tool: String(tool),
            input: JSON.stringify(params),
            output: `Unknown tool: ${tool}`,
            status: "error",
          };
      }
    } catch (error) {
      return {
        tool: String(tool),
        input: JSON.stringify(params),
        output: String(error),
        status: "error",
      };
    }
  }

  async function sendMessage() {
    if (!input.trim() || isStreaming) return;

    const userMessage: Message = { role: "user", content: input.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setIsStreaming(true);

    const assistantMessage: Message = { role: "assistant", content: "" };
    setMessages([...newMessages, assistantMessage]);

    try {
      abortRef.current = new AbortController();

      const chatMessages = newMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch("/api/ollama", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: chatMessages, model: selectedModel }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const error = await res.json();
        assistantMessage.content = `Error: ${error.error || "Failed to get response"}`;
        setMessages([...newMessages, { ...assistantMessage }]);
        setIsStreaming(false);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No reader");

      const decoder = new TextDecoder();
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") continue;
            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                fullContent += parsed.content;
                setMessages([
                  ...newMessages,
                  { ...assistantMessage, content: fullContent },
                ]);
              }
            } catch {
              // skip
            }
          }
        }
      }

      // After streaming, check for tool calls and execute them
      const toolResults = await executeToolCalls(fullContent);
      if (toolResults.length > 0) {
        const updatedAssistant = {
          ...assistantMessage,
          content: fullContent,
          toolCalls: toolResults,
        };
        const updatedMessages = [...newMessages, updatedAssistant];
        setMessages(updatedMessages);

        // Feed tool results back to Ollama for a follow-up response
        const toolResultContent = toolResults
          .map((r) => `Tool "${r.tool}" (${r.status}):\n${r.output}`)
          .join("\n\n");

        const followUpMessages = [
          ...chatMessages,
          { role: "assistant", content: fullContent },
          { role: "user", content: `[Tool Results]\n${toolResultContent}\n\nPlease continue based on these results.` },
        ];

        const followUp: Message = { role: "assistant", content: "" };
        setMessages([...updatedMessages, followUp]);

        const followUpRes = await fetch("/api/ollama", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: followUpMessages, model: selectedModel }),
        });

        if (followUpRes.ok) {
          const followUpReader = followUpRes.body?.getReader();
          if (followUpReader) {
            let followUpContent = "";
            while (true) {
              const { done, value } = await followUpReader.read();
              if (done) break;
              const chunk = decoder.decode(value, { stream: true });
              const lines = chunk.split("\n");
              for (const line of lines) {
                if (line.startsWith("data: ")) {
                  const data = line.slice(6);
                  if (data === "[DONE]") continue;
                  try {
                    const parsed = JSON.parse(data);
                    if (parsed.content) {
                      followUpContent += parsed.content;
                      setMessages([
                        ...updatedMessages,
                        { ...followUp, content: followUpContent },
                      ]);
                    }
                  } catch {
                    // skip
                  }
                }
              }
            }
          }
        }
      }
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        setMessages([
          ...newMessages,
          { role: "assistant", content: `Connection error: ${error}` },
        ]);
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function clearChat() {
    setMessages([]);
  }

  function stopStreaming() {
    abortRef.current?.abort();
    setIsStreaming(false);
  }

  function formatSize(bytes: number): string {
    if (bytes < 1e9) return `${(bytes / 1e6).toFixed(0)}MB`;
    return `${(bytes / 1e9).toFixed(1)}GB`;
  }

  return (
    <div className="flex flex-col h-[calc(100vh-80px)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[var(--accent-dim)] flex items-center justify-center">
            <TerminalIcon className="w-5 h-5 text-[var(--accent)]" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-[var(--text)]">AI Terminal</h1>
            <div className="flex items-center gap-2 text-xs text-[var(--dim)]">
              <Circle
                className={`w-2 h-2 fill-current ${
                  ollamaStatus === "online"
                    ? "text-green-500"
                    : ollamaStatus === "offline"
                    ? "text-red-500"
                    : "text-yellow-500"
                }`}
              />
              <span>
                Ollama{" "}
                {ollamaStatus === "checking"
                  ? "connecting..."
                  : ollamaStatus}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Model selector */}
          <div className="relative">
            <button
              onClick={() => setShowModelDropdown(!showModelDropdown)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-sm text-[var(--text)] hover:bg-[var(--surface2)]"
            >
              <span className="max-w-[120px] truncate">{selectedModel}</span>
              <ChevronDown className="w-3 h-3" />
            </button>
            {showModelDropdown && (
              <div className="absolute right-0 top-full mt-1 w-64 bg-[var(--surface)] border border-[var(--border)] rounded-lg shadow-xl z-10 overflow-hidden">
                {models.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-[var(--dim)]">No models loaded</div>
                ) : (
                  models.map((m) => (
                    <button
                      key={m.name}
                      onClick={() => {
                        setSelectedModel(m.name);
                        setShowModelDropdown(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-[var(--surface2)] flex justify-between ${
                        selectedModel === m.name ? "text-[var(--accent)]" : "text-[var(--text)]"
                      }`}
                    >
                      <span>{m.name}</span>
                      <span className="text-[var(--dim)]">{formatSize(m.size)}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          <button
            onClick={clearChat}
            className="p-2 rounded-lg text-[var(--dim)] hover:text-[var(--text)] hover:bg-[var(--surface2)]"
            title="Clear chat"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto rounded-lg bg-[var(--surface)] border border-[var(--border)] p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <TerminalIcon className="w-12 h-12 text-[var(--dim)] mb-4 opacity-30" />
            <p className="text-[var(--dim)] text-sm mb-2">AI Terminal ready</p>
            <p className="text-[var(--dim)] text-xs max-w-md">
              Ask me to modify the dashboard, query data, trigger scans, or explore the codebase.
              I have full access to the source code and all API endpoints.
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-lg px-4 py-3 text-sm ${
                msg.role === "user"
                  ? "bg-[var(--accent-dim)] text-[var(--text)]"
                  : "bg-[var(--surface2)] text-[var(--text)]"
              }`}
            >
              <pre className="whitespace-pre-wrap font-[inherit] m-0">{msg.content}</pre>

              {/* Tool call results */}
              {msg.toolCalls && msg.toolCalls.length > 0 && (
                <div className="mt-3 space-y-2">
                  {msg.toolCalls.map((tc, j) => (
                    <details key={j} className="group">
                      <summary className="cursor-pointer flex items-center gap-2 text-xs text-[var(--dim)] hover:text-[var(--text)]">
                        <FolderOpen className="w-3 h-3" />
                        <span>{tc.tool}</span>
                        <span className="text-[var(--dim)]">({tc.input})</span>
                        <span className={tc.status === "success" ? "text-green-400" : "text-red-400"}>
                          {tc.status}
                        </span>
                      </summary>
                      <pre className="mt-1 p-2 rounded bg-[var(--bg)] text-xs overflow-x-auto max-h-40 overflow-y-auto">
                        {tc.output}
                      </pre>
                    </details>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {isStreaming && (
          <div className="flex items-center gap-2 text-xs text-[var(--dim)]">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>Generating...</span>
            <button
              onClick={stopStreaming}
              className="text-[var(--red)] hover:underline text-xs"
            >
              Stop
            </button>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="mt-3 flex gap-2">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            ollamaStatus === "online"
              ? "Ask me anything about the dashboard..."
              : "Waiting for Ollama connection..."
          }
          disabled={ollamaStatus !== "online"}
          rows={1}
          className="flex-1 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-4 py-3 text-sm text-[var(--text)] placeholder:text-[var(--dim)] resize-none focus:outline-none focus:border-[var(--accent)] disabled:opacity-50"
          style={{ minHeight: "48px", maxHeight: "120px" }}
          onInput={(e) => {
            const target = e.target as HTMLTextAreaElement;
            target.style.height = "48px";
            target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
          }}
        />
        <button
          onClick={sendMessage}
          disabled={!input.trim() || isStreaming || ollamaStatus !== "online"}
          className="px-4 rounded-lg bg-[var(--accent)] text-[var(--bg)] font-medium hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
