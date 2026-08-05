import { useTranslations } from "next-intl";
import { Badge } from "@evcore/ui";
import { FixtureName } from "@/components/fixture-name";
import { Amount } from "@/components/amount";
import { formatDateTime } from "@/lib/date";
import { translateCountry } from "@/lib/competition-i18n";
import {
  formatMarketForDisplay,
  formatPickForDisplay,
} from "@/helpers/fixture";
import type { SubscriptionEvent } from "@/domains/subscriptions/types/subscriptions";

// Logos + pays affichés à côté de chaque match — aide à retrouver
// rapidement l'événement chez un bookmaker.
export function SubscriptionEventRow({
  event,
  locale,
}: {
  event: SubscriptionEvent;
  locale: string;
}) {
  const t = useTranslations("subscriptions");
  const loc = locale === "en" ? "en" : "fr";

  return (
    <div className="flex items-start justify-between gap-3 rounded-md border border-border px-3 py-2.5 text-sm">
      <div className="min-w-0 flex-1">
        {event.fixture && event.market && event.pick ? (
          <>
            <FixtureName
              fixture={`${event.fixture.homeTeam} vs ${event.fixture.awayTeam}`}
              homeLogo={event.fixture.homeLogo}
              awayLogo={event.fixture.awayLogo}
              className="text-sm font-medium text-foreground"
              stacked
              wrap
            />
            <p className="mt-0.5 text-xs text-muted-foreground">
              {formatPickForDisplay(event.pick, event.market)} ·{" "}
              {formatMarketForDisplay(event.market, loc)} ·{" "}
              {translateCountry(event.fixture.country, loc)}
            </p>
          </>
        ) : event.legs.length > 0 ? (
          <>
            <p className="text-foreground">
              {t("detail.couponLabel", { value: event.combinedOdds ?? "" })}
            </p>
            <div className="mt-1.5 flex flex-col gap-1.5">
              {event.legs.map((leg, i) => (
                <div key={i} className="min-w-0">
                  <FixtureName
                    fixture={`${leg.homeTeam} vs ${leg.awayTeam}`}
                    homeLogo={leg.homeLogo}
                    awayLogo={leg.awayLogo}
                    className="text-xs font-medium text-foreground"
                    stacked
                    wrap
                  />
                  <p className="text-[0.7rem] text-muted-foreground">
                    {formatPickForDisplay(leg.pick, leg.market)} ·{" "}
                    {formatMarketForDisplay(leg.market, loc)} ·{" "}
                    {translateCountry(leg.country, loc)}
                  </p>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="text-foreground">{t("detail.genericEvent")}</p>
        )}
        <p className="mt-1.5 text-xs text-muted-foreground">
          {event.kickoff ? formatDateTime(event.kickoff) : event.date}
          {event.odds ? (
            <>
              {" · "}
              <span className="text-sm font-semibold text-foreground">
                {t("detail.odds", { value: Number(event.odds).toFixed(2) })}
              </span>
            </>
          ) : null}
        </p>
      </div>
      <div className="shrink-0 text-right">
        {event.result ? (
          <>
            <Badge variant={event.result === "WON" ? "default" : "secondary"}>
              {t(`detail.results.${event.result}`)}
            </Badge>
            <p
              className={`mt-1 text-xs font-medium ${
                Number(event.pnl ?? 0) >= 0
                  ? "text-success"
                  : "text-destructive"
              }`}
            >
              <Amount value={event.pnl ?? "0"} signed />
            </p>
          </>
        ) : (
          <Badge variant="outline">{t("detail.pending")}</Badge>
        )}
      </div>
    </div>
  );
}
