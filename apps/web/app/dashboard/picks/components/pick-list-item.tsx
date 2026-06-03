"use client";

import { useLocale, useTranslations } from "next-intl";
import type { FixtureRow } from "@/domains/fixture/types/fixture";
import {
  formatMarketForDisplay,
  formatCombinedPickForDisplay,
} from "@/helpers/fixture";
import { PickCard } from "@/components/pick-card";
import {
  AddToSlipInline,
  AddPredictionToSlipInline,
} from "./add-to-slip-inline";
import { CONF_PICK_LABEL } from "./pick-constants";

type Canal = "EV" | "SV" | "CONF" | "DRAW" | "BTTS";

const CANAL_COLOR: Record<Canal, string> = {
  EV: "var(--canal-ev)",
  SV: "var(--canal-sv)",
  CONF: "var(--canal-conf)",
  DRAW: "var(--canal-draw)",
  BTTS: "var(--canal-btts)",
};

export function PickListItem({
  row,
  canal,
  active,
  onSelect,
}: {
  row: FixtureRow;
  canal: Canal;
  active: boolean;
  onSelect: () => void;
}) {
  const t = useTranslations("picks");
  const locale = useLocale();
  const mr = row.modelRun;
  const sv = row.safeValueBet;
  const prediction =
    canal === "DRAW"
      ? row.drawPrediction
      : canal === "BTTS"
        ? row.bttsPrediction
        : row.prediction;

  // ── marketLabel ────────────────────────────────────────────────────────────
  const loc = locale === "en" ? "en" : "fr";
  const marketLabel =
    canal === "EV" && mr?.market
      ? formatMarketForDisplay(mr.market, loc)
      : canal === "SV" && sv
        ? formatMarketForDisplay(sv.market, loc)
        : prediction?.market
          ? formatMarketForDisplay(prediction.market, loc)
          : "–";

  // ── pickLabel ──────────────────────────────────────────────────────────────
  const pickLabel =
    canal === "EV" && mr?.market && mr.pick
      ? formatCombinedPickForDisplay({
          market: mr.market,
          pick: mr.pick,
          comboMarket: mr.comboMarket ?? undefined,
          comboPick: mr.comboPick ?? undefined,
        })
      : canal === "SV" && sv
        ? formatCombinedPickForDisplay({
            market: sv.market,
            pick: sv.pick,
            comboMarket: sv.comboMarket ?? undefined,
            comboPick: sv.comboPick ?? undefined,
          })
        : prediction
          ? canal === "BTTS"
            ? prediction.pick === "YES"
              ? t("bttsYes")
              : t("bttsNo")
            : (CONF_PICK_LABEL[prediction.pick] ?? prediction.pick)
          : "–";

  // ── probabilityPct (string already includes %) ─────────────────────────────
  const probabilityPct =
    canal === "EV"
      ? (mr?.probEstimated ?? null)
      : canal === "SV"
        ? (sv?.probEstimated ?? null)
        : (prediction?.probability ?? null);

  // ── odds ───────────────────────────────────────────────────────────────────
  const odds =
    canal === "EV" && mr?.market && mr.pick
      ? (mr.evaluatedPicks.find(
          (p) =>
            p.market === mr.market &&
            p.pick === mr.pick &&
            (p.comboMarket ?? null) === (mr.comboMarket ?? null) &&
            (p.comboPick ?? null) === (mr.comboPick ?? null),
        )?.odds ?? null)
      : canal === "SV"
        ? (sv?.odds ?? null)
        : (prediction?.odds ?? null);

  // ── betStatus ──────────────────────────────────────────────────────────────
  const betStatus =
    canal === "EV"
      ? (mr?.betStatus ?? null)
      : canal === "SV"
        ? (sv?.betStatus ?? null)
        : prediction?.correct === true
          ? "WON"
          : prediction?.correct === false
            ? "LOST"
            : null;

  // ── slip action ────────────────────────────────────────────────────────────
  const actionSlot =
    canal === "EV" ? (
      <AddToSlipInline row={row} canal="EV" />
    ) : canal === "SV" ? (
      <AddToSlipInline row={row} canal="SV" />
    ) : (
      <AddPredictionToSlipInline
        row={row}
        canal={canal as "CONF" | "DRAW" | "BTTS"}
      />
    );

  return (
    <PickCard
      fixtureName={row.fixture}
      homeLogo={row.homeLogo}
      awayLogo={row.awayLogo}
      competition={row.competition}
      country={row.country}
      locale={locale}
      scheduledAt={row.scheduledAt}
      canalColor={CANAL_COLOR[canal]}
      marketLabel={marketLabel}
      pickLabel={pickLabel}
      probabilityPct={probabilityPct}
      signalScore={null}
      odds={odds}
      score={row.score}
      htScore={row.htScore}
      betStatus={betStatus as "WON" | "LOST" | "PENDING" | null}
      actionSlot={actionSlot}
      active={active}
      onSelect={onSelect}
    />
  );
}
