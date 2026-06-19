import type { Metadata } from "next";
import { DecisionsChannelsPageClient } from "../components/decisions-channels-page-client";

export const metadata: Metadata = {
  title: "Décisions par canal — EVCore",
};

export default function DecisionsChannelsPage() {
  return <DecisionsChannelsPageClient />;
}
