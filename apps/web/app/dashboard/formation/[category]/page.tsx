import { notFound, redirect } from "next/navigation";
import { getFormationIndex } from "@/domains/formation/server/formation-content";
import {
  FORMATION_CATEGORIES,
  type FormationCategory,
} from "@/domains/formation/types/formation";

export default async function FormationCategoryIndexPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  if (!FORMATION_CATEGORIES.includes(category as FormationCategory)) notFound();

  const items = await getFormationIndex();
  const categoryItems = items.filter(
    (item) => item.category === (category as FormationCategory),
  );

  const first = categoryItems[0];
  if (!first) {
    redirect("/dashboard/formation");
  }

  redirect(`/dashboard/formation/${category}/${first.slug}`);
}
