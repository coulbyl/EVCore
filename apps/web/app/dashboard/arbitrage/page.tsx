import type { Metadata } from "next";
import { PauseGate } from "@/components/pause-gate";
import { ArbitragePageClient } from "./components/arbitrage-page-client";

export const metadata: Metadata = {
  title: "Avis IA — EVCore",
};

export default function ArbitragePage() {
  return (
    <PauseGate>
      <ArbitragePageClient />
    </PauseGate>
  );
}
