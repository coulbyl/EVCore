import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LegalLine } from "@/components/scoreboard/shell/legal-line";

const LEGAL_PAGES = [
  { href: "/cgu", key: "terms" },
  { href: "/confidentialite", key: "privacy" },
  { href: "/mentions-legales", key: "notice" },
  { href: "/jeu-responsable", key: "responsible" },
] as const;

/** Le pied des pages du visiteur (11 § 1) : la ligne 18+, les pages légales. */
export async function VisitorFooter() {
  const [t, shell] = await Promise.all([
    getTranslations("landing.legal"),
    getTranslations("shell"),
  ]);
  return (
    <footer className="mx-auto mt-auto w-full max-w-[40rem] border-t border-border">
      <LegalLine text={shell("legal")} className="pb-1" />
      <nav
        aria-label={t("label")}
        className="flex flex-wrap justify-center gap-x-4 px-4 pb-6"
      >
        {LEGAL_PAGES.map((page) => (
          <Link
            key={page.href}
            href={page.href}
            className="inline-flex min-h-11 items-center text-meta text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            {t(page.key)}
          </Link>
        ))}
      </nav>
    </footer>
  );
}
