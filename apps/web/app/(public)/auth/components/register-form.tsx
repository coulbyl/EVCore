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
  email: z.email("Cet email n'est pas valide."),
  username: z
    .string()
    .trim()
    .min(3, "Au moins 3 caractères.")
    .max(32, "32 caractères max.")
    .regex(/^[a-zA-Z0-9_]+$/, "Lettres, chiffres ou _ uniquement."),
  fullName: z
    .string()
    .trim()
    .min(2, "Renseignez votre nom complet.")
    .max(80, "80 caractères max."),
  password: z
    .string()
    .min(8, "8 caractères minimum.")
    .max(128, "Mot de passe trop long."),
  bio: z
    .string()
    .trim()
    .max(280, "280 caractères max.")
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
          <div className="rounded-xl border border-destructive/20 bg-destructive/8 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        {/* Email + Username */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
            name="username"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nom d&apos;utilisateur</FormLabel>
                <FormControl>
                  <Input autoComplete="username" className="h-11" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Full name + Password */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="fullName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nom complet</FormLabel>
                <FormControl>
                  <Input autoComplete="name" className="h-11" {...field} />
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
                    className="h-11"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Bio — full width, optional */}
        <FormField
          control={form.control}
          name="bio"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Bio{" "}
                <span className="text-[0.72rem] font-normal text-muted-foreground">
                  — optionnel
                </span>
              </FormLabel>
              <FormControl>
                <Textarea
                  rows={2}
                  placeholder="Quelques mots sur vous"
                  className="resize-none"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="h-11 w-full" disabled={isSubmitting}>
          {isSubmitting ? "Création…" : "Créer un compte"}
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          Déjà inscrit ?{" "}
          <Link href="/auth/login" className="font-medium text-accent">
            Se connecter
          </Link>
        </p>
      </form>
    </Form>
  );
}
