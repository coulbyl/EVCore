"use client";

import { useTranslations } from "next-intl";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@evcore/ui";
import type { InvestmentChannel } from "@/domains/investment/types/investment";
import { CHANNEL_FILTER_ORDER } from "./investment-constants";

const ALL = "all";

/**
 * Le canal est une COLONNE filtrable, pas un onglet — c'est tout l'écart
 * entre l'ancien Investir et le nouveau. Un onglet par canal promettait 18
 * surfaces également défendables ; un filtre dit qu'il y a une seule liste et
 * qu'on peut la restreindre.
 */
export function InvestmentChannelFilter({
  channel,
  onChange,
}: {
  channel: InvestmentChannel | null;
  onChange: (channel: InvestmentChannel | null) => void;
}) {
  const t = useTranslations("investment");
  const tChannels = useTranslations("decisions");

  return (
    <Select
      value={channel ?? ALL}
      onValueChange={(value) =>
        onChange(value === ALL ? null : (value as InvestmentChannel))
      }
    >
      <SelectTrigger aria-label={t("channelFilterLabel")} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{t("channelFilterAll")}</SelectItem>
        {CHANNEL_FILTER_ORDER.map((value) => (
          <SelectItem key={value} value={value}>
            {tChannels(`channels.${value}.label`)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
