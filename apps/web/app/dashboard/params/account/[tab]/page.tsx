import { notFound, redirect } from "next/navigation";
import { AccountPageShell } from "../account-page-shell";
import { isAccountTabValue } from "../account-tabs-constants";

export default async function AccountTabPage({
  params,
}: {
  params: Promise<{ tab: string }>;
}) {
  const { tab } = await params;
  // Onglet retiré le 2026-10-27 : un ancien lien mène au profil.
  if (tab === "personnalisation") redirect("/dashboard/params/account/profil");
  if (!isAccountTabValue(tab)) {
    notFound();
  }

  return <AccountPageShell activeTab={tab} securityDetailOpen={false} />;
}
