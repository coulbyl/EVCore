"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowLeft, Repeat } from "lucide-react";
import { Page, PageContent, PageHeader, PageHeaderTitle } from "@evcore/ui";
import { SubscriptionForm } from "./subscription-form";

export function SubscriptionFormPageClient() {
  const t = useTranslations("subscriptions");

  return (
    <Page className="flex h-full flex-col">
      <PageContent className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
          <nav className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Link
              href="/dashboard/subscriptions"
              className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
            >
              <ArrowLeft size={12} />
              {t("pageTitle")}
            </Link>
          </nav>

          <PageHeader>
            <div>
              <PageHeaderTitle className="flex items-center gap-2">
                <Repeat size={16} className="text-accent" />
                {t("form.title")}
              </PageHeaderTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("form.description")}
              </p>
            </div>
          </PageHeader>

          <section className="rounded-[1.6rem] border border-border bg-panel-strong p-4 sm:p-6">
            <SubscriptionForm />
          </section>
        </div>
      </PageContent>
    </Page>
  );
}
