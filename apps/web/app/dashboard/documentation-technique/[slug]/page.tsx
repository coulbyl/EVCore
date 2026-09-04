import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  Page,
  PageContent,
  PageHeader,
  PageHeaderActions,
  PageHeaderTitle,
} from "@evcore/ui";
import { Library } from "lucide-react";
import { MarkdownArticle } from "@/components/markdown-article";
import {
  getTechnicalDocBySlug,
  listTechnicalDocs,
} from "@/domains/technical-docs/server/technical-docs-content";
import { TechnicalDocsNav } from "../components/technical-docs-nav";

export async function generateStaticParams() {
  const docs = await listTechnicalDocs();
  return docs.map((doc) => ({ slug: doc.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const doc = await getTechnicalDocBySlug(slug);
  return {
    title: doc
      ? `Documentation technique · ${doc.title}`
      : "Documentation technique",
  };
}

export default async function TechnicalDocPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const doc = await getTechnicalDocBySlug(slug);
  if (!doc) notFound();

  const docs = await listTechnicalDocs();

  return (
    <Page className="flex h-full flex-col">
      <PageHeader className="lg:flex-col lg:items-stretch lg:justify-start">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <span className="inline-flex size-9 items-center justify-center rounded-2xl border border-border bg-secondary text-accent shadow-xs">
                <Library size={16} />
              </span>
              <div>
                <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                  Console
                </p>
                <PageHeaderTitle className="text-[1.1rem] font-semibold tracking-tight sm:text-[1.4rem]">
                  Documentation technique EVCore
                </PageHeaderTitle>
              </div>
            </div>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              Architecture, backend, moteur de prédiction, frontend, workers et
              packages — état réel du code, vérifié contre les sources.
            </p>
          </div>
          <PageHeaderActions className="shrink-0">
            <div className="rounded-[1.25rem] border border-accent/20 px-4 py-3 text-left md:px-5 md:py-4 md:text-right">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-accent">
                Pages
              </p>
              <p className="mt-1 text-[1.6rem] font-semibold tracking-tight tabular-nums text-foreground md:text-3xl">
                {docs.length}
              </p>
            </div>
          </PageHeaderActions>
        </div>
      </PageHeader>

      <PageContent className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5 ev-shell-shadow">
        <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)] lg:gap-6">
          <aside className="rounded-[1.4rem] border border-border bg-panel-strong p-4 ev-shell-shadow lg:sticky lg:top-5 lg:h-fit lg:max-h-[calc(100dvh-8rem)] lg:overflow-y-auto lg:rounded-[1.6rem] lg:p-5">
            <p className="mb-3 text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
              Sommaire
            </p>
            <TechnicalDocsNav docs={docs} activeSlug={slug} />
          </aside>

          <section className="rounded-[1.6rem] border border-border bg-panel p-4 shadow-[0_16px_44px_rgba(15,23,42,0.08)] sm:p-6 lg:p-8">
            <MarkdownArticle content={doc.content} />
          </section>
        </div>
      </PageContent>
    </Page>
  );
}
