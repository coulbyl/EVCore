"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
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
  Input,
} from "@evcore/ui";
import { deleteAccount } from "@/domains/auth/use-cases/delete-account";

/**
 * Suppression du compte en libre-service : ce qui disparaît, le mot de
 * passe, et c'est tout. Pas de « Tu vas tout perdre ! » ni de délai de
 * grâce (décision du 2026-10-28).
 */
export function DeleteAccountDialog() {
  const t = useTranslations("account.deleteAccount");
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password.length < 8 || pending) return;
    setPending(true);
    setError(null);
    try {
      await deleteAccount(password);
      queryClient.clear();
      router.replace("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("error"));
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setPassword("");
          setError(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" className="h-11 w-fit text-destructive">
          {t("trigger")}
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-md bg-panel-strong">
        <form onSubmit={(event) => void handleSubmit(event)}>
          <DialogHeader>
            <DialogTitle>{t("title")}</DialogTitle>
            <DialogDescription className="text-sm leading-6">
              {t("description")}
            </DialogDescription>
          </DialogHeader>
          {/* La pause, proposée une fois, sans insister. */}
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            {t("pauseHint")}
          </p>
          <div className="mt-4 flex flex-col gap-1.5">
            <label
              htmlFor="delete-account-password"
              className="text-sm font-medium text-foreground"
            >
              {t("passwordLabel")}
            </label>
            <Input
              id="delete-account-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-11"
            />
            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}
          </div>
          <DialogFooter className="mt-5 gap-2">
            <Button
              type="button"
              variant="secondary"
              className="h-11"
              onClick={() => setOpen(false)}
            >
              {t("cancel")}
            </Button>
            <Button
              type="submit"
              variant="destructive"
              className="h-11 gap-2"
              disabled={password.length < 8 || pending}
            >
              {pending ? <Loader2 size={14} className="animate-spin" /> : null}
              {t("confirm")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
