"use client";

import { useEffect, useState, useTransition } from "react";
import { X, ReceiptText, Trash2, AlertCircle, CheckCircle } from "lucide-react";
import { Drawer, DrawerContent, DrawerTitle } from "@evcore/ui";
import { useIsMobile } from "@/hooks/use-mobile";
import { useQueryClient } from "@tanstack/react-query";
import { useBetSlip } from "@/domains/bet-slip/context/bet-slip-context";
import { createBetSlip } from "@/domains/bet-slip/use-cases/create-bet-slip";
import { useBankrollBalance } from "@/domains/bankroll/use-cases/get-bankroll-balance";
import {
  draftItemKey,
  type BetSlipDraftItem,
} from "@/domains/bet-slip/types/bet-slip";
import { FixtureName } from "./fixture-name";
import {
  formatCombinedPickForDisplay,
  formatMarketForDisplay,
} from "@/helpers/fixture";
import { useCurrencyFormat } from "@/providers/currency-provider";
import { Amount } from "./amount";

function StakeInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <input
      type="number"
      min={0}
      step={100}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-24 rounded-lg border border-border bg-background px-2 py-1.5 text-right text-xs font-semibold tabular-nums text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
    />
  );
}

function DraftItemRow({
  item,
  unitStake,
  mode,
  onRemove,
  onStakeChange,
}: {
  item: BetSlipDraftItem;
  unitStake: number;
  mode: "SIMPLE" | "COMBO";
  onRemove: () => void;
  onStakeChange: (v: string) => void;
}) {
  const { formatAmount } = useCurrencyFormat();
  const odds = item.odds ? Number.parseFloat(item.odds) : null;
  const stake = item.stakeOverride ?? unitStake;

  return (
    <div className="px-4 py-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <FixtureName
            fixture={item.fixture}
            homeLogo={item.homeLogo}
            awayLogo={item.awayLogo}
            className="text-xs font-semibold text-foreground"
          />
          <p className="mt-0.5 text-[0.65rem] uppercase tracking-[0.14em] text-muted-foreground">
            {item.competition} • {item.scheduledAt}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <span className="text-[0.65rem] text-muted-foreground">
              {formatMarketForDisplay(item.market)}
            </span>
            <span className="rounded-md bg-secondary px-2 py-0.5 text-[0.68rem] font-semibold text-secondary-foreground">
              {formatCombinedPickForDisplay({
                market: item.market,
                pick: item.pick,
                comboMarket: item.comboMarket,
                comboPick: item.comboPick,
              })}
            </span>
            {item.ev && (
              <span className="text-[0.65rem] font-semibold text-success">
                Valeur {item.ev}
              </span>
            )}
            {odds !== null && Number.isFinite(odds) ? (
              <span className="text-[0.65rem] font-semibold tabular-nums text-foreground">
                @{odds.toFixed(2)}
              </span>
            ) : null}
          </div>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="mt-0.5 shrink-0 rounded-lg p-2.5 text-danger active:bg-destructive/10 hover:bg-destructive/10 hover:text-destructive"
          aria-label="Supprimer"
        >
          <X size={14} />
        </button>
      </div>
      {mode === "SIMPLE" ? (
        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="text-[0.65rem] text-muted-foreground">
            <span>Mise spécifique</span>
            {odds !== null && Number.isFinite(odds) ? (
              <span className="ml-2 tabular-nums">
                Gain pot. {formatAmount(stake * odds)}
              </span>
            ) : null}
          </div>
          <StakeInput
            value={
              item.stakeOverride !== null ? String(item.stakeOverride) : ""
            }
            onChange={onStakeChange}
            placeholder={String(unitStake)}
          />
        </div>
      ) : null}
    </div>
  );
}

