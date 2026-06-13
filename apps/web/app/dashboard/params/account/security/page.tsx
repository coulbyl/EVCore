import { Page, PageContent, PageHeader, PageHeaderTitle } from "@evcore/ui";
import { SettingsSectionCard } from "../components/settings-section-card";
import { SecuritySetupForm } from "./components/security-setup-form";

export default function SecuritySetupPage() {
  return (
    <Page className="flex h-full flex-col">
      <PageContent className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5 ev-shell-shadow">
        <PageHeader className="mb-6">
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
            Sécurité
          </p>
          <PageHeaderTitle className="mt-2 text-xl font-semibold tracking-tight">
            Vérification du compte
          </PageHeaderTitle>
        </PageHeader>

        <div className="mx-auto max-w-lg">
          <SettingsSectionCard
            eyebrow="Authentification"
            title="Configurer la vérification"
          >
            <SecuritySetupForm />
          </SettingsSectionCard>
        </div>
      </PageContent>
    </Page>
  );
}
