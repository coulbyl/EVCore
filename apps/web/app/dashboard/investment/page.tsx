import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { InvestmentPageClient } from "./components/investment-page-client";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("investment");
  return { title: t("pageTitle") };
}

export default function InvestmentPage() {
  return <InvestmentPageClient />;
}
