import type { Metadata } from "next";
import { InvestissementPageClient } from "./components/investissement-page-client";

export const metadata: Metadata = {
  title: "Investissement — EVCore",
};

export default function InvestissementPage() {
  return <InvestissementPageClient />;
}
