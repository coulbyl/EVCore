import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getAdminConversations } from "@/domains/support/use-cases/get-admin-support";
import { AdminBand } from "../components/admin-band";
import { ConversationList } from "./components/conversation-list";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("console");
  return {
    title: `${t("titles.messages")} — EVCore`,
    robots: { index: false },
  };
}

/**
 * Messages (12-admin.md § 3): the players' support conversations, in the
 * order one acts. A thread opens on its own page on a phone, next to the
 * list on a wide screen.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; silent?: string }>;
}) {
  const [params, conversations] = await Promise.all([
    searchParams,
    getAdminConversations(),
  ]);
  return (
    <>
      <AdminBand current="messages" />
      <div className="px-4 pt-3 pb-4 lg:px-6">
        <ConversationList
          conversations={conversations}
          query={(params.q ?? "").trim()}
          showSilent={params.silent === "1"}
        />
      </div>
    </>
  );
}
