"use client";

import { useTranslations } from "next-intl";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@evcore/ui";
import type {
  SubscriptionSourceDef,
  SubscriptionSourceType,
} from "@/domains/subscriptions/types/subscriptions";
import { sourceLabel } from "../subscriptions-constants";

function formatRoi(roi: number): string {
  return `${roi >= 0 ? "+" : "−"}${Math.abs(roi * 100).toFixed(1)}%`;
}

/**
 * Le choix de la source, groupé par ce qui est mesuré dessus.
 *
 * Le catalogue proposait ses sept canaux à égalité visuelle alors que cinq
 * sont mesurés perdants — le même défaut qu'Investir avait avec ses 18
 * onglets, et la même correction : on ne masque rien, on arrête de présenter
 * comme équivalent ce qui ne l'est pas. Le ROI accompagne chaque canal, parce
 * qu'un nom de canal seul ne dit rien de ce à quoi on s'engage.
 *
 * Les groupes sont dérivés du `tier` renvoyé par le serveur, lui-même
 * recalculé à chaque appel : un canal qui repasse au-dessus de zéro remonte
 * tout seul.
 */
export function SubscriptionSourceSelect({
  sources,
  value,
  onChange,
}: {
  sources: SubscriptionSourceDef[];
  value: SubscriptionSourceType | null;
  onChange: (value: SubscriptionSourceType) => void;
}) {
  const t = useTranslations("subscriptions");

  const coupons = sources.filter((s) => s.kind === "COUPON");
  const backed = sources.filter(
    (s) => s.kind === "CHANNEL" && s.tier === "BACKED",
  );
  const watch = sources.filter(
    (s) => s.kind === "CHANNEL" && s.tier === "WATCH",
  );

  function renderItem(source: SubscriptionSourceDef) {
    return (
      <SelectItem key={source.id} value={source.id}>
        <span className="flex w-full items-center gap-2">
          <span>{sourceLabel(source.id, t)}</span>
          {source.roiShrunk !== null && (
            <span
              className={
                source.roiShrunk >= 0
                  ? "text-[0.68rem] tabular-nums text-success"
                  : "text-[0.68rem] tabular-nums text-warning"
              }
            >
              {formatRoi(source.roiShrunk)}
            </span>
          )}
        </span>
      </SelectItem>
    );
  }

  return (
    <Select value={value ?? undefined} onValueChange={onChange}>
      <SelectTrigger className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {coupons.length > 0 && (
          <SelectGroup>
            <SelectLabel>{t("form.sourceGroupCoupon")}</SelectLabel>
            {coupons.map(renderItem)}
          </SelectGroup>
        )}
        {backed.length > 0 && (
          <SelectGroup>
            <SelectLabel>{t("form.sourceGroupBacked")}</SelectLabel>
            {backed.map(renderItem)}
          </SelectGroup>
        )}
        {watch.length > 0 && (
          <SelectGroup>
            <SelectLabel>{t("form.sourceGroupWatch")}</SelectLabel>
            {watch.map(renderItem)}
          </SelectGroup>
        )}
      </SelectContent>
    </Select>
  );
}
