// "use client";

// import { Check, ShoppingCart } from "lucide-react";
// import { useBetSlip } from "@/domains/bet-slip/context/bet-slip-context";
// import {
//   draftItemKey,
//   type BetSlipDraftItem,
// } from "@/domains/bet-slip/types/bet-slip";
// import type { FixtureRow } from "@/domains/fixture/types/fixture";
// import { isFixtureBettable } from "@/domains/fixture/helpers/fixture";

// type Canal = "VALUE" | "SAFE" | "DOMINANT" | "DRAW" | "BTTS";

// const CANAL_COLOR: Record<Canal, string> = {
//   EV: "var(--canal-ev)",
//   SV: "var(--canal-sv)",
//   CONF: "var(--canal-conf)",
//   DRAW: "var(--canal-draw)",
//   BTTS: "var(--canal-btts)",
// };

// export function AddToSlipInline({
//   row,
//   canal,
// }: {
//   row: FixtureRow;
//   canal: Canal;
// }) {
//   const { draft, addItem, removeItem, isInSlip, open } = useBetSlip();

//   if (canal === "VALUE") {
//     const mr = row.modelRun;
//     if (
//       !mr ||
//       !mr.betId ||
//       !mr.market ||
//       !mr.pick ||
//       mr.betStatus !== "PENDING" ||
//       !isFixtureBettable(row)
//     ) {
//       return null;
//     }

//     const betId = mr.betId;
//     const market = mr.market;
//     const pick = mr.pick;
//     const ev = mr.ev;
//     const comboMarket = mr.comboMarket;
//     const comboPick = mr.comboPick;
//     const inSlip = isInSlip(betId);
//     const odds =
//       mr.evaluatedPicks.find(
//         (p) =>
//           p.market === market &&
//           p.pick === pick &&
//           (p.comboMarket ?? null) === (comboMarket ?? null) &&
//           (p.comboPick ?? null) === (comboPick ?? null),
//       )?.odds ?? null;

//     function handleClick(e: React.MouseEvent) {
//       e.stopPropagation();
//       if (inSlip) {
//         removeItem(betId);
//         return;
//       }
//       const item: BetSlipDraftItem = {
//         betId,
//         fixtureId: row.fixtureId,
//         fixture: row.fixture,
//         homeLogo: row.homeLogo,
//         awayLogo: row.awayLogo,
//         competition: row.competition,
//         scheduledAt: row.scheduledAt,
//         market,
//         pick,
//         comboMarket: comboMarket ?? undefined,
//         comboPick: comboPick ?? undefined,
//         odds,
//         ev,
//         stakeOverride: null,
//       };
//       addItem(item);
//       if (draft.items.length === 0) open();
//     }

//     return <SlipButton inSlip={inSlip} onClick={handleClick} canal="VALUE" />;
//   }

//   // SV canal
//   const sv = row.safeValueBet;
//   if (!sv || sv.betStatus !== "PENDING" || !isFixtureBettable(row)) {
//     return null;
//   }

//   const inSlip = isInSlip(sv.betId);

//   function handleSvClick(e: React.MouseEvent) {
//     e.stopPropagation();
//     if (inSlip) {
//       removeItem(sv!.betId);
//       return;
//     }
//     const item: BetSlipDraftItem = {
//       betId: sv!.betId,
//       fixtureId: row.fixtureId,
//       fixture: row.fixture,
//       homeLogo: row.homeLogo,
//       awayLogo: row.awayLogo,
//       competition: row.competition,
//       scheduledAt: row.scheduledAt,
//       market: sv!.market,
//       pick: sv!.pick,
//       comboMarket: sv!.comboMarket ?? undefined,
//       comboPick: sv!.comboPick ?? undefined,
//       odds: sv!.odds,
//       ev: sv!.ev,
//       stakeOverride: null,
//     };
//     addItem(item);
//     if (draft.items.length === 0) open();
//   }

//   return <SlipButton inSlip={inSlip} onClick={handleSvClick} canal="SAFE" />;
// }

// // ── CONF / DRAW / BTTS ────────────────────────────────────────────────────────

// export function AddPredictionToSlipInline({
//   row,
//   canal,
// }: {
//   row: FixtureRow;
//   canal: "DOMINANT" | "DRAW" | "BTTS";
// }) {
//   const { draft, addItem, removeItem, isInSlip, open } = useBetSlip();
//   const modelRunId = row.modelRun?.modelRunId;

//   const prediction =
//     canal === "DRAW"
//       ? row.drawPrediction
//       : canal === "BTTS"
//         ? row.bttsPrediction
//         : row.prediction;

//   if (
//     !prediction ||
//     !modelRunId ||
//     prediction.correct !== null ||
//     !isFixtureBettable(row)
//   ) {
//     return null;
//   }

//   const key = draftItemKey({
//     fixtureId: row.fixtureId,
//     market: prediction.market,
//     pick: prediction.pick,
//   });
//   const inSlip = isInSlip(key);

//   function handleClick(e: React.MouseEvent) {
//     e.stopPropagation();
//     if (inSlip) {
//       removeItem(key);
//       return;
//     }
//     const item: BetSlipDraftItem = {
//       modelRunId,
//       fixtureId: row.fixtureId,
//       fixture: row.fixture,
//       homeLogo: row.homeLogo,
//       awayLogo: row.awayLogo,
//       competition: row.competition,
//       scheduledAt: row.scheduledAt,
//       market: prediction!.market,
//       pick: prediction!.pick,
//       odds: prediction!.odds,
//       ev: null,
//       stakeOverride: null,
//     };
//     addItem(item);
//     if (draft.items.length === 0) open();
//   }

//   return <SlipButton inSlip={inSlip} onClick={handleClick} canal={canal} />;
// }

// function SlipButton({
//   inSlip,
//   onClick,
//   canal,
// }: {
//   inSlip: boolean;
//   onClick: (e: React.MouseEvent) => void;
//   canal: Canal;
// }) {
//   const canalColor = CANAL_COLOR[canal];
//   return (
//     <button
//       type="button"
//       onClick={onClick}
//       title={inSlip ? "Retirer du coupon" : "Ajouter au coupon"}
//       className={`ml-auto flex size-7 shrink-0 items-center justify-center rounded-lg border transition-colors ${
//         inSlip
//           ? "border-success/20 bg-success/12 text-success"
//           : "border-border bg-secondary text-muted-foreground hover:text-foreground"
//       }`}
//       style={
//         !inSlip ? ({ "--hover-color": canalColor } as React.CSSProperties) : {}
//       }
//     >
//       {inSlip ? <Check size={12} /> : <ShoppingCart size={12} />}
//     </button>
//   );
// }
