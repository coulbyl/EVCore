import { Sheet } from "@/components/scoreboard/sheet/sheet";
import { assertDevOnly } from "../../../../dev/dev-only";
import { SheetDemoContent } from "../../../../dev/components/sheet/sheet-demo-content";

/** La feuille de la vitrine, ouverte par une navigation interceptée. */
export default function SheetDemo() {
  assertDevOnly();
  return (
    <Sheet
      title="Favori du jour"
      fallbackHref="/dev/components"
      tone="band"
      bandContent={
        <p className="score text-figure font-bold">8 sur 10 · 1,28</p>
      }
      footer={
        <button
          type="button"
          className="h-12 w-full rounded-[0.625rem] bg-primary text-bet font-medium text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          Suivre
        </button>
      }
    >
      <SheetDemoContent />
    </Sheet>
  );
}
