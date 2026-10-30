"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  Button,
  Checkbox,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  PasswordInput,
} from "@evcore/ui";
import { register } from "@/domains/auth/use-cases/register";

const registerSchema = z.object({
  // Prénom, e-mail, mot de passe : plus de nom d'utilisateur, on se
  // connecte avec l'e-mail (refonte, 11 § 2).
  firstName: z
    .string()
    .trim()
    .min(1, "Indique ton prénom.")
    .max(50, "50 caractères max."),
  email: z.email("Cet e-mail n'est pas valide."),
  password: z
    .string()
    .min(8, "8 caractères minimum.")
    .max(128, "Mot de passe trop long."),
  // Les deux consentements sont exigés aussi côté serveur (RegisterDto),
  // qui garde leur date et la version des conditions acceptée.
  confirmAge: z
    .boolean()
    .refine((v) => v, "Tu dois confirmer avoir l'âge légal pour parier."),
  acceptTerms: z
    .boolean()
    .refine(
      (v) => v,
      "Tu dois accepter les conditions d'utilisation et la politique de confidentialité.",
    ),
});

type RegisterValues = z.infer<typeof registerSchema>;

export function RegisterForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      firstName: "",
      email: "",
      password: "",
      confirmAge: false,
      acceptTerms: false,
    },
    mode: "onTouched",
  });

  async function onSubmit(values: RegisterValues) {
    setError(null);
    setIsSubmitting(true);
    try {
      await register({
        firstName: values.firstName,
        email: values.email,
        password: values.password,
        // Validés par le schéma : on n'arrive ici que les deux cochés.
        confirmAge: true,
        acceptTerms: true,
      });
      // La vérification du compte (code par e-mail ou application
      // d'authentification) suit l'inscription, comme le formulaire
      // l'annonce : l'inscription menait jusqu'ici droit au tableau de bord
      // et le code promis n'arrivait jamais (audit du 2026-10-23, P2-3).
      router.push("/auth/verify");
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

        <div className="grid grid-cols-1 gap-4">
          <FormField
            control={form.control}
            name="firstName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Prénom</FormLabel>
                <FormControl>
                  <Input
                    autoComplete="given-name"
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
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>E-mail</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    autoComplete="email"
                    className="h-11"
                    {...field}
                  />
                </FormControl>
                {/* Dit avant l'envoi ce qui va se passer : l'inscription
                    mène à la vérification du compte (revue UX du 2026-10-11,
                    P2-17), désormais vraiment (audit du 2026-10-23, P2-3). */}
                <p className="text-xs leading-snug text-muted-foreground">
                  Juste après l&apos;inscription, tu sécurises ton compte : un
                  code à 6 chiffres envoyé à cette adresse, ou une application
                  d&apos;authentification.
                </p>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 gap-4">
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Mot de passe</FormLabel>
                <FormControl>
                  <PasswordInput
                    autoComplete="new-password"
                    placeholder="Au moins 8 caractères"
                    className="h-11"
                    {...field}
                  />
                </FormControl>
                {/* La seule règle est la longueur (8 à 128, même règle côté
                    serveur) : on le dit, et on conseille ce qui protège
                    vraiment — la longueur, pas la complexité. */}
                <p className="text-xs leading-snug text-muted-foreground">
                  Au moins 8 caractères. Une phrase longue et facile à retenir
                  protège mieux qu&apos;un mot compliqué.
                </p>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Consentements : âge légal, conditions et confidentialité (audit
            du 2026-10-23, P1-1). La bio, inutile au premier accès, reste
            modifiable dans le profil. */}
        <FormField
          control={form.control}
          name="confirmAge"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-start gap-3">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={(checked) =>
                      field.onChange(checked === true)
                    }
                    className="mt-0.5"
                  />
                </FormControl>
                <FormLabel className="text-sm font-normal leading-snug">
                  J&apos;ai 18 ans ou plus (21 ans ou plus si je réside au
                  Cameroun), ou l&apos;âge légal pour parier dans mon pays.
                </FormLabel>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="acceptTerms"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-start gap-3">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={(checked) =>
                      field.onChange(checked === true)
                    }
                    className="mt-0.5"
                  />
                </FormControl>
                <FormLabel className="text-sm font-normal leading-snug">
                  <span>
                    J&apos;accepte les{" "}
                    <Link
                      href="/cgu"
                      target="_blank"
                      className="text-accent underline"
                    >
                      conditions d&apos;utilisation
                    </Link>{" "}
                    et la{" "}
                    <Link
                      href="/confidentialite"
                      target="_blank"
                      className="text-accent underline"
                    >
                      politique de confidentialité
                    </Link>
                    .
                  </span>
                </FormLabel>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <p className="text-xs leading-snug text-muted-foreground">
          Parier comporte des risques de perte. EVCore ne prend aucune mise et
          ne vend pas de coupons.
        </p>

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
