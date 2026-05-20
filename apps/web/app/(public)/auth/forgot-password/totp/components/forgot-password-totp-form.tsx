"use client";

import { useState } from "react";
import Link from "next/link";
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
  PasswordInput,
} from "@evcore/ui";
import { resetPasswordWithTotp } from "@/domains/auth/use-cases/password-reset";

const schema = z
  .object({
    identifier: z
      .string()
      .min(3, "Renseignez votre email ou nom d'utilisateur."),
    totpCode: z
      .string()
      .length(6, "Le code doit contenir exactement 6 chiffres.")
      .regex(/^\d{6}$/, "Le code ne contient que des chiffres."),
    newPassword: z
      .string()
      .min(8, "Mot de passe trop court (8 caractères minimum).")
      .max(128, "Mot de passe trop long."),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Les mots de passe ne correspondent pas.",
    path: ["confirmPassword"],
  });

type Values = z.infer<typeof schema>;

export function ForgotPasswordTotpForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      identifier: "",
      totpCode: "",
      newPassword: "",
      confirmPassword: "",
    },
    mode: "onTouched",
  });

  async function onSubmit(values: Values) {
    setError(null);
    setIsSubmitting(true);
    try {
      await resetPasswordWithTotp(
        values.identifier,
        values.totpCode,
        values.newPassword,
      );
      router.push("/auth/login?reset=totp");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Code invalide ou identifiant introuvable.",
      );
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

        <FormField
          control={form.control}
          name="newPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nouveau mot de passe</FormLabel>
              <FormControl>
                <PasswordInput
                  autoComplete="new-password"
                  placeholder="8 caractères minimum"
                  className="h-11 rounded-lg"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="confirmPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Confirmer le mot de passe</FormLabel>
              <FormControl>
                <PasswordInput
                  autoComplete="new-password"
                  className="h-11 rounded-lg"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="totpCode"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Code de votre application (6 chiffres)</FormLabel>
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

        <Button type="submit" className="h-11 w-full" disabled={isSubmitting}>
          {isSubmitting ? "Réinitialisation…" : "Réinitialiser le mot de passe"}
        </Button>

        <Link
          href="/auth/login"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Retour à la connexion
        </Link>
      </form>
    </Form>
  );
}
