import Link from "next/link";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { SESSION_COOKIE } from "@/domains/auth/routing/auth-routing";

/**
 * Le bandeau encre des pages du visiteur (DESIGN.md : un bandeau encre en
 * tête de chaque écran), le même que celui des onglets : la marque et
 * « Se connecter » sur la première ligne, ce qui est propre à la page en
 * dessous (la phrase de marque, le retour et le titre). Sans colonne
 * gauche ici, la marque reste sur ordinateur aussi.
 *
 * Avec un cookie de session (un joueur venu lire une page légale),
 * « Aujourd'hui » à la place de « Se connecter » ; `action={false}` le
 * retire (la page de connexion elle-même).
 */
export async function VisitorBand({
  action = true,
  children,
}: {
  action?: boolean;
  children?: React.ReactNode;
}) {
  const [t, shell, jar] = await Promise.all([
    getTranslations("landing"),
    getTranslations("shell"),
    cookies(),
  ]);
  const signedIn = jar.has(SESSION_COOKIE);
  return (
    <header className="bg-band px-4 pb-3.5 pt-[max(1rem,env(safe-area-inset-top))] text-band-foreground dark:border-b dark:border-band-rule lg:px-6">
      <div className="flex min-h-11 items-center justify-between gap-3">
        <Link
          href="/"
          className="score text-title font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-led-on"
        >
          EVCore
        </Link>
        {action ? (
          <Link
            href={signedIn ? "/today" : "/auth/login"}
            className="inline-flex min-h-11 items-center rounded-[0.625rem] border border-band-rule px-4 text-body font-medium hover:bg-band-rule focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-led-on"
          >
            {signedIn ? shell("tabs.today") : t("signIn")}
          </Link>
        ) : null}
      </div>
      {children ? (
        <div className="mt-3 border-t border-band-rule pt-3">{children}</div>
      ) : null}
    </header>
  );
}
