"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Target,
  Plus,
  Trash2,
  Shield,
  Loader2,
  Crosshair,
  Globe,
  Gauge,
} from "lucide-react";

export default function NewScanPage() {
  const router = useRouter();
  const [target, setTarget] = useState("");
  const [scopeEntries, setScopeEntries] = useState<string[]>([""]);
  const [rateLimit, setRateLimit] = useState(30);
  const [depth, setDepth] = useState<"quick" | "standard" | "deep">("standard");
  const [modules, setModules] = useState({
    idor: true,
    access_control: true,
    info_disclosure: true,
  });
  const [userAgent, setUserAgent] = useState("");
  const [customHeader, setCustomHeader] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  function addScopeEntry() {
    setScopeEntries([...scopeEntries, ""]);
  }

  function removeScopeEntry(idx: number) {
    setScopeEntries(scopeEntries.filter((_, i) => i !== idx));
  }

  function updateScopeEntry(idx: number, value: string) {
    const updated = [...scopeEntries];
    updated[idx] = value;
    setScopeEntries(updated);
  }

  function autoPopulateScope() {
    if (!target) return;
    const domain = target.replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/:\d+$/, "");
    setScopeEntries([domain, `*.${domain}`]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!target.trim()) {
      setError("Target domain is required");
      return;
    }

    const cleanScope = scopeEntries.filter((s) => s.trim() !== "");
    if (cleanScope.length === 0) {
      setError("At least one scope entry is required for compliance");
      return;
    }

    const selectedModules = Object.entries(modules)
      .filter(([, enabled]) => enabled)
      .map(([name]) => name);

    if (selectedModules.length === 0) {
      setError("Select at least one scan module");
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch("/api/scans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain: target.trim(),
          depth,
          modules: selectedModules,
          rateLimit,
          scope: cleanScope,
          rulesOfEngagement: {
            userAgent: userAgent.trim() || null,
            requestHeader: customHeader.trim() || null,
            safeHarbour: true,
          },
          programId: undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create scan");
      }

      router.push("/monitor");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create scan");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[var(--accent-dim)] flex items-center justify-center">
          <Crosshair className="w-5 h-5 text-[var(--accent)]" />
        </div>
        <div>
          <h1 className="text-lg font-bold">New Scan</h1>
          <p className="text-xs text-[var(--dim)]">Configure target, scope, and scan parameters</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Target */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-4 h-4 text-[var(--accent)]" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--dim)]">Target</h2>
          </div>
          <input
            type="text"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="example.com or https://example.com"
            className="w-full px-3 py-2.5 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-sm focus:border-[var(--accent)] focus:outline-none transition-colors"
          />
        </div>

        {/* Scope */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-[var(--blue)]" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--dim)]">Scope (Compliance)</h2>
            </div>
            <button
              type="button"
              onClick={autoPopulateScope}
              className="text-[10px] text-[var(--accent)] hover:underline"
            >
              Auto from target
            </button>
          </div>
          <p className="text-[11px] text-[var(--dim)] -mt-1">
            Only domains/patterns listed here will be scanned. Everything else is blocked.
          </p>
          {scopeEntries.map((entry, idx) => (
            <div key={idx} className="flex gap-2">
              <input
                type="text"
                value={entry}
                onChange={(e) => updateScopeEntry(idx, e.target.value)}
                placeholder="*.example.com or api.example.com"
                className="flex-1 px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-sm focus:border-[var(--accent)] focus:outline-none transition-colors"
              />
              {scopeEntries.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeScopeEntry(idx)}
                  className="p-2 rounded-lg text-[var(--dim)] hover:text-[var(--red)] hover:bg-[var(--surface2)] transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={addScopeEntry}
            className="flex items-center gap-1.5 text-xs text-[var(--accent)] hover:underline"
          >
            <Plus className="w-3.5 h-3.5" />
            Add scope entry
          </button>
        </div>

        {/* Scan Modules */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <Globe className="w-4 h-4 text-[var(--purple)]" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--dim)]">Modules</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {[
              { key: "idor", label: "IDOR Scanner", desc: "ID manipulation tests" },
              { key: "access_control", label: "Access Control", desc: "Admin path probing" },
              { key: "info_disclosure", label: "Info Disclosure", desc: "Sensitive data leaks" },
            ].map(({ key, label, desc }) => (
              <label
                key={key}
                className={`flex flex-col gap-1 p-3 rounded-lg border cursor-pointer transition-colors ${
                  modules[key as keyof typeof modules]
                    ? "border-[var(--accent)] bg-[var(--accent-dim)]"
                    : "border-[var(--border)] bg-[var(--bg)] hover:border-[var(--dim)]"
                }`}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={modules[key as keyof typeof modules]}
                    onChange={(e) => setModules({ ...modules, [key]: e.target.checked })}
                    className="accent-[var(--accent)]"
                  />
                  <span className="text-xs font-bold">{label}</span>
                </div>
                <span className="text-[10px] text-[var(--dim)]">{desc}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Rate Limit & Depth */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Gauge className="w-4 h-4 text-[var(--orange)]" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--dim)]">Parameters</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] text-[var(--dim)] font-medium block mb-1.5">
                Rate Limit (req/min)
              </label>
              <input
                type="number"
                value={rateLimit}
                onChange={(e) => setRateLimit(Math.max(1, parseInt(e.target.value) || 1))}
                min={1}
                max={120}
                className="w-full px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-sm focus:border-[var(--accent)] focus:outline-none"
              />
              <p className="text-[10px] text-[var(--dim)] mt-1">Lower = safer, higher = faster</p>
            </div>
            <div>
              <label className="text-[11px] text-[var(--dim)] font-medium block mb-1.5">
                Crawl Depth
              </label>
              <select
                value={depth}
                onChange={(e) => setDepth(e.target.value as "quick" | "standard" | "deep")}
                className="w-full px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-sm focus:border-[var(--accent)] focus:outline-none"
              >
                <option value="quick">Quick (depth 1)</option>
                <option value="standard">Standard (depth 3)</option>
                <option value="deep">Deep (depth 5)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-[11px] text-[var(--dim)] font-medium block mb-1.5">
              Custom User-Agent (optional)
            </label>
            <input
              type="text"
              value={userAgent}
              onChange={(e) => setUserAgent(e.target.value)}
              placeholder="EthicalHackingBot/1.0 (authorized pentest)"
              className="w-full px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-sm focus:border-[var(--accent)] focus:outline-none"
            />
          </div>
          <div>
            <label className="text-[11px] text-[var(--dim)] font-medium block mb-1.5">
              Custom Header (optional, format: Key: Value)
            </label>
            <input
              type="text"
              value={customHeader}
              onChange={(e) => setCustomHeader(e.target.value)}
              placeholder="X-Bug-Bounty: HackerOne-username"
              className="w-full px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-sm focus:border-[var(--accent)] focus:outline-none"
            />
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-[var(--red)]/10 border border-[var(--red)]/30 rounded-xl px-4 py-3 text-xs text-[var(--red)]">
            {error}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[var(--accent)] text-black text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {submitting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Crosshair className="w-4 h-4" />
          )}
          Queue Scan
        </button>
      </form>
    </div>
  );
}
