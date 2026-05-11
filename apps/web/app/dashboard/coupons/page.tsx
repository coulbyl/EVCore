import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { CouponsPageClient } from "./components/coupons-page-client";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("coupons");
  return { title: t("pageTitle") };
}

export default function CouponsPage() {
  return <CouponsPageClient />;
}
