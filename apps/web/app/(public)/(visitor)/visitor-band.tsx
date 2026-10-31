import Link from "next/link";
import { getTranslations } from "next-intl/server";

/** « EVCore · Se connecter » en tête des pages du visiteur (11 § 1). */
export async function VisitorBand() {
  const t = await getTranslations("landing");
  return (
    <header className="flex items-center justify-between gap-3 px-4 pt-4 lg:px-6">
      <Link
        href="/"
        className="score text-title font-bold tracking-wide focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        EVCore
      </Link>
      <Link
        href="/auth/login"
        className="inline-flex min-h-11 items-center text-body font-medium underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        {t("signIn")}
      </Link>
    </header>
  );
}
