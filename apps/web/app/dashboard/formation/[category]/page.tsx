import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft, ListVideo } from "lucide-react";
import { Button } from "@evcore/ui";
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
  const categoryItems = items
    .filter((item) => item.category === (category as FormationCategory))
    .slice()
    .sort((a, b) => {
      const ao = a.order ?? Number.POSITIVE_INFINITY;
      const bo = b.order ?? Number.POSITIVE_INFINITY;
      if (ao !== bo) return ao - bo;
      return a.title.localeCompare(b.title);
    });

  const first = categoryItems[0];
  if (first) {
    redirect(`/dashboard/formation/${category}/${first.slug}`);
  }

  const t = await getTranslations("formation");

  return (
    <section className="flex flex-1 flex-col items-center justify-center gap-4 rounded-[1.6rem] border border-border bg-panel-strong p-8 text-center ev-shell-shadow">
      <span className="inline-flex size-12 items-center justify-center rounded-2xl border border-border bg-secondary text-accent">
        <ListVideo size={20} />
      </span>
      <div>
        <p className="text-base font-semibold text-foreground">
          {t("videoHub.emptyTitle")}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("videoHub.emptySubtitle")}
        </p>
      </div>
      <Button asChild variant="outline" className="rounded-xl">
        <Link href="/dashboard/formation">
          <ArrowLeft size={16} data-icon="inline-start" />
          {t("label")}
        </Link>
      </Button>
    </section>
  );
}
