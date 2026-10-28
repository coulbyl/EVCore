"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
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
  cn,
} from "@evcore/ui";
import {
  useCurrentUser,
  useSetCurrentUser,
} from "@/domains/auth/context/current-user-context";
import { useActivePause } from "@/domains/auth/use-cases/use-active-pause";
import {
  PAUSE_DURATIONS_DAYS,
  pauseAccount,
  type PauseDurationDays,
} from "@/domains/auth/use-cases/pause-account";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Faire une pause (jeu responsable, décision du 2026-10-28) : 24 heures,
 * 7 ou 30 jours, sans retour en arrière. Pendant la pause, l'app ne propose
 * plus aucun pari et ne pousse plus d'annonce ; l'historique reste ouvert.
 * Une pause en cours ne peut que se prolonger : les durées qui finiraient
 * plus tôt sont désactivées, et le serveur les refuse de toute façon.
 */
export function PauseAccountSection() {
  const t = useTranslations("account.pause");
  const locale = useLocale();
  const user = useCurrentUser();
  const setCurrentUser = useSetCurrentUser();
  const pauseEnd = useActivePause();
  const [open, setOpen] = useState(false);
  const [days, setDays] = useState<PauseDurationDays | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const endLabel = (iso: string) =>
    new Date(iso).toLocaleString(locale === "en" ? "en-GB" : "fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
    });
  const endsSooner = (option: PauseDurationDays) =>
    pauseEnd !== null &&
    Date.now() + option * DAY_MS <= new Date(pauseEnd).getTime();

  async function handleConfirm() {
    if (days === null || pending) return;
    setPending(true);
    setError(null);
    try {
      const { pausedUntil } = await pauseAccount(days);
      setCurrentUser({ ...user, pausedUntil });
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("error"));
    } finally {
      setPending(false);
    }
  }

  return (
    <div data-testid="pause-section" className="flex flex-col gap-2">
      <p>
        {pauseEnd ? (
          <span
            className="font-medium text-foreground"
            suppressHydrationWarning
          >
            {t("activeUntil", { end: endLabel(pauseEnd) })}
          </span>
        ) : (
          t("intro")
        )}
      </p>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) {
            setDays(null);
            setError(null);
          }
        }}
      >
        <DialogTrigger asChild>
          <Button variant="outline" className="h-11 w-fit">
            {pauseEnd ? t("extend") : t("trigger")}
          </Button>
        </DialogTrigger>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-md bg-panel-strong">
          <DialogHeader>
            <DialogTitle>{pauseEnd ? t("extend") : t("trigger")}</DialogTitle>
            <DialogDescription className="text-sm leading-6">
              {t("description")}
            </DialogDescription>
          </DialogHeader>
          <div
            role="radiogroup"
            aria-label={t("durationLabel")}
            className="mt-2 grid grid-cols-3 gap-2"
          >
            {PAUSE_DURATIONS_DAYS.map((option) => {
              const disabled = endsSooner(option);
              return (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={days === option}
                  disabled={disabled}
                  onClick={() => setDays(option)}
                  className={cn(
                    "min-h-11 rounded-xl border px-3 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                    days === option
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-border text-foreground hover:bg-secondary",
                  )}
                >
                  {t(`duration.${option}`)}
                </button>
              );
            })}
          </div>
          <p className="text-sm leading-6 text-foreground">{t("noReturn")}</p>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <DialogFooter className="gap-2">
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
              className="h-11 gap-2"
              disabled={days === null || pending}
              onClick={() => void handleConfirm()}
            >
              {pending ? <Loader2 size={14} className="animate-spin" /> : null}
              {t("confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
