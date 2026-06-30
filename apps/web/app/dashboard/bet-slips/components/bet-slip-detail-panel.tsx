"use client";

import { X, Plus, Layers } from "lucide-react";
import { Badge, cn } from "@evcore/ui";
import {
  formatMarketForDisplay,
  formatPickForDisplay,
} from "@/helpers/fixture";
import { formatDateLong } from "@/lib/date";
import { useCurrencyFormat } from "@/providers/currency-provider";
import { CanalBadge } from "@/components/canal-badge";
import type {
  BetSlipView,
  BetSlipItemView,
} from "@/domains/bet-slip/types/bet-slip";

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}

function totalOdds(data: BetSlipView) {
  return data.items.reduce((product, item) => {
    const odds = Number(item.odds ?? 1);
    return Number.isFinite(odds) && odds > 0 ? product * odds : product;
  }, 1);
}

type ItemStatus = "WON" | "LOST" | "PENDING" | "VOID";

const STATUS_PILL: Record<ItemStatus, string> = {
  WON: "bg-success/12 text-success",
  LOST: "bg-destructive/10 text-destructive",
  PENDING: "bg-warning/12 text-warning",
  VOID: "bg-secondary text-muted-foreground",
};

const STATUS_LABEL: Record<ItemStatus, string> = {
  WON: "Gagné",
  LOST: "Perdu",
  PENDING: "En attente",
  VOID: "Annulé",
};

