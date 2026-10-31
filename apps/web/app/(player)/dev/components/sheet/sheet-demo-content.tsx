import { ChanceFigure } from "@/components/scoreboard/ui/chance-figure";
import { FormStrip } from "@/components/scoreboard/ui/form-strip";
import { Row, RowList } from "@/components/scoreboard/ui/row-list";

/** Un contenu de feuille assez long pour défiler (vitrine et tests). */
export function SheetDemoContent() {
  return (
    <div className="flex flex-col gap-4">
      <ChanceFigure probability={0.8} size="lg" />
      <FormStrip
        outcomes={[
          "won",
          "won",
          "lost",
          "won",
          "won",
          "won",
          "won",
          "won",
          "void",
          "won",
          "won",
          "won",
        ]}
        label="9 jours gagnés sur 11, 1 perdu, 1 remboursé"
      />
      <RowList label="Contenu long">
        {Array.from({ length: 24 }, (_, index) => (
          <Row
            key={index}
            title={`Ligne ${index + 1} de la feuille`}
            meta="Pour éprouver le défilement"
            value="1,28"
          />
        ))}
      </RowList>
      <p id="sheet-end" className="text-body text-muted-foreground">
        Fin de la feuille
      </p>
    </div>
  );
}
