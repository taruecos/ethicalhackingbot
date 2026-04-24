"use client";

import React, { useState } from "react";
import { Copy, Check, Trash2, Plus, Key, ExternalLink } from "lucide-react";
import { ds } from "@/components/ds/tokens";
import { DSButton } from "@/components/ds/DSButton";
import { DSDialog } from "@/components/ds/DSDialog";
import { SettingsCard, FormInput } from "./shared";

interface ApiTabProps {
  onSave: (msg?: string) => void;
  onError: (msg?: string) => void;
}

interface ApiToken {
  id: string;
  name: string;
  created: string;
  lastUsed: string | null;
  scopes: string[];
  prefix: string;
}

const MOCK_TOKENS: ApiToken[] = [
  { id: "t1", name: "CI/CD Pipeline", created: "2026-03-15", lastUsed: "2026-04-23", scopes: ["read:findings", "read:scans"], prefix: "ehb_live_a3Kx" },
  { id: "t2", name: "Zapier Integration", created: "2026-02-01", lastUsed: "2026-04-22", scopes: ["read:findings"], prefix: "ehb_live_9pQz" },
  { id: "t3", name: "Dev Testing", created: "2026-04-10", lastUsed: null, scopes: ["*"], prefix: "ehb_test_7mRj" },
];

const ALL_SCOPES = [
  { key: "read:findings", label: "Read findings", hint: "List and read finding details" },
  { key: "write:findings", label: "Write findings", hint: "Create, update and delete findings" },
  { key: "read:scans", label: "Read scans", hint: "List and read scan configurations" },
  { key: "write:scans", label: "Write scans", hint: "Create and trigger scans" },
  { key: "read:programs", label: "Read programs", hint: "List and read program data" },
  { key: "*", label: "Full access", hint: "All permissions — use with caution" },
];

const WEBHOOK_URL = "https://scanner.ehbsec.io/webhook/inbound/v1/7f4a9c2e1b3d8e6f";

