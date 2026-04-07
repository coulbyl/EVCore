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
      <div className="sticky top-0 z-20 mb-4 shrink-0 backdrop-blur supports-backdrop-filter:bg-panel-strong/95">
        <div className="flex items-end justify-between gap-6 rounded-[1.8rem] border border-border bg-panel-strong px-6 py-5 shadow-[0_14px_40px_rgba(15,23,42,0.08)]">
          <div>
            <div className="flex items-center gap-3">
              <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Console
              </span>
              <span className="text-sm text-slate-300">/</span>
              <span className="text-sm font-medium text-slate-500">
                Glossaire
              </span>
            </div>
            <h1 className="mt-3 text-[2rem] font-semibold tracking-tight text-slate-900">
              Documentation EVCore
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-slate-500">
              Référence éditoriale des termes métier, statistiques et techniques
              utilisés dans le produit et dans le code.
            </p>
          </div>
          <div className="hidden rounded-3xl border border-cyan-200 bg-[radial-gradient(circle_at_top,#ecfeff_0%,#f8fafc_65%)] px-5 py-4 text-right md:block">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-cyan-700">
              Sommaire
            </p>
            <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
              {toc.length}
            </p>
            <p className="mt-1 text-sm text-slate-500">sections principales</p>
          </div>
        </div>
      </div>

      <PageContent className="min-h-0 flex-1 overflow-y-auto rounded-[1.8rem] p-5 ev-shell-shadow">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
          <aside className="h-fit rounded-[1.6rem] border border-border bg-panel-strong p-5 ev-shell-shadow xl:sticky xl:top-5">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-slate-400">
              Navigation
            </p>
            <GlossaryToc items={toc} />
          </aside>

          <section className="rounded-[1.6rem] border border-border bg-white p-8 shadow-[0_16px_44px_rgba(15,23,42,0.08)]">
            <MarkdownArticle content={content} />
          </section>
        </div>
      </PageContent>
    </Page>
  );
}
