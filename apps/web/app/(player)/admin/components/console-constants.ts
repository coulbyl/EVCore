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
