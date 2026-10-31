import { TicketSheet } from "@/components/scoreboard/ticket/ticket-sheet";

/**
 * The same sheet on a link or a reload: no interception then, the slot
 * renders it over Matchs (`ticket/page.tsx`).
 */
export default function TicketSheetPage() {
  return <TicketSheet />;
}
