"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  Button,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
} from "@evcore/ui";
import { sendVerificationEmail, verifyEmail } from "@/domains/auth/use-cases/verify-email";

const schema = z.object({
  code: z
    .string()
    .length(6, "Le code doit contenir exactement 6 chiffres.")
    .regex(/^\d{6}$/, "Le code ne contient que des chiffres."),
});

type Values = z.infer<typeof schema>;

export function EmailVerifyFlow({ onBack }: { onBack: () => void }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { code: "" },
    mode: "onTouched",
  });

  useEffect(() => {
    async function autoSend() {
      setSending(true);
      try {
        await sendVerificationEmail();
        setSent(true);
      } catch {
        setError("Impossible d'envoyer le code. Réessayez.");
      } finally {
        setSending(false);
      }
    }
    void autoSend();
  }, []);

  async function resend() {
    setError(null);
    setSending(true);
    try {
      await sendVerificationEmail();
      setSent(true);
    } catch {
      setError("Impossible d'envoyer le code. Réessayez.");
    } finally {
      setSending(false);
    }
  }

  async function onSubmit(values: Values) {
    setError(null);
    setIsSubmitting(true);
    try {
      await verifyEmail(values.code);
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Code invalide ou expiré.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form className="flex flex-col gap-5" onSubmit={form.handleSubmit(onSubmit)}>
        {error ? (
          <div className="rounded-xl border border-destructive/20 bg-destructive/8 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        {sending ? (
          <p className="text-sm text-muted-foreground">Envoi du code en cours…</p>
        ) : sent ? (
          <p className="rounded-xl border border-border bg-panel px-4 py-3 text-sm text-muted-foreground">
            Un code à 6 chiffres a été envoyé à votre adresse email. Vérifiez
            aussi vos spams.
          </p>
        ) : null}

        <FormField
          control={form.control}
          name="code"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Code de vérification</FormLabel>
              <FormControl>
                <Input
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  className="h-12 text-center text-xl tracking-[0.5em]"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="h-11 w-full" disabled={isSubmitting || !sent}>
          {isSubmitting ? "Vérification…" : "Confirmer"}
        </Button>

        <div className="flex items-center justify-between text-sm">
          <button
            type="button"
            onClick={onBack}
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            ← Changer de méthode
          </button>
          <button
            type="button"
            onClick={resend}
            disabled={sending}
            className="text-accent hover:underline disabled:opacity-50"
          >
            Renvoyer le code
          </button>
        </div>
      </form>
    </Form>
  );
}
