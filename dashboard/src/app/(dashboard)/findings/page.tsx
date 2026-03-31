"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import {
  Loader2,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Flag,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";
import { SeverityBadge } from "@/components/severity-badge";

interface Finding {
  id: string;
  scanId: string;
  module: string;
  severity: string;
  confidence: number;
  title: string;
  description: string;
  url: string | null;
  evidence: Record<string, unknown>;
  remediation: string | null;
  status: string;
  falsePositive: boolean;
  cweId: string | null;
  cvssScore: number | null;
  notes: string | null;
  scan?: { target: string };
}

const SEVERITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"];
const STATUSES = ["NEW", "CONFIRMED", "FALSE_POSITIVE", "FIXED", "ACCEPTED", "REPORTED"];

export default function FindingsPageWrapper() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-[var(--accent)]" /></div>}>
      <FindingsPage />
    </Suspense>
  );
}

function FindingsPage() {
  const searchParams = useSearchParams();
  const scanFilter = searchParams.get("scan") || "";

  const [findings, setFindings] = useState<Finding[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [moduleFilter, setModuleFilter] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchFindings = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (scanFilter) params.set("scanId", scanFilter);
      if (severityFilter.length) params.set("severity", severityFilter.join(","));
      if (statusFilter.length) params.set("status", statusFilter.join(","));
      if (moduleFilter) params.set("module", moduleFilter);
      if (search) params.set("search", search);

      const res = await fetch(`/api/findings?${params}`);
      if (res.ok) {
        const data = await res.json();
        setFindings(data.findings || []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [scanFilter, severityFilter, statusFilter, moduleFilter, search]);

  useEffect(() => {
    fetchFindings();
  }, [fetchFindings]);

  async function updateFindingStatus(id: string, status: string) {
    await fetch(`/api/findings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    await fetchFindings();
  }

  async function markFalsePositive(id: string) {
    await fetch(`/api/findings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ falsePositive: true, status: "FALSE_POSITIVE" }),
    });
    await fetchFindings();
  }

  const modules = [...new Set(findings.map((f) => f.module))].sort();

  const filteredFindings = findings;

  return (
    <div className="space-y-4">
      {/* Filters Bar */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-3 sm:p-4 space-y-3">
        {/* Search row */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--dim)]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search findings..."
              className="w-full pl-10 pr-4 py-2.5 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:border-[var(--accent)] transition-colors"
            />
          </div>
          <button onClick={fetchFindings} className="p-2.5 rounded-lg hover:bg-[var(--surface2)] text-[var(--dim)] shrink-0">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Severity + filters row */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Severity filter */}
          <div className="flex flex-wrap gap-1.5">
            {SEVERITIES.map((sev) => (
              <button
                key={sev}
                onClick={() =>
                  setSeverityFilter((prev) =>
                    prev.includes(sev) ? prev.filter((s) => s !== sev) : [...prev, sev]
                  )
                }
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  severityFilter.includes(sev)
                    ? "opacity-100"
                    : "opacity-30 hover:opacity-60"
                }`}
              >
                <SeverityBadge severity={sev} />
              </button>
            ))}
          </div>

          {/* Module filter */}
          {modules.length > 0 && (
            <select
              value={moduleFilter}
              onChange={(e) => setModuleFilter(e.target.value)}
              className="px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-xs text-[var(--text)]"
            >
              <option value="">All modules</option>
              {modules.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          )}

          {/* Status filter */}
          <select
            value={statusFilter.join(",")}
            onChange={(e) =>
              setStatusFilter(e.target.value ? e.target.value.split(",") : [])
            }
            className="px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-xs text-[var(--text)]"
          >
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace("_", " ")}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Results count */}
      <div className="flex items-center gap-2 text-xs text-[var(--dim)]">
        <Filter className="w-3.5 h-3.5" />
        {filteredFindings.length} findings
        {scanFilter && <span className="text-[var(--accent)]">• scan: {scanFilter}</span>}
      </div>

      {/* Findings List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-5 h-5 animate-spin text-[var(--accent)]" />
        </div>
      ) : filteredFindings.length === 0 ? (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-12 text-center">
          <AlertTriangle className="w-8 h-8 text-[var(--dim)] mx-auto mb-3" />
          <p className="text-sm text-[var(--dim)]">No findings match your filters</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredFindings.map((finding) => {
            const expanded = expandedId === finding.id;
            return (
              <div
                key={finding.id}
                className="bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-hidden"
              >
                {/* Header row */}
                <button
                  onClick={() => setExpandedId(expanded ? null : finding.id)}
                  className="w-full px-4 py-3.5 flex items-start gap-3 hover:bg-[var(--surface2)] transition-colors text-left"
                >
                  <div className="mt-0.5">
                    {expanded ? (
                      <ChevronDown className="w-4 h-4 text-[var(--dim)]" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-[var(--dim)]" />
                    )}
                  </div>
                  <div className="mt-0.5 shrink-0">
                    <SeverityBadge severity={finding.severity} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{finding.title}</p>
                    <p className="text-xs text-[var(--dim)] mt-0.5">
                      {finding.module} • {finding.scan?.target || ""}
                      {finding.confidence && (
                        <span className="ml-2">
                          {Math.round(finding.confidence * 100)}% conf.
                        </span>
                      )}
                    </p>
                    <span
                      className={`text-[10px] uppercase font-bold tracking-wider ${
                        finding.falsePositive ? "text-[var(--dim)] line-through" : "text-[var(--text)]"
                      }`}
                    >
                      {finding.status.replace("_", " ")}
                    </span>
                  </div>
                </button>

                {/* Expanded details */}
                {expanded && (
                  <div className="px-5 pb-5 border-t border-[var(--border)]">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
                      {/* Description */}
                      <div>
                        <h4 className="text-[10px] uppercase tracking-widest text-[var(--dim)] font-semibold mb-2">
                          Description
                        </h4>
                        <p className="text-sm text-[var(--text)] whitespace-pre-wrap">
                          {finding.description}
                        </p>
                      </div>

                      {/* Details */}
                      <div className="space-y-3">
                        {finding.url && (
                          <div>
                            <h4 className="text-[10px] uppercase tracking-widest text-[var(--dim)] font-semibold mb-1">
                              URL
                            </h4>
                            <a
                              href={finding.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-[var(--accent)] flex items-center gap-1 hover:underline break-all"
                            >
                              {finding.url}
                              <ExternalLink className="w-3 h-3 flex-shrink-0" />
                            </a>
                          </div>
                        )}

                        {finding.cweId && (
                          <div>
                            <h4 className="text-[10px] uppercase tracking-widest text-[var(--dim)] font-semibold mb-1">
                              CWE
                            </h4>
                            <span className="text-xs font-mono">{finding.cweId}</span>
                          </div>
                        )}

                        {finding.cvssScore !== null && (
                          <div>
                            <h4 className="text-[10px] uppercase tracking-widest text-[var(--dim)] font-semibold mb-1">
                              CVSS Score
                            </h4>
                            <span className="text-xs font-mono font-bold">{finding.cvssScore}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Evidence */}
                    {Object.keys(finding.evidence).length > 0 && (
                      <div className="mt-4">
                        <h4 className="text-[10px] uppercase tracking-widest text-[var(--dim)] font-semibold mb-2">
                          Evidence
                        </h4>
                        <pre className="bg-[var(--bg)] border border-[var(--border)] rounded-lg p-3 text-xs font-mono overflow-x-auto max-h-48">
                          {JSON.stringify(finding.evidence, null, 2)}
                        </pre>
                      </div>
                    )}

                    {/* Remediation */}
                    {finding.remediation && (
                      <div className="mt-4">
                        <h4 className="text-[10px] uppercase tracking-widest text-[var(--dim)] font-semibold mb-2">
                          Remediation
                        </h4>
                        <p className="text-sm text-[var(--text)] whitespace-pre-wrap bg-[var(--accent-dim)] rounded-lg p-3">
                          {finding.remediation}
                        </p>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-[var(--border)]">
                      <button
                        onClick={() => updateFindingStatus(finding.id, "CONFIRMED")}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--accent-dim)] text-[var(--accent)] text-xs font-semibold hover:opacity-80"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Confirm
                      </button>
                      <button
                        onClick={() => markFalsePositive(finding.id)}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--surface2)] text-[var(--dim)] text-xs font-semibold hover:text-[var(--text)]"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        False Positive
                      </button>
                      <button
                        onClick={() => updateFindingStatus(finding.id, "REPORTED")}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--blue)]/15 text-[var(--blue)] text-xs font-semibold hover:opacity-80"
                      >
                        <Flag className="w-3.5 h-3.5" />
                        Mark Reported
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
