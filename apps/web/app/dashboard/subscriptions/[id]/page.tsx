import { SubscriptionDetailPageClient } from "../components/subscription-detail-page-client";

export default async function SubscriptionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <SubscriptionDetailPageClient subscriptionId={id} />;
}
