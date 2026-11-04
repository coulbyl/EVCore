import { cache } from "react";
import { getTranslations } from "next-intl/server";
import type { BackPlaces } from "./back-places";

/** The screens a way back names (`shell.backTo`), the player's and the visitor's. */
const PLACES = {
  "/today": "today",
  "/matches": "matches",
  "/results": "results",
  "/me": "me",
  "/me/messages": "messages",
  "/me/help": "help",
  "/me/account": "account",
  "/me/responsible": "responsible",
  "/notifications": "notifications",
  "/admin": "admin",
  "/": "home",
  "/resultats": "results",
  "/auth/login": "login",
  "/auth/register": "register",
  "/auth/forgot-password": "forgotPassword",
} as const;

/** The names of `BackLink`, read once per request. */
export const getBackPlaces = cache(async (): Promise<BackPlaces> => {
  const t = await getTranslations("shell");
  return {
    back: t("back"),
    screens: Object.fromEntries(
      Object.entries(PLACES).map(([path, key]) => [path, t(`backTo.${key}`)]),
    ),
  };
});
