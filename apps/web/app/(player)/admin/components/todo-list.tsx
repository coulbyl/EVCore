import Link from "next/link";
import { ChevronRight, TriangleAlert } from "lucide-react";
import { clsx } from "clsx";
import type { TodoItem } from "@/domains/console/types/console";
import { todoHref } from "./console-constants";

/**
 * « À faire » (12-admin.md § 1): what the rules found, reds first, each
 * line leading where one acts. A line goes when its cause goes; nothing to
 * mark as read.
 */
export function TodoList({
  items,
  textOf,
  labels,
}: {
  items: TodoItem[];
  textOf: (item: TodoItem) => string;
  labels: { title: string; nothing: string };
}) {
  return (
    <section aria-labelledby="todo-title" className="flex flex-col gap-1">
      <h2
        id="todo-title"
        className="text-meta font-semibold text-muted-foreground"
      >
        {labels.title}
      </h2>
      {items.length === 0 ? (
        <p className="py-2 text-body text-muted-foreground">{labels.nothing}</p>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((item, index) => (
            <li key={`${item.kind}-${index}`}>
              <Link
                href={todoHref(item)}
                className="flex min-h-12 items-center gap-3 py-2 focus-visible:outline-2 focus-visible:outline-ring"
              >
                <TriangleAlert
                  aria-hidden
                  strokeWidth={2}
                  className={clsx(
                    "size-4 shrink-0",
                    item.severity === "red" ? "text-loss" : "text-warning",
                  )}
                />
                <span className="min-w-0 flex-1 text-body">{textOf(item)}</span>
                <ChevronRight
                  aria-hidden
                  className="size-[1.125rem] shrink-0 text-icon-subtle"
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
