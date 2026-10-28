"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@evcore/ui";
import { useCurrencyFormat } from "@/providers/currency-provider";
import { useDeleteBetSlip } from "@/domains/bet-slip/use-cases/delete-bet-slip";

/**
 * Supprimer un coupon saisi par erreur : possible tant qu'aucun de ses
 * matchs n'a commencé (règle du serveur, 2026-10-28). La mise revient au
 * solde.
 */
export function DeleteSlipDialog({
  slipId,
  staked,
  onDeleted,
}: {
  slipId: string;
  staked: string;
  onDeleted: () => void;
}) {
  const t = useTranslations("betSlips.delete");
  const { formatAmount } = useCurrencyFormat();
  const [open, setOpen] = useState(false);
  const mutation = useDeleteBetSlip();

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) mutation.reset();
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="h-11 w-full text-destructive sm:w-fit"
          data-testid="delete-slip-trigger"
        >
          {t("trigger")}
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-md bg-panel-strong">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription className="text-sm leading-6">
            {t("description", { amount: formatAmount(staked) })}
          </DialogDescription>
        </DialogHeader>
        {mutation.error ? (
          <p role="alert" className="text-sm text-destructive">
            {mutation.error instanceof Error
              ? mutation.error.message
              : t("error")}
          </p>
        ) : null}
        <DialogFooter className="mt-2 gap-2">
          <Button
            type="button"
            variant="secondary"
            className="h-11"
            onClick={() => setOpen(false)}
          >
            {t("cancel")}
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="h-11 gap-2"
            disabled={mutation.isPending}
            onClick={() =>
              mutation.mutate(slipId, {
                onSuccess: () => {
                  setOpen(false);
                  onDeleted();
                },
              })
            }
          >
            {mutation.isPending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : null}
            {t("confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