export function ApiTab({ onSave, onError }: ApiTabProps) {
  const [tokens, setTokens] = useState<ApiToken[]>(MOCK_TOKENS);
  const [webhookCopied, setWCopied] = useState(false);
  const [revokeTarget, setRevoke] = useState<ApiToken | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newScopes, setNewScopes] = useState<Set<string>>(new Set(["read:findings"]));
  const [creating, setCreating] = useState(false);
  const [newTokenVal, setNewTokenVal] = useState<string | null>(null);
  const [tokenCopied, setTCopied] = useState(false);

  const copyWebhook = () => {
    navigator.clipboard.writeText(WEBHOOK_URL);
    setWCopied(true);
    setTimeout(() => setWCopied(false), 1500);
  };

  const revokeToken = () => {
    if (!revokeTarget) return;
    setTokens((prev) => prev.filter((t) => t.id !== revokeTarget.id));
    setRevoke(null);
    onSave(`Token "${revokeTarget.name}" revoked`);
  };

  const createToken = () => {
    if (!newName.trim()) {
      onError("Token name is required");
      return;
    }
    if (newScopes.size === 0) {
      onError("Select at least one scope");
      return;
    }
    setCreating(true);
    setTimeout(() => {
      const id = `t${Date.now()}`;
      const val = `ehb_live_${Math.random().toString(36).slice(2, 14)}`;
      const token = { id, name: newName, created: new Date().toISOString().slice(0, 10), lastUsed: null, scopes: [...newScopes], prefix: val.slice(0, 13) };
      setTokens((prev) => [token, ...prev]);
      setNewTokenVal(val);
      setCreating(false);
    }, 900);
  };

  const closeCreate = () => {
    setCreateOpen(false);
    setNewName("");
    setNewScopes(new Set(["read:findings"]));
    setNewTokenVal(null);
    setTCopied(false);
  };

  const toggleScope = (key: string) => {
    setNewScopes((prev) => {
      const next = new Set(prev);
      if (key === "*") return new Set(["*"]);
      next.delete("*");
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <SettingsCard title="Inbound webhook endpoint" description="Send findings or scan triggers to this URL from external tools">
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <FormInput
            value={WEBHOOK_URL}
            readOnly
            monospace
            rightElement={
              <button onClick={copyWebhook} style={{ display: "flex", alignItems: "center", gap: 4, height: 24, padding: "0 8px", backgroundColor: ds.bg.surface, border: `1px solid ${ds.border.default}`, borderRadius: ds.radius.md, cursor: "pointer", color: webhookCopied ? ds.accent.default : ds.text.muted, fontSize: 10, fontFamily: "Inter, sans-serif" }}>
                {webhookCopied ? <Check size={10} /> : <Copy size={10} />}
                {webhookCopied ? "Copied" : "Copy"}
              </button>
            }
          />
          <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "10px 12px", backgroundColor: ds.bg.elevated, borderRadius: ds.radius.md, border: `1px solid ${ds.border.default}` }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: ds.severity.info, marginTop: 5, flexShrink: 0 }} />
            <div style={{ fontSize: 10, color: ds.text.muted, lineHeight: 1.6 }}>
              POST JSON to this endpoint to create findings programmatically. Include the{" "}
              <code style={{ fontFamily: "monospace", color: ds.severity.info, backgroundColor: ds.bg.base, padding: "1px 4px", borderRadius: 3 }}>Authorization: Bearer {"{token}"}</code> header. See{" "}
              <a href="#" style={{ color: ds.accent.default, textDecoration: "none" }}>
                API docs <ExternalLink size={9} style={{ display: "inline", verticalAlign: "middle" }} />
              </a>
            </div>
          </div>
        </div>
      </SettingsCard>

      <SettingsCard
        title="API tokens"
        description="Tokens for authenticating external API calls"
        action={
          <DSButton variant="secondary" size="sm" icon={<Plus size={13} />} onClick={() => setCreateOpen(true)}>
            Create token
          </DSButton>
        }
      >
        {tokens.length === 0 ? (
          <div style={{ textAlign: "center", padding: "28px 0", color: ds.text.muted, fontSize: ds.size.xs }}>No tokens yet — create one to get started.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 100px 120px auto", gap: 12, padding: "6px 12px", borderBottom: `1px solid ${ds.border.default}` }}>
              {["Token name", "Created", "Last used", ""].map((h) => (
                <span key={h} style={{ fontSize: 10, fontWeight: ds.weight.semibold, color: ds.text.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</span>
              ))}
            </div>

            {tokens.map((tok, i) => (
              <div key={tok.id} style={{ display: "grid", gridTemplateColumns: "1fr 100px 120px auto", gap: 12, padding: "10px 12px", alignItems: "center", borderBottom: i < tokens.length - 1 ? `1px solid ${ds.border.default}` : "none", backgroundColor: "transparent" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                  <div style={{ width: 28, height: 28, borderRadius: ds.radius.md, flexShrink: 0, backgroundColor: ds.bg.elevated, border: `1px solid ${ds.border.default}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Key size={12} style={{ color: ds.text.muted }} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: ds.size.xs, fontWeight: ds.weight.semibold, color: ds.text.primary }}>{tok.name}</div>
                    <div style={{ fontSize: 10, fontFamily: "monospace", color: ds.text.muted, marginTop: 1 }}>{tok.prefix}…</div>
                  </div>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {tok.scopes.map((s) => (
                      <span key={s} style={{ fontSize: 9, padding: "1px 5px", borderRadius: 4, backgroundColor: s === "*" ? ds.severity.highBg : ds.accent.bg15, color: s === "*" ? ds.severity.high : ds.accent.default, border: `1px solid ${s === "*" ? `${ds.severity.high}30` : ds.border.accent20}`, fontWeight: ds.weight.semibold, whiteSpace: "nowrap" }}>{s}</span>
                    ))}
                  </div>
                </div>
                <span style={{ fontSize: ds.size.xs, color: ds.text.muted, fontFamily: "monospace" }}>{tok.created}</span>
                <span style={{ fontSize: ds.size.xs, color: ds.text.muted, fontFamily: "monospace" }}>{tok.lastUsed ?? <span style={{ color: "rgba(113,113,122,0.5)", fontStyle: "italic" }}>Never</span>}</span>
                <DSButton variant="ghost" size="sm" icon={<Trash2 size={11} />} onClick={() => setRevoke(tok)} style={{ color: ds.severity.critical }}>
                  Revoke
                </DSButton>
              </div>
            ))}
          </div>
        )}
      </SettingsCard>

      <DSDialog
        isOpen={!!revokeTarget}
        onClose={() => setRevoke(null)}
        title="Revoke API token?"
        footer={
          <>
            <DSButton variant="ghost" size="md" onClick={() => setRevoke(null)}>
              Cancel
            </DSButton>
            <DSButton variant="danger" size="md" icon={<Trash2 size={13} />} onClick={revokeToken}>
              Revoke token
            </DSButton>
          </>
        }
      >
        <p style={{ margin: 0, fontSize: ds.size.sm, color: ds.text.secondary, lineHeight: 1.6 }}>
          Revoking <strong style={{ color: ds.text.primary }}>{revokeTarget?.name}</strong> will immediately invalidate all API calls using this token. This cannot be undone.
        </p>
      </DSDialog>

      <DSDialog
        isOpen={createOpen}
        onClose={closeCreate}
        title="Create API token"
        footer={
          newTokenVal ? (
            <DSButton variant="primary" size="md" onClick={closeCreate}>
              Done
            </DSButton>
          ) : (
            <>
              <DSButton variant="ghost" size="md" onClick={closeCreate}>
                Cancel
              </DSButton>
              <DSButton variant="primary" size="md" icon={<Key size={13} />} forceState={creating ? "loading" : undefined} onClick={createToken}>
                Create token
              </DSButton>
            </>
          )
        }
      >
        {newTokenVal ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ padding: "10px 12px", backgroundColor: ds.accent.bg15, border: `1px solid ${ds.border.accent20}`, borderRadius: ds.radius.md, fontSize: 10, color: ds.accent.default, lineHeight: 1.5 }}>
              Copy this token now — it will not be shown again.
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", backgroundColor: ds.bg.base, borderRadius: ds.radius.md, border: `1px solid ${ds.border.default}` }}>
              <code style={{ flex: 1, fontFamily: "monospace", fontSize: ds.size.xs, color: ds.text.primary, wordBreak: "break-all" }}>{newTokenVal}</code>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(newTokenVal!);
                  setTCopied(true);
                }}
                style={{ display: "flex", alignItems: "center", gap: 4, height: 26, padding: "0 8px", backgroundColor: ds.bg.elevated, border: `1px solid ${ds.border.default}`, borderRadius: ds.radius.md, cursor: "pointer", fontSize: 10, fontFamily: "Inter, sans-serif", color: tokenCopied ? ds.accent.default : ds.text.muted, flexShrink: 0 }}
              >
                {tokenCopied ? <Check size={10} /> : <Copy size={10} />}
                {tokenCopied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={{ display: "block", fontSize: 10, color: ds.text.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Token name</label>
              <FormInput value={newName} onChange={setNewName} placeholder="e.g. GitHub Actions, Zapier integration…" />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 10, color: ds.text.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Scopes</label>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {ALL_SCOPES.map((s) => (
                  <label
                    key={s.key}
                    style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "8px 10px", cursor: "pointer", borderRadius: ds.radius.md, backgroundColor: newScopes.has(s.key) ? (s.key === "*" ? ds.severity.highBg : ds.accent.bg15) : ds.bg.elevated, border: `1px solid ${newScopes.has(s.key) ? (s.key === "*" ? `${ds.severity.high}40` : ds.border.accent20) : ds.border.default}` }}
                    onClick={() => toggleScope(s.key)}
                  >
                    <div style={{ width: 14, height: 14, borderRadius: 4, flexShrink: 0, marginTop: 1, backgroundColor: newScopes.has(s.key) ? (s.key === "*" ? ds.severity.high : ds.accent.default) : "transparent", border: `1.5px solid ${newScopes.has(s.key) ? (s.key === "*" ? ds.severity.high : ds.accent.default) : "rgba(113,113,122,0.4)"}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {newScopes.has(s.key) && (
                        <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                          <path d="M1 3L3 5L7 1" stroke={s.key === "*" ? "#fff" : "#000"} strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                      )}
                    </div>
                    <div>
                      <div style={{ fontSize: ds.size.xs, fontWeight: ds.weight.medium, color: ds.text.primary, fontFamily: "monospace" }}>{s.key}</div>
                      <div style={{ fontSize: 10, color: ds.text.muted, marginTop: 1 }}>{s.hint}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}
      </DSDialog>
    </div>
  );
}
