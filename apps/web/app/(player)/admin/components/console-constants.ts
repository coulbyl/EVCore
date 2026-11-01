import type { LightState, TodoItem } from "@/domains/console/types/console";

/** The diode of a light: the one colour of its state. */
export const LIGHT_DOT: Record<LightState, string> = {
  green: "bg-win",
  orange: "bg-warning",
  red: "bg-loss",
};

/** Where a line of « À faire » leads: where one acts on it. */
export function todoHref(item: TodoItem): string {
  switch (item.kind) {
    case "product_absent":
    case "market_suspended":
    case "channel_alert":
      return "/admin/engine";
    case "players_silent":
      return "/admin/players";
    case "support_unanswered":
      return "/admin/messages";
    default:
      return "/admin#passes";
  }
}

/** The kinds whose figure is « hours since », null meaning « never ». */
export function neverKey(item: TodoItem): string {
  return "hours" in item && item.hours === null
    ? `${item.kind}Never`
    : item.kind;
}

/**
 * « coupons 2026-10-25 → 2026-11-01 », as the journal stores a settlement
 * replay, said « {kind} du 25/10 au 01/11 »; null for any other target.
 */
export function settleTargetOf(
  target: string,
): { kind: "coupons" | "selections"; from: string; to: string } | null {
  const match =
    /^(coupons|selections) (\d{4})-(\d{2})-(\d{2}) → (\d{4})-(\d{2})-(\d{2})$/.exec(
      target,
    );
  if (!match) return null;
  const [, kind, , fm, fd, , tm, td] = match;
  return {
    kind: kind as "coupons" | "selections",
    from: `${fd}/${fm}`,
    to: `${td}/${tm}`,
  };
}
