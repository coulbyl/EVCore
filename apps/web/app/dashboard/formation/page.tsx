import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getFormationIndex } from "@/domains/formation/server/formation-content";
import { FormationPageClient } from "./components/formation-page-client";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("formation");
  return { title: t("title") };
}

export default async function FormationPage() {
  const items = await getFormationIndex();
  return <FormationPageClient items={items} />;
}
