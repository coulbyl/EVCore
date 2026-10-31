import { getTranslations } from "next-intl/server";
import { LegalLine } from "@/components/scoreboard/shell/legal-line";
import { BandTitle } from "../../band-title";
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
        <BandTitle title={title} back={back} />
      </VisitorBand>
      {/* A form reads best narrow: centred, 26 rem at most on a wide screen. */}
      <main
        id="contenu"
        className="mx-auto flex w-full max-w-[26rem] flex-col gap-4 px-4 pt-5 pb-8"
      >
        {intro ? (
          <p className="text-body text-muted-foreground">{intro}</p>
        ) : null}
        {children}
      </main>
      <LegalLine text={shell("legal")} className="mt-auto" />
    </>
  );
}
