"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
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
  PasswordInput,
} from "@evcore/ui";
import { login } from "@/domains/auth/use-cases/login";
import { safeNextPath } from "@/domains/auth/helpers/safe-next-path";
import { LoginTotpStep } from "./login-totp-step";

const loginSchema = z.object({
  identifier: z.string().trim().min(1, "Indique ton e-mail."),
  password: z.string().min(1, "Indique ton mot de passe."),
});

type LoginValues = z.infer<typeof loginSchema>;

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [challenge, setChallenge] = useState<string | null>(null);

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: "", password: "" },
    mode: "onTouched",
  });

  function goToNext() {
    // L'écran demandé avant la connexion (proxy.ts), s'il est interne.
    const next = safeNextPath(
      new URLSearchParams(window.location.search).get("next"),
    );
    router.push(next ?? "/dashboard");
    router.refresh();
  }

  async function onSubmit(values: LoginValues) {
    setError(null);
    setIsSubmitting(true);
    try {
      const result = await login({
        identifier: values.identifier,
        password: values.password,
      });
      if (result.kind === "totp") {
        setChallenge(result.challenge);
        return;
      }
      goToNext();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "E-mail ou mot de passe incorrect.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (challenge) {
    return (
      <LoginTotpStep
        challenge={challenge}
        onSignedIn={goToNext}
        onBack={() => setChallenge(null)}
      />
    );
  }

  return (
    <Form {...form}>
      <form
        className="flex flex-col gap-5"
        onSubmit={form.handleSubmit(onSubmit)}
      >
        {error ? (
          <div className="rounded-xl border border-destructive/20 bg-destructive/8 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <FormField
          control={form.control}
          name="identifier"
          render={({ field }) => (
            <FormItem>
              <FormLabel>E-mail</FormLabel>
              <FormControl>
                <Input
                  inputMode="email"
                  autoComplete="email"
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
          name="password"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center justify-between">
                <FormLabel>Mot de passe</FormLabel>
                <Link
                  href="/auth/forgot-password"
                  className="text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  Mot de passe oublié ?
                </Link>
              </div>
              <FormControl>
                <PasswordInput
                  autoComplete="current-password"
                  className="h-11"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="h-11 w-full" disabled={isSubmitting}>
          {isSubmitting ? "Connexion…" : "Se connecter"}
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          Pas encore de compte ?{" "}
          <Link href="/auth/register" className="font-medium text-accent">
            Créer un compte
          </Link>
        </p>
      </form>
    </Form>
  );
}
