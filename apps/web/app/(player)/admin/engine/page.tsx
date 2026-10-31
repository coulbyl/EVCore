import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AdminBand } from "../components/admin-band";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("console");
  return { title: `${t("titles.engine")} — EVCore`, robots: { index: false } };
}

/** 12-admin.md: the screen is built in the next lines of phase G. */
export default async function Page() {
  return (
    <>
      <AdminBand current="engine" />
      <div className="flex flex-col gap-4 px-4 pt-3 pb-4 lg:px-6" />
    </>
  );
}
