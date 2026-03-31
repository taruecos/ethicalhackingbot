import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  color?: string;
  subtitle?: string;
}

export function StatCard({ label, value, icon: Icon, color = "var(--accent)", subtitle }: StatCardProps) {
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-3 sm:p-5">
      <div className="flex items-center justify-between mb-2 sm:mb-3">
        <span className="text-[9px] sm:text-[10px] uppercase tracking-widest text-[var(--dim)] font-semibold">
          {label}
        </span>
        <div
          className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: `${color}20` }}
        >
          <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" style={{ color }} />
        </div>
      </div>
      <p className="text-xl sm:text-3xl font-extrabold" style={{ color }}>
        {value}
      </p>
      {subtitle && (
        <p className="text-xs text-[var(--dim)] mt-1">{subtitle}</p>
      )}
    </div>
  );
}
