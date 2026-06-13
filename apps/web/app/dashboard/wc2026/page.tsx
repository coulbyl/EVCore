import type { Metadata } from "next";
import Link from "next/link";
import {
  Page,
  PageContent,
  PageHeader,
  PageHeaderActions,
  PageHeaderTitle,
} from "@evcore/ui";
import {
  daysUntilWC2026,
  isWC2026Active,
  isWC2026Countdown,
  WC2026,
} from "@/lib/events/world-cup-2026";
import { WC2026Groups } from "@/components/events/wc2026/wc2026-groups";

export const metadata: Metadata = {
  title: "Coupe du Monde 2026 — EVCore",
};

export default function WC2026Page() {
  const now = new Date();
  const active = isWC2026Active(now);
  const countdown = isWC2026Countdown(now);

  if (!active && !countdown) {
    return (
      <Page className="flex h-full flex-col">
        <PageContent className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5 ev-shell-shadow">
          <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
            <span className="inline-flex size-16 items-center justify-center rounded-[1.4rem] border border-[#c9a84c]/30 bg-[#c9a84c]/10 text-3xl">
              🏆
            </span>
            <div>
              <p className="text-lg font-semibold text-foreground">
                Coupe du Monde 2026
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                La compétition débute le{" "}
                {WC2026.start.toLocaleDateString("fr-FR", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
                .
              </p>
            </div>
            <Link
              href="/dashboard"
              className="mt-1 text-sm text-accent hover:underline underline-offset-2"
            >
              ← Retour au dashboard
            </Link>
          </div>
        </PageContent>
      </Page>
    );
  }

  const days = countdown ? daysUntilWC2026(now) : 0;

  return (
    <Page className="flex h-full flex-col">
      <PageHeader>
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[#c9a84c]">🏆</span>
              <PageHeaderTitle className="text-base font-bold text-[#c9a84c] sm:text-lg">
                Coupe du Monde 2026
              </PageHeaderTitle>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              11 juin – 19 juillet 2026 · USA 🇺🇸 Canada 🇨🇦 Mexique 🇲🇽
            </p>
          </div>
          <PageHeaderActions className="shrink-0">
            {countdown ? (
              <div className="shrink-0 rounded-[1rem] border border-[#c9a84c]/30 bg-[#c9a84c]/10 px-4 py-2 text-right">
                <p className="text-2xl font-bold tabular-nums text-[#c9a84c] sm:text-3xl">
                  {days}
                </p>
                <p className="text-[0.62rem] font-medium uppercase tracking-[0.18em] text-[#c9a84c]/70">
                  {days === 1 ? "jour" : "jours"}
                </p>
              </div>
            ) : (
              <span className="shrink-0 rounded-full border border-[#c9a84c]/40 bg-[#c9a84c]/10 px-3 py-1 text-xs font-semibold text-[#c9a84c]">
                En cours
              </span>
            )}
          </PageHeaderActions>
        </div>
      </PageHeader>

      <PageContent className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5 ev-shell-shadow">
        <div className="flex flex-col gap-5 pb-6">
          <WC2026Groups />
        </div>
      </PageContent>
    </Page>
  );
}
