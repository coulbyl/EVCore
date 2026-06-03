import { Tabs, TabsList, TabsTrigger, TabsContent } from "@evcore/ui";
import type {
  CoreInvestmentCanal,
  InvestmentPickDto,
} from "@/domains/ai-engine/types/investment";
import { CANAL_ORDER, CANAL_LABEL } from "./canal-constants";
import { CanalSection } from "./canal-section";

export function StrategyTabs({
  selections,
  locale,
}: {
  selections: Record<CoreInvestmentCanal, InvestmentPickDto[]>;
  locale: string;
}) {
  const activeCanals = CANAL_ORDER.filter(
    (c) => (selections[c]?.length ?? 0) > 0,
  );

  if (activeCanals.length === 0) return null;

  const defaultTab = activeCanals[0]!;

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-base font-semibold">Par stratégie</h2>

      <Tabs key={activeCanals.join(",")} defaultValue={defaultTab}>
        <div className="overflow-x-auto">
          <TabsList variant="line">
            {activeCanals.map((canal) => (
              <TabsTrigger key={canal} value={canal}>
                {CANAL_LABEL[canal]}
                <span className="ml-1 tabular-nums text-[0.65rem] opacity-60">
                  {selections[canal]!.length}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {activeCanals.map((canal) => (
          <TabsContent key={canal} value={canal} className="mt-4">
            <CanalSection
              canal={canal}
              picks={selections[canal]!}
              locale={locale}
            />
          </TabsContent>
        ))}
      </Tabs>
    </section>
  );
}
