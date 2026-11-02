import { cache } from "react";
import { serverApiRequest } from "@/lib/api/server-api";
import type {
  SupportConversationSummary,
  SupportMessagePage,
} from "../types/support";

/** Every support conversation, as the team reads them (12-admin.md § 3). */
export const getAdminConversations = cache(
  (): Promise<SupportConversationSummary[]> =>
    serverApiRequest<SupportConversationSummary[]>(
      "/admin/support/conversations",
    ),
);

/** A conversation's latest page of messages, with its player. */
export type AdminThread = SupportMessagePage & {
  player: { id: string; fullName: string };
  adminReadAt: string | null;
};

export const getAdminThread = cache(
  (id: string): Promise<AdminThread> =>
    serverApiRequest<AdminThread>(
      `/admin/support/conversations/${encodeURIComponent(id)}/messages`,
    ),
);

/** The page before a message, for « Messages précédents ». */
export function getAdminOlder(input: {
  id: string;
  before: string;
}): Promise<SupportMessagePage> {
  return serverApiRequest<SupportMessagePage>(
    `/admin/support/conversations/${encodeURIComponent(input.id)}/messages/before/${encodeURIComponent(input.before)}`,
  );
}
