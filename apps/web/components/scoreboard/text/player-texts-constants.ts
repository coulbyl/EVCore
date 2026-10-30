/**
 * The message namespaces the player's client components read
 * (PlayerTextsProvider). Everything else is translated on the server.
 */
export const PLAYER_CLIENT_NAMESPACES = ["shell", "scoreboard.states"] as const;

export type PlayerClientNamespace = (typeof PLAYER_CLIENT_NAMESPACES)[number];

/** Messages of a namespace, nested as in messages/*.json. */
export type PlayerMessages = { [key: string]: string | PlayerMessages };

export type PlayerTexts = Record<PlayerClientNamespace, PlayerMessages>;

/** « Hors ligne · vu à {time} »: simple placeholders only, no ICU syntax. */
export function formatPlayerText(
  messages: PlayerMessages,
  key: string,
  values?: Record<string, string>,
): string {
  const message = key
    .split(".")
    .reduce<
      string | PlayerMessages | undefined
    >((node, part) => (typeof node === "object" ? node[part] : undefined), messages);
  if (typeof message !== "string") return key;
  return message.replace(/\{(\w+)\}/g, (placeholder, name: string) =>
    values && name in values ? (values[name] as string) : placeholder,
  );
}

/** The player's namespaces picked out of all the messages (server side). */
export function pickPlayerTexts(all: Record<string, unknown>): PlayerTexts {
  const at = (path: string): PlayerMessages => {
    const node = path
      .split(".")
      .reduce<unknown>(
        (acc, part) =>
          acc && typeof acc === "object"
            ? (acc as Record<string, unknown>)[part]
            : undefined,
        all,
      );
    return node && typeof node === "object" ? (node as PlayerMessages) : {};
  };
  return {
    shell: at("shell"),
    "scoreboard.states": at("scoreboard.states"),
  };
}
