"use client";

import {
  Badge,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@evcore/ui";
import { useTranslations } from "next-intl";
import {
  fixtureStatusLabel,
  formatCombinedPickForDisplay,
} from "@/helpers/fixture";
import { formatScore } from "@/domains/fixture/helpers/fixture";
import type {
  FixtureEvaluatedPickSnapshot,
  FixtureRow,
} from "@/domains/fixture/types/fixture";
import {
  FixtureFactorBar,
  type FixtureFactorDef,
} from "@/components/fixture-factor-bar";

/**
 * Diagnostic brut d'un match, réservé aux admins depuis le 2026-10-27 :
 * facteurs, buts attendus et toutes les lectures évaluées avec leur EV et
 * leur motif. Le joueur a sa fiche de match, ouverte depuis Décisions.
 *
 * Retirés le même jour (revue UX, Matchs P1-1 à P1-3) : le panier, qui
 * ajoutait au coupon n'importe quelle ligne, y compris d'un marché suspendu
 * ou rejetée ; le bloc « pari retenu », « Prob. estimée » et « Valeur (EV) »,
 * lus dans la table `bet` vide depuis le 04/09 ; les couleurs vert/rouge de
 * l'EV, qui le présentaient comme un signal de qualité alors qu'il est
 * anti-prédictif (CLAUDE.md).
 */

type BadgeVariant = "accent" | "warning" | "destructive" | "neutral";
type Translator = ReturnType<typeof useTranslations>;

function fixtureStatusTone(status: string): BadgeVariant {
  const s = status.toLowerCase();
  if (s === "finished") return "neutral";
  if (s === "in_progress") return "accent";
  if (s === "postponed" || s === "cancelled") return "destructive";
  return "warning";
}

function formatEv(raw: string): string {
  const v = parseFloat(raw);
  if (Number.isNaN(v)) return raw;
  return `${v >= 0 ? "+" : ""}${(v * 100).toFixed(1)}%`;
}

function rejectionLabel(reason: string | undefined, t: Translator): string {
  if (!reason) return "—";
  const key = `rejection.${reason}` as const;
  return t.has(key) ? t(key) : reason;
}

function EvaluatedPickItem({
  snap,
  t,
}: {
  snap: FixtureEvaluatedPickSnapshot;
  t: Translator;
}) {
  const prob = `${(Number(snap.probability) * 100).toFixed(1)}%`;
  return (
    <div className="border-b border-border py-2.5 last:border-b-0">
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 truncate text-sm font-semibold text-foreground">
          {formatCombinedPickForDisplay(snap)}
        </p>
        <Badge variant="neutral" className="shrink-0 rounded-full">
          {snap.status === "viable"
            ? t("table.viable")
            : rejectionLabel(snap.rejectionReason, t)}
        </Badge>
      </div>
      <p className="mt-1 flex flex-wrap gap-x-3 text-xs tabular-nums text-muted-foreground">
        <span>
          {t("table.probability")} {prob}
        </span>
        <span>
          {t("table.odds")} {snap.odds}
        </span>
        <span>EV {formatEv(snap.ev)}</span>
      </p>
    </div>
  );
}

export function FixtureDiagnostics({ row }: { row: FixtureRow }) {
  const t = useTranslations("fixtureDiagnostics");
  const mr = row.modelRun;
  const score = formatScore(row.score, row.htScore);
  const factorDefs: FixtureFactorDef[] = [
    {
      key: "recentForm",
      label: t("factors.recentForm"),
      kind: "directional",
      hint: t("factorHints.recentForm"),
    },
    {
      key: "xg",
      label: t("factors.xg"),
      kind: "directional",
      hint: t("factorHints.xg"),
    },
    {
      key: "performanceDomExt",
      label: t("factors.performanceDomExt"),
      kind: "directional",
      hint: t("factorHints.performanceDomExt"),
    },
    {
      key: "volatiliteLigue",
      label: t("factors.volatiliteLigue"),
      kind: "absolute",
      hint: t("factorHints.volatiliteLigue"),
    },
  ];

  if (!mr) {
    return (
      <Empty className="rounded-3xl border border-dashed border-border bg-panel/70 p-8">
        <EmptyHeader>
          <EmptyTitle>{t("empty.title")}</EmptyTitle>
          <EmptyDescription>{t("empty.description")}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const hasFactors =
    mr.factors && Object.values(mr.factors).some((v) => v !== null);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-3 border-b border-border pb-4">
        <div className="min-w-0">
          <p className="text-base font-semibold leading-tight text-foreground sm:text-lg">
            {row.fixture}
          </p>
          {score && (
            <p className="mt-1 text-sm font-medium text-foreground">{score}</p>
          )}
        </div>
        <Badge variant={fixtureStatusTone(row.status)} className="shrink-0">
          {fixtureStatusLabel(row.status)}
        </Badge>
      </div>

      {hasFactors && mr.factors && (
        <section className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            {t("sections.factors")}
          </h3>
          {factorDefs.map((f) => (
            <FixtureFactorBar
              key={f.key}
              label={f.label}
              value={mr.factors![f.key]}
              kind={f.kind}
              hint={f.hint}
            />
          ))}
        </section>
      )}

      {(mr.lambdaHome !== null || mr.lambdaAway !== null) && (
        <p className="text-sm text-muted-foreground">
          λ {mr.lambdaHome ?? "?"} / {mr.lambdaAway ?? "?"}
          {mr.expectedTotalGoals
            ? ` · ${mr.expectedTotalGoals} ${t("predictionSummary.expectedGoals")}`
            : null}
        </p>
      )}

      {mr.evaluatedPicks.length > 0 && (
        <section className="flex flex-col">
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            {t("sections.analyzedMarkets")} ({mr.evaluatedPicks.length})
          </h3>
          {mr.evaluatedPicks.map((snap) => (
            <EvaluatedPickItem
              key={`${snap.market}:${snap.pick}`}
              snap={snap}
              t={t}
            />
          ))}
        </section>
      )}
    </div>
  );
}
