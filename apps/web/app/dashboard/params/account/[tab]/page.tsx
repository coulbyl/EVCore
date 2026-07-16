import { notFound } from "next/navigation";
import { AccountPageShell } from "../account-page-shell";
import { isAccountTabValue } from "../account-tabs-constants";

export default async function AccountTabPage({
  params,
}: {
  params: Promise<{ tab: string }>;
}) {
  const { tab } = await params;
  if (!isAccountTabValue(tab)) {
    notFound();
  }

  return <AccountPageShell activeTab={tab} securityDetailOpen={false} />;
}
