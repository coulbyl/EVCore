import Link from "next/link";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { SESSION_COOKIE } from "@/domains/auth/routing/auth-routing";

/**
 * « EVCore · Se connecter » en tête des pages du visiteur (11 § 1). Avec un
 * cookie de session (un joueur venu lire une page légale), « Aujourd'hui »
 * à la place : le cookie suffit, une session expirée repasse par la
 * connexion.
 */
export async function VisitorBand() {
  const [t, shell, jar] = await Promise.all([
    getTranslations("landing"),
    getTranslations("shell"),
    cookies(),
  ]);
  const signedIn = jar.has(SESSION_COOKIE);
  return (
    <header className="flex items-center justify-between gap-3 px-4 pt-4 lg:px-6">
      <Link
        href="/"
        className="score text-title font-bold tracking-wide focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        EVCore
      </Link>
      <Link
        href={signedIn ? "/today" : "/auth/login"}
        className="inline-flex min-h-11 items-center text-body font-medium underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        {signedIn ? shell("tabs.today") : t("signIn")}
      </Link>
    </header>
  );
}
