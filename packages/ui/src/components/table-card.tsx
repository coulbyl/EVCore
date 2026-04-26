import * as React from "react"
import { SectionHeader } from "@evcore/ui/components/section-header"
import { cn } from "@evcore/ui/lib/utils"

type TableCardProps = {
  title: string
  subtitle?: string
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}

function TableCard({ title, subtitle, action, children, className }: TableCardProps) {
  return (
    <div className={cn("rounded-[1.8rem] border border-border bg-panel-strong p-4 sm:p-6 ev-shell-shadow", className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <SectionHeader title={title} subtitle={subtitle} />
        </div>
        {action ? (
          <div className="shrink-0 self-start sm:self-auto">{action}</div>
        ) : null}
      </div>
      <div className="mt-5 overflow-hidden rounded-[1.3rem] border border-border">
        {children}
      </div>
    </div>
  )
}

export { TableCard }
