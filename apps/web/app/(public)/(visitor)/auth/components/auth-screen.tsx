import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { LegalLine } from "@/components/scoreboard/shell/legal-line";
import { VisitorBand } from "../../visitor-band";

/**
 * Un écran du compte sans connexion (11 § 2–5, maquettes Inscription,
 * Connexion, Verification) : le bandeau encre du visiteur avec le retour et
 * le titre, une colonne, la ligne 18+ en pied. Sans le pied légal complet.
 */
export async function AuthScreen({
  title,
  intro,
  back,
  action = true,
  children,
}: {
  title: string;
  /** One short line under the title, when the screen needs it. */
  intro?: React.ReactNode;
  back: { href: string; label: string };
  /** « Se connecter » in the band; off on the sign-in page itself. */
  action?: boolean;
  children: React.ReactNode;
}) {
  const shell = await getTranslations("shell");
  return (
    <>
      <VisitorBand action={action}>
        <div className="-ms-2 flex items-center gap-1">
          <Link
            href={back.href}
            aria-label={back.label}
            className="flex size-11 shrink-0 items-center justify-center rounded-full text-band-muted hover:text-band-foreground focus-visible:outline-2 focus-visible:outline-led-on"
          >
            <ChevronLeft aria-hidden strokeWidth={2} className="size-6" />
          </Link>
          <h1 className="score text-title font-semibold">{title}</h1>
        </div>
      </VisitorBand>
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
