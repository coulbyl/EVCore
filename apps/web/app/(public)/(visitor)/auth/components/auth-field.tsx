import { Check } from "lucide-react";
import { FIELD } from "@/components/scoreboard/ui/form-looks";

/**
 * The fields are uncontrolled, read from the form on submit: what a player
 * types before the page has hydrated (a slow phone) stays in the field.
 *
 * A field of the account forms (11 § 2): the label above, the input, a hint
 * and, in its place, the error in one line under the field — never at the
 * top of the page. `error` may carry a link (« · Se connecter »).
 */
export function AuthField({
  label,
  hint,
  error,
  aside,
  ...input
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  name: string;
  hint?: string;
  error?: React.ReactNode;
  /** Beside the input: « afficher » on a password. */
  aside?: React.ReactNode;
}) {
  const describedBy = error
    ? `${input.name}-error`
    : hint
      ? `${input.name}-hint`
      : undefined;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={input.name} className="text-meta text-muted-foreground">
        {label}
      </label>
      {/* « afficher » sits inside the field, at its right edge: the
          fields keep one width and one right edge. */}
      <div className="relative">
        <input
          id={input.name}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={`${FIELD} w-full aria-invalid:border-foreground ${aside ? "pe-24" : ""}`}
          {...input}
          onKeyDown={
            input.enterKeyHint === "next" ? focusNextField : input.onKeyDown
          }
        />
        {aside ? (
          <div className="absolute inset-y-0 end-1 flex items-center">
            {aside}
          </div>
        ) : null}
      </div>
      {/* Always in the page, empty without an error: a live region added
          together with its text is not reliably announced. */}
      <p
        id={`${input.name}-error`}
        aria-live="polite"
        className={error ? "text-meta font-medium" : "sr-only"}
      >
        {error}
      </p>
      {hint && !error ? (
        <p
          id={`${input.name}-hint`}
          className="text-meta text-muted-foreground"
        >
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** A box to tick (the age, the terms): never ticked in advance (11 § 2). */
export function AuthCheck({
  name,
  error,
  children,
}: {
  name: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="flex min-h-11 items-start gap-3 text-body">
        <span className="relative mt-0.5 flex size-5 shrink-0">
          <input
            type="checkbox"
            name={name}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${name}-error` : undefined}
            className="peer size-5 appearance-none rounded-[0.3rem] border border-icon-subtle bg-card checked:border-primary checked:bg-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          />
          <Check
            aria-hidden
            strokeWidth={3}
            className="pointer-events-none absolute inset-0.5 hidden size-4 text-primary-foreground peer-checked:block"
          />
        </span>
        <span>{children}</span>
      </label>
      <p
        id={`${name}-error`}
        aria-live="polite"
        className={error ? "ps-8 text-meta font-medium" : "sr-only"}
      >
        {error}
      </p>
    </div>
  );
}

/**
 * « Suivant » on the keyboard (`enterKeyHint="next"`): Enter goes to the
 * next text field instead of sending the form, so the thumb never has to
 * reach the button; the last field (« OK ») sends it.
 */
function focusNextField(event: React.KeyboardEvent<HTMLInputElement>) {
  if (event.key !== "Enter") return;
  const fields = Array.from(
    event.currentTarget.form?.querySelectorAll<HTMLInputElement>(
      'input:not([type="checkbox"]):not([type="hidden"])',
    ) ?? [],
  );
  const next = fields[fields.indexOf(event.currentTarget) + 1];
  if (!next) return;
  event.preventDefault();
  next.focus();
}
