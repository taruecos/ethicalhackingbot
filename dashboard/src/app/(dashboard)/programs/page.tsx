import { ds } from "@/components/ds/tokens";

export default function ProgramsPage() {
  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>
      <h1 style={{ fontSize: ds.size["3xl"], fontWeight: ds.weight.bold, color: ds.text.primary, margin: 0 }}>
        Programs
      </h1>
      <p style={{ marginTop: 8, fontSize: ds.size.base, color: ds.text.muted }}>
        Synced programs, live program catalog, recent activities, and payouts.
      </p>
    </div>
  );
}
