"use client";

import { Check, ShoppingCart } from "lucide-react";
import { useBetSlip } from "@/domains/bet-slip/context/bet-slip-context";
import type { BetSlipDraftItem } from "@/domains/bet-slip/types/bet-slip";
import type { FixtureRow } from "@/domains/fixture/types/fixture";

type Canal = "EV" | "SV";

export function AddToSlipInline({
  row,
  canal,
}: {
  row: FixtureRow;
  canal: Canal;
}) {
  const { draft, addItem, removeItem, isInSlip, open } = useBetSlip();

  if (canal === "EV") {
    const mr = row.modelRun;
    if (
      !mr ||
      mr.decision !== "BET" ||
      !mr.betId ||
      !mr.market ||
      !mr.pick ||
      mr.betStatus !== "PENDING" ||
      row.status === "FINISHED"
    ) {
      return null;
    }

    const betId = mr.betId;
    const market = mr.market;
    const pick = mr.pick;
    const ev = mr.ev;
    const comboMarket = mr.comboMarket;
    const comboPick = mr.comboPick;
    const inSlip = isInSlip(betId);
    const odds =
      mr.evaluatedPicks.find(
        (p) =>
          p.market === market &&
          p.pick === pick &&
          (p.comboMarket ?? null) === (comboMarket ?? null) &&
          (p.comboPick ?? null) === (comboPick ?? null),
      )?.odds ?? null;

    function handleClick(e: React.MouseEvent) {
      e.stopPropagation();
      if (inSlip) {
        removeItem(betId);
        return;
      }
      const item: BetSlipDraftItem = {
        betId,
        fixtureId: row.fixtureId,
        fixture: row.fixture,
        homeLogo: row.homeLogo,
        awayLogo: row.awayLogo,
        competition: row.competition,
        scheduledAt: row.scheduledAt,
        market,
        pick,
        comboMarket: comboMarket ?? undefined,
        comboPick: comboPick ?? undefined,
        odds,
        ev,
        stakeOverride: null,
      };
      addItem(item);
      if (draft.items.length === 0) open();
    }

    return (
      <SlipButton inSlip={inSlip} onClick={handleClick} canal="EV" />
    );
  }

  // SV canal
  const sv = row.safeValueBet;
  if (!sv || sv.betStatus !== "PENDING" || row.status === "FINISHED") {
    return null;
  }

  const inSlip = isInSlip(sv.betId);

  function handleSvClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (inSlip) {
      removeItem(sv!.betId);
      return;
    }
    const item: BetSlipDraftItem = {
      betId: sv!.betId,
      fixtureId: row.fixtureId,
      fixture: row.fixture,
      homeLogo: row.homeLogo,
      awayLogo: row.awayLogo,
      competition: row.competition,
      scheduledAt: row.scheduledAt,
      market: sv!.market,
      pick: sv!.pick,
      comboMarket: sv!.comboMarket ?? undefined,
      comboPick: sv!.comboPick ?? undefined,
      odds: sv!.odds,
      ev: sv!.ev,
      stakeOverride: null,
    };
    addItem(item);
    if (draft.items.length === 0) open();
  }

  return <SlipButton inSlip={inSlip} onClick={handleSvClick} canal="SV" />;
}

function SlipButton({
  inSlip,
  onClick,
  canal,
}: {
  inSlip: boolean;
  onClick: (e: React.MouseEvent) => void;
  canal: Canal;
}) {
  const canalColor = canal === "EV" ? "var(--canal-ev)" : "var(--canal-sv)";
  return (
    <button
      type="button"
      onClick={onClick}
      title={inSlip ? "Retirer du coupon" : "Ajouter au coupon"}
      className={`ml-auto flex size-7 shrink-0 items-center justify-center rounded-lg border transition-colors ${
        inSlip
          ? "border-success/20 bg-success/12 text-success"
          : "border-border bg-secondary text-muted-foreground hover:text-foreground"
      }`}
      style={
        !inSlip ? { "--hover-color": canalColor } as React.CSSProperties : {}
      }
    >
      {inSlip ? <Check size={12} /> : <ShoppingCart size={12} />}
    </button>
  );
}
