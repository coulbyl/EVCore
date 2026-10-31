import { clsx } from "clsx";
import type { ConsoleStatus, LightKey } from "@/domains/console/types/console";
import { LIGHT_DOT } from "./console-constants";

const ORDER: LightKey[] = ["data", "engine", "players"];

/**
 * « ● Données ● Moteur ● Joueurs » (12-admin.md § 1): one diode each, its
 * state said for screen readers, the time it turned red under a red one.
 */
export function LightsRow({
  status,
  labels,
  timeOf,
}: {
  status: ConsoleStatus;
  labels: {
    names: Record<LightKey, string>;
    states: Record<string, string>;
    redSince: (time: string) => string;
  };
  timeOf: (iso: string) => string;
}) {
  return (
    <ul className="grid grid-cols-3 gap-2">
      {ORDER.map((key) => {
        const state = status.lights[key];
        const since = status.since[key];
        return (
          <li
            key={key}
            className="flex flex-col gap-0.5 rounded-[0.875rem] border border-border bg-card px-3 py-2.5"
          >
            <span className="flex items-center gap-2 text-body font-semibold">
              <span
                aria-hidden
                className={clsx("size-2.5 rounded-full", LIGHT_DOT[state])}
              />
              {labels.names[key]}
              <span className="sr-only">{labels.states[state]}</span>
            </span>
            {state === "red" && since ? (
              <span className="text-legal text-loss">
                {labels.redSince(timeOf(since))}
              </span>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
