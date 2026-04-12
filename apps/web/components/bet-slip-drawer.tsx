"use client";

import { useState, useTransition } from "react";
import {
  X,
  ShoppingCart,
  Trash2,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
import { Drawer } from "vaul";
import { useBetSlip } from "@/domains/bet-slip/context/bet-slip-context";
import { createBetSlip } from "@/domains/bet-slip/use-cases/create-bet-slip";
import { FixtureName } from "./fixture-name";
import {
  formatPickForDisplay,
  formatMarketForDisplay,
} from "@/helpers/fixture";

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
      className="w-24 rounded-lg border border-border bg-slate-50 px-2 py-1.5 text-right text-xs font-semibold tabular-nums text-slate-700 focus:outline-none focus:ring-1 focus:ring-accent"
    />
  );
}

export function BetSlipDrawer() {
  const {
    draft,
    isOpen,
    close,
    removeItem,
    setStakeOverride,
    setUnitStake,
    clearDraft,
  } = useBetSlip();

  const [unitStakeInput, setUnitStakeInput] = useState(() =>
    String(draft.unitStake),
  );
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [isPending, startTransition] = useTransition();

  const totalItems = draft.items.length;

  function effectiveStake(stakeOverride: number | null): number {
    return stakeOverride ?? draft.unitStake;
  }

  const totalStake = draft.items.reduce(
    (sum, item) => sum + effectiveStake(item.stakeOverride),
    0,
  );

  function handleSubmit() {
    setSubmitError(null);
    startTransition(async () => {
      try {
        await createBetSlip(draft);
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
    <Drawer.Root open={isOpen} onOpenChange={(open) => !open && close()}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <Drawer.Content className="fixed bottom-0 left-0 right-0 z-50 flex max-h-[92dvh] flex-col rounded-t-[1.5rem] bg-white outline-none sm:left-auto sm:right-4 sm:top-4 sm:bottom-4 sm:w-[420px] sm:rounded-[1.5rem]">
          <Drawer.Title className="sr-only">Panier de bets</Drawer.Title>
          {/* Handle (mobile) */}
          <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-slate-300 sm:hidden" />

          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div className="flex items-center gap-2">
              <ShoppingCart size={16} className="text-accent" />
              <h2 className="text-sm font-semibold text-slate-800">
                Panier
                {totalItems > 0 && (
                  <span className="ml-1.5 rounded-full bg-accent px-1.5 py-0.5 text-[0.6rem] font-bold text-white">
                    {totalItems}
                  </span>
                )}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              {totalItems > 0 && (
                <button
                  type="button"
                  onClick={clearDraft}
                  className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-[0.7rem] font-semibold text-rose-500 hover:bg-rose-50"
                >
                  <Trash2 size={11} />
                  Vider
                </button>
              )}
              <button
                type="button"
                onClick={close}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {submitted ? (
              <div className="flex flex-col items-center gap-3 px-5 py-12 text-center">
                <CheckCircle size={40} className="text-emerald-500" />
                <p className="font-semibold text-slate-800">Ticket soumis !</p>
                <p className="text-sm text-slate-500">
                  Retrouvez-le dans la section Mes tickets.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSubmitted(false);
                    close();
                  }}
                  className="mt-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                >
                  Fermer
                </button>
              </div>
            ) : totalItems === 0 ? (
              <div className="flex flex-col items-center gap-2 px-5 py-12 text-center">
                <ShoppingCart size={32} className="text-slate-300" />
                <p className="text-sm font-semibold text-slate-500">
                  Panier vide
                </p>
                <p className="text-xs text-slate-400">
                  Ajoutez des paris depuis la page Matchs.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {draft.items.map((item) => (
                  <div key={item.betId} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <FixtureName
                          fixture={item.fixture}
                          homeLogo={item.homeLogo}
                          awayLogo={item.awayLogo}
                          className="text-xs font-semibold text-slate-800"
                        />
                        <p className="mt-0.5 text-[0.65rem] uppercase tracking-[0.14em] text-slate-400">
                          {item.competition} • {item.scheduledAt}
                        </p>
                        <div className="mt-1.5 flex items-center gap-2">
                          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[0.68rem] font-semibold text-slate-700">
                            {formatPickForDisplay(item.pick, item.market)}
                          </span>
                          <span className="text-[0.65rem] text-slate-400">
                            {formatMarketForDisplay(item.market)}
                          </span>
                          {item.ev && (
                            <span className="text-[0.65rem] font-semibold text-emerald-600">
                              EV {item.ev}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeItem(item.betId)}
                        className="mt-0.5 shrink-0 rounded-lg p-2.5 text-rose-400 active:bg-rose-50 hover:bg-rose-50 hover:text-rose-600"
                        aria-label="Supprimer"
                      >
                        <X size={14} />
                      </button>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="text-[0.65rem] text-slate-400">
                        Mise override
                      </span>
                      <StakeInput
                        value={
                          item.stakeOverride !== null
                            ? String(item.stakeOverride)
                            : ""
                        }
                        onChange={(v) => {
                          const n = parseFloat(v);
                          setStakeOverride(
                            item.betId,
                            v === "" || isNaN(n) ? null : n,
                          );
                        }}
                        placeholder={String(draft.unitStake)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {!submitted && totalItems > 0 && (
            <div className="border-t border-border bg-slate-50 px-5 py-4">
              {submitError && (
                <div className="mb-3 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-600">
                  <AlertCircle size={13} />
                  {submitError}
                </div>
              )}
              <div className="mb-3 flex items-center justify-between text-xs">
                <span className="text-slate-500">Mise unitaire</span>
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
                <span className="font-semibold text-slate-700">
                  Total ({totalItems} bet{totalItems > 1 ? "s" : ""})
                </span>
                <span className="font-bold tabular-nums text-slate-900">
                  {totalStake.toLocaleString("fr-FR")}
                </span>
              </div>
              <button
                type="button"
                disabled={isPending}
                onClick={handleSubmit}
                className="w-full rounded-xl bg-slate-900 py-3 text-sm font-bold text-white disabled:opacity-60"
              >
                {isPending ? "Soumission…" : "Valider le ticket"}
              </button>
            </div>
          )}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
