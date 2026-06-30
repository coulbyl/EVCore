"use client";

import { useState } from "react";
import { BarChart2 } from "lucide-react";
import { Button } from "@evcore/ui";
import { useIsMobile } from "@/hooks/use-mobile";
import { CouponIndicesDrawer } from "./coupon-indices-drawer";

export function IndicesDrawerButton() {
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="h-7 gap-1.5 text-xs"
      >
        <BarChart2 size={12} />
        Indice de paris
      </Button>
      <CouponIndicesDrawer
        open={open}
        onClose={() => setOpen(false)}
        isMobile={isMobile}
      />
    </>
  );
}
