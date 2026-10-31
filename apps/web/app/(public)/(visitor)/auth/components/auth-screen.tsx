import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { LegalLine } from "@/components/scoreboard/shell/legal-line";

/**
 * Un écran du compte sans connexion (11 § 2–5, maquettes Inscription,
 * Connexion, Verification) : le retour et le titre, une colonne, la ligne
 * 18+ en pied. Le même style que la landing, sans le pied légal complet.
 */
export async function AuthScreen({
  title,
  intro,
  back,
  children,
}: {
  title: string;
  /** One short line under the title, when the screen needs it. */
  intro?: React.ReactNode;
  back: { href: string; label: string };
  children: React.ReactNode;
}) {
  const shell = await getTranslations("shell");
  return (
    <>
      <header className="flex items-center gap-1 px-2 pt-3 lg:px-4">
        <Link
          href={back.href}
          aria-label={back.label}
          className="flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
        >
          <ChevronLeft aria-hidden strokeWidth={2} className="size-6" />
        </Link>
        <h1 className="score text-title font-semibold">{title}</h1>
      </header>
      <main id="contenu" className="flex flex-col gap-4 px-4 pt-4 pb-8 lg:px-6">
        {intro ? (
          <p className="text-body text-muted-foreground">{intro}</p>
        ) : null}
        {children}
      </main>
      <LegalLine text={shell("legal")} className="mt-auto" />
    </>
  );
}
