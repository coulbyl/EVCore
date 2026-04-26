"use client";

import { useState } from "react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
  EvButton,
  Input,
} from "@evcore/ui";
import { Loader2, Plus, Wallet, X } from "lucide-react";
import { useDepositBankroll } from "@/domains/bankroll/use-cases/deposit-bankroll";

export function DepositDialog() {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const mutation = useDepositBankroll();

  function resetForm() {
    setAmount("");
    setNote("");
    mutation.reset();
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsedAmount = Number.parseFloat(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount < 1) {
      return;
    }

    try {
      await mutation.mutateAsync({
        amount: parsedAmount,
        note: note.trim() || undefined,
      });
      setOpen(false);
    } catch {
      // L'erreur est deja geree via le message du mutation state.
    }
  }

  const amountIsInvalid =
    amount.trim().length > 0 &&
    (!Number.isFinite(Number.parseFloat(amount)) ||
      Number.parseFloat(amount) < 1);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          resetForm();
        }
      }}
    >
      <DialogTrigger asChild>
        <EvButton className="gap-2">
          <Plus size={14} />
          Ajouter un dépôt
        </EvButton>
      </DialogTrigger>

      <DialogContent
        showCloseButton={false}
        className="w-[calc(100vw-2rem)] max-w-md rounded-3xl border border-border bg-white p-6 shadow-xl"
      >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <DialogTitle className="flex items-center gap-2 text-base font-semibold text-slate-900">
                <Wallet size={16} className="text-accent" />
                Ajouter un dépôt
              </DialogTitle>
              <DialogDescription className="mt-1 text-sm text-slate-500">
                Ajoutez un dépôt pour mettre à jour votre solde et votre
                historique.
              </DialogDescription>
            </div>
            <DialogClose asChild>
              <button
                type="button"
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={16} />
              </button>
            </DialogClose>
          </div>

          <form onSubmit={(event) => void handleSubmit(event)} className="mt-5">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="deposit-amount"
                  className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-slate-500"
                >
                  Montant
                </label>
                <Input
                  id="deposit-amount"
                  type="number"
                  min={1}
                  step={1}
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="50000"
                  className="h-11 rounded-xl border-border bg-slate-50 text-sm font-semibold text-slate-900"
                />
                {amountIsInvalid ? (
                  <p className="text-xs text-rose-600">
                    Saisissez un montant supérieur ou égal à 1.
                  </p>
                ) : null}
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="deposit-note"
                  className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-slate-500"
                >
                  Note
                </label>
                <Input
                  id="deposit-note"
                  type="text"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Dépôt initial"
                  className="h-11 rounded-xl border-border bg-slate-50 text-sm text-slate-900"
                />
              </div>
            </div>

            {mutation.error ? (
              <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-600">
                {mutation.error instanceof Error
                  ? mutation.error.message
                  : "Impossible d’enregistrer le dépôt."}
              </p>
            ) : null}

            <div className="mt-5 flex gap-2">
              <EvButton
                type="button"
                tone="secondary"
                className="flex-1"
                onClick={() => {
                  setOpen(false);
                  resetForm();
                }}
              >
                Annuler
              </EvButton>
              <EvButton
                type="submit"
                className="flex-1 gap-2"
                disabled={
                  mutation.isPending ||
                  amount.trim().length === 0 ||
                  amountIsInvalid
                }
              >
                {mutation.isPending ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Confirmation...
                  </>
                ) : (
                  "Confirmer"
                )}
              </EvButton>
            </div>
          </form>
      </DialogContent>
    </Dialog>
  );
}
