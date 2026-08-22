import { FixtureCard } from "@/components/fixture-card";
import { NewCoachChip } from "@/components/new-coach-badge";
import type { InvestmentView } from "@/domains/investment/types/investment";
import type { InvestmentFixtureGroup } from "./investment-constants";
import { InvestmentPickRow } from "./investment-pick-row";

export function InvestmentFixtureCard({
  group,
  view,
  locale,
}: {
  group: InvestmentFixtureGroup;
  view: InvestmentView;
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
      status={group.fixtureStatus}
      locale={locale}
      homeBadge={
        group.homeNewCoach ? <NewCoachChip locale={locale} /> : undefined
      }
      awayBadge={
        group.awayNewCoach ? <NewCoachChip locale={locale} /> : undefined
      }
    >
      {group.picks.map((pick, idx) => (
        <InvestmentPickRow
          key={`${pick.fixtureId}:${pick.channel}`}
          pick={pick}
          view={view}
          locale={locale}
          connector={{
            show: group.picks.length > 1,
            isLast: idx === group.picks.length - 1,
          }}
        />
      ))}
    </FixtureCard>
  );
}
