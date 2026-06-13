import { promises as fs } from "node:fs";
import path from "node:path";
import Link from "next/link";
import {
  Page,
  PageContent,
  PageHeader,
  PageHeaderActions,
  PageHeaderTitle,
} from "@evcore/ui";
import { HelpCircle, Mail } from "lucide-react";
import { GlossaryToc } from "@/components/glossary-toc";
import { MarkdownArticle, getMarkdownToc } from "@/components/markdown-article";
import { GlossaireSearch } from "../glossaire/glossaire-search";

async function loadHelpContent() {
  const filePath = path.join(process.cwd(), "content", "help-leagues.md");
  return fs.readFile(filePath, "utf8");
}

export default async function HelpPage() {
  const content = await loadHelpContent();
  const toc = getMarkdownToc(content);

  return (
    <Page className="flex h-full flex-col">
      <PageHeader className="lg:flex-col lg:items-stretch lg:justify-start">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <span className="inline-flex size-9 items-center justify-center rounded-2xl border border-border bg-secondary text-accent shadow-xs">
                <HelpCircle size={16} />
              </span>
              <div>
                <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                  Aide
                </p>
                <PageHeaderTitle className="text-[1.1rem] font-semibold tracking-tight sm:text-[1.4rem]">
                  Guide des paris
                </PageHeaderTitle>
              </div>
            </div>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              Picks validés par ligue — fenêtres de cotes et signaux observés
              sur 3 saisons de backtest.
            </p>
          </div>
          <PageHeaderActions className="shrink-0">
            <div className="rounded-[1.25rem] border border-accent/20 px-4 py-3 text-left md:px-5 md:py-4 md:text-right">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-accent">
                Ligues
              </p>
              <p className="mt-1 text-[1.6rem] font-semibold tracking-tight tabular-nums text-foreground md:text-3xl">
                {toc.length}
              </p>
              <p className="text-sm text-muted-foreground">sections</p>
            </div>
          </PageHeaderActions>
        </div>

        <GlossaireSearch items={toc} />
      </PageHeader>

      <PageContent className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5 ev-shell-shadow">
        <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)] lg:gap-6">
          {/* Mobile ToC */}
          <section className="rounded-[1.4rem] border border-border bg-panel-strong p-4 ev-shell-shadow lg:hidden">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
              Navigation
            </p>
            <GlossaryToc items={toc} />
          </section>

          {/* Desktop sticky sidebar */}
          <aside className="hidden lg:flex lg:flex-col lg:sticky lg:top-5 lg:max-h-[calc(100dvh-8rem)] rounded-[1.6rem] border border-border bg-panel-strong p-5 ev-shell-shadow">
            <p className="shrink-0 text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
              Navigation
            </p>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <GlossaryToc items={toc} />
            </div>
          </aside>

          <div className="flex flex-col gap-5">
            <section className="rounded-[1.6rem] border border-border bg-panel p-4 shadow-[0_16px_44px_rgba(15,23,42,0.08)] sm:p-6 lg:p-8">
              <MarkdownArticle content={content} />
            </section>

            {/* Contact support CTA */}
            <section className="rounded-[1.6rem] border border-border bg-panel-strong p-5 sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-2xl border border-border bg-secondary text-accent">
                    <Mail size={16} />
                  </span>
                  <div>
                    <p className="font-semibold text-foreground">
                      Vous ne trouvez pas ce que vous cherchez ?
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Contactez le support — nous répondons en moins de 24h.
                    </p>
                  </div>
                </div>
                <Link
                  href="mailto:support@evcore.io"
                  className="shrink-0 inline-flex items-center gap-2 rounded-2xl border border-border bg-secondary px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:border-accent/30 hover:bg-accent/8 hover:text-accent"
                >
                  <Mail size={14} />
                  Contacter le support
                </Link>
              </div>
            </section>
          </div>
        </div>
      </PageContent>
    </Page>
  );
}
