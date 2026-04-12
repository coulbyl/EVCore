"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { AppPageHeader } from "@/components/app-page-header";

export function FixturesHeaderClient() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleRefresh() {
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <AppPageHeader
      currentPageLabel="Fixtures"
      subtitle="Liste des matchs scorés du jour"
      backendLabel="OK"
      onRefresh={handleRefresh}
      isRefreshing={isPending}
    />
  );
}
