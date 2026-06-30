import type { Metadata } from "next";
import { DecisionsPageClient } from "./components/decisions-page-client";

export const metadata: Metadata = {
  title: "Décisions — EVCore",
};

export default function DecisionsPage() {
  return <DecisionsPageClient />;
}
