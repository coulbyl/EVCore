import { clsx } from "clsx";
import type { PassView } from "@/domains/console/types/console";
import { RelaunchButton } from "./relaunch-button";

/**
 * « Les passes d'aujourd'hui » (12-admin.md § 1, § 5): time, name, last
 * run and its result; Relancer on a pass failed, missed or waiting; a
 * running one says since when. The failure's message on touch.
 */
export function PassesList({
  passes,
  nameOf,
  stateOf,
  labels,
}: {
  passes: PassView[];
  nameOf: (pass: PassView) => string;
  stateOf: (pass: PassView) => string;
  labels: { title: string; relaunch: string; relaunchFailed: string };
}) {
  return (
    <section
      id="passes"
      aria-labelledby="passes-title"
      className="flex flex-col gap-1"
    >
      <h2
        id="passes-title"
        className="text-meta font-semibold text-muted-foreground"
      >
        {labels.title}
      </h2>
      <ul className="divide-y divide-border">
        {passes.map((pass) => (
          <li key={pass.key} className="flex min-h-12 items-center gap-3 py-2">
            <span className="score w-12 shrink-0 text-body text-muted-foreground">
              {pass.at}
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-body font-medium">{nameOf(pass)}</span>
              {pass.state === "failed" && pass.reason ? (
                <details className="text-meta text-loss">
                  <summary className="cursor-pointer">{stateOf(pass)}</summary>
                  <span className="break-words">{pass.reason}</span>
                </details>
              ) : (
                <span
                  className={clsx(
                    "text-meta",
                    pass.state === "failed" || pass.state === "missed"
                      ? "text-loss"
                      : "text-muted-foreground",
                  )}
                >
                  {stateOf(pass)}
                </span>
              )}
            </span>
            {pass.canRelaunch ? (
              <RelaunchButton
                passKey={pass.key}
                labels={{
                  relaunch: labels.relaunch,
                  failed: labels.relaunchFailed,
                }}
              />
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
