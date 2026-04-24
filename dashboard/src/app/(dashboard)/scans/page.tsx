import { Suspense } from "react";
import { ScansPage } from "@/features/scans/ScansPage";

export default function Page() {
  return (
    <Suspense>
      <ScansPage />
    </Suspense>
  );
}
