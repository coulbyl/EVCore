import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PicksPageClient } from "./components/picks-page-client";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("picks");

  return {
    title: t("pageTitle"),
  };
}

export default function PicksPage() {
  return <PicksPageClient />;
}
