import type {
  PromotionVerdict,
  PromotionWindow,
} from "@/domains/reports/types/reports";

type BadgeVariant =
  | "success"
  | "warning"
  | "destructive"
  | "neutral"
  | "outline";

export const VERDICT_META: Record<
  PromotionVerdict,
  { label: string; variant: BadgeVariant; hint: string }
> = {
  GO: {
    label: "GO",
    variant: "success",
    hint: "La correction bat la baseline (calibration + ROI) sur un échantillon suffisant.",
  },
  WATCH: {
    label: "WATCH",
    variant: "warning",
    hint: "Direction correcte mais fragile — continuer l'observation.",
  },
  NO_GO: {
    label: "NO-GO",
    variant: "destructive",
    hint: "La correction dégrade la calibration vs baseline — ne pas promouvoir.",
  },
  INSUFFICIENT: {
    label: "Données insuffisantes",
    variant: "neutral",
    hint: "Pas encore assez de picks settlés et comparables sur la fenêtre.",
  },
  META_ONLY: {
    label: "Méta uniquement",
    variant: "outline",
    hint: "Canal prédiction — pas de correction shadow par pick. Métriques d'entraînement seules.",
  },
};

export const WINDOW_OPTIONS: { value: PromotionWindow; label: string }[] = [
  { value: "P7D", label: "7 jours" },
  { value: "P30D", label: "30 jours" },
  { value: "P90D", label: "90 jours" },
  { value: "SINCE_ACTIVATION", label: "Depuis activation" },
];

export function fmtPct(n: number | null | undefined, decimals = 1): string {
  if (n === null || n === undefined) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${(n * 100).toFixed(decimals)}%`;
}

export function fmtNum(n: number | null | undefined, decimals = 3): string {
  if (n === null || n === undefined) return "—";
  return n.toFixed(decimals);
}

export function fmtDateTime(iso: string | null): string {
  if (iso === null) return "—";
  return new Date(iso).toLocaleString("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}
