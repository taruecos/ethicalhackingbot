const SEVERITY_COLORS: Record<string, { bg: string; text: string }> = {
  CRITICAL: { bg: "bg-red-500/15", text: "text-red-400" },
  HIGH: { bg: "bg-orange-500/15", text: "text-orange-400" },
  MEDIUM: { bg: "bg-purple-500/15", text: "text-purple-400" },
  LOW: { bg: "bg-blue-500/15", text: "text-blue-400" },
  INFO: { bg: "bg-cyan-500/15", text: "text-cyan-400" },
};

export function SeverityBadge({ severity }: { severity: string }) {
  const colors = SEVERITY_COLORS[severity] || SEVERITY_COLORS.INFO;
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${colors.bg} ${colors.text}`}
    >
      {severity}
    </span>
  );
}
