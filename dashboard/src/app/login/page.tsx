"use client";

import { useEffect, useState } from "react";
import { Bug, Loader2 } from "lucide-react";

const MIN_PASSWORD_LENGTH = 12;

export default function LoginPage() {
  const [mode, setMode] = useState<"loading" | "setup" | "login">("loading");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/status");
        const data = await res.json();
        if (cancelled) return;
        setMode(data.setupRequired ? "setup" : "login");
      } catch {
        if (!cancelled) setMode("login");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (mode === "setup") {
      if (password.length < MIN_PASSWORD_LENGTH) {
        setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
        return;
      }
      if (password !== confirm) {
        setError("Passwords do not match");
        return;
      }
    }

    setSubmitting(true);
    try {
      const endpoint = mode === "setup" ? "/api/auth/setup" : "/api/auth";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        window.location.href = "/dashboard";
        return;
      }

      const data = await res.json().catch(() => ({}));
      if (res.status === 412 && data.setupRequired) {
        setMode("setup");
        setError("Set a password to get started");
        return;
      }
      setError(data.error || (mode === "setup" ? "Setup failed" : "Invalid password"));
    } catch {
      setError("Connection failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (mode === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <Loader2 className="w-6 h-6 animate-spin text-[var(--dim)]" />
      </div>
    );
  }

  const isSetup = mode === "setup";

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm">
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-8">
          <div className="flex justify-center mb-6">
            <div className="w-14 h-14 rounded-xl bg-[var(--accent-dim)] flex items-center justify-center">
              <Bug className="w-7 h-7 text-[var(--accent)]" />
            </div>
          </div>

          <h1 className="text-xl font-bold text-center mb-1">BugBountyBot</h1>
          <p className="text-[var(--dim)] text-sm text-center mb-6">
            {isSetup ? "Choose a password (one time)" : "Enter your password"}
          </p>

          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={isSetup ? "New password" : "Password"}
            className="w-full px-4 py-3 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-[var(--text)] font-mono text-sm focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-dim)] transition-all"
            autoFocus
            autoComplete={isSetup ? "new-password" : "current-password"}
          />

          {isSetup && (
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Confirm password"
              className="w-full mt-3 px-4 py-3 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-[var(--text)] font-mono text-sm focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-dim)] transition-all"
              autoComplete="new-password"
            />
          )}

          {error && (
            <p className="text-[var(--red)] text-xs mt-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting || !password || (isSetup && !confirm)}
            className="w-full mt-4 py-3 rounded-xl bg-[var(--accent)] text-black font-bold text-sm hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {isSetup ? "Creating..." : "Authenticating..."}
              </>
            ) : isSetup ? (
              "Create Password"
            ) : (
              "Access Dashboard"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
