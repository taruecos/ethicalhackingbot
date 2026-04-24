"use client";

import React, { useEffect, useState } from "react";
import {
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Info,
  Loader2,
  Lock,
} from "lucide-react";
import { ds } from "@/components/ds/tokens";
import { DSCard } from "@/components/ds/DSCard";
import { DSButton } from "@/components/ds/DSButton";

type ComplianceStatus = "ok" | "forbidden" | "conditional" | "unknown";
type ScopeEntryType = "wildcard" | "exact" | "ip";
type Depth = "quick" | "standard" | "deep";

interface ScopeEntry {
  id: string;
  url: string;
  type: ScopeEntryType;
}

interface Program {
  id: string;
  name: string;
  bountyMin: number;
  bountyMax: number;
  industry: string;
  safeHarbour: boolean;
  automatedStatus: ComplianceStatus;
  scope: string[];
  userAgent: string;
  reqHeaders: string[];
}

interface ApiProgram {
  id: string;
  name: string;
  slug: string;
  industry: string | null;
  minBounty: number | null;
  maxBounty: number | null;
  scope: unknown;
  compliance: Record<string, unknown> | null;
}

function mapApiToProgram(p: ApiProgram): Program {
  const compliance = (p.compliance ?? {}) as Record<string, unknown>;
  const toolingStatus = compliance.automatedToolingStatus as string | undefined;
  let automatedStatus: ComplianceStatus = "unknown";
  if (toolingStatus === "allowed") automatedStatus = "ok";
  else if (toolingStatus === "not_allowed") automatedStatus = "forbidden";
  else if (toolingStatus === "conditional") automatedStatus = "conditional";

  const safeHarbour = Boolean(compliance.safeHarbour);
  const userAgent = (compliance.userAgent as string) || "EHBScanner/1.0";
  const requestHeader = compliance.requestHeader as string | null | undefined;
  const reqHeaders = requestHeader ? [requestHeader] : [];

  // scope is an array of {id, type, endpoint, tier, description}
  const scopeArr: string[] = [];
  if (Array.isArray(p.scope)) {
    for (const entry of p.scope) {
      const e = entry as Record<string, unknown>;
      const endpoint = e?.endpoint as string | undefined;
      if (endpoint) scopeArr.push(endpoint);
    }
  }

  return {
    id: p.id,
    name: p.name,
    bountyMin: p.minBounty ?? 0,
    bountyMax: p.maxBounty ?? 0,
    industry: p.industry ?? "—",
    safeHarbour,
    automatedStatus,
    scope: scopeArr,
    userAgent,
    reqHeaders,
  };
}

const MODULES = [
  { id: "idor", label: "IDOR", desc: "Insecure Direct Object References — sequential ID attacks" },
  { id: "access_control", label: "Access Control", desc: "Broken access control — privilege escalation paths" },
  { id: "info_disclosure", label: "Info Disclosure", desc: "Sensitive data exposure in headers, responses, errors" },
  { id: "xss", label: "XSS", desc: "Cross-Site Scripting — reflected & stored injection" },
  { id: "sqli", label: "SQLi", desc: "SQL injection — error-based, blind, time-based" },
  { id: "csrf", label: "CSRF", desc: "Cross-Site Request Forgery — state-change endpoints" },
  { id: "ssrf", label: "SSRF", desc: "Server-Side Request Forgery — URL parameter probing" },
  { id: "differential", label: "Differential", desc: "Differential response analysis — logic flaws detection" },
];

