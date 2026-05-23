import type { Metadata } from "next";
import { InvestmentSummaryPageClient } from "./components/investment-summary-page-client";

export const metadata: Metadata = {
  title: "Résumé Investment",
};

export default function InvestmentSummaryPage() {
  return <InvestmentSummaryPageClient />;
}
