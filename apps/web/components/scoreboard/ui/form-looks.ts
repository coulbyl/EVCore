/** The looks of the small forms (Compte, sign-in, sign-up); no JSX: imported by clients. */
// The border in `icon-subtle` (3.6:1 on the card): a field's outline must
// reach 3:1 against its surroundings (WCAG 1.4.11), read outdoors.
export const FIELD =
  "min-h-12 rounded-[0.625rem] border border-icon-subtle bg-card px-3 text-body text-foreground focus:outline-2 focus:outline-ring";
// DESIGN.md « Buttons »: 48 px high, the label in `bet` 500.
export const PRIMARY =
  "min-h-12 rounded-[0.625rem] bg-primary px-4 text-bet font-medium text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-60";
export const QUIET =
  "min-h-11 rounded-[0.625rem] px-3 text-body font-medium text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring";
export const LINK =
  "min-h-11 text-body font-medium underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring";
