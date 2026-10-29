import { useTranslations } from "next-intl";
import { cn } from "@evcore/ui/cn";

/**
 * « 18+ · Parier comporte des risques de perte », en pied de chaque écran du
 * joueur (10-transverse.md § 5). Toujours la même, jamais masquée, jamais
 * plus grande.
 */
export function LegalLine({ className }: { className?: string }) {
  const t = useTranslations("shell");
  return (
    <p
      className={cn(
        "px-4 py-4 text-center text-legal text-muted-foreground",
        className,
      )}
    >
      {t("legal")}
    </p>
  );
}
