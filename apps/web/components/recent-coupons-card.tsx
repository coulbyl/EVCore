"use client";

import { Badge, Button, Code } from "@evcore/ui";
import { useMemo, useState } from "react";
import type { CouponSnapshot } from "../types/dashboard";

function couponStatusLabel(status: CouponSnapshot["status"]) {
  if (status === "PENDING") return "EN_ATTENTE";
  return status;
}

export function RecentCouponsCard({
  snapshots,
}: {
  snapshots: CouponSnapshot[];
}) {
  const [expanded, setExpanded] = useState(false);

  const visibleSnapshots = useMemo(
    () => (expanded ? snapshots : snapshots.slice(0, 8)),
    [expanded, snapshots],
  );

  return (
    <div className="rounded-[1.8rem] border border-border bg-panel-strong p-6 ev-shell-shadow">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-slate-400">
            Coupons récents
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">
            Coupons générés
          </h2>
        </div>
        {snapshots.length > 8 ? (
          <Button tone="secondary" onClick={() => setExpanded((prev) => !prev)}>
            {expanded ? "Réduire" : "Voir tout"}
          </Button>
        ) : null}
      </div>

      <div className="mt-4 grid gap-2.5">
        {visibleSnapshots.map((coupon) => (
          <div
            key={coupon.id}
            className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border bg-[linear-gradient(180deg,#fcfdff_0%,#f4f7fb_100%)] px-3.5 py-3"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Code className="truncate text-[11px] text-slate-500">
                  {coupon.code}
                </Code>
                <span className="text-xs font-semibold text-slate-900">
                  {coupon.ev}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                <span>{coupon.legs} sélections</span>
                <span>•</span>
                <span>{coupon.window}</span>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Badge
                tone={
                  coupon.status === "WON"
                    ? "success"
                    : coupon.status === "LOST"
                      ? "danger"
                      : "warning"
                }
              >
                {couponStatusLabel(coupon.status)}
              </Badge>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
