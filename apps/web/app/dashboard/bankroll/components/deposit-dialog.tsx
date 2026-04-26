"use client";

import { useState } from "react";
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
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
        <Button className="gap-2">
          <Plus size={14} />
          Ajouter un dépôt
        </Button>
      </DialogTrigger>

      <DialogContent
        showCloseButton={false}
        className="w-[calc(100vw-2rem)] max-w-md rounded-3xl border border-border bg-panel p-6 shadow-xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <DialogTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
              <Wallet size={16} className="text-accent" />
              Ajouter un dépôt
            </DialogTitle>
            <DialogDescription className="mt-1 text-sm text-muted-foreground">
              Ajoutez un dépôt pour mettre à jour votre solde et votre
              historique.
            </DialogDescription>
          </div>
          <DialogClose asChild>
            <button
              type="button"
              className="rounded-lg p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <X size={16} />
            </button>
          </DialogClose>
        </div>

        <form onSubmit={(event) => void handleSubmit(event)} className="mt-5">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="deposit-amount"
                className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground"
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
                className="h-11 rounded-xl border-border bg-background text-sm font-semibold text-foreground"
              />
              {amountIsInvalid ? (
                <p className="text-xs text-danger">
                  Saisissez un montant supérieur ou égal à 1.
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="deposit-note"
                className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground"
              >
                Note
              </label>
              <Input
                id="deposit-note"
                type="text"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Dépôt initial"
                className="h-11 rounded-xl border-border bg-background text-sm text-foreground"
              />
            </div>
          </div>

          {mutation.error ? (
            <p className="mt-4 rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {mutation.error instanceof Error
                ? mutation.error.message
                : "Impossible d’enregistrer le dépôt."}
            </p>
          ) : null}

          <div className="mt-5 flex gap-2">
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              onClick={() => {
                setOpen(false);
                resetForm();
              }}
            >
              Annuler
            </Button>
            <Button
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
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
