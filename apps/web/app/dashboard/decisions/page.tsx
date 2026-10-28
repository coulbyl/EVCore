import type { Metadata } from "next";
import { PauseGate } from "@/components/pause-gate";
import { DecisionsPageClient } from "./components/decisions-page-client";

export const metadata: Metadata = {
  title: "Décisions — EVCore",
};

export default function DecisionsPage() {
  return (
    <PauseGate>
      <DecisionsPageClient />
    </PauseGate>
  );
}
