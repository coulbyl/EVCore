"use client";

import { useEffect, useState, useTransition } from "react";
import {
  X,
  ReceiptText,
  Trash2,
  AlertCircle,
  CheckCircle,
  ChevronRight,
  Plus,
  Layers,
} from "lucide-react";
import { Drawer, DrawerContent, DrawerTitle, cn } from "@evcore/ui";
import { useIsMobile } from "@/hooks/use-mobile";
import { useQueryClient } from "@tanstack/react-query";
import { useCurrentUser } from "@/domains/auth/context/current-user-context";
import { useBetSlip } from "@/domains/bet-slip/context/bet-slip-context";
import { createBetSlip } from "@/domains/bet-slip/use-cases/create-bet-slip";
import { useBankrollBalance } from "@/domains/bankroll/use-cases/get-bankroll-balance";
import {
  SLIP_LIMITS,
  draftItemKey,
  type BetSlipDraftItem,
} from "@/domains/bet-slip/types/bet-slip";
import { FixtureName } from "./fixture-name";
import {
  formatMarketForDisplay,
  formatPickForDisplay,
} from "@/helpers/fixture";
import { useCurrencyFormat } from "@/providers/currency-provider";
import { Amount } from "./amount";

// ─── Stake input ────────────────────────────────────────────────────────────

function StakeInput({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  className?: string;
}) {
  return (
    <input
      type="number"
      min={0}
      step={100}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={cn(
        "w-28 rounded-xl border border-border/70 bg-secondary/40 px-3 py-2 text-right text-sm font-bold tabular-nums text-foreground transition-colors placeholder:font-normal placeholder:text-muted-foreground/50 focus:border-accent/50 focus:bg-background focus:outline-none focus:ring-2 focus:ring-accent/20",
        className,
      )}
    />
  );
}

// ─── Canal dot ──────────────────────────────────────────────────────────────

const CANAL_COLOR: Record<string, string> = {
  VALUE: "var(--canal-value)",
  SAFE: "var(--canal-safe)",
  DOMINANT: "var(--canal-dominant)",
  BTTS: "var(--canal-btts)",
  DRAW: "var(--canal-draw)",
  GOALS: "var(--canal-goals)",
  CONSENSUS: "var(--canal-consensus)",
};

function CanalDot({ canal }: { canal?: string }) {
  if (!canal) return null;
  const color = CANAL_COLOR[canal];
  if (!color) return null;
  return (
    <span
      className="inline-block size-1.5 shrink-0 rounded-full"
      style={{
        backgroundColor: color,
        boxShadow: `0 0 0 3px color-mix(in srgb, ${color} 16%, transparent)`,
      }}
    />
  );
}

// ─── Single draft item row ───────────────────────────────────────────────────

// ─── Grouping : un match = une carte, ses picks = des branches ───────────────

type MatchGroup = {
  fixtureId: string;
  fixture: string;
  homeLogo: string | null;
  awayLogo: string | null;
  items: BetSlipDraftItem[];
};