const COMPLIANCE_CONFIG: Record<ComplianceStatus, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  ok: { label: "Automated OK", color: ds.accent.default, bg: ds.accent.bg15, icon: <CheckCircle2 size={13} /> },
  forbidden: { label: "Automated tooling not allowed", color: ds.severity.critical, bg: ds.severity.criticalBg, icon: <AlertCircle size={13} /> },
  conditional: { label: "Conditional — read rules carefully", color: ds.severity.high, bg: ds.severity.highBg, icon: <AlertTriangle size={13} /> },
  unknown: { label: "Unknown — select a program", color: ds.text.muted, bg: "rgba(113,113,122,0.1)", icon: <HelpCircle size={13} /> },
};

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      style={{ width: 36, height: 20, borderRadius: 10, padding: 0, backgroundColor: checked ? ds.accent.default : "rgba(39,39,42,0.6)", border: "none", cursor: disabled ? "not-allowed" : "pointer", position: "relative", transition: "background 0.2s ease", flexShrink: 0, opacity: disabled ? 0.4 : 1 }}
    >
      <span style={{ position: "absolute", top: 2, left: checked ? 18 : 2, width: 16, height: 16, borderRadius: "50%", backgroundColor: "#fff", transition: "left 0.2s ease", boxShadow: "0 1px 3px rgba(0,0,0,0.4)" }} />
    </button>
  );
}

