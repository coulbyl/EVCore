import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button, Page, PageContent } from "@evcore/ui";
import { MarkdownArticle } from "@/components/markdown-article";
import {
  getFormationContentBySlug,
  getFormationIndex,
} from "@/domains/formation/server/formation-content";
import { FormationCompletionButton } from "../components/formation-completion-button";
import { FormationRecentTracker } from "../components/formation-recent-tracker";
import { sortFormationItems } from "@/domains/formation/helpers/sort-formation-items";

/**
 * Les quinze anciens articles (et la vidéo jamais tournée) remplacés le
 * 2026-10-27 par cinq fiches : une ancienne adresse, gardée dans un favori ou
 * un lien, mène à la fiche qui en reprend le sujet au lieu d'une page 404.
 */
const LEGACY_SLUGS: Readonly<Record<string, string>> = {
  "comment-lire-un-pick": "lire-un-pronostic",
  "channels-overview": "lire-un-pronostic",
  "intro-formation": "lire-un-pronostic",
  "dominant-channel": "lire-un-pronostic",
  "draw-channel": "lire-un-pronostic",
  "btts-channel": "lire-un-pronostic",
  "goals-channel": "lire-un-pronostic",
  "team-total-channel": "lire-un-pronostic",
  "value-channel": "lire-un-pronostic",
  "safe-channel": "lire-un-pronostic",
  "cotes-probabilites-implicites": "cote-et-chances",
  "ev-probabilites-cotes": "cote-et-chances",
  "variance-et-patience": "series-perdantes",
  "unite-de-mise": "erreurs-a-eviter",
  "allocation-et-timing": "erreurs-a-eviter",
  "erreurs-frequentes": "erreurs-a-eviter",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const t = await getTranslations("formation");
  const item = await getFormationContentBySlug(slug);
  if (!item) return { title: t("label") };
  return { title: `${item.title} — ${t("label")}` };
}

export default async function FormationSheetPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const legacy = LEGACY_SLUGS[slug];
  if (legacy) redirect(`/dashboard/formation/${legacy}`);

  const item = await getFormationContentBySlug(slug);
  if (!item) notFound();

  const t = await getTranslations("formation");
  const sheets = sortFormationItems(await getFormationIndex());
  const position = sheets.findIndex((entry) => entry.slug === item.slug);
  const next = position >= 0 ? sheets[position + 1] : undefined;

  return (
    <Page className="flex h-full flex-col">
      <PageContent className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5 ev-shell-shadow">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 pb-20">
          <FormationRecentTracker
            category={item.category}
            type={item.type}
            slug={item.slug}
          />

          <Link
            href="/dashboard/formation"
            className="inline-flex min-h-11 w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft size={14} />
            {t("label")}
          </Link>

          <header className="flex flex-col gap-1">
            <p className="text-xs tabular-nums text-muted-foreground">
              {t("position", {
                n: position + 1,
                total: sheets.length,
                minutes: item.readTime,
              })}
            </p>
            <h1 className="text-balance text-xl font-semibold tracking-tight text-foreground">
              {item.title}
            </h1>
          </header>

          <article className="rounded-2xl border border-border bg-panel px-4 py-5 sm:px-6">
            <MarkdownArticle content={item.content} />
          </article>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <FormationCompletionButton type={item.type} slug={item.slug} />
            {next ? (
              <Button asChild className="rounded-xl">
                <Link href={`/dashboard/formation/${next.slug}`}>
                  {t("next")}
                  <ArrowRight data-icon="inline-end" />
                </Link>
              </Button>
            ) : (
              <Button asChild variant="outline" className="rounded-xl">
                <Link href="/dashboard/formation">{t("backToList")}</Link>
              </Button>
            )}
          </div>
        </div>
      </PageContent>
    </Page>
  );
}
