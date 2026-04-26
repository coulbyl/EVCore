import * as React from "react"
import { cn } from "@evcore/ui/lib/utils"

type ColsValue = 1 | 2 | 3 | 4 | 5 | 6

type ResponsiveGridProps = {
  cols?: ColsValue | { base?: ColsValue; sm?: ColsValue; md?: ColsValue; lg?: ColsValue; xl?: ColsValue }
  gap?: "xs" | "sm" | "md" | "lg" | "xl"
  className?: string
  children: React.ReactNode
}

const colsMap: Record<ColsValue, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
  5: "grid-cols-5",
  6: "grid-cols-6",
}

const smColsMap: Record<ColsValue, string> = {
  1: "sm:grid-cols-1",
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
  4: "sm:grid-cols-4",
  5: "sm:grid-cols-5",
  6: "sm:grid-cols-6",
}

const mdColsMap: Record<ColsValue, string> = {
  1: "md:grid-cols-1",
  2: "md:grid-cols-2",
  3: "md:grid-cols-3",
  4: "md:grid-cols-4",
  5: "md:grid-cols-5",
  6: "md:grid-cols-6",
}

const lgColsMap: Record<ColsValue, string> = {
  1: "lg:grid-cols-1",
  2: "lg:grid-cols-2",
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-4",
  5: "lg:grid-cols-5",
  6: "lg:grid-cols-6",
}

const xlColsMap: Record<ColsValue, string> = {
  1: "xl:grid-cols-1",
  2: "xl:grid-cols-2",
  3: "xl:grid-cols-3",
  4: "xl:grid-cols-4",
  5: "xl:grid-cols-5",
  6: "xl:grid-cols-6",
}

const gapMap = {
  xs: "gap-2",
  sm: "gap-3",
  md: "gap-4",
  lg: "gap-5",
  xl: "gap-6",
} as const

function ResponsiveGrid({ cols = 1, gap = "md", className, children }: ResponsiveGridProps) {
  let colClasses: string

  if (typeof cols === "number") {
    colClasses = colsMap[cols]
  } else {
    const parts: string[] = []
    if (cols.base) parts.push(colsMap[cols.base])
    if (cols.sm) parts.push(smColsMap[cols.sm])
    if (cols.md) parts.push(mdColsMap[cols.md])
    if (cols.lg) parts.push(lgColsMap[cols.lg])
    if (cols.xl) parts.push(xlColsMap[cols.xl])
    colClasses = parts.join(" ")
  }

  return (
    <div className={cn("grid", colClasses, gapMap[gap], className)}>
      {children}
    </div>
  )
}

export { ResponsiveGrid }
