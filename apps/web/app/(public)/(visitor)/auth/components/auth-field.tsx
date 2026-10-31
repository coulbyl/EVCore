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
      <div className="flex items-center gap-2">
        <input
          id={input.name}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={`${FIELD} min-w-0 flex-1 aria-invalid:border-foreground`}
          {...input}
        />
        {aside}
      </div>
      {error ? (
        <p id={`${input.name}-error`} className="text-meta font-medium">
          {error}
        </p>
      ) : hint ? (
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
        <input
          type="checkbox"
          name={name}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${name}-error` : undefined}
          className="mt-0.5 size-5 shrink-0 accent-primary"
        />
        <span>{children}</span>
      </label>
      {error ? (
        <p id={`${name}-error`} className="ps-8 text-meta font-medium">
          {error}
        </p>
      ) : null}
    </div>
  );
}
