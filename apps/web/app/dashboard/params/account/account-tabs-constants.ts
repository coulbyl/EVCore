export const ACCOUNT_TABS = [
  "profil",
  "preferences",
  "securite",
  "notifications",
  "bankroll",
] as const;

export type AccountTabValue = (typeof ACCOUNT_TABS)[number];

export function isAccountTabValue(value: string): value is AccountTabValue {
  return (ACCOUNT_TABS as readonly string[]).includes(value);
}
