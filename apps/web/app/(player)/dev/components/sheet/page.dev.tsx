import type { Metadata } from "next";
import { PlayerBand } from "@/components/scoreboard/shell/player-band";
import { assertDevOnly, devOnlyMetadata } from "../../dev-only";
import { SheetDemoContent } from "./sheet-demo-content";

export const metadata: Metadata = {
  title: "Feuille — vitrine",
  ...devOnlyMetadata,
};

/** La même feuille chargée directement : la page complète, sans voile. */
export default function SheetDemoPage() {
  assertDevOnly();
  return (
    <>
      <PlayerBand />
      <div className="px-4 pt-4 lg:px-6">
        <SheetDemoContent />
      </div>
    </>
  );
}
