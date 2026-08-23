"use client";

import { useTranslations } from "next-intl";
import { ScrollableTabs } from "@/components/scrollable-tabs";
import {
  INVESTMENT_VIEWS,
  type InvestmentView,
} from "@/domains/investment/types/investment";

/**
 * Trois vues, pas dix-huit onglets.
 *
 * Les 18 modes (un par canal) donnaient la même autorité visuelle à des
 * canaux dont 16 sur 18 sont mesurés perdants, et laissaient l'utilisateur
 * choisir entre 18 listes sans qu'aucune ne lui dise laquelle vaut quelque
 * chose. Voir docs/audit-canaux-investir-2026-08-22.md §4.3 et §5.2.
 */
export function InvestmentViewToggle({
  view,
  onChange,
}: {
  view: InvestmentView;
  onChange: (view: InvestmentView) => void;
}) {
  const t = useTranslations("investment");

  const items = INVESTMENT_VIEWS.map((value) => ({
    value,
    label: t(`views.${value}.label`),
  }));

  return <ScrollableTabs value={view} onValueChange={onChange} items={items} />;
}
