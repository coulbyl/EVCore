import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";

export type Locale = "fr" | "en";
export const defaultLocale: Locale = "fr";
export const locales: Locale[] = ["fr", "en"];

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const locale = (cookieStore.get("NEXT_LOCALE")?.value ?? defaultLocale) as Locale;
  const validLocale = locales.includes(locale) ? locale : defaultLocale;

  return {
    locale: validLocale,
    messages: (await import(`./messages/${validLocale}.json`)).default as Record<string, string>,
  };
});
