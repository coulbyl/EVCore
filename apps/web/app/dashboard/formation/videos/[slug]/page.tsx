import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getFormationContentBySlug } from "@/domains/formation/server/formation-content";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const item = await getFormationContentBySlug("video", slug);
  if (!item) return {};
  return { title: item.title };
}

export default async function FormationVideoPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { slug } = await params;
  const { t } = await searchParams;

  const item = await getFormationContentBySlug("video", slug);
  if (!item) notFound();

  // Legacy route kept for backwards compatibility: redirect to the new
  // category-based reading experience (preserve chapter offset).
  const qs = t ? `?t=${encodeURIComponent(t)}` : "";
  redirect(`/dashboard/formation/${item.category}/${item.slug}${qs}`);
}
