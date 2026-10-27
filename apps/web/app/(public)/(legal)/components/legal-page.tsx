import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { LEGAL_LAST_UPDATED } from "../legal-entity";

export const LEGAL_LINKS = [
  { href: "/cgu", label: "Conditions d'utilisation" },
  { href: "/confidentialite", label: "Confidentialité" },
  { href: "/jeu-responsable", label: "Jeu responsable" },
  { href: "/mentions-legales", label: "Mentions légales" },
] as const;

/**
 * Gabarit des pages légales : une colonne de lecture (mode « Read »), un
 * titre, la date de mise à jour, et la navigation entre les quatre pages.
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
    <main className="min-h-dvh bg-background text-foreground">
      <header className="border-b border-border px-6 py-4 sm:px-10">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center gap-2 text-sm font-bold"
        >
          <Image
            src="/icons/icon.svg"
            alt=""
            width={28}
            height={28}
            className="size-7 rounded-lg"
          />
          EVCore
        </Link>
      </header>

      <article className="mx-auto max-w-[68ch] px-6 py-12 sm:px-10">
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Dernière mise à jour : {LEGAL_LAST_UPDATED}
        </p>
        <p className="mt-6 text-base leading-relaxed">{intro}</p>
        <div className="legal-body mt-8 flex flex-col gap-8 text-base leading-relaxed [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_li]:mt-1.5 [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-6">
          {children}
        </div>
      </article>

      <footer className="border-t border-border px-6 py-8 sm:px-10">
        <nav
          aria-label="Pages légales"
          className="mx-auto flex max-w-[68ch] flex-wrap gap-x-6 gap-y-2 text-sm"
        >
          {LEGAL_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="inline-flex min-h-11 items-center text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <p className="mx-auto mt-4 max-w-[68ch] text-sm text-muted-foreground">
          18+ · Parier comporte des risques de perte. Ne mise que ce que tu peux
          perdre.
        </p>
      </footer>
    </main>
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
    <span className="rounded bg-warning/15 px-1.5 py-0.5 text-warning">
      {fallback}
    </span>
  );
}
