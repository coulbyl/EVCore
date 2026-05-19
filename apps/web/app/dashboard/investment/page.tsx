import type { Metadata } from "next";
import { InvestissementPageClient } from "./components/investment-page-client";

export const metadata: Metadata = {
  title: "Investment — EVCore",
};

export default function InvestissementPage() {
  return <InvestissementPageClient />;
}
