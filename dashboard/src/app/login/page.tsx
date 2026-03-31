"use client";

import { useState } from "react";
import { Bug, Loader2 } from "lucide-react";

export default function LoginPage() {
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      if (res.ok) {
        window.location.href = "/overview";
      } else {
        setError("Invalid token");
      }
    } catch {
      setError("Connection failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <form onSubmit={handleLogin} className="w-full max-w-sm">
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-8">
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <div className="w-14 h-14 rounded-xl bg-[var(--accent-dim)] flex items-center justify-center">
              <Bug className="w-7 h-7 text-[var(--accent)]" />
            </div>
          </div>

          <h1 className="text-xl font-bold text-center mb-1">BugBountyBot</h1>
          <p className="text-[var(--dim)] text-sm text-center mb-6">
            Enter your dashboard token
          </p>

          {/* Token input */}
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Dashboard token"
            className="w-full px-4 py-3 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-[var(--text)] font-mono text-sm focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-dim)] transition-all"
            autoFocus
          />

          {/* Error */}
          {error && (
            <p className="text-[var(--red)] text-xs mt-2">{error}</p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || !token}
            className="w-full mt-4 py-3 rounded-xl bg-[var(--accent)] text-black font-bold text-sm hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Authenticating...
              </>
            ) : (
              "Access Dashboard"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
