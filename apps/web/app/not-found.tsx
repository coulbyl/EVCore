import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { SESSION_COOKIE } from "@/domains/auth/routing/auth-routing";
import styles from "./not-found.module.css";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("notFound");
  return { title: `${t("title")} — EVCore` };
}

/**
 * La page introuvable (11 § 8, maquette Introuvable) : une ligne, un bouton
 * vers Aujourd'hui, ou vers l'accueil sans session. Les anciennes adresses
 * connues redirigent avant d'arriver ici (helpers/retired-routes.ts).
 */
export default async function NotFound() {
  const [t, shell, jar] = await Promise.all([
    getTranslations("notFound"),
    getTranslations("shell"),
    cookies(),
  ]);
  const signedIn = jar.has(SESSION_COOKIE);
  return (
    <div className={styles.page}>
      <header className={styles.band}>EVCore</header>
      <main className={styles.body}>
        <p className={styles.code} aria-hidden>
          404
        </p>
        <h1 className={styles.line}>{t("line")}</h1>
        <Link href={signedIn ? "/today" : "/"} className={styles.action}>
          {signedIn ? shell("tabs.today") : t("home")}
        </Link>
      </main>
      <p className={styles.legal}>{shell("legal")}</p>
    </div>
  );
}
