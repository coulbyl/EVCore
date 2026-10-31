import type { Metadata } from "next";
import { MaintenanceScreen } from "@/components/scoreboard/states/maintenance-screen";
import { assertDevOnly, devOnlyMetadata } from "../../dev-only";

export const metadata: Metadata = {
  title: "Maintenance — vitrine",
  ...devOnlyMetadata,
};

/** La page de maintenance telle que le joueur la voit quand le serveur tombe. */
export default function MaintenanceDemoPage() {
  assertDevOnly();
  return <MaintenanceScreen />;
}
