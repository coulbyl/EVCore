import { promises as fs } from "node:fs";
import path from "node:path";
import { Page, PageContent } from "@evcore/ui";
import { GlossaryToc } from "@/components/glossary-toc";
import { MarkdownArticle, getMarkdownToc } from "@/components/markdown-article";

async function loadGlossary() {
  const filePath = path.join(process.cwd(), "content", "glossaire-evcore.md");
  return fs.readFile(filePath, "utf8");
}

export default async function GlossairePage() {
  const content = await loadGlossary();
  const toc = getMarkdownToc(content);

  return (
    <Page className="flex h-full flex-col">
      <div className="sticky top-0 z-20 mb-3 shrink-0 backdrop-blur supports-backdrop-filter:bg-panel-strong/95 sm:mb-4">
        <div className="flex flex-col gap-4 rounded-[1.5rem] border border-border bg-panel-strong px-4 py-4 shadow-[0_14px_40px_rgba(15,23,42,0.08)] sm:gap-6 sm:rounded-[1.8rem] sm:px-6 sm:py-5 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <span className="inline-flex rounded-full border border-border bg-secondary px-2 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Console
              </span>
              <span className="hidden text-sm text-border sm:inline">/</span>
              <span className="hidden text-sm font-medium text-muted-foreground sm:inline">
                Glossaire
              </span>
            </div>
            <h1 className="mt-3 text-[1.2rem] font-semibold tracking-tight text-foreground sm:text-[1.5rem] lg:text-[2rem]">
              Documentation EVCore
            </h1>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
              Référence éditoriale des termes métier, statistiques et techniques
              utilisés dans le produit et dans le code.
            </p>
          </div>
          <div className="rounded-[1.25rem] border border-accent/20 bg-[radial-gradient(circle_at_top,hsl(var(--accent-soft))_0%,hsl(var(--panel))_65%)] px-4 py-3 text-left md:rounded-3xl md:px-5 md:py-4 md:text-right">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-accent">
              Sommaire
            </p>
            <p className="mt-2 text-[1.7rem] font-semibold tracking-tight text-foreground md:text-3xl">
              {toc.length}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              sections principales
            </p>
          </div>
        </div>
      </div>

      <PageContent className="min-h-0 flex-1 overflow-y-auto rounded-[1.8rem] p-4 sm:p-5 ev-shell-shadow">
        <div className="flex flex-col gap-5 xl:grid xl:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
          <section className="rounded-[1.4rem] border border-border bg-panel-strong p-4 ev-shell-shadow xl:hidden">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
              Navigation
            </p>
            <GlossaryToc items={toc} />
          </section>

          <aside className="hidden h-fit rounded-[1.6rem] border border-border bg-panel-strong p-5 ev-shell-shadow xl:block xl:sticky xl:top-5">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
              Navigation
            </p>
            <GlossaryToc items={toc} />
          </aside>

          <section className="rounded-[1.4rem] border border-border bg-panel p-4 shadow-[0_16px_44px_rgba(15,23,42,0.08)] sm:rounded-[1.6rem] sm:p-6 lg:p-8">
            <MarkdownArticle content={content} />
          </section>
        </div>
      </PageContent>
    </Page>
  );
}
