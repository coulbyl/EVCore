import { FixtureCard } from "@/components/fixture-card";
import type { InvestmentFixtureGroup } from "./investment-constants";
import { InvestmentPickRow } from "./investment-pick-row";

export function InvestmentFixtureCard({
  group,
  locale,
}: {
  group: InvestmentFixtureGroup;
  locale: string;
}) {
  return (
    <FixtureCard
      fixture={group.fixture}
      homeLogo={group.homeLogo}
      awayLogo={group.awayLogo}
      competition={group.competition}
      country={group.country}
      kickoff={group.kickoff}
      score={group.score}
      htScore={group.htScore}
      locale={locale}
    >
      {group.picks.map((pick, idx) => (
        <InvestmentPickRow
          key={`${pick.fixtureId}:${pick.channel}`}
          pick={pick}
          locale={locale}
          connector={group.picks.length > 1}
          isLast={idx === group.picks.length - 1}
        />
      ))}
    </FixtureCard>
  );
}
