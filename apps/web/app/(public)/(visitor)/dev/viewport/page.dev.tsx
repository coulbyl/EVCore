import type { Metadata } from "next";
import Link from "next/link";
import { getMessages } from "next-intl/server";
import { assertDevOnly, devOnlyMetadata } from "@/app/(player)/dev/dev-only";
import { SheetDemoContent } from "@/app/(player)/dev/components/sheet/sheet-demo-content";
import { Sheet } from "@/components/scoreboard/sheet/sheet";
import { BottomTabs } from "@/components/scoreboard/shell/bottom-tabs";
import { PlayerTextsProvider } from "@/components/scoreboard/text/player-texts";
import { pickPlayerTexts } from "@/components/scoreboard/text/player-texts-constants";
import { ViewportProbe } from "./viewport-probe";

export const metadata: Metadata = {
  title: "Relevé de l'écran — vitrine",
  ...devOnlyMetadata,
};

const ACTION_CLASS =
  "flex h-12 flex-1 items-center justify-center rounded-[0.625rem] bg-primary text-bet font-medium text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

/**
 * What a real phone's browser covers at the bottom of the page (15-todo.md,
 * « Feuille courte coupée en bas »). A simulator draws its own bar over the
 * page and sees no viewport change: only a real phone settles where a fixed
 * element may sit. The ruler reads in CSS pixels up from the bottom edge
 * where `position: fixed; bottom: 0` lands; the lowest graduation still
 * visible is how much the browser hides.
 *
 * Outside the player's group, without a session: a phone reaches the dev
 * server through a tunnel, and signing in there would call the API on the
 * phone's own localhost. It brings the real tab bar and the real sheet,
 * short (the coupon) or long (the match), with « Suivre » at the bottom.
 */
export default async function ViewportProbePage({
  searchParams,
}: {
  searchParams: Promise<{ sheet?: string }>;
}) {
  assertDevOnly();
  const [{ sheet }, messages] = await Promise.all([
    searchParams,
    getMessages(),
  ]);

  return (
    <PlayerTextsProvider texts={pickPlayerTexts(messages)}>
      <main
        data-sheet-inert=""
        className="mx-auto flex w-full max-w-[40rem] flex-col gap-4 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[calc(3.5rem+env(safe-area-inset-bottom)+1.5rem)]"
      >
        <h1 className="score text-title font-semibold">
          Relevé de l&apos;écran
        </h1>
        <ol className="flex list-decimal flex-col gap-1 ps-5 text-body">
          <li>
            Note la plus petite graduation lisible de la règle, en bas à gauche,
            et fais une capture.
          </li>
          <li>
            Fais défiler vers le bas pour replier la barre du navigateur, puis
            recommence.
          </li>
          <li>
            Ouvre la feuille courte, puis la longue : « Suivre » passe-t-il sous
            la barre ?
          </li>
        </ol>
        <div className="flex gap-2">
          <Link href="/dev/viewport?sheet=short" className={ACTION_CLASS}>
            Feuille courte
          </Link>
          <Link href="/dev/viewport?sheet=long" className={ACTION_CLASS}>
            Feuille longue
          </Link>
        </div>
        <ViewportProbe />
      </main>
      <BottomTabs />
      {sheet === "short" || sheet === "long" ? (
        <Sheet
          title="Favori du jour"
          fallbackHref="/dev/viewport"
          tone="band"
          bandContent={
            <p className="score text-figure font-bold">8 sur 10 · 1,28</p>
          }
          footer={
            <button type="button" className={`${ACTION_CLASS} w-full`}>
              Suivre
            </button>
          }
        >
          {sheet === "long" ? (
            <SheetDemoContent />
          ) : (
            <p className="py-4 text-body">
              Une feuille plus courte que l&apos;écran, comme un coupon à une
              jambe.
            </p>
          )}
        </Sheet>
      ) : null}
    </PlayerTextsProvider>
  );
}
