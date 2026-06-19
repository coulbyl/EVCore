import { redirect } from "next/navigation";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export default async function DecisionsPage({
  searchParams,
}: PageProps<"/dashboard/decisions">) {
  const params = await searchParams;
  const date = typeof params.date === "string" ? params.date : null;
  const suffix = date && ISO_DATE.test(date) ? `?date=${date}` : "";
  redirect(`/dashboard/decisions/matches${suffix}`);
}
