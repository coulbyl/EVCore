import type { ReactNode } from "react";
import { LEGAL_LAST_UPDATED } from "../legal-entity";
import { VisitorBand } from "../../visitor-band";
import { VisitorFooter } from "../../visitor-footer";

/**
 * Gabarit des pages légales (11 § 7) dans le style de l'application : la
 * bande du visiteur, une colonne de lecture, le titre, la date de mise à
 * jour, le texte, puis le pied commun (la ligne 18+ et les quatre pages).
 */
export function LegalPage({
  title,
  intro,
  children,
}: {
  title: string;
  intro: string;
  children: ReactNode;
}) {
  return (
    <>
      <VisitorBand />
      <main
        id="contenu"
        className="mx-auto w-full max-w-[40rem] px-4 pt-6 pb-10 lg:px-6"
      >
        <article className="flex max-w-[68ch] flex-col gap-2">
          <h1 className="score text-title font-bold">{title}</h1>
          <p className="text-meta text-muted-foreground">
            Dernière mise à jour : {LEGAL_LAST_UPDATED}
          </p>
          <p className="pt-3 text-body">{intro}</p>
          <div className="flex flex-col gap-6 pt-4 text-body [&_a]:underline [&_a]:underline-offset-4 [&_h2]:score [&_h2]:text-bet [&_h2]:font-semibold [&_li]:mt-1.5 [&_p]:mt-2 [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:ps-5">
            {children}
          </div>
        </article>
      </main>
      <VisitorFooter />
    </>
  );
}

/** Une valeur de l'éditeur, ou la mention visible qu'elle reste à fournir. */
export function EntityValue({
  value,
  fallback,
}: {
  value: string | null;
  fallback: string;
}) {
  return value ? (
    <>{value}</>
  ) : (
    <span className="rounded-sm bg-warning/15 px-1.5 py-0.5 text-warning">
      {fallback}
    </span>
  );
}
