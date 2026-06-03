"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { DateNav } from "@/components/date-nav";

export function FixturesFilters({ date }: { date: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function handleDateChange(next: string) {
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("date", next);
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  return (
    <div
      className={
        isPending
          ? "pointer-events-none opacity-60 transition-opacity"
          : "transition-opacity"
      }
    >
      <DateNav date={date} onChange={handleDateChange} />
    </div>
  );
}
