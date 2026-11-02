import type { Metadata } from "next";
import Link from "next/link";
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

const BACK = [
  { key: "players", href: "/admin/players" },
  { key: "home", href: "/admin" },
] as const;

/**
 * Messages (12-admin.md § 3): the players' support conversations, in the
 * order one acts. A thread opens on its own page on a phone, next to the
 * list on a wide screen.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; silent?: string; from?: string }>;
}) {
  const [params, conversations, t] = await Promise.all([
    searchParams,
    getAdminConversations(),
    getTranslations("console.messages"),
  ]);
  // Arrived from Joueurs or a line of « À faire »: the way back, as on
  // the other sub-screens.
  const from = BACK.find((b) => b.key === params.from);
  return (
    <>
      <AdminBand current="messages" />
      <div className="flex flex-col gap-3 px-4 pt-3 pb-4 lg:px-6">
        {from ? (
          <Link
            href={from.href}
            className="text-meta font-medium underline-offset-4 hover:underline"
          >
            ‹ {t(`backTo.${from.key}`)}
          </Link>
        ) : null}
        <ConversationList
          conversations={conversations}
          query={(params.q ?? "").trim()}
          showSilent={params.silent === "1"}
        />
      </div>
    </>
  );
}