function ResultPill({ status }: { status: ItemStatus }) {
  return (
    <span
      className={cn(
        "rounded-md px-1.5 py-0.5 text-[0.58rem] font-bold uppercase tracking-wide",
        STATUS_PILL[status],
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

function PnlDisplay({
  item,
  slipType,
}: {
  item: BetSlipItemView;
  slipType: BetSlipView["type"];
}) {
  const { formatAmount, formatSigned } = useCurrencyFormat();
  if (slipType === "COMBO") return null;
  if (item.pnl !== null) {
    const raw = Number(item.pnl);
    const isPos = raw >= 0;
    return (
      <p
        className={cn(
          "text-sm font-bold tabular-nums",
          isPos ? "text-success" : "text-danger",
        )}
      >
        {formatSigned(raw)}
      </p>
    );
  }
  if (item.betStatus === "VOID") return null;
  if (item.odds !== null) {
    const potential = Number(item.stake) * (Number(item.odds) - 1);
    return (
      <p className="text-xs tabular-nums text-muted-foreground">
        +{formatAmount(potential)} pot.
      </p>
    );
  }
  return null;
}

// ─── Grouping : un match = une carte, ses picks = des branches ───────────────

type SlipMatchGroup = {
  fixtureId: string;
  fixture: string;
  homeScore: number | null;
  awayScore: number | null;
  items: BetSlipItemView[];
};

function groupItemsByFixture(items: BetSlipItemView[]): SlipMatchGroup[] {
  const map = new Map<string, SlipMatchGroup>();
  const order: string[] = [];
  for (const item of items) {
    let group = map.get(item.fixtureId);
    if (!group) {
      group = {
        fixtureId: item.fixtureId,
        fixture: item.fixture,
        homeScore: item.homeScore,
        awayScore: item.awayScore,
        items: [],
      };
      map.set(item.fixtureId, group);
      order.push(item.fixtureId);
    }
    group.items.push(item);
  }
  return order.map((id) => map.get(id)!);
}

function ComboLeg({ pick, market }: { pick: string; market: string }) {
  return (
    <div>
      <div className="flex items-center gap-1.5">
        <Plus
          size={12}
          strokeWidth={3}
          className="-ml-[1px] shrink-0 rounded-full bg-accent/12 text-accent"
        />
        <span className="text-[0.8rem] font-bold text-foreground">{pick}</span>
      </div>
      <p className="ml-[1.3rem] text-[0.62rem] text-muted-foreground">
        {market}
      </p>
    </div>
  );
}

function PickContent({ item }: { item: BetSlipItemView }) {
  const hasCombo = Boolean(item.comboMarket && item.comboPick);

  if (hasCombo) {
    return (
      <div>
        <span className="flex items-center gap-1 text-[0.7rem] font-extrabold italic uppercase tracking-tight text-accent">
          <Layers size={12} strokeWidth={2.5} />
          Mycombi
        </span>
        <div className="relative mt-1 space-y-1 pl-1">
          <span className="absolute bottom-2.5 left-[5px] top-2.5 w-px bg-border" />
          <ComboLeg
            pick={formatPickForDisplay(item.pick, item.market)}
            market={formatMarketForDisplay(item.market)}
          />
          <ComboLeg
            pick={formatPickForDisplay(item.comboPick!, item.comboMarket!)}
            market={formatMarketForDisplay(item.comboMarket!)}
          />
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-sm font-bold text-foreground">
          {formatPickForDisplay(item.pick, item.market)}
        </span>
        <CanalBadge canal={item.canal} />
      </div>
      <p className="mt-0.5 text-[0.66rem] text-muted-foreground">
        {formatMarketForDisplay(item.market)}
      </p>
    </div>
  );
}

function LegConnector({ isLast }: { isLast: boolean }) {
  return (
    <div className="relative w-4 shrink-0" aria-hidden>
      <span className="absolute left-1 top-0 h-[1.05rem] w-2.5 rounded-bl-[0.5rem] border-b border-l border-border/60" />
      {!isLast && (
        <span className="absolute bottom-0 left-1 top-[1.05rem] w-px bg-border/60" />
      )}
    </div>
  );
}

function SlipLeg({
  item,
  slipType,
  connector,
  isLast,
}: {
  item: BetSlipItemView;
  slipType: BetSlipView["type"];
  connector: boolean;
  isLast: boolean;
}) {
  const { formatAmount } = useCurrencyFormat();
  const status = item.betStatus as ItemStatus;

  return (
    <div className="flex">
      {connector && <LegConnector isLast={isLast} />}
      <div className="min-w-0 flex-1 py-1.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <PickContent item={item} />
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            {item.odds && (
              <span className="text-sm font-bold italic tabular-nums text-foreground">
                {item.odds}
              </span>
            )}
            <PnlDisplay item={item} slipType={slipType} />
            <ResultPill status={status} />
          </div>
        </div>

        {/* Méta : EV + mise */}
        <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[0.62rem] text-muted-foreground">
          <span>
            EV{" "}
            <span className="font-semibold text-success">
              {item.ev.startsWith("+") ? item.ev : `+${item.ev}`}
            </span>
          </span>
          {slipType === "COMBO" ? (
            <span>Leg combiné</span>
          ) : (
            <span>
              Mise{" "}
              <span className="font-semibold text-foreground">
                {formatAmount(item.stake)}
              </span>
            </span>
          )}
          {slipType === "SIMPLE" && item.stakeOverride ? (
            <Badge variant="warning" className="py-0 text-[0.6rem]">
              Perso {formatAmount(item.stakeOverride)}
            </Badge>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function SlipMatchCard({
  group,
  slipType,
}: {
  group: SlipMatchGroup;
  slipType: BetSlipView["type"];
}) {
  const multi = group.items.length > 1;

  return (
    <div className="overflow-hidden rounded-2xl border border-border/60 bg-background shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      {/* Match header */}
      <div className="flex items-center justify-between gap-2 border-b border-border/40 bg-secondary/25 px-3.5 py-2">
        <p className="min-w-0 truncate text-[0.72rem] font-semibold text-foreground">
          {group.fixture}
        </p>
        {group.homeScore !== null && group.awayScore !== null ? (
          <span className="shrink-0 rounded-md bg-secondary px-2 py-0.5 text-[0.7rem] font-bold tabular-nums text-secondary-foreground">
            {group.homeScore} – {group.awayScore}
          </span>
        ) : null}
      </div>

      {/* Picks du match */}
      <div className="px-3.5 py-1.5">
        {group.items.map((item, idx) => (
          <SlipLeg
            key={item.betId}
            item={item}
            slipType={slipType}
            connector={multi}
            isLast={idx === group.items.length - 1}
          />
        ))}
      </div>
    </div>
  );
}

export function BetSlipDetailPanel({
  data,
  onClose,
}: {
  data: BetSlipView;
  onClose: () => void;
}) {
  const { formatAmount, formatSigned } = useCurrencyFormat();
  const totalStake =
    data.type === "COMBO"
      ? Number(data.unitStake)
      : data.items.reduce((sum, item) => sum + Number(item.stake), 0);
  const settledItems = data.items.filter(
    (i) => i.betStatus === "WON" || i.betStatus === "LOST",
  );
  const pendingCount =
    data.type === "COMBO"
      ? data.items.some((i) => i.betStatus === "PENDING")
        ? 1
        : 0
      : data.items.length - settledItems.length;
  const comboAllWon = data.items.every((i) => i.betStatus === "WON");
  const comboTotalOdds = totalOdds(data);
  const pendingSelections = data.items.filter(
    (i) => i.betStatus === "PENDING",
  ).length;
  const realPnl =
    data.type === "COMBO"
      ? pendingCount === 0
        ? comboAllWon
          ? totalStake * comboTotalOdds - totalStake
          : -totalStake
        : 0
      : settledItems.reduce((sum, item) => {
          if (item.pnl === null) return sum;
          return sum + Number(item.pnl);
        }, 0);
  const retourTotal =
    data.type === "COMBO"
      ? pendingCount === 0 && comboAllWon
        ? totalStake * comboTotalOdds
        : 0
      : settledItems
          .filter((i) => i.betStatus === "WON" && i.pnl !== null)
          .reduce((sum, i) => sum + Number(i.stake) + Number(i.pnl), 0);
  const hasPnl =
    data.type === "COMBO" ? pendingCount === 0 : settledItems.length > 0;
  const status =
    pendingCount > 0 ? "En attente" : realPnl >= 0 ? "Gagné" : "Perdu";
  const statusTone =
    pendingCount > 0 ? "warning" : realPnl >= 0 ? "success" : "danger";
  const potentialReturn =
    data.type === "COMBO"
      ? totalStake * comboTotalOdds
      : data.items.reduce((sum, item) => {
          const odds = Number(item.odds ?? 0);
          return Number.isFinite(odds) ? sum + Number(item.stake) * odds : sum;
        }, 0);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[1.35rem] border border-border bg-panel-strong ev-shell-shadow">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Coupon
          </p>
          <p className="text-base font-semibold text-foreground">
            #{data.id.slice(0, 8)}
          </p>
          <p className="text-xs font-semibold text-foreground">
            {data.type === "COMBO" ? "Combiné" : "Simples"}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatDateLong(data.createdAt)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={statusTone === "danger" ? "destructive" : statusTone}>
            {status}
          </Badge>
          <Badge variant="accent">
            {data.itemCount} sélection{data.itemCount > 1 ? "s" : ""}
          </Badge>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-panel text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {/* Summary */}
        <div className="flex flex-col gap-2.5 border-b border-border px-4 py-4">
          <DetailRow label="Utilisateur" value={`@${data.username}`} />
          {data.type === "COMBO" && (
            <DetailRow label="Cote totale" value={comboTotalOdds.toFixed(2)} />
          )}
          <DetailRow label="Total misé" value={formatAmount(totalStake)} />
          {hasPnl && (
            <>
              <div
                className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm font-semibold ${
                  realPnl >= 0
                    ? "bg-success/12 text-success"
                    : "bg-destructive/10 text-destructive"
                }`}
              >
                <span>
                  {pendingCount > 0 ? "Gain net partiel" : "Gain net"}
                </span>
                <span className="tabular-nums">{formatSigned(realPnl)}</span>
              </div>
              {retourTotal > 0 && (
                <DetailRow
                  label="Retour total"
                  value={formatAmount(retourTotal)}
                />
              )}
            </>
          )}
          {pendingCount > 0 && (
            <>
              <DetailRow
                label="Gain potentiel"
                value={formatAmount(potentialReturn)}
              />
              <p className="text-xs text-muted-foreground">
                {pendingSelections} sélection
                {pendingSelections > 1 ? "s" : ""} en attente de résultat
              </p>
            </>
          )}
        </div>

        {/* Items groupés par match */}
        <div className="flex flex-col gap-2.5 p-4">
          {groupItemsByFixture(data.items).map((group) => (
            <SlipMatchCard
              key={group.fixtureId}
              group={group}
              slipType={data.type}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
