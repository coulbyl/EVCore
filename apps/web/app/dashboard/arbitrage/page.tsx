import type { Metadata } from "next";
import { ArbitragePageClient } from "./components/arbitrage-page-client";

export const metadata: Metadata = {
  title: "Arbitrage — EVCore",
};

export default function ArbitragePage() {
  return <ArbitragePageClient />;
}
