import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { SubpageBand } from "@/components/scoreboard/shell/subpage-band";
import { Row, RowList } from "@/components/scoreboard/ui/row-list";
import { helpSheets } from "@/domains/help/help-sheets";
import { displayLocaleOf } from "@/helpers/scoreboard-format";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("help");
  return { title: `${t("title")} — EVCore` };
}

/**
 * « Aide » (09 § 3, maquette Aide) : l'index des fiches courtes, chacune
 * ouverte en feuille ; la dernière ligne mène à Messages.
 */
export default async function Page() {
  const [t, locale] = await Promise.all([getTranslations("help"), getLocale()]);
  return (
    <>
      <SubpageBand
        title={t("title")}
        back={{ href: "/me", label: t("back") }}
      />
      <div className="flex flex-col px-4 pt-2 pb-4 lg:px-6">
        <RowList label={t("sheets")}>
          {helpSheets(displayLocaleOf(locale)).map((sheet) => (
            <Row
              key={sheet.slug}
              href={`/me/help/${sheet.slug}`}
              title={sheet.title}
            />
          ))}
        </RowList>
        <RowList className="border-t border-border">
          <Row href="/me/messages" title={t("ask")} />
        </RowList>
      </div>
    </>
  );
}
