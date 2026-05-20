"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import Image from "next/image";
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
import { setupTotp, confirmTotp } from "@/domains/auth/use-cases/totp";

const schema = z.object({
  code: z
    .string()
    .length(6, "Le code doit contenir exactement 6 chiffres.")
    .regex(/^\d{6}$/, "Le code ne contient que des chiffres."),
});

type Values = z.infer<typeof schema>;

export function TotpSetupFlow({ onBack }: { onBack: () => void }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { code: "" },
    mode: "onTouched",
  });

  useEffect(() => {
    async function init() {
      try {
        const data = await setupTotp();
        setQrDataUrl(data.qrDataUrl);
        setSecret(data.secret);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Impossible de configurer TOTP.",
        );
      } finally {
        setIsLoading(false);
      }
    }
    void init();
  }, []);

  async function onSubmit(values: Values) {
    setError(null);
    setIsSubmitting(true);
    try {
      await confirmTotp(values.code);
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Code invalide.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form
        className="flex flex-col gap-4"
        onSubmit={form.handleSubmit(onSubmit)}
      >
        {error ? (
          <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        {isLoading ? (
          <div className="flex h-40 items-center justify-center">
            <p className="text-sm text-muted-foreground">
              Génération du QR code…
            </p>
          </div>
        ) : qrDataUrl ? (
          <>
            <p className="text-sm text-muted-foreground">
              Scannez ce QR code avec Google Authenticator, Authy ou une
              application compatible TOTP.
            </p>
            <div className="flex justify-center">
              <div className="rounded-xl border border-border bg-white p-3">
                <Image
                  src={qrDataUrl}
                  alt="QR code TOTP"
                  width={160}
                  height={160}
                  unoptimized
                />
              </div>
            </div>
            {secret ? (
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setShowSecret((v) => !v)}
                  className="text-xs text-muted-foreground underline underline-offset-2"
                >
                  {showSecret
                    ? "Masquer la clé manuelle"
                    : "Entrer la clé manuellement"}
                </button>
                {showSecret ? (
                  <p className="mt-2 rounded-lg bg-muted px-3 py-2 font-mono text-xs tracking-widest text-foreground">
                    {secret}
                  </p>
                ) : null}
              </div>
            ) : null}
          </>
        ) : null}

        <FormField
          control={form.control}
          name="code"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Code TOTP (6 chiffres)</FormLabel>
              <FormControl>
                <Input
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  className="h-11 rounded-lg text-center text-lg tracking-[0.4em]"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button
          type="submit"
          className="h-11 w-full"
          disabled={isSubmitting || isLoading}
        >
          {isSubmitting ? "Confirmation…" : "Confirmer et accéder au dashboard"}
        </Button>

        <button
          type="button"
          onClick={onBack}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Changer de méthode
        </button>
      </form>
    </Form>
  );
}
