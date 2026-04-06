import {
  Column,
  Heading,
  Hr,
  Row,
  Section,
  Text,
} from "@react-email/components";
import { createElement } from "react";
import { renderEmail } from "../render";
import { type DailyCouponProps, type DailyCouponLeg } from "../types";
import { EvCoreLayout } from "../components/evcore-layout";
import { palette } from "../components/palette";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatMarketLabel(market: string, comboMarket: string | null): string {
  const fmt = (m: string) => {
    if (m === "ONE_X_TWO") return "1X2";
    if (m === "OVER_UNDER" || m === "OVER_UNDER_25") return "O/U 2.5";
    if (m === "BTTS") return "BTTS";
    return m.replace(/_/g, " ");
  };
  return comboMarket ? `${fmt(market)} + ${fmt(comboMarket)}` : fmt(market);
}

function formatPick(leg: DailyCouponLeg): string {
  const fmt = (pick: string, market: string) => {
    if (market === "ONE_X_TWO") {
      if (pick === "HOME") return "Domicile";
      if (pick === "DRAW") return "Nul";
      if (pick === "AWAY") return "Extérieur";
    }
    if (market === "OVER_UNDER" || market === "OVER_UNDER_25") {
      if (pick === "OVER") return "Plus de 2.5";
      if (pick === "UNDER") return "Moins de 2.5";
    }
    if (market === "BTTS") {
      if (pick === "YES") return "Les deux marquent";
      if (pick === "NO") return "Non";
    }
    return pick;
  };
  const main = fmt(leg.pick, leg.market);
  if (leg.comboMarket && leg.comboPick) {
    return `${main} + ${fmt(leg.comboPick, leg.comboMarket)}`;
  }
  return main;
}

function formatDateTime(scheduledAt: string): string {
  // scheduledAt format: "2026-03-15 15:00 UTC"
  const parts = scheduledAt.split(" ");
  if (parts.length >= 2) {
    const date = parts[0] ?? "";
    const time = parts[1] ?? "";
    const [, month, day] = date.split("-");
    return `${day}/${month} · ${time}`;
  }
  return scheduledAt;
}

// ─── Tier badge ───────────────────────────────────────────────────────────────

type Tier = "PREMIUM" | "STANDARD" | "SPECULATIF";

const TIER_STYLES: Record<
  Tier,
  { bg: string; text: string; border: string; label: string }
> = {
  PREMIUM: {
    bg: "#2e1065",
    text: "#c4b5fd",
    border: "#7c3aed",
    label: "PREMIUM",
  },
  STANDARD: {
    bg: "#0c2040",
    text: "#7dd3fc",
    border: "#0284c7",
    label: "STANDARD",
  },
  SPECULATIF: {
    bg: "#422006",
    text: "#fde68a",
    border: "#d97706",
    label: "SPÉCULATIF",
  },
};

