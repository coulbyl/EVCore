import Link from "next/link";
import { ChevronRight, TriangleAlert } from "lucide-react";
import { clsx } from "clsx";
import type {
  ConsoleStatus,
  LightKey,
  TodoItem,
} from "@/domains/console/types/console";
import { LIGHT_DOT, todoHref } from "./console-constants";

const ORDER: LightKey[] = ["data", "engine", "players"];

/**
 * The three lights with what they say (12-admin.md § 1): each light is a
 * heading — its diode, its name, its state in words — and under it the
 * « À faire » lines that set it, reds first, each leading where one acts.
 * A green light is one line, « rien à faire ». A line goes when its cause
 * goes; nothing to mark as read.
 */
export function LightSections({
  status,
  textOf,
  timeOf,
  labels,
}: {
  status: ConsoleStatus;
  textOf: (item: TodoItem) => string;
  timeOf: (iso: string) => string;
  labels: {
    names: Record<LightKey, string>;
    states: Record<"green" | "orange" | "red", string>;
    redSince: (time: string) => string;
  };
}) {
  return (
    <div className="flex flex-col gap-4">
      {ORDER.map((key) => {
        const state = status.lights[key];
        const since = status.since[key];
        const items = status.todo.filter((item) => item.light === key);
        return (
          <section
            key={key}
            aria-labelledby={`light-${key}`}
            className="flex flex-col"
          >
            <h2
              id={`light-${key}`}
              className="flex items-center gap-2 text-body"
            >
              <span
                aria-hidden
                className={clsx(
                  "size-2.5 shrink-0 rounded-full",
                  LIGHT_DOT[state],
                )}
              />
              <span className="font-semibold">{labels.names[key]}</span>
              <span
                className={clsx(
                  state === "red" ? "text-loss" : "text-muted-foreground",
                )}
              >
                — {labels.states[state]}
                {state === "red" && since
                  ? ` ${labels.redSince(timeOf(since))}`
                  : ""}
              </span>
            </h2>
            {items.length > 0 ? (
              <ul className="divide-y divide-border">
                {items.map((item, index) => (
                  <li key={`${item.kind}-${index}`}>
                    <Link
                      href={todoHref(item)}
                      className="flex min-h-12 items-center gap-3 py-2 ps-[1.125rem] focus-visible:outline-2 focus-visible:outline-ring"
                    >
                      <TriangleAlert
                        aria-hidden
                        strokeWidth={2}
                        className={clsx(
                          "size-4 shrink-0",
                          item.severity === "red"
                            ? "text-loss"
                            : "text-warning",
                        )}
                      />
                      <span className="min-w-0 flex-1 text-body">
                        {textOf(item)}
                      </span>
                      <ChevronRight
                        aria-hidden
                        className="size-[1.125rem] shrink-0 text-icon-subtle"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
