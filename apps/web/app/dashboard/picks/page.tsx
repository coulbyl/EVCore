import { getTranslations } from "next-intl/server";
import { PicksPageClient } from "./components/picks-page-client";

export async function generateMetadata() {
  const t = await getTranslations("picks");

  return {
    title: t("pageTitle"),
  };
}

export default function PicksPage() {
  return <PicksPageClient />;
}
