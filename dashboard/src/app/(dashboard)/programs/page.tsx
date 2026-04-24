import { Suspense } from "react";
import { ProgramsPage } from "@/features/programs/ProgramsPage";

export default function Page() {
  return (
    <Suspense>
      <ProgramsPage />
    </Suspense>
  );
}
