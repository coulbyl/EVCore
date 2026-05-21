"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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
  PasswordInput,
} from "@evcore/ui";
import { resetPassword } from "@/domains/auth/use-cases/password-reset";

const schema = z
  .object({
    newPassword: z
      .string()
      .min(8, "8 caractères minimum.")
      .max(128, "Mot de passe trop long."),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Les mots de passe ne correspondent pas.",
    path: ["confirmPassword"],
  });

type Values = z.infer<typeof schema>;

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { newPassword: "", confirmPassword: "" },
    mode: "onTouched",
  });

  if (!token) {
    return (
      <div className="flex flex-col gap-4">
        <div className="rounded-xl border border-destructive/20 bg-destructive/8 px-4 py-3 text-sm text-destructive">
          Lien invalide ou manquant.
        </div>
        <Link
          href="/auth/forgot-password"
          className="text-sm text-accent hover:underline"
        >
          Demander un nouveau lien →
        </Link>
      </div>
    );
  }

  async function onSubmit(values: Values) {
    if (!token) return;
    setError(null);
    setIsSubmitting(true);
    try {
      await resetPassword(token, values.newPassword);
      router.push("/auth/login?reset=success");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Lien invalide ou expiré. Demandez un nouveau lien.",
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
          <div className="rounded-xl border border-destructive/20 bg-destructive/8 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

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
                  className="h-11"
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
                  className="h-11"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="h-11 w-full" disabled={isSubmitting}>
          {isSubmitting
            ? "Réinitialisation…"
            : "Définir le nouveau mot de passe"}
        </Button>
      </form>
    </Form>
  );
}
