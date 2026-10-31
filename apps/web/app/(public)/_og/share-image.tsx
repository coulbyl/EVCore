import { ImageResponse } from "next/og";
import { createTranslator } from "next-intl";
import messages from "@/messages/fr.json";
import { getPublicToday } from "@/domains/public/use-cases/get-public-today";
import type { PublicHero } from "@/domains/public/types/public";
import {
  chanceOf,
  formatOdds,
  formatShortDate,
  DEFAULT_TIME_ZONE,
  ledsOf,
  type Chance,
} from "@/helpers/scoreboard-format";
import { legPickLabel } from "../../(player)/today/components/today-constants";

/**
 * Image de partage (WhatsApp, Facebook, X) des pages publiques (11 § 1) :
 * le héros du jour en image — le produit, le match, le pari et sa cote, la
 * chance et ses diodes — et la ligne 18+, régénérée avec le héros. Sans
 * héros (jour vide, serveur muet) : la phrase de marque seule.
 *
 * Jamais de donnée de compte (audit du 2026-10-23, P1-4 : l'ancienne image
 * montrait un solde et un fondateur). En français : le lien circule sur
 * WhatsApp, l'appareil qui le reçoit n'a pas dit sa langue. Les textes
 * viennent du fichier de messages, pas de la requête : l'image ne dépend
 * d'aucun cookie et se sert statique, régénérée à la minute.
 *
 * Police par défaut d'ImageResponse : le moteur ne lit pas le woff2 des
 * polices Barlow.
 */
export const shareImageAlt =
  "EVCore — le pari du jour, sa cote et sa chance, compté et daté. 18+ (21+ au Cameroun).";
export const shareImageSize = { width: 1200, height: 630 };

const LOOK = {
  ink: "#0e1320",
  text: "#ffffff",
  muted: "#9aa3b2",
  rule: "#2a3142",
  amber: "#ffb300",
} as const;

/** Beyond three matches, « + 2 matchs »: the image stays readable. */
const SHOWN_LEGS = 3;

export async function renderShareImage(): Promise<ImageResponse> {
  const today = await getPublicToday();
  const t = createTranslator({ locale: "fr", messages, namespace: "today" });
  const chanceText = createTranslator({
    locale: "fr",
    messages,
    namespace: "scoreboard.chance",
  });
  const shell = createTranslator({
    locale: "fr",
    messages,
    namespace: "shell",
  });
  const landing = createTranslator({
    locale: "fr",
    messages,
    namespace: "landing",
  });
  const hero = today?.hero ?? null;
  const date = today
    ? formatShortDate(
        new Date(`${today.date}T12:00:00Z`),
        "fr",
        DEFAULT_TIME_ZONE,
      )
    : null;

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "56px 72px",
        background: LOOK.ink,
        color: LOOK.text,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            fontSize: 40,
            fontWeight: 800,
          }}
        >
          {/* The EVCore mark (shell/brand-mark.tsx), drawn for Satori. */}
          <svg width="44" height="44" viewBox="0 0 24 24" fill={LOOK.text}>
            <rect x="3" y="13" width="4" height="8" rx="1" />
            <rect x="10" y="9" width="4" height="12" rx="1" />
            <rect
              x="17"
              y="10.5"
              width="4"
              height="10.5"
              rx="1"
              opacity="0.55"
            />
            <circle cx="12" cy="4.5" r="2.5" fill="#f5b400" />
          </svg>
          EVCore
        </div>
        {date ? (
          <div style={{ display: "flex", fontSize: 28, color: LOOK.muted }}>
            {date}
          </div>
        ) : null}
      </div>

      {hero ? (
        <HeroBlock
          hero={hero}
          product={t(`products.${hero.product}`)}
          chance={
            hero.chance !== null ? chanceLine(hero.chance, chanceText) : null
          }
          matchesLabel={(count) => t("matches", { count })}
        />
      ) : (
        <div
          style={{
            display: "flex",
            fontSize: 72,
            fontWeight: 800,
            lineHeight: 1.1,
            maxWidth: 1000,
          }}
        >
          {landing("brandLine")}
        </div>
      )}

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          borderTop: `2px solid ${LOOK.rule}`,
          paddingTop: 20,
          fontSize: 26,
          color: LOOK.muted,
        }}
      >
        {hero ? (
          <div style={{ display: "flex" }}>{landing("brandLine")}</div>
        ) : null}
        <div style={{ display: "flex" }}>{shell("legal")}</div>
      </div>
    </div>,
    shareImageSize,
  );
}

type ChanceTranslate = ReturnType<
  typeof createTranslator<typeof messages, "scoreboard.chance">
>;

type ChanceLine = { text: string; leds: { lit: number; total: number } | null };

function chanceLine(
  probability: number,
  t: ChanceTranslate,
): ChanceLine | null {
  const chance = chanceOf(probability);
  if (!chance) return null;
  return { text: written(chance, t), leds: ledsOf(chance) };
}

function written(chance: Chance, t: ChanceTranslate): string {
  switch (chance.kind) {
    case "outOfTen":
      return t("outOfTen", { count: chance.count, total: chance.total });
    case "oneIn":
      return t("oneIn", { total: chance.total });
    case "rarerThan":
      return t("rarerThan", { total: chance.total });
  }
}

/** The hero: one match in large, a combo as its first matches. */
function HeroBlock({
  hero,
  product,
  chance,
  matchesLabel,
}: {
  hero: PublicHero;
  product: string;
  chance: ChanceLine | null;
  matchesLabel: (count: number) => string;
}) {
  const single = hero.legs.length === 1 ? hero.legs[0] : undefined;
  const hidden = hero.legs.length - SHOWN_LEGS;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", fontSize: 34, color: LOOK.amber }}>
        {product}
      </div>
      {single ? (
        <div
          style={{
            display: "flex",
            fontSize: 64,
            fontWeight: 800,
            lineHeight: 1.05,
          }}
        >
          {single.home.name} – {single.away.name}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {hero.legs.slice(0, SHOWN_LEGS).map((leg) => (
            <div
              key={leg.fixtureId}
              style={{ display: "flex", fontSize: 36, fontWeight: 700 }}
            >
              {leg.home.name} – {leg.away.name}
            </div>
          ))}
          {hidden > 0 ? (
            <div style={{ display: "flex", fontSize: 28, color: LOOK.muted }}>
              + {matchesLabel(hidden)}
            </div>
          ) : null}
        </div>
      )}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          fontSize: 40,
        }}
      >
        <div style={{ display: "flex" }}>
          {single ? legPickLabel(single) : matchesLabel(hero.legs.length)}
        </div>
        {hero.odds !== null ? (
          <div style={{ display: "flex", fontSize: 56, fontWeight: 800 }}>
            {formatOdds(hero.odds, "fr")}
          </div>
        ) : null}
      </div>
      {chance ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", gap: 12 }}>
            {chance.leds
              ? Array.from({ length: chance.leds.total }, (_, i) => (
                  <div
                    key={i}
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 13,
                      background:
                        i < (chance.leds?.lit ?? 0) ? LOOK.amber : LOOK.rule,
                    }}
                  />
                ))
              : null}
          </div>
          <div style={{ display: "flex", fontSize: 48, fontWeight: 800 }}>
            {chance.text}
          </div>
        </div>
      ) : null}
    </div>
  );
}
