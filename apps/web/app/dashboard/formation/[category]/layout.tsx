import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getFormationIndex } from "@/domains/formation/server/formation-content";
import {
  FORMATION_CATEGORIES,
  type FormationCategory,
} from "@/domains/formation/types/formation";
import { FormationCategoryShell } from "../components/formation-category-shell";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}): Promise<Metadata> {
  const { category } = await params;
  const t = await getTranslations("formation");
  if (!FORMATION_CATEGORIES.includes(category as FormationCategory)) {
    return { title: t("label") };
  }
  return { title: `${t("label")} · ${t(`categories.${category}`)}` };
}

export default async function FormationCategoryLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  if (!FORMATION_CATEGORIES.includes(category as FormationCategory)) notFound();

  const items = await getFormationIndex();
  const categoryItems = items
    .filter((item) => item.category === (category as FormationCategory))
    .slice()
    .sort((a, b) => {
      const ao = a.order ?? Number.POSITIVE_INFINITY;
      const bo = b.order ?? Number.POSITIVE_INFINITY;
      if (ao !== bo) return ao - bo;
      return a.title.localeCompare(b.title);
    });

  return (
    <FormationCategoryShell
      category={category as FormationCategory}
      items={categoryItems}
    >
      {children}
    </FormationCategoryShell>
  );
}
