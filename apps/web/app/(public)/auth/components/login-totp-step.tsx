"use client";

import { useState } from "react";
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
import { loginWithTotp } from "@/domains/auth/use-cases/login";

const codeSchema = z.object({
  code: z.string().regex(/^\d{6}$/, "Six chiffres."),
});

type CodeValues = z.infer<typeof codeSchema>;

/** L'écran de plus quand le compte a une application (11 § 3). */
export function LoginTotpStep({
  challenge,
  onSignedIn,
  onBack,
}: {
  challenge: string;
  onSignedIn: () => void;
  onBack: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<CodeValues>({
    resolver: zodResolver(codeSchema),
    defaultValues: { code: "" },
  });

  async function onSubmit(values: CodeValues) {
    setError(null);
    setIsSubmitting(true);
    try {
      await loginWithTotp({ challenge, code: values.code });
      onSignedIn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Code incorrect.");
      form.resetField("code");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form
        className="flex flex-col gap-5"
        onSubmit={form.handleSubmit(onSubmit)}
      >
        <FormField
          control={form.control}
          name="code"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Le code de ton application</FormLabel>
              <FormControl>
                <Input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoFocus
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

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <Button type="submit" className="h-11 w-full" disabled={isSubmitting}>
          {isSubmitting ? "Connexion…" : "Se connecter"}
        </Button>

        <button
          type="button"
          onClick={onBack}
          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          ← Revenir à l&apos;e-mail et au mot de passe
        </button>
      </form>
    </Form>
  );
}
