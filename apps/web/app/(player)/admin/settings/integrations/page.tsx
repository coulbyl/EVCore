import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { getIntegrations } from "@/domains/console/use-cases/get-console";
import { getPlayerTimeZone } from "@/domains/preferences/get-player-time-zone";
import { displayLocaleOf, formatShortDate } from "@/helpers/scoreboard-format";
import { AdminBand } from "../../components/admin-band";
import { IntegrationCard } from "../components/integration-card";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("console.integrations");
  return { title: `${t("title")} — EVCore`, robots: { index: false } };
}

/** The data services first, then the players' messages, then the AI. */
const GROUPS = [
  { key: "data", items: ["apiFootball", "theOddsApi"] },
  { key: "players", items: ["email", "push", "storage"] },
  { key: "ai", items: ["groq", "cerebras", "together", "fireworks", "tavily"] },
] as const;

/**
 * Réglages › Intégrations (revue admin du 01/11, on iddia's model): the
 * keys and addresses of the third-party services, out of the .env. A
 * secret is encrypted with SETTINGS_ENCRYPTION_KEY and never shown again;
 * a field left empty keeps reading its .env variable. Changes serve within
 * a minute, without a redeploy.
 */
export default async function Page() {
  const [t, locale, timeZone, data] = await Promise.all([
    getTranslations("console.integrations"),
    getLocale(),
    getPlayerTimeZone(),
    getIntegrations(),
  ]);
  const display = displayLocaleOf(locale);
  const byKey = new Map(data.items.map((i) => [i.key, i]));
  const heading = "text-meta font-semibold text-muted-foreground";

  return (
    <>
      <AdminBand current="settings" />
      <div className="flex flex-col gap-5 px-4 pt-3 pb-4 lg:px-6">
        <Link
          href="/admin/settings"
          className="text-meta font-medium underline-offset-4 hover:underline"
        >
          ‹ {t("back")}
        </Link>
        <div className="flex flex-col gap-1">
          <h2 className="score text-title font-semibold">{t("title")}</h2>
          <p className="text-meta text-muted-foreground">{t("intro")}</p>
        </div>
        {!data.canEncrypt ? (
          <p
            role="alert"
            className="rounded-[0.875rem] border border-loss/40 bg-loss/10 px-4 py-3 text-body"
          >
            {t("noEncryption")}
          </p>
        ) : null}
        {GROUPS.map((group) => (
          <section key={group.key} className="flex flex-col gap-2">
            <h2 className={heading}>{t(`groups.${group.key}`)}</h2>
            {group.items.map((key) => {
              const integration = byKey.get(key);
              if (!integration) return null;
              return (
                <IntegrationCard
                  key={key}
                  integration={integration}
                  canEncrypt={data.canEncrypt}
                  dates={Object.fromEntries(
                    integration.fields.map((f) => [
                      f.key,
                      f.updatedAt
                        ? formatShortDate(
                            new Date(f.updatedAt),
                            display,
                            timeZone,
                          )
                        : "",
                    ]),
                  )}
                  labels={{
                    name: t(`names.${key}`),
                    fields: Object.fromEntries(
                      integration.fields.map((f) => [
                        f.key,
                        t(`fields.${f.key.split(".")[1]}`),
                      ]),
                    ),
                    source: {
                      stored: t("source.stored"),
                      env: t("source.env"),
                      none: t("source.none"),
                    },
                    secretSet: t("secretSet"),
                    unreadable: t("unreadable"),
                    setBy: String(t.raw("setBy")),
                    edit: t("edit"),
                    replace: t("replace"),
                    save: t("save"),
                    cancel: t("cancel"),
                    clear: t("clear"),
                    clearHint: t("clearHint"),
                    test: t("test"),
                    testing: t("testing"),
                    failed: t("failed"),
                    noEncryption: t("noEncryption"),
                  }}
                />
              );
            })}
          </section>
        ))}
      </div>
    </>
  );
}
