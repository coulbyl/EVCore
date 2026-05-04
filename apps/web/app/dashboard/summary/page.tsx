import type { Metadata } from "next";
import { SummaryPageClient } from "./components/summary-page-client";

export const metadata: Metadata = {
  title: "Résumé",
};

export default function SummaryPage() {
  return <SummaryPageClient />;
}