function TierBadge({ tier }: { tier: Tier }) {
  const style = TIER_STYLES[tier];
  return (
    <Text
      style={{
        display: "inline-block",
        backgroundColor: style.bg,
        color: style.text,
        border: `1px solid ${style.border}`,
        borderRadius: "999px",
        fontSize: "10px",
        fontWeight: "700",
        letterSpacing: "0.08em",
        padding: "2px 10px",
        margin: "0 0 16px",
      }}
    >
      {style.label}
    </Text>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = {
  header: {
    color: palette.status.success,
    fontSize: "20px",
    fontWeight: "700",
    margin: "0 0 2px",
  },
  subHeader: {
    color: palette.text.secondary,
    fontSize: "12px",
    margin: "0 0 8px",
  },
  // Summary pill row
  summaryRow: {
    backgroundColor: "#1e293b",
    borderRadius: "8px",
    border: `1px solid ${palette.border.default}`,
    padding: "10px 14px",
    marginBottom: "20px",
  },
  summaryItem: {
    color: palette.text.secondary,
    fontSize: "12px",
    margin: 0,
  },
  summaryValue: {
    color: palette.text.primary,
    fontSize: "14px",
    fontWeight: "700",
    margin: "2px 0 0",
  },
  summaryValueRight: {
    color: palette.status.caution,
    fontSize: "14px",
    fontWeight: "700",
    margin: "2px 0 0",
    textAlign: "right" as const,
  },
  // Per-leg
  legFixture: {
    color: palette.text.secondary,
    fontSize: "11px",
    margin: "0 0 1px",
  },
  legDateTime: {
    color: palette.text.label,
    fontSize: "11px",
    margin: 0,
    textAlign: "right" as const,
  },
  legMarket: {
    color: palette.text.label,
    fontSize: "10px",
    letterSpacing: "0.5px",
    margin: "6px 0 4px",
  },
  legPick: {
    color: palette.text.primary,
    fontSize: "16px",
    fontWeight: "700",
    margin: 0,
  },
  legOdds: {
    color: palette.text.primary,
    fontSize: "20px",
    fontWeight: "700",
    margin: 0,
    textAlign: "right" as const,
  },
  legEvBadge: {
    color: palette.status.success,
    fontSize: "11px",
    fontWeight: "600",
    margin: "2px 0 0",
    textAlign: "right" as const,
  },
  legSection: {
    padding: "14px 0",
  },
  // Footer
  footer: {
    color: palette.text.subtle,
    fontSize: "11px",
    margin: "16px 0 0",
    textAlign: "center" as const,
  },
} as const;

// ─── Leg component ────────────────────────────────────────────────────────────

function LegRow({ leg, index }: { leg: DailyCouponLeg; index: number }) {
  return (
    <Section style={s.legSection}>
      {/* Fixture + DateTime */}
      <Row>
        <Column>
          <Text style={s.legFixture}>
            ⚽ {leg.homeTeam} vs {leg.awayTeam}
          </Text>
        </Column>
        <Column style={{ width: "100px" }}>
          <Text style={s.legDateTime}>{formatDateTime(leg.scheduledAt)}</Text>
        </Column>
      </Row>

      {/* Market label */}
      <Text style={s.legMarket}>
        LEG {index + 1} · {formatMarketLabel(leg.market, leg.comboMarket)}
      </Text>

      {/* Pick (hero) + Odds */}
      <Row>
        <Column>
          <Text style={s.legPick}>{formatPick(leg)}</Text>
        </Column>
        <Column style={{ width: "80px" }}>
          <Text style={s.legOdds}>
            {leg.odds !== null ? leg.odds.toFixed(2) : "—"}
          </Text>
          <Text style={s.legEvBadge}>EV +{(leg.ev * 100).toFixed(1)}%</Text>
        </Column>
      </Row>
    </Section>
  );
}

// ─── Email ────────────────────────────────────────────────────────────────────

export function DailyCouponEmail({
  couponId,
  date,
  legCount,
  tier,
  legs,
}: DailyCouponProps) {
  const evAvg =
    legs.length > 0 ? legs.reduce((sum, l) => sum + l.ev, 0) / legs.length : 0;

  const combinedOdds = legs
    .filter((l) => l.odds !== null)
    .reduce((acc, l) => acc * (l.odds as number), 1);

  const allHaveOdds = legs.length > 0 && legs.every((l) => l.odds !== null);

  return (
    <EvCoreLayout
      preview={`EVCore ${date} — ${legCount} sélection${legCount !== 1 ? "s" : ""} — EV moy. +${(evAvg * 100).toFixed(1)}%`}
    >
      <Heading style={s.header}>Coupon du jour</Heading>
      <Text style={s.subHeader}>{date}</Text>
      {tier && <TierBadge tier={tier} />}

      {/* Summary row */}
      <Section style={s.summaryRow}>
        <Row>
          <Column>
            <Text style={s.summaryItem}>SÉLECTIONS</Text>
            <Text style={s.summaryValue}>{legCount}</Text>
          </Column>
          <Column style={{ textAlign: "center" as const }}>
            <Text style={{ ...s.summaryItem, textAlign: "center" as const }}>
              EV MOYEN
            </Text>
            <Text
              style={{
                ...s.summaryValue,
                textAlign: "center" as const,
                color: palette.status.success,
              }}
            >
              +{(evAvg * 100).toFixed(1)}%
            </Text>
          </Column>
          <Column style={{ textAlign: "right" as const }}>
            <Text style={{ ...s.summaryItem, textAlign: "right" as const }}>
              {allHaveOdds ? "COTE COMBINÉE" : "MISE / LEG"}
            </Text>
            <Text style={s.summaryValueRight}>
              {allHaveOdds ? combinedOdds.toFixed(2) : "1% bankroll"}
            </Text>
          </Column>
        </Row>
      </Section>

      {/* Legs */}
      {legs.map((leg, i) => (
        <div key={i}>
          <LegRow leg={leg} index={i} />
          {i < legs.length - 1 && (
            <Hr
              style={{
                borderColor: palette.border.default,
                margin: 0,
              }}
            />
          )}
        </div>
      ))}

      <Text style={s.footer}>
        Mise conseillée : 1% bankroll par sélection · Modèle EVCore
        {"\n"}Coupon #{couponId}
      </Text>
    </EvCoreLayout>
  );
}

export const renderDailyCoupon = (props: DailyCouponProps) =>
  renderEmail(createElement(DailyCouponEmail, props));

export default function DailyCouponEmailPreview() {
  return (
    <DailyCouponEmail
      couponId="preview-coupon-id"
      date="2026-03-14"
      legCount={3}
      legs={[
        {
          homeTeam: "Arsenal",
          awayTeam: "Chelsea",
          scheduledAt: "2026-03-15 15:00 UTC",
          market: "ONE_X_TWO",
          pick: "HOME",
          odds: 2.1,
          ev: 0.141,
          comboMarket: null,
          comboPick: null,
        },
        {
          homeTeam: "Inter",
          awayTeam: "Juventus",
          scheduledAt: "2026-03-15 20:45 UTC",
          market: "OVER_UNDER",
          pick: "OVER",
          odds: 1.85,
          ev: 0.092,
          comboMarket: null,
          comboPick: null,
        },
        {
          homeTeam: "Barcelona",
          awayTeam: "Atletico",
          scheduledAt: "2026-03-15 21:00 UTC",
          market: "ONE_X_TWO",
          pick: "HOME",
          odds: 3.2,
          ev: 0.113,
          comboMarket: "BTTS",
          comboPick: "YES",
        },
      ]}
    />
  );
}
