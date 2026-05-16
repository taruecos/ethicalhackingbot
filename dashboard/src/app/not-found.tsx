"use client";

import Link from "next/link";
import { Shield, ArrowLeft, Home, ScanLine } from "lucide-react";
import { ds } from "@/components/ds/tokens";
import { DSButton } from "@/components/ds/DSButton";

export default function NotFound() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px 20px",
        backgroundColor: ds.bg.base,
        color: ds.text.primary,
        fontFamily: "Inter, sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 460,
          padding: "32px 28px",
          backgroundColor: ds.bg.surface,
          border: `1px solid ${ds.border.default}`,
          borderRadius: ds.radius.xl,
          textAlign: "center",
          boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: ds.radius.lg,
            backgroundColor: ds.accent.bg15,
            border: `1px solid ${ds.border.accent20}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 20px",
          }}
        >
          <Shield size={26} style={{ color: ds.accent.default }} />
        </div>

        <div
          style={{
            fontSize: 56,
            fontWeight: ds.weight.bold,
            color: ds.text.primary,
            lineHeight: 1,
            letterSpacing: "-0.04em",
            marginBottom: 8,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          404
        </div>

        <h1
          style={{
            margin: "0 0 8px",
            fontSize: ds.size.xl,
            fontWeight: ds.weight.semibold,
            color: ds.text.primary,
          }}
        >
          Page not found
        </h1>

        <p
          style={{
            margin: "0 0 24px",
            fontSize: ds.size.sm,
            color: ds.text.muted,
            lineHeight: 1.6,
          }}
        >
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
          Check the URL or head back to the dashboard.
        </p>

        <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
          <Link href="/dashboard" style={{ textDecoration: "none" }}>
            <DSButton variant="primary" size="md" icon={<Home size={14} />}>
              Back to dashboard
            </DSButton>
          </Link>
          <Link href="/scans" style={{ textDecoration: "none" }}>
            <DSButton variant="secondary" size="md" icon={<ScanLine size={14} />}>
              Go to scans
            </DSButton>
          </Link>
        </div>

        <button
          onClick={() => (typeof window !== "undefined" ? window.history.back() : undefined)}
          style={{
            marginTop: 20,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 10px",
            backgroundColor: "transparent",
            border: "none",
            cursor: "pointer",
            color: ds.text.muted,
            fontSize: ds.size.xs,
            fontFamily: "Inter, sans-serif",
          }}
        >
          <ArrowLeft size={12} /> Go back to the previous page
        </button>
      </div>
    </div>
  );
}
