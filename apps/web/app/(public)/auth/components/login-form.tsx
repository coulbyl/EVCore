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

const loginSchema = z.object({
  identifier: z
    .string()
    .trim()
    .min(1, "Renseignez votre email ou votre username."),
  password: z.string().min(1, "Renseignez votre mot de passe."),
});

type LoginValues = z.infer<typeof loginSchema>;

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: "", password: "" },
    mode: "onTouched",
  });

  async function onSubmit(values: LoginValues) {
    setError(null);
    setIsSubmitting(true);

    try {
      await login({ identifier: values.identifier, password: values.password });
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Identifiants invalides.");
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
                  className="h-11 rounded-lg border-border bg-background text-sm text-foreground"
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
              <FormLabel>Mot de passe</FormLabel>
              <FormControl>
                <PasswordInput
                  autoComplete="current-password"
                  className="h-11 rounded-lg border-border bg-background text-sm text-foreground"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button
          type="submit"
          className="h-11 w-full justify-center rounded-lg"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Connexion..." : "Se connecter"}
        </Button>

        <p className="text-sm text-muted-foreground">
          Pas encore de compte ?{" "}
          <Link href="/auth/register" className="font-medium text-accent">
            Créer un compte
          </Link>
        </p>
      </form>
    </Form>
  );
}
