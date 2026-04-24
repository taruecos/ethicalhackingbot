"use client";

import React, { useEffect, useState, useCallback } from "react";
import { CheckCircle2, XCircle, X } from "lucide-react";
import { ds } from "@/components/ds/tokens";

export interface ToastItem {
  id: string;
  message: string;
  type: "success" | "error";
}

interface ToastProps {
  items: ToastItem[];
  onDismiss: (id: string) => void;
}

function ToastCard({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const enter = setTimeout(() => setVisible(true), 10);
    const exit = setTimeout(() => {
      setVisible(false);
      setTimeout(onDismiss, 250);
    }, 3000);
    return () => {
      clearTimeout(enter);
      clearTimeout(exit);
    };
  }, [onDismiss]);

  const isSuccess = item.type === "success";
  const color = isSuccess ? ds.accent.default : ds.severity.critical;
  const bg = isSuccess ? ds.accent.bg15 : ds.severity.criticalBg;
  const border = isSuccess ? ds.accent.default : ds.severity.critical;
  const Icon = isSuccess ? CheckCircle2 : XCircle;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", minWidth: 240, maxWidth: 340, backgroundColor: ds.bg.elevated, border: `1px solid ${border}40`, borderLeft: `3px solid ${border}`, borderRadius: ds.radius.lg, boxShadow: "0 8px 32px rgba(0,0,0,0.6)", transform: visible ? "translateX(0)" : "translateX(calc(100% + 24px))", opacity: visible ? 1 : 0, transition: "transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s ease" }}>
      <div style={{ width: 28, height: 28, borderRadius: ds.radius.md, flexShrink: 0, backgroundColor: bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icon size={14} style={{ color }} />
      </div>
      <span style={{ flex: 1, fontSize: ds.size.xs, fontWeight: ds.weight.medium, color: ds.text.primary, lineHeight: 1.4 }}>{item.message}</span>
      <button
        onClick={() => {
          setVisible(false);
          setTimeout(onDismiss, 250);
        }}
        style={{ background: "none", border: "none", cursor: "pointer", color: ds.text.muted, display: "flex", padding: 2, flexShrink: 0 }}
      >
        <X size={12} />
      </button>
    </div>
  );
}

export function ToastContainer({ items, onDismiss }: ToastProps) {
  return (
    <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 200, display: "flex", flexDirection: "column", gap: 8, pointerEvents: items.length > 0 ? "all" : "none" }}>
      {items.map((item) => (
        <ToastCard key={item.id} item={item} onDismiss={() => onDismiss(item.id)} />
      ))}
    </div>
  );
}

let _counter = 0;

export function useToast() {
  const [items, setItems] = useState<ToastItem[]>([]);

  const show = useCallback((message: string, type: "success" | "error" = "success") => {
    const id = `toast-${++_counter}`;
    setItems((prev) => [...prev, { id, message, type }]);
  }, []);

  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { items, show, dismiss };
}
