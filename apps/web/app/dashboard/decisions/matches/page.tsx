import type { Metadata } from "next";
import { DecisionsMatchesPageClient } from "../components/decisions-matches-page-client";

export const metadata: Metadata = {
  title: "Décisions par match — EVCore",
};

export default function DecisionsMatchesPage() {
  return <DecisionsMatchesPageClient />;
}
