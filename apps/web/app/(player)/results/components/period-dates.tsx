import { CalendarDays, X } from "lucide-react";
import { cn } from "@evcore/ui/cn";

/**
 * « Dates », after 30 j · 90 j · Tout in the band: the player's own period.
 * A native popover with two native date fields, so the phone shows its own
 * calendar, never a dropdown (02 § 5), and the sheet-less screen keeps no
 * JavaScript of its own. The form is a GET on the screen: the address
 * carries the dates, the server reads them (`periodOf`).
 */
export function PeriodDates({
  action,
  active,
  label,
  from,
  to,
  max,
  texts,
}: {
  /** The screen the form reloads, « /results ». */
  action: string;
  /** The player's dates are the period shown. */
  active: boolean;
  /** « Dates », or the dates chosen « 13/10 – 25/10 ». */
  label: string;
  /** The fields' values, YYYY-MM-DD. */
  from: string;
  to: string;
  /** The last day one can pick: today. */
  max: string;
  texts: {
    title: string;
    from: string;
    to: string;
    show: string;
    close: string;
  };
}) {
  const id = "results-period-dates";
  return (
    <>
      <button
        type="button"
        popoverTarget={id}
        aria-current={active ? "true" : undefined}
        className={cn(
          "flex min-h-11 items-center gap-2 rounded-full px-4 text-body font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-led-on",
          active
            ? "bg-led-on text-band"
            : "text-band-muted hover:text-band-foreground",
        )}
      >
        <CalendarDays aria-hidden className="size-4" strokeWidth={2} />
        {label}
      </button>
      <div
        id={id}
        popover="auto"
        role="dialog"
        aria-label={texts.title}
        className="m-auto w-[min(22rem,calc(100vw-2rem))] rounded-[0.875rem] border border-border bg-card p-4 pt-1 text-card-foreground shadow-lg backdrop:bg-black/40"
      >
        <div className="flex items-center justify-between gap-3">
          <p className="text-meta text-muted-foreground">{texts.title}</p>
          <button
            type="button"
            popoverTarget={id}
            popoverTargetAction="hide"
            aria-label={texts.close}
            className="-me-3 grid size-11 place-items-center focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
          >
            <X aria-hidden className="size-5" strokeWidth={2} />
          </button>
        </div>
        <form action={action} method="get" className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-meta text-muted-foreground">
              {texts.from}
              <input
                type="date"
                name="from"
                required
                defaultValue={from}
                max={max}
                className="min-h-11 rounded-[0.625rem] border border-border bg-background px-3 text-body text-foreground"
              />
            </label>
            <label className="flex flex-col gap-1 text-meta text-muted-foreground">
              {texts.to}
              <input
                type="date"
                name="to"
                required
                defaultValue={to}
                max={max}
                className="min-h-11 rounded-[0.625rem] border border-border bg-background px-3 text-body text-foreground"
              />
            </label>
          </div>
          <button
            type="submit"
            className="h-12 w-full rounded-[0.625rem] bg-primary text-bet font-medium text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {texts.show}
          </button>
        </form>
      </div>
    </>
  );
}
