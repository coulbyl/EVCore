"use client";

import { AlertCircle, Users } from "lucide-react";
import {
  useRetention,
  type RetentionView,
} from "@/domains/dashboard/use-cases/get-retention";

// Seuils du plan du 2026-10-23, avant toute offre payante.
const ACTIVATION_TARGET = 0.4;
const D14_TARGET = 0.3;
const SIGNUPS_TARGET = 300;

const NOTIFICATION_LABEL: Record<string, string> = {
  MORNING_BRIEF: "Matinée",
  WEEKLY_STATEMENT: "Relevé du lundi",
};

function pct(rate: number | null): string {
  return rate === null ? "—" : `${Math.round(rate * 100)} %`;
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-xl border border-border bg-background px-3 py-2">
      <span className="text-[0.62rem] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="text-base font-bold tabular-nums text-foreground">
        {value}
      </span>
    </div>
  );
}

function RetentionBody({ data }: { data: RetentionView }) {
  const signups = data.cohorts.reduce((sum, c) => sum + c.signups, 0);
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-2">
        <Tile label="Actifs / jour" value={String(data.active.dau)} />
        <Tile label="Actifs / 7 j" value={String(data.active.wau)} />
        <Tile label="Actifs / 30 j" value={String(data.active.mau)} />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Tile
          label="Suivent un coupon"
          value={pct(data.engagement.followedRate)}
        />
        <Tile
          label="Déclarent un coupon"
          value={pct(data.engagement.declaredRate)}
        />
        {data.notifications.map((n) => (
          <Tile
            key={n.type}
            label={`${NOTIFICATION_LABEL[n.type] ?? n.type} ouverte`}
            value={`${pct(n.rate)} · ${n.opened}/${n.sent}`}
          />
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[28rem] text-left text-xs tabular-nums">
          <thead className="text-[0.62rem] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="py-1.5 pr-2 font-medium">Semaine</th>
              <th className="py-1.5 pr-2 font-medium">Inscrits</th>
              <th className="py-1.5 pr-2 font-medium">Activés</th>
              <th className="py-1.5 pr-2 font-medium">J7</th>
              <th className="py-1.5 pr-2 font-medium">J14</th>
              <th className="py-1.5 font-medium">J30</th>
            </tr>
          </thead>
          <tbody>
            {data.cohorts.map((c) => (
              <tr key={c.week} className="border-t border-border">
                <td className="py-1.5 pr-2 text-muted-foreground">{c.week}</td>
                <td className="py-1.5 pr-2">{c.signups}</td>
                <td className="py-1.5 pr-2">{pct(c.activation)}</td>
                <td className="py-1.5 pr-2">{pct(c.d7.rate)}</td>
                <td className="py-1.5 pr-2">{pct(c.d14.rate)}</td>
                <td className="py-1.5">{pct(c.d30.rate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[0.68rem] text-muted-foreground">
        Activé : actif au moins 3 jours dans ses 14 premiers. Repères avant
        toute offre payante : activation ≥ {pct(ACTIVATION_TARGET)}, J14 ≥{" "}
        {pct(D14_TARGET)}, sur au moins {SIGNUPS_TARGET} inscrits ({signups} sur
        ces 12 semaines). Admins exclus.
      </p>
    </div>
  );
}

/** Fidélisation (lot 4) : mesure interne, sans outil tiers. */
export function RetentionCard() {
  const { data, isLoading, isError } = useRetention();
  return (
    <section
      data-testid="retention-card"
      className="flex flex-col rounded-[1.35rem] border border-border bg-panel-strong p-4 sm:p-5 ev-shell-shadow"
    >
      <div className="mb-3 flex items-center gap-2">
        <Users size={14} className="shrink-0 text-accent" />
        <h2 className="text-sm font-bold tracking-tight text-foreground">
          Fidélisation
        </h2>
        {data ? (
          <span className="ml-auto text-[0.6rem] font-medium uppercase tracking-wide text-muted-foreground">
            au {data.asOf}
          </span>
        ) : null}
      </div>
      {isLoading ? (
        <div className="bento-skeleton h-40 rounded-xl" />
      ) : isError || !data ? (
        <div className="flex items-center gap-2 rounded-2xl border border-danger/20 bg-danger/5 px-4 py-4 text-sm text-foreground">
          <AlertCircle size={18} className="text-danger opacity-60" />
          Impossible de charger la fidélisation.
        </div>
      ) : (
        <RetentionBody data={data} />
      )}
    </section>
  );
}