export function BetSlipDrawer() {
  const isMobile = useIsMobile();
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
  const bankrollQuery = useBankrollBalance();

  const [unitStakeInput, setUnitStakeInput] = useState(() =>
    String(draft.unitStake),
  );
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [isPending, startTransition] = useTransition();

  const totalItems = draft.items.length;
  const isCombo = draft.type === "COMBO" && totalItems >= 2;
  const totalOdds = draft.items.reduce((product, item) => {
    const odds = item.odds ? Number.parseFloat(item.odds) : 1;
    return Number.isFinite(odds) && odds > 0 ? product * odds : product;
  }, 1);

  useEffect(() => {
    setUnitStakeInput(String(draft.unitStake));
  }, [draft.unitStake]);

  useEffect(() => {
    if (!isOpen) {
      setSubmitError(null);
      setSubmitted(false);
    }
  }, [isOpen]);

  function effectiveStake(stakeOverride: number | null): number {
    return stakeOverride ?? draft.unitStake;
  }

  const totalStake = isCombo
    ? draft.unitStake
    : draft.items.reduce(
        (sum, item) => sum + effectiveStake(item.stakeOverride),
        0,
      );
  const potentialReturn = isCombo
    ? draft.unitStake * totalOdds
    : draft.items.reduce((sum, item) => {
        const odds = item.odds ? Number.parseFloat(item.odds) : 0;
        return Number.isFinite(odds)
          ? sum + effectiveStake(item.stakeOverride) * odds
          : sum;
      }, 0);
  const bankroll = Number.parseFloat(bankrollQuery.data?.balance ?? "0");
  const exceedsBalance = totalStake > bankroll;

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
            ? "z-50 flex h-[92dvh] min-h-0 flex-col rounded-t-[1.5rem] border-t border-border bg-panel outline-none"
            : "z-50 inset-y-4 right-4 flex h-[calc(100dvh-2rem)] w-[420px] flex-col rounded-[1.5rem] border border-border bg-panel shadow-[0_24px_80px_rgba(15,23,42,0.18)] outline-none"
        }
      >
        <DrawerTitle className="sr-only">Coupon en préparation</DrawerTitle>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <ReceiptText size={16} className="text-accent" />
              <h2 className="text-sm font-semibold text-foreground">
                Coupon en préparation
                {totalItems > 0 && (
                  <span className="ml-1.5 rounded-full bg-accent px-1.5 py-0.5 text-[0.6rem] font-bold text-accent-foreground">
                    {totalItems}
                  </span>
                )}
              </h2>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {totalItems > 0
                ? `${totalItems} sélection${totalItems > 1 ? "s" : ""} prête${totalItems > 1 ? "s" : ""}`
                : "Ajoutez vos sélections pour préparer votre coupon."}
            </p>
            <p className="mt-2 text-xs font-semibold text-foreground">
              Solde disponible :{" "}
              <Amount value={bankroll} className="text-foreground" />
            </p>
          </div>
          <div className="flex items-center gap-2">
            {totalItems > 0 && (
              <button
                type="button"
                onClick={clearDraft}
                className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-[0.7rem] font-semibold text-danger hover:bg-destructive/10"
              >
                <Trash2 size={11} />
                Vider
              </button>
            )}
            <button
              type="button"
              onClick={close}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {submitted ? (
            <div className="flex flex-col items-center gap-3 px-5 py-12 text-center">
              <CheckCircle size={40} className="text-success" />
              <p className="font-semibold text-foreground">Coupon soumis !</p>
              <p className="text-sm text-muted-foreground">
                Retrouvez-le dans la section Mes coupons.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSubmitted(false);
                  close();
                }}
                className="mt-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
              >
                Fermer
              </button>
            </div>
          ) : totalItems === 0 ? (
            <div className="flex flex-col items-center gap-2 px-5 py-12 text-center">
              <ReceiptText size={32} className="text-muted-foreground" />
              <p className="text-sm font-semibold text-foreground">
                Aucun coupon en préparation
              </p>
              <p className="text-xs text-muted-foreground">
                Placez des sélections depuis la page Matchs.
              </p>
            </div>
          ) : (
            <div>
              <div className="border-b border-border px-4 py-3">
                <div className="grid grid-cols-2 gap-1 rounded-lg bg-secondary p-1">
                  <button
                    type="button"
                    onClick={() => setType("SIMPLE")}
                    className={`rounded-md px-3 py-2 text-xs font-bold transition-colors ${
                      !isCombo
                        ? "bg-panel text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Simples
                  </button>
                  <button
                    type="button"
                    onClick={() => setType("COMBO")}
                    disabled={totalItems < 2}
                    className={`rounded-md px-3 py-2 text-xs font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${
                      isCombo
                        ? "bg-panel text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Combiné
                  </button>
                </div>
              </div>
              <div className="divide-y divide-border">
                {draft.items.map((item) => {
                  const key = draftItemKey(item);
                  return (
                    <DraftItemRow
                      key={key}
                      item={item}
                      unitStake={draft.unitStake}
                      mode={isCombo ? "COMBO" : "SIMPLE"}
                      onRemove={() => removeItem(key)}
                      onStakeChange={(v) => {
                        const n = parseFloat(v);
                        setStakeOverride(key, v === "" || isNaN(n) ? null : n);
                      }}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {!submitted && totalItems > 0 && (
          <div className="shrink-0 border-t border-border bg-panel-strong px-5 py-4">
            {submitError && (
              <div className="mb-3 flex items-center gap-2 rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
                <AlertCircle size={13} />
                {submitError}
              </div>
            )}
            {exceedsBalance && (
              <div className="mb-3 flex items-center gap-2 rounded-xl border border-warning/20 bg-warning/12 px-3 py-2 text-xs font-medium text-warning">
                <AlertCircle size={13} />
                Solde insuffisant : vous voulez miser{" "}
                <Amount value={totalStake} className="text-warning" />.
              </div>
            )}
            <div className="mb-3 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                {isCombo ? "Mise du combiné" : "Mise par sélection"}
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
            <div className="mb-4 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Solde disponible</span>
              <Amount
                value={bankroll}
                className="font-semibold text-foreground"
              />
            </div>
            <div className="mb-4 flex items-center justify-between text-xs">
              <span className="font-semibold text-foreground">
                Mise totale ({totalItems} sélection{totalItems > 1 ? "s" : ""})
              </span>
              <Amount
                value={totalStake}
                className="font-bold text-foreground"
              />
            </div>
            {isCombo ? (
              <div className="mb-4 flex items-center justify-between text-xs">
                <span className="font-semibold text-foreground">
                  Cote totale
                </span>
                <span className="font-bold tabular-nums text-foreground">
                  {totalOdds.toFixed(2)}
                </span>
              </div>
            ) : null}
            <div className="mb-4 flex items-center justify-between text-xs">
              <span className="font-semibold text-foreground">
                Gain potentiel
              </span>
              <Amount
                value={potentialReturn}
                className="font-bold text-success"
              />
            </div>
            <button
              type="button"
              disabled={isPending || exceedsBalance}
              onClick={handleSubmit}
              className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground disabled:opacity-60"
            >
              {isPending ? "Soumission…" : "Valider le coupon"}
            </button>
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
}
