"use client";

import { useState } from "react";
import Link from "next/link";
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
import { requestPasswordReset } from "@/domains/auth/use-cases/password-reset";

const schema = z.object({
  identifier: z.string().min(3, "Renseignez votre email ou nom d'utilisateur."),
});

type Values = z.infer<typeof schema>;

export function ForgotPasswordForm() {
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { identifier: "" },
    mode: "onTouched",
  });

  async function onSubmit(values: Values) {
    setIsSubmitting(true);
    try {
      await requestPasswordReset(values.identifier);
    } finally {
      setSubmitted(true);
      setIsSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="flex flex-col gap-4">
        <div className="rounded-lg border border-border bg-muted/50 px-4 py-3 text-sm text-foreground">
          Si un compte avec cet identifiant existe et dispose d'un email
          vérifié, vous recevrez un lien dans les prochaines minutes.
        </div>
        <p className="text-sm text-muted-foreground">
          Pas d&apos;email ?{" "}
          <Link
            href="/auth/forgot-password/totp"
            className="text-accent hover:underline"
          >
            Réinitialiser avec une app TOTP
          </Link>
        </p>
        <Link
          href="/auth/login"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Retour à la connexion
        </Link>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form
        className="flex flex-col gap-4"
        onSubmit={form.handleSubmit(onSubmit)}
      >
        <FormField
          control={form.control}
          name="identifier"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email ou nom d&apos;utilisateur</FormLabel>
              <FormControl>
                <Input
                  autoComplete="username"
                  className="h-11 rounded-lg"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="h-11 w-full" disabled={isSubmitting}>
          {isSubmitting ? "Envoi…" : "Envoyer un lien de réinitialisation"}
        </Button>

        <div className="flex flex-col gap-2 text-sm">
          <Link
            href="/auth/forgot-password/totp"
            className="text-accent hover:underline"
          >
            Réinitialiser avec une app TOTP →
          </Link>
          <Link
            href="/auth/login"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Retour à la connexion
          </Link>
        </div>
      </form>
    </Form>
  );
}
