import { Page, PageContent } from "@evcore/ui";
import { getLocale, getTranslations } from "next-intl/server";
import { AppearanceSection } from "./components/appearance-section";
import { LanguageSection } from "./components/language-section";

export default async function AccountSettingsPage() {
  const locale = (await getLocale()) as "fr" | "en";
  const t = await getTranslations("account");

  return (
    <Page className="flex h-full flex-col">
      <PageContent className="min-h-0 flex-1 overflow-y-auto rounded-[1.8rem] p-4 sm:p-5 ev-shell-shadow">
        <div className="mb-6">
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
            {t("account")}
          </p>
          <h1 className="mt-2 text-xl font-semibold tracking-tight text-foreground">
            {t("title")}
          </h1>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <AppearanceSection />
          <LanguageSection currentLocale={locale} />

          <div className="rounded-[1.6rem] border border-border bg-panel-strong p-5 ev-shell-shadow">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
              {t("notifications")}
            </p>
            <p className="mt-3 text-sm text-muted-foreground">À venir.</p>
          </div>

          <div className="rounded-[1.6rem] border border-border bg-panel-strong p-5 ev-shell-shadow">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
              {t("bankroll")}
            </p>
            <p className="mt-3 text-sm text-muted-foreground">À venir.</p>
          </div>
        </div>
      </PageContent>
    </Page>
  );
}
