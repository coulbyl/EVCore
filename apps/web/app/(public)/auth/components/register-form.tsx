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
  Textarea,
} from "@evcore/ui";
import { register } from "@/domains/auth/use-cases/register";

const registerSchema = z.object({
  email: z.email("Cet email n’est pas valide."),
  username: z
    .string()
    .trim()
    .min(3, "Choisissez un nom d’utilisateur (au moins 3 caractères).")
    .max(32, "Nom d’utilisateur trop long (32 caractères max).")
    .regex(
      /^[a-zA-Z0-9_]+$/,
      "Le nom d’utilisateur doit contenir uniquement des lettres, chiffres ou _.",
    ),
  fullName: z
    .string()
    .trim()
    .min(2, "Renseignez votre nom complet.")
    .max(80, "Nom complet trop long (80 caractères max)."),
  password: z
    .string()
    .min(8, "Mot de passe trop court (8 caractères minimum).")
    .max(128, "Mot de passe trop long."),
  bio: z
    .string()
    .trim()
    .max(280, "Bio trop longue (280 caractères max).")
    .optional()
    .or(z.literal("")),
});

type RegisterValues = z.infer<typeof registerSchema>;

export function RegisterForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: "",
      username: "",
      fullName: "",
      password: "",
      bio: "",
    },
    mode: "onTouched",
  });

  async function onSubmit(values: RegisterValues) {
    setError(null);
    setIsSubmitting(true);

    try {
      await register({
        email: values.email,
        username: values.username,
        fullName: values.fullName,
        password: values.password,
        bio: values.bio?.trim() ? values.bio.trim() : undefined,
      });
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Impossible de créer le compte.",
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
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  autoComplete="email"
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
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nom d&apos;utilisateur</FormLabel>
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
          name="fullName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nom complet</FormLabel>
              <FormControl>
                <Input
                  autoComplete="name"
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
                  autoComplete="new-password"
                  placeholder="8 caractères minimum"
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
          name="bio"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Bio</FormLabel>
              <FormControl>
                <Textarea
                  rows={3}
                  placeholder="Optionnel"
                  className="rounded-lg border-border bg-background text-sm text-foreground focus-visible:ring-accent/40"
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
          {isSubmitting ? "Création..." : "Créer un compte"}
        </Button>

        <p className="text-sm text-muted-foreground">
          Déjà inscrit ?{" "}
          <Link href="/auth/login" className="font-medium text-accent">
            Se connecter
          </Link>
        </p>
      </form>
    </Form>
  );
}