function groupItemsByFixture(items: BetSlipDraftItem[]): MatchGroup[] {
  const map = new Map<string, MatchGroup>();
  const order: string[] = [];
  for (const item of items) {
    let group = map.get(item.fixtureId);
    if (!group) {
      group = {
        fixtureId: item.fixtureId,
        fixture: item.fixture,
        homeLogo: item.homeLogo,
        awayLogo: item.awayLogo,
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
    <div className="relative">
      <div className="flex items-center gap-1.5">
        <Plus
          size={13}
          strokeWidth={3}
          className="-ml-[1px] shrink-0 rounded-full bg-accent/12 text-accent"
        />
        <span className="text-[0.82rem] font-bold text-foreground">{pick}</span>
      </div>
      <p className="ml-[1.35rem] text-[0.64rem] text-muted-foreground">
        {market}
      </p>
    </div>
  );
}

/** Étiquette d'un pick (simple ou MYCOMBI intra-match), sans cote ni cadre. */
function PickLabel({ item }: { item: BetSlipDraftItem }) {
  const hasCombo = Boolean(item.comboMarket && item.comboPick);

  if (hasCombo) {
    return (
      <div>
        <span className="flex items-center gap-1 text-[0.72rem] font-extrabold italic uppercase tracking-tight text-accent">
          <Layers size={12} strokeWidth={2.5} />
          Mycombi
        </span>
        <div className="relative mt-1 space-y-1 pl-1">
          <span className="absolute bottom-2.5 left-[6px] top-2.5 w-px bg-border" />
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
      <div className="flex items-center gap-1.5">
        <CanalDot canal={item.canal} />
        <span className="text-sm font-bold text-foreground">
          {formatPickForDisplay(item.pick, item.market)}
        </span>
        {item.ev && (
          <span className="text-[0.6rem] font-semibold text-success">
            {item.ev}
          </span>
        )}
      </div>
      <p className="mt-0.5 text-[0.66rem] text-muted-foreground">
        {formatMarketForDisplay(item.market)}
      </p>
    </div>
  );
}

/** Connecteur ├─ / └─ arrondi à gauche d'un pick quand le match en a plusieurs. */
function LegConnector({ isLast }: { isLast: boolean }) {
  return (
    <div className="relative w-4 shrink-0" aria-hidden>
      {/* Branche arrondie : trait vertical + coude vers le pick */}
      <span
        className={cn(
          "absolute left-1 top-0 w-2.5 rounded-bl-[0.5rem] border-l border-b border-border/60",
          isLast ? "h-[1.05rem]" : "h-[1.05rem]",
        )}
      />
      {!isLast && (
        <span className="absolute bottom-0 left-1 top-[1.05rem] w-px bg-border/60" />
      )}
    </div>
  );
}

function PickLeg({
  item,
  unitStake,
  mode,
  connector,
  isLast,
  onRemove,
  onStakeChange,
}: {
  item: BetSlipDraftItem;
  unitStake: number;
  mode: "SIMPLE" | "COMBO";
  connector: boolean;
  isLast: boolean;
  onRemove: () => void;
  onStakeChange: (v: string) => void;
}) {
  const { formatAmount } = useCurrencyFormat();
  const odds = item.odds ? Number.parseFloat(item.odds) : null;
  const stake = item.stakeOverride ?? unitStake;

  return (
    <div className="flex">
      {connector && <LegConnector isLast={isLast} />}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2 py-1">
          <div className="min-w-0 flex-1">
            <PickLabel item={item} />
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {odds !== null && Number.isFinite(odds) && (
              <span className="text-sm font-bold italic tabular-nums text-foreground">
                {odds.toFixed(2)}
              </span>
            )}
            <button
              type="button"
              onClick={onRemove}
              aria-label="Supprimer"
              className="rounded-md p-0.5 text-muted-foreground/60 transition-colors hover:bg-destructive/10 hover:text-destructive"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Mise override — mode SIMPLE uniquement */}
        {mode === "SIMPLE" && (
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="text-[0.65rem] text-muted-foreground">
              Mise
              {odds !== null && Number.isFinite(odds) && (
                <span className="ml-1.5 tabular-nums text-muted-foreground/70">
                  → {formatAmount(stake * odds)}
                </span>
              )}
            </span>
            <StakeInput
              value={
                item.stakeOverride !== null ? String(item.stakeOverride) : ""
              }
              onChange={onStakeChange}
              placeholder={String(unitStake)}
              className="w-24 py-1.5 text-xs"
            />
          </div>
        )}
      </div>
    </div>
  );
}

function MatchGroupCard({
  group,
  unitStake,
  mode,
  onRemove,
  onStakeChange,
}: {
  group: MatchGroup;
  unitStake: number;
  mode: "SIMPLE" | "COMBO";
  onRemove: (key: string) => void;
  onStakeChange: (key: string, v: string) => void;
}) {
  const multi = group.items.length > 1;

  return (
    <div className="overflow-hidden rounded-2xl border border-border/60 bg-background shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-shadow hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
      {/* Match header — affiché une seule fois */}
      <div className="border-b border-border/40 bg-secondary/25 px-3.5 py-2">
        <FixtureName
          fixture={group.fixture}
          homeLogo={group.homeLogo}
          awayLogo={group.awayLogo}
          className="min-w-0 truncate text-[0.7rem] font-semibold text-muted-foreground"
        />
      </div>

      {/* Picks du match */}
      <div className="px-3.5 py-1.5">
        {group.items.map((item, idx) => {
          const key = draftItemKey(item);
          return (
            <PickLeg
              key={key}
              item={item}
              unitStake={unitStake}
              mode={mode}
              connector={multi}
              isLast={idx === group.items.length - 1}
              onRemove={() => onRemove(key)}
              onStakeChange={(v) => onStakeChange(key, v)}
            />
          );
        })}
      </div>
    </div>
  );
}

// ─── Empty state ────────────────────────────────────────────────────────────

function EmptySlip() {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
      <div className="flex size-16 items-center justify-center rounded-[1.25rem] bg-secondary/60 text-muted-foreground/70 ring-1 ring-border/40">
        <ReceiptText size={26} strokeWidth={1.75} />
      </div>
      <div>
        <p className="text-sm font-semibold text-foreground">Coupon vide</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Ajoutez des sélections depuis la page Décisions.
        </p>
      </div>
    </div>
  );
}

// ─── Success state ───────────────────────────────────────────────────────────

function SubmittedState({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 px-6 py-14 text-center">
      <div className="flex size-16 items-center justify-center rounded-[1.25rem] bg-success/12 text-success ring-1 ring-success/15">
        <CheckCircle size={30} strokeWidth={1.75} />
      </div>
      <div>
        <p className="text-sm font-semibold text-foreground">Coupon soumis !</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Retrouvez-le dans la section Mes coupons.
        </p>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="mt-1 flex items-center gap-1.5 rounded-2xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-[0_4px_14px_-4px] shadow-primary/40 transition-all hover:brightness-105 active:scale-[0.99]"
      >
        Fermer
        <ChevronRight size={14} />
      </button>
    </div>
  );
}

// ─── Type tab bar ────────────────────────────────────────────────────────────

function TypeTabs({
  active,
  onChange,
  disabled,
}: {
  active: "SIMPLE" | "COMBO";
  onChange: (t: "SIMPLE" | "COMBO") => void;
  disabled: boolean;
}) {
  return (
    <div className="px-4 pb-1 pt-1">
      <div className="flex gap-1 rounded-2xl bg-secondary/50 p-1">
        {(["SIMPLE", "COMBO"] as const).map((t) => (
          <button
            key={t}
            type="button"
            disabled={t === "COMBO" && disabled}
            onClick={() => onChange(t)}
            className={cn(
              "flex-1 rounded-xl py-2 text-xs font-bold tracking-wide transition-all",
              active === t
                ? "bg-background text-accent shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
                : "text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40",
            )}
          >
            {t === "SIMPLE" ? "Simples" : "Combiné"}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Main drawer ─────────────────────────────────────────────────────────────

export function BetSlipDrawer() {
  const isMobile = useIsMobile();
  const currentUser = useCurrentUser();
  const {
    draft,
    isOpen,
    close,
    removeItem,
    setStakeOverride,
    setUnitStake,
    setType,
    clearDraft,
  } = useBetSlip();
  const queryClient = useQueryClient();
  const bankrollQuery = useBankrollBalance(currentUser.id);

  const [unitStakeInput, setUnitStakeInput] = useState(() =>
    String(draft.unitStake),
  );
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [isPending, startTransition] = useTransition();

  const totalItems = draft.items.length;
  const isCombo = draft.type === "COMBO" && totalItems >= 2;

  // BetClic-style: une combo intra-match (MYCOMBI) compte 2 sélections.
  const selectionCount = draft.items.reduce(
    (n, i) => n + (i.comboMarket && i.comboPick ? 2 : 1),
    0,
  );

  const totalOdds = draft.items.reduce((acc, item) => {
    const o = item.odds ? Number.parseFloat(item.odds) : 1;
    return Number.isFinite(o) && o > 0 ? acc * o : acc;
  }, 1);

  const bankroll = Number.parseFloat(bankrollQuery.data?.balance ?? "0");

  function effectiveStake(override: number | null) {
    return override ?? draft.unitStake;
  }

  const totalStake = isCombo
    ? draft.unitStake
    : draft.items.reduce((s, i) => s + effectiveStake(i.stakeOverride), 0);

  const potentialReturn = isCombo
    ? draft.unitStake * totalOdds
    : draft.items.reduce((s, i) => {
        const o = i.odds ? Number.parseFloat(i.odds) : 0;
        return Number.isFinite(o) ? s + effectiveStake(i.stakeOverride) * o : s;
      }, 0);

  const exceedsBalance = totalStake > bankroll;
  const exceedsReturnCap = potentialReturn > SLIP_LIMITS.MAX_POTENTIAL_RETURN;
  const exceedsStakeCap = draft.unitStake > SLIP_LIMITS.MAX_UNIT_STAKE;
  const exceedsItemsCap = totalItems > SLIP_LIMITS.MAX_ITEMS;

  useEffect(() => {
    setUnitStakeInput(String(draft.unitStake));
  }, [draft.unitStake]);

  useEffect(() => {
    if (!isOpen) {
      setSubmitError(null);
      setSubmitted(false);
    }
  }, [isOpen]);

  function handleSubmit() {
    setSubmitError(null);
    startTransition(async () => {
      try {
        await createBetSlip(draft);
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["bet-slips"] }),
          queryClient.invalidateQueries({ queryKey: ["bankroll-balance"] }),
          queryClient.invalidateQueries({
            queryKey: ["bankroll-transactions"],
          }),
        ]);
        setSubmitted(true);
        clearDraft();
      } catch (err) {
        setSubmitError(
          err instanceof Error ? err.message : "Erreur lors de la soumission",
        );
      }
    });
  }

  return (
    <Drawer
      open={isOpen}
      onOpenChange={(open) => !open && close()}
      direction={isMobile ? "bottom" : "right"}
    >
      <DrawerContent
        className={
          isMobile
            ? "z-50 flex h-[92dvh] min-h-0 flex-col rounded-t-[1.25rem] border-t border-border bg-panel outline-none"
            : "z-50 inset-y-4 right-4 flex h-[calc(100dvh-2rem)] w-[400px] flex-col rounded-2xl border border-border bg-panel shadow-[0_24px_80px_rgba(0,0,0,0.28)] outline-none"
        }
      >
        <DrawerTitle className="sr-only">Mon coupon</DrawerTitle>

        {/* ── Header */}
        <div className="flex shrink-0 items-center justify-between px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className="flex size-7 items-center justify-center rounded-xl bg-accent/12 text-accent">
              <ReceiptText size={15} />
            </span>
            <span className="text-sm font-bold text-foreground">
              {totalItems > 0
                ? `${selectionCount} sélection${selectionCount > 1 ? "s" : ""}`
                : "Mon coupon"}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {totalItems > 0 && (
              <button
                type="button"
                onClick={clearDraft}
                className="flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-[0.7rem] font-semibold text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 size={11} />
                Vider
              </button>
            )}
            <button
              type="button"
              onClick={close}
              aria-label="Fermer"
              className="rounded-xl p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* ── Tabs — only when picks exist */}
        {totalItems > 0 && !submitted && (
          <TypeTabs
            active={draft.type}
            onChange={setType}
            disabled={totalItems < 2}
          />
        )}

        {/* ── Content */}
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          {submitted ? (
            <SubmittedState
              onClose={() => {
                setSubmitted(false);
                close();
              }}
            />
          ) : totalItems === 0 ? (
            <EmptySlip />
          ) : (
            <div className="flex flex-col gap-2.5">
              {groupItemsByFixture(draft.items).map((group) => (
                <MatchGroupCard
                  key={group.fixtureId}
                  group={group}
                  unitStake={draft.unitStake}
                  mode={isCombo ? "COMBO" : "SIMPLE"}
                  onRemove={(key) => removeItem(key)}
                  onStakeChange={(key, v) => {
                    const n = parseFloat(v);
                    setStakeOverride(key, v === "" || isNaN(n) ? null : n);
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── Footer */}
        {!submitted && totalItems > 0 && (
          <div className="shrink-0 border-t border-border/50 bg-panel px-4 pb-4 pt-3.5">
            {submitError && (
              <div className="mb-3 flex items-center gap-2 rounded-2xl border border-destructive/20 bg-destructive/10 px-3 py-2.5 text-xs font-medium text-destructive">
                <AlertCircle size={13} className="shrink-0" />
                {submitError}
              </div>
            )}
            {exceedsBalance && (
              <div className="mb-2 flex items-center gap-2 rounded-2xl border border-warning/20 bg-warning/10 px-3 py-2.5 text-xs font-medium text-warning">
                <AlertCircle size={13} className="shrink-0" />
                <span>
                  Solde insuffisant — mise totale{" "}
                  <Amount
                    value={totalStake}
                    className="font-bold text-warning"
                  />
                </span>
              </div>
            )}
            {exceedsReturnCap && (
              <div className="mb-2 flex items-center gap-2 rounded-2xl border border-destructive/20 bg-destructive/10 px-3 py-2.5 text-xs font-medium text-destructive">
                <AlertCircle size={13} className="shrink-0" />
                <span>
                  Gain potentiel dépasse le plafond de{" "}
                  <Amount
                    value={SLIP_LIMITS.MAX_POTENTIAL_RETURN}
                    className="font-bold"
                  />
                </span>
              </div>
            )}
            {exceedsStakeCap && (
              <div className="mb-2 flex items-center gap-2 rounded-2xl border border-destructive/20 bg-destructive/10 px-3 py-2.5 text-xs font-medium text-destructive">
                <AlertCircle size={13} className="shrink-0" />
                <span>
                  Mise maximale par sélection :{" "}
                  <Amount
                    value={SLIP_LIMITS.MAX_UNIT_STAKE}
                    className="font-bold"
                  />
                </span>
              </div>
            )}
            {exceedsItemsCap && (
              <div className="mb-2 flex items-center gap-2 rounded-2xl border border-destructive/20 bg-destructive/10 px-3 py-2.5 text-xs font-medium text-destructive">
                <AlertCircle size={13} className="shrink-0" />
                Maximum {SLIP_LIMITS.MAX_ITEMS} sélections par coupon.
              </div>
            )}

            {/* Récap dans un panneau doux */}
            <div className="rounded-2xl bg-secondary/40 p-3">
              {/* Mise */}
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-medium text-muted-foreground">
                  {isCombo ? "Mise combiné" : "Mise par sélection"}
                </span>
                <StakeInput
                  value={unitStakeInput}
                  onChange={(v) => {
                    setUnitStakeInput(v);
                    const val = parseFloat(v);
                    if (!isNaN(val) && val > 0) setUnitStake(val);
                  }}
                  placeholder="4000"
                />
              </div>

              {/* Odds combo */}
              {isCombo && (
                <div className="mt-2.5 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Cote totale</span>
                  <span className="font-bold tabular-nums text-foreground">
                    {totalOdds.toFixed(2)}
                  </span>
                </div>
              )}

              {/* Mise totale (simples seulement) */}
              {!isCombo && totalItems > 1 && (
                <div className="mt-2.5 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    Mise totale ({totalItems} paris)
                  </span>
                  <Amount
                    value={totalStake}
                    className="font-semibold text-foreground"
                  />
                </div>
              )}

              <div className="my-2.5 h-px bg-border/50" />

              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground">
                  Gains possibles
                </span>
                <Amount
                  value={potentialReturn}
                  className="text-base font-extrabold text-success"
                />
              </div>
            </div>

            <p className="mb-3 mt-2 text-right text-[0.62rem] text-muted-foreground/60">
              Solde : <Amount value={bankroll} className="" />
            </p>

            <button
              type="button"
              disabled={
                isPending ||
                exceedsBalance ||
                exceedsReturnCap ||
                exceedsStakeCap ||
                exceedsItemsCap
              }
              onClick={handleSubmit}
              className="w-full rounded-2xl bg-primary py-3.5 text-sm font-bold text-primary-foreground shadow-[0_4px_14px_-4px] shadow-primary/40 transition-all hover:brightness-105 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
            >
              {isPending ? "Validation…" : "Parier"}
            </button>
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
}
