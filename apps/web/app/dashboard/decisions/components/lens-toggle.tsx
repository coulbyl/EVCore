"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@evcore/ui";

// Segmented control to switch between the two lenses of the SAME data (by match
// / by channel) while preserving the selected date — replaces hopping between
// two sidebar entries that felt like separate pages.
export function LensToggle({ date }: { date: string }) {
  const pathname = usePathname();
  const t = useTranslations("decisions");
  const query = `?date=${date}`;
  const onMatches = pathname.startsWith("/dashboard/decisions/matches");

  return (
    <div className="inline-flex rounded-lg border border-border/60 p-0.5">
      <Tab href={`/dashboard/decisions/matches${query}`} active={onMatches}>
        {t("lens.matches")}
      </Tab>
      <Tab href={`/dashboard/decisions/channels${query}`} active={!onMatches}>
        {t("lens.channels")}
      </Tab>
    </div>
  );
}

function Tab({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-md px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "bg-[color:var(--accent-soft)] text-foreground"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </Link>
  );
}
