"use client";

import {
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
} from "recharts";
import { CHART_TOOLTIP_CONTENT_STYLE } from "./chart-theme";

type EvRadialBarProps = {
  value: number;
  max?: number;
  color?: string;
  trackColor?: string;
  size?: number;
  label?: string;
  formatValue?: (value: number) => string;
  className?: string;
};

function EvRadialBar({
  value,
  max = 100,
  color = "#0f766e",
  trackColor = "var(--secondary)",
  size = 140,
  label,
  formatValue,
  className,
}: EvRadialBarProps) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  const data = [{ value: pct, fill: color }];

  return (
    <div
      className={`relative flex items-center justify-center ${className ?? ""}`}
      style={{ width: size, height: size }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart
          innerRadius="70%"
          outerRadius="100%"
          data={data}
          startAngle={90}
          endAngle={-270}
          barSize={10}
        >
          <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
          <RadialBar
            background={{ fill: trackColor }}
            dataKey="value"
            cornerRadius={6}
            tooltipType="none"
          />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-semibold tabular-nums text-foreground">
          {formatValue ? formatValue(value) : `${Math.round(pct)}%`}
        </span>
        {label && (
          <span className="mt-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            {label}
          </span>
        )}
      </div>
    </div>
  );
}

export { EvRadialBar };

// Suppress unused import warning — kept for future tooltip use
void CHART_TOOLTIP_CONTENT_STYLE;