function Checkbox({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      style={{ width: 16, height: 16, borderRadius: 4, backgroundColor: checked ? ds.accent.default : "transparent", border: `1.5px solid ${checked ? ds.accent.default : "rgba(113,113,122,0.5)"}`, cursor: disabled ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.1s ease", padding: 0, opacity: disabled ? 0.4 : 1 }}
    >
      {checked && (
        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
          <path d="M1 4L3.5 6.5L9 1" stroke="#000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}

function InlineInput({ value, onChange, placeholder, disabled, error, prefix }: { value: string; onChange: (v: string) => void; placeholder?: string; disabled?: boolean; error?: string; prefix?: string }) {
  const [focused, setFocused] = useState(false);
  const borderColor = error ? ds.severity.critical : focused ? ds.accent.default : ds.border.default;
  const shadow = error ? "0 0 0 3px rgba(239,68,68,0.12)" : focused ? `0 0 0 3px ${ds.border.accent20}` : "none";

  return (
    <div>
      <div style={{ position: "relative" }}>
        {prefix && (
          <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: ds.size.sm, color: ds.text.muted, pointerEvents: "none", userSelect: "none" }}>{prefix}</span>
        )}
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          disabled={disabled}
          style={{ width: "100%", height: 36, boxSizing: "border-box", backgroundColor: disabled ? ds.bg.base : ds.bg.surface, border: `1px solid ${borderColor}`, borderRadius: ds.radius.md, fontSize: ds.size.sm, fontFamily: "Inter, sans-serif", color: disabled ? ds.text.muted : ds.text.primary, paddingLeft: prefix ? 36 : 12, paddingRight: 12, outline: "none", opacity: disabled ? 0.55 : 1, boxShadow: shadow, transition: "all 0.15s ease" }}
        />
      </div>
      {error && (
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 5, fontSize: ds.size.xs, color: ds.severity.critical }}>
          <AlertCircle size={11} />
          {error}
        </div>
      )}
    </div>
  );
}

export function ComposeTab() {
  const [domain, setDomain] = useState("");
  const [selectedProgramId, setSelectedProgramId] = useState("");
  const [useProgramScope, setUseProgramScope] = useState(false);
  const [scopeEntries, setScopeEntries] = useState<ScopeEntry[]>([{ id: "1", url: "", type: "wildcard" }]);
  const [checkedModules, setCheckedModules] = useState<Set<string>>(new Set(["sqli", "xss", "ssrf", "idor"]));
  const [depth, setDepth] = useState<Depth>("standard");
  const [rateLimit, setRateLimit] = useState(30);
  const [safeHarbourChecked, setSafeHarbourChecked] = useState(false);
  const [touched, setTouched] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [launchSuccess, setLaunchSuccess] = useState(false);
  const [launchError, setLaunchError] = useState<string | null>(null);
  const [tooltipOpen, setTooltipOpen] = useState(false);

  const [programs, setPrograms] = useState<Program[]>([]);
  const [programsLoading, setProgramsLoading] = useState(true);
  const [programsError, setProgramsError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setProgramsLoading(true);
      setProgramsError(null);
      try {
        const res = await fetch("/api/programs?limit=500", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const list = (json.programs ?? []) as ApiProgram[];
        if (!cancelled) setPrograms(list.map(mapApiToProgram));
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Network error";
        if (!cancelled) setProgramsError(msg);
      } finally {
        if (!cancelled) setProgramsLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedProgram = programs.find((p) => p.id === selectedProgramId) ?? null;
  const complianceStatus: ComplianceStatus = selectedProgram?.automatedStatus ?? "unknown";
  const complianceCfg = COMPLIANCE_CONFIG[complianceStatus];

  const errors = {
    domain: !domain.trim() ? "Target domain is required" : "",
    scope: !useProgramScope && scopeEntries.every((e) => !e.url.trim()) ? "At least one scope URL is required" : "",
    modules: checkedModules.size === 0 ? "Select at least one module" : "",
    safeHarbour: !safeHarbourChecked ? "You must accept the Safe Harbour agreement" : "",
  };
  const isComplianceBlocked = complianceStatus === "forbidden";
  const isValid = !errors.domain && !errors.scope && !errors.modules && !errors.safeHarbour && !isComplianceBlocked;

  const disabledReason = !isValid ? (isComplianceBlocked ? "Automated tooling is not permitted for this program" : errors.domain || errors.scope || errors.modules || errors.safeHarbour) : "";

  const addScopeEntry = () => setScopeEntries((prev) => [...prev, { id: Date.now().toString(), url: "", type: "wildcard" }]);
  const removeScopeEntry = (id: string) => setScopeEntries((prev) => prev.filter((e) => e.id !== id));
  const updateScopeEntry = (id: string, field: keyof ScopeEntry, value: string) => setScopeEntries((prev) => prev.map((e) => (e.id === id ? { ...e, [field]: value } : e)));

  const handleUseProgramScope = (v: boolean) => {
    setUseProgramScope(v);
    if (v && selectedProgram) {
      setScopeEntries(selectedProgram.scope.map((url, i) => ({ id: `prog-${i}`, url, type: "wildcard" as ScopeEntryType })));
    }
  };

  const handleProgramChange = (id: string) => {
    setSelectedProgramId(id);
    if (useProgramScope) {
      const prog = programs.find((p) => p.id === id);
      if (prog) {
        setScopeEntries(prog.scope.map((url, i) => ({ id: `prog-${i}`, url, type: "wildcard" })));
      }
    }
  };

  const handleLaunch = async () => {
    setTouched(true);
    setLaunchError(null);
    if (!isValid) return;
    setLaunching(true);
    try {
      const payload = {
        domain: domain.trim(),
        programId: selectedProgramId || null,
        depth,
        modules: Array.from(checkedModules),
        rateLimit,
        scope: scopeEntries.filter((e) => e.url.trim()).map((e) => ({ url: e.url.trim(), type: e.type })),
        rulesOfEngagement: {
          safeHarbour: safeHarbourChecked,
          userAgent: selectedProgram?.userAgent ?? "EHBScanner/1.0",
          requestHeaders: selectedProgram?.reqHeaders ?? [],
          automatedToolingStatus: complianceStatus,
        },
      };
      const res = await fetch("/api/scans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.error || `HTTP ${res.status}`);
      }
      setLaunchSuccess(true);
      setTimeout(() => setLaunchSuccess(false), 3000);
    } catch (e) {
      setLaunchError(e instanceof Error ? e.message : "Failed to launch scan");
    } finally {
      setLaunching(false);
    }
  };

  const selectStyle: React.CSSProperties = {
    height: 36,
    padding: "0 10px",
    backgroundColor: ds.bg.surface,
    border: `1px solid ${ds.border.default}`,
    borderRadius: ds.radius.md,
    color: ds.text.secondary,
    fontSize: ds.size.sm,
    cursor: "pointer",
    outline: "none",
    fontFamily: "Inter, sans-serif",
    colorScheme: "dark" as const,
    width: "100%",
    boxSizing: "border-box",
  };

  const depthMeta: Record<Depth, { label: string; desc: string }> = {
    quick: { label: "Quick", desc: "~2–5 min, surface scan" },
    standard: { label: "Standard", desc: "~8–15 min, thorough" },
    deep: { label: "Deep", desc: "~30+ min, exhaustive" },
  };

  return (
    <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
      <div style={{ flex: 2, display: "flex", flexDirection: "column", gap: 14 }}>
        <DSCard style={{ padding: 20 }}>
          <SectionHeader label="Target" required />
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <InlineInput value={domain} onChange={setDomain} placeholder="api.example.com" prefix="https://" error={touched && errors.domain ? errors.domain : undefined} />

            <div>
              <div style={{ fontSize: ds.size.xs, color: ds.text.muted, marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                <span>
                  Program <span style={{ color: ds.text.muted, fontStyle: "italic" }}>(optional)</span>
                </span>
                {programsLoading && <Loader2 size={11} className="animate-spin" style={{ color: ds.text.muted }} />}
                {programsError && (
                  <span style={{ color: ds.severity.critical, display: "inline-flex", alignItems: "center", gap: 3 }}>
                    <AlertCircle size={11} /> Couldn't load programs
                  </span>
                )}
              </div>
              <select value={selectedProgramId} onChange={(e) => handleProgramChange(e.target.value)} style={selectStyle} disabled={programsLoading}>
                <option value="">— No program / custom target —</option>
                {programs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderRadius: ds.radius.md, backgroundColor: useProgramScope ? ds.accent.bg15 : ds.bg.elevated, border: `1px solid ${useProgramScope ? ds.border.accent20 : ds.border.default}`, transition: "all 0.15s ease" }}>
              <div>
                <div style={{ fontSize: ds.size.sm, fontWeight: ds.weight.medium, color: ds.text.primary }}>Use program scope</div>
                <div style={{ fontSize: ds.size.xs, color: ds.text.muted, marginTop: 2 }}>Auto-fill scope entries from selected program</div>
              </div>
              <Toggle checked={useProgramScope} onChange={handleUseProgramScope} disabled={!selectedProgramId} />
            </div>
          </div>
        </DSCard>

        <DSCard style={{ padding: 20, opacity: useProgramScope ? 0.6 : 1, transition: "opacity 0.2s" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <SectionHeader label="Scope Entries" required />
            <DSButton variant="secondary" size="sm" icon={<Plus size={12} />} onClick={addScopeEntry} style={{ pointerEvents: useProgramScope ? "none" : "auto" }}>
              Add entry
            </DSButton>
          </div>

          {touched && errors.scope && (
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 10, fontSize: ds.size.xs, color: ds.severity.critical }}>
              <AlertCircle size={11} /> {errors.scope}
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {scopeEntries.map((entry) => (
              <div key={entry.id} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                  <input
                    value={entry.url}
                    onChange={(e) => updateScopeEntry(entry.id, "url", e.target.value)}
                    placeholder={entry.type === "wildcard" ? "*.example.com" : entry.type === "ip" ? "192.168.1.0/24" : "https://example.com/api"}
                    disabled={useProgramScope}
                    style={{ width: "100%", height: 34, boxSizing: "border-box", backgroundColor: ds.bg.elevated, border: `1px solid ${ds.border.default}`, borderRadius: ds.radius.md, fontSize: ds.size.xs, fontFamily: "monospace", color: ds.text.secondary, padding: "0 10px", outline: "none", opacity: useProgramScope ? 0.5 : 1 }}
                  />
                </div>
                <select
                  value={entry.type}
                  onChange={(e) => updateScopeEntry(entry.id, "type", e.target.value as ScopeEntryType)}
                  disabled={useProgramScope}
                  style={{ ...selectStyle, width: 100, flexShrink: 0, fontSize: ds.size.xs, opacity: useProgramScope ? 0.5 : 1, backgroundColor: ds.bg.elevated }}
                >
                  <option value="wildcard">Wildcard</option>
                  <option value="exact">Exact</option>
                  <option value="ip">IP Range</option>
                </select>
                <button
                  onClick={() => removeScopeEntry(entry.id)}
                  disabled={scopeEntries.length <= 1 || useProgramScope}
                  style={{ width: 34, height: 34, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: ds.radius.md, border: `1px solid ${ds.border.default}`, backgroundColor: "transparent", cursor: "pointer", color: ds.text.muted, opacity: scopeEntries.length <= 1 || useProgramScope ? 0.3 : 1 }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 10, fontSize: ds.size.xs, color: ds.text.muted }}>
            {scopeEntries.filter((e) => e.url.trim()).length} of {scopeEntries.length} entries filled
          </div>
        </DSCard>

        <DSCard style={{ padding: 20 }}>
          <SectionHeader label="Modules" required />
          {touched && errors.modules && (
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 10, fontSize: ds.size.xs, color: ds.severity.critical }}>
              <AlertCircle size={11} /> {errors.modules}
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
            {MODULES.map(({ id, label, desc }) => (
              <ModuleCard
                key={id}
                label={label}
                desc={desc}
                checked={checkedModules.has(id)}
                onChange={(v) => {
                  setCheckedModules((prev) => {
                    const next = new Set(prev);
                    if (v) next.add(id);
                    else next.delete(id);
                    return next;
                  });
                }}
              />
            ))}
          </div>
          <div style={{ marginTop: 10, fontSize: ds.size.xs, color: ds.text.muted }}>
            {checkedModules.size} module{checkedModules.size !== 1 ? "s" : ""} selected
          </div>
        </DSCard>

        <DSCard style={{ padding: 20 }}>
          <SectionHeader label="Configuration" />
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div>
              <div style={{ fontSize: ds.size.xs, color: ds.text.muted, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontWeight: ds.weight.semibold, textTransform: "uppercase", letterSpacing: "0.07em" }}>Scan depth</span>
                <span style={{ color: ds.accent.default }}>· {depthMeta[depth].desc}</span>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {(["quick", "standard", "deep"] as Depth[]).map((d) => (
                  <button
                    key={d}
                    onClick={() => setDepth(d)}
                    style={{ flex: 1, height: 34, borderRadius: ds.radius.md, border: `1px solid ${depth === d ? ds.accent.default : ds.border.default}`, backgroundColor: depth === d ? ds.accent.bg15 : ds.bg.elevated, color: depth === d ? ds.accent.default : ds.text.muted, fontSize: ds.size.xs, fontWeight: ds.weight.medium, cursor: "pointer", fontFamily: "Inter, sans-serif", transition: "all 0.1s ease", textTransform: "capitalize" }}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, fontSize: ds.size.xs }}>
                <span style={{ fontWeight: ds.weight.semibold, color: ds.text.muted, textTransform: "uppercase", letterSpacing: "0.07em" }}>Rate limit</span>
                <span style={{ fontWeight: ds.weight.bold, color: ds.text.primary, fontVariantNumeric: "tabular-nums" }}>
                  {rateLimit} <span style={{ color: ds.text.muted, fontWeight: ds.weight.regular }}>req / min</span>
                </span>
              </div>
              <div style={{ position: "relative" }}>
                <input type="range" min={1} max={60} step={1} value={rateLimit} onChange={(e) => setRateLimit(+e.target.value)} style={{ width: "100%", accentColor: ds.accent.default, cursor: "pointer", height: 4 }} />
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                  <span style={{ fontSize: 10, color: ds.text.muted }}>1 (cautious)</span>
                  <span style={{ fontSize: 10, color: ds.text.muted }}>60 (aggressive)</span>
                </div>
              </div>
              {rateLimit > 45 && (
                <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 5, fontSize: ds.size.xs, color: ds.severity.high }}>
                  <AlertTriangle size={11} /> High rate may trigger WAF/rate-limiting
                </div>
              )}
            </div>
          </div>
        </DSCard>

        <DSCard forceVariant={isComplianceBlocked ? undefined : "selected"} style={{ padding: 20, border: `1px solid ${isComplianceBlocked ? ds.severity.critical : ds.accent.default}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 16 }}>
            <Lock size={13} style={{ color: isComplianceBlocked ? ds.severity.critical : ds.accent.default }} />
            <span style={{ fontSize: ds.size.xs, fontWeight: ds.weight.semibold, color: isComplianceBlocked ? ds.severity.critical : ds.accent.default, textTransform: "uppercase", letterSpacing: "0.07em" }}>Compliance Gate</span>
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: ds.size.xs, color: ds.text.muted, marginBottom: 8 }}>Program compliance status</div>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: ds.radius.md, backgroundColor: complianceCfg.bg, color: complianceCfg.color, fontSize: ds.size.xs, fontWeight: ds.weight.semibold }}>
              {complianceCfg.icon}
              {complianceCfg.label}
            </span>
          </div>

          {isComplianceBlocked && (
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 12px", borderRadius: ds.radius.md, backgroundColor: ds.severity.criticalBg, border: `1px solid ${ds.severity.critical}40`, marginBottom: 16 }}>
              <AlertCircle size={14} style={{ color: ds.severity.critical, flexShrink: 0, marginTop: 1 }} />
              <div>
                <div style={{ fontSize: ds.size.sm, fontWeight: ds.weight.semibold, color: ds.severity.critical }}>Cannot launch — automated tooling not allowed</div>
                <div style={{ fontSize: ds.size.xs, color: ds.text.muted, marginTop: 3 }}>This program explicitly forbids automated scanning. Switch to a different program or use manual testing.</div>
              </div>
            </div>
          )}

          {complianceStatus === "conditional" && (
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 12px", borderRadius: ds.radius.md, backgroundColor: ds.severity.highBg, border: `1px solid ${ds.severity.high}40`, marginBottom: 16 }}>
              <AlertTriangle size={14} style={{ color: ds.severity.high, flexShrink: 0, marginTop: 1 }} />
              <div style={{ fontSize: ds.size.xs, color: ds.text.secondary }}>Automated tooling is conditionally allowed. Ensure you comply with all rate limits and User-Agent requirements before launching.</div>
            </div>
          )}

          <div style={{ padding: "12px 14px", borderRadius: ds.radius.md, backgroundColor: ds.bg.elevated, border: `1px solid ${ds.border.default}` }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
              <div style={{ paddingTop: 1 }}>
                <Checkbox checked={safeHarbourChecked} onChange={setSafeHarbourChecked} disabled={isComplianceBlocked} />
              </div>
              <div>
                <div style={{ fontSize: ds.size.sm, fontWeight: ds.weight.medium, color: ds.text.primary, marginBottom: 6 }}>I accept the Safe Harbour agreement</div>
                <div style={{ maxHeight: 80, overflowY: "auto", fontSize: ds.size.xs, color: ds.text.muted, lineHeight: 1.6, paddingRight: 4 }}>
                  This scanning activity is authorized under the program's safe harbour policy. By checking this box, you confirm that: (1) You are acting in good faith and within the defined scope of this bug bounty program; (2) You will not access, modify, or delete production data beyond what is necessary to demonstrate a vulnerability; (3) You will not perform Denial of Service (DoS) or Distributed DoS attacks; (4) You will report all findings responsibly through the official submission portal within the disclosure window; (5) You understand that unauthorized testing outside the defined scope may violate applicable computer crime laws including the CFAA, Computer Misuse Act, and equivalent local statutes.
                </div>
              </div>
            </div>
            {touched && errors.safeHarbour && (
              <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 8, fontSize: ds.size.xs, color: ds.severity.critical }}>
                <AlertCircle size={11} /> {errors.safeHarbour}
              </div>
            )}
          </div>
        </DSCard>

        <div style={{ position: "relative" }} onMouseEnter={() => !isValid && setTooltipOpen(true)} onMouseLeave={() => setTooltipOpen(false)}>
          {tooltipOpen && disabledReason && (
            <div style={{ position: "absolute", bottom: "110%", left: "50%", transform: "translateX(-50%)", marginBottom: 4, padding: "6px 12px", backgroundColor: ds.bg.elevated, border: `1px solid ${ds.border.default}`, borderRadius: ds.radius.md, fontSize: ds.size.xs, color: ds.text.secondary, whiteSpace: "nowrap", zIndex: 100, boxShadow: "0 4px 12px rgba(0,0,0,0.4)" }}>
              {disabledReason}
            </div>
          )}
          <DSButton variant="primary" size="lg" icon={launching ? <Loader2 size={15} className="animate-spin" /> : undefined} onClick={handleLaunch} style={{ width: "100%", opacity: isValid ? 1 : 0.4, cursor: isValid ? "pointer" : "not-allowed" }}>
            {launchSuccess ? "✓ Scan queued successfully" : launching ? "Queuing scan…" : "Launch Scan"}
          </DSButton>
          {launchError && (
            <div style={{ marginTop: 10, display: "flex", alignItems: "flex-start", gap: 8, padding: "10px 12px", borderRadius: ds.radius.md, backgroundColor: ds.severity.criticalBg, border: `1px solid ${ds.severity.critical}40` }}>
              <AlertCircle size={13} style={{ color: ds.severity.critical, flexShrink: 0, marginTop: 1 }} />
              <div style={{ fontSize: ds.size.xs, color: ds.severity.critical }}>{launchError}</div>
            </div>
          )}
        </div>
      </div>

      <div style={{ flex: 1, position: "sticky", top: 0, display: "flex", flexDirection: "column", gap: 12 }}>
        {!selectedProgram ? (
          <DSCard style={{ padding: 24, textAlign: "center" }}>
            <Info size={28} style={{ color: ds.text.muted, margin: "0 auto 12px" }} />
            <div style={{ fontSize: ds.size.sm, fontWeight: ds.weight.medium, color: ds.text.secondary, marginBottom: 6 }}>No program selected</div>
            <div style={{ fontSize: ds.size.xs, color: ds.text.muted, lineHeight: 1.6 }}>Select a program from the dropdown to see compliance info, scope enforcement and rules of engagement.</div>
          </DSCard>
        ) : (
          <>
            <DSCard style={{ padding: 16 }}>
              <PanelHeader label="Program Info" />
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ fontSize: ds.size.sm, fontWeight: ds.weight.semibold, color: ds.text.primary }}>{selectedProgram.name}</div>
                <InfoRow label="Bounty range" value={`$${selectedProgram.bountyMin.toLocaleString()} – $${selectedProgram.bountyMax.toLocaleString()}`} />
                <InfoRow label="Industry" value={selectedProgram.industry} />
                <InfoRow
                  label="Safe Harbour"
                  value={
                    <span style={{ display: "flex", alignItems: "center", gap: 4, color: selectedProgram.safeHarbour ? ds.accent.default : ds.severity.critical }}>
                      {selectedProgram.safeHarbour ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                      {selectedProgram.safeHarbour ? "Protected" : "No coverage"}
                    </span>
                  }
                />
                <InfoRow
                  label="Automation"
                  value={
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "2px 8px", borderRadius: ds.radius.md, backgroundColor: complianceCfg.bg, color: complianceCfg.color, fontSize: 11, fontWeight: ds.weight.medium }}>
                      {complianceCfg.icon}
                      {complianceCfg.label}
                    </span>
                  }
                />
              </div>
            </DSCard>

            <DSCard style={{ padding: 16 }}>
              <PanelHeader label="Scope Enforcement" />
              <div style={{ marginBottom: 8, fontSize: ds.size.xs, color: ds.text.muted }}>{selectedProgram.scope.length} entries authorized</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {selectedProgram.scope.slice(0, 5).map((entry, i) => (
                  <div key={i} style={{ fontSize: 11, fontFamily: "monospace", color: ds.text.secondary, padding: "4px 8px", backgroundColor: ds.bg.elevated, borderRadius: ds.radius.md, border: `1px solid ${ds.border.default}` }}>
                    {entry}
                  </div>
                ))}
                {selectedProgram.scope.length > 5 && (
                  <div style={{ fontSize: ds.size.xs, color: ds.text.muted, paddingLeft: 4 }}>+{selectedProgram.scope.length - 5} more entries</div>
                )}
              </div>
            </DSCard>

            <DSCard style={{ padding: 16 }}>
              <PanelHeader label="Rules of Engagement" />
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div>
                  <div style={{ fontSize: 10, color: ds.text.muted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5 }}>User-Agent required</div>
                  <div style={{ fontSize: 11, fontFamily: "monospace", color: ds.text.secondary, padding: "5px 8px", backgroundColor: ds.bg.elevated, borderRadius: ds.radius.md, border: `1px solid ${ds.border.default}` }}>{selectedProgram.userAgent}</div>
                </div>
                {selectedProgram.reqHeaders.length > 0 && (
                  <div>
                    <div style={{ fontSize: 10, color: ds.text.muted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5 }}>Required headers</div>
                    {selectedProgram.reqHeaders.map((h, i) => (
                      <div key={i} style={{ fontSize: 11, fontFamily: "monospace", color: ds.severity.info, padding: "4px 8px", backgroundColor: ds.bg.elevated, borderRadius: ds.radius.md, border: `1px solid ${ds.border.default}`, marginBottom: 4 }}>
                        {h}
                      </div>
                    ))}
                  </div>
                )}
                {selectedProgram.reqHeaders.length === 0 && (
                  <div style={{ fontSize: ds.size.xs, color: ds.text.muted, fontStyle: "italic" }}>No additional headers required</div>
                )}
              </div>
            </DSCard>
          </>
        )}
      </div>
    </div>
  );
}

function SectionHeader({ label, required }: { label: string; required?: boolean }) {
  return (
    <div style={{ fontSize: ds.size.xs, fontWeight: ds.weight.semibold, color: ds.text.muted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 12, display: "flex", alignItems: "center", gap: 5 }}>
      {label}
      {required && <span style={{ color: ds.severity.critical, fontSize: 10 }}>*</span>}
    </div>
  );
}

function PanelHeader({ label }: { label: string }) {
  return <div style={{ fontSize: 10, fontWeight: ds.weight.semibold, color: ds.text.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>{label}</div>;
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
      <span style={{ fontSize: ds.size.xs, color: ds.text.muted }}>{label}</span>
      <span style={{ fontSize: ds.size.xs, color: ds.text.secondary, textAlign: "right" }}>{value}</span>
    </div>
  );
}

function ModuleCard({ label, desc, checked, onChange }: { label: string; desc: string; checked: boolean; onChange: (v: boolean) => void }) {
  const [hovered, setHovered] = useState(false);
  const [tooltipVisible, setTooltipVisible] = useState(false);
  return (
    <div
      onClick={() => onChange(!checked)}
      onMouseEnter={() => {
        setHovered(true);
        setTooltipVisible(true);
      }}
      onMouseLeave={() => {
        setHovered(false);
        setTooltipVisible(false);
      }}
      style={{ position: "relative", padding: "10px 12px", borderRadius: ds.radius.md, cursor: "pointer", backgroundColor: checked ? ds.accent.bg15 : hovered ? ds.bg.elevated : "transparent", border: `1px solid ${checked ? ds.border.accent20 : hovered ? ds.border.zinc30 : ds.border.default}`, display: "flex", flexDirection: "column", gap: 7, transition: "all 0.1s ease" }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: ds.size.xs, fontWeight: ds.weight.semibold, color: checked ? ds.accent.default : ds.text.primary }}>{label}</span>
        <Checkbox checked={checked} onChange={onChange} />
      </div>
      {tooltipVisible && (
        <div style={{ position: "absolute", top: "110%", left: 0, right: 0, padding: "6px 8px", backgroundColor: ds.bg.elevated, border: `1px solid ${ds.border.default}`, borderRadius: ds.radius.md, fontSize: 10, color: ds.text.muted, zIndex: 50, lineHeight: 1.5, boxShadow: "0 4px 12px rgba(0,0,0,0.4)" }}>
          {desc}
        </div>
      )}
    </div>
  );
}
