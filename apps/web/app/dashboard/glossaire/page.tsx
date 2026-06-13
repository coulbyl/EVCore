import { promises as fs } from "node:fs";
import path from "node:path";
import {
  Page,
  PageContent,
  PageHeader,
  PageHeaderActions,
  PageHeaderTitle,
} from "@evcore/ui";
import { BookOpen } from "lucide-react";
import { GlossaryToc } from "@/components/glossary-toc";
import { GlossaireMobileSelect } from "./glossaire-mobile-select";
import { MarkdownArticle, getMarkdownToc } from "@/components/markdown-article";
import { GlossaireSearch } from "./glossaire-search";

async function loadGlossary() {
  const filePath = path.join(process.cwd(), "content", "glossaire-evcore.md");
  return fs.readFile(filePath, "utf8");
}

export default async function GlossairePage() {
  const content = await loadGlossary();
  const toc = getMarkdownToc(content);

  return (
    <Page className="flex h-full flex-col">
      <PageHeader className="lg:flex-col lg:items-stretch lg:justify-start">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <span className="inline-flex size-9 items-center justify-center rounded-2xl border border-border bg-secondary text-accent shadow-xs">
                <BookOpen size={16} />
              </span>
              <div>
                <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                  Console
                </p>
                <PageHeaderTitle className="text-[1.1rem] font-semibold tracking-tight sm:text-[1.4rem]">
                  Documentation EVCore
                </PageHeaderTitle>
              </div>
            </div>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              Référence éditoriale des termes métier, statistiques et techniques
              utilisés dans le produit et dans le code.
            </p>
          </div>
          <PageHeaderActions className="shrink-0">
            <div className="rounded-[1.25rem] border border-accent/20 px-4 py-3 text-left md:px-5 md:py-4 md:text-right">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-accent">
                Sommaire
              </p>
              <p className="mt-1 text-[1.6rem] font-semibold tracking-tight tabular-nums text-foreground md:text-3xl">
                {toc.length}
              </p>
              <p className="text-sm text-muted-foreground">
                sections principales
              </p>
            </div>
          </PageHeaderActions>
        </div>

        <GlossaireSearch items={toc} />
      </PageHeader>

      <PageContent className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5 ev-shell-shadow">
        <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)] lg:gap-6">
          {/* Mobile ToC */}
          <section className="flex flex-col gap-3 rounded-[1.4rem] border border-border bg-panel-strong p-4 ev-shell-shadow lg:hidden">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
              Navigation
            </p>
            <GlossaireMobileSelect items={toc} />
            <GlossaryToc items={toc} />
          </section>

          {/* Desktop sticky sidebar */}
          <aside className="hidden h-fit rounded-[1.6rem] border border-border bg-panel-strong p-5 ev-shell-shadow lg:block lg:sticky lg:top-5 lg:max-h-[calc(100dvh-8rem)] lg:overflow-y-auto">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
              Navigation
            </p>
            <GlossaryToc items={toc} />
          </aside>

          <section className="rounded-[1.6rem] border border-border bg-panel p-4 shadow-[0_16px_44px_rgba(15,23,42,0.08)] sm:p-6 lg:p-8">
            <MarkdownArticle content={content} />
          </section>
        </div>
      </PageContent>
    </Page>
  );
}
