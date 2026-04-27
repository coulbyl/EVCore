"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CHART_AXIS_TICK, CHART_TOOLTIP_CONTENT_STYLE } from "./chart-theme";

type BarDef = {
  key: string;
  color: string;
  label: string;
};

type EvBarChartProps = {
  data: Record<string, unknown>[];
  xKey: string;
  bars: BarDef[];
  height?: number;
  layout?: "vertical" | "horizontal";
  formatY?: (value: number) => string;
  className?: string;
};

function EvBarChart({
  data,
  xKey,
  bars,
  height = 180,
  layout = "horizontal",
  formatY,
  className,
}: EvBarChartProps) {
  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={data}
          layout={layout}
          margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
          barCategoryGap="28%"
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--border)"
            vertical={layout === "vertical"}
            horizontal={layout === "horizontal"}
          />
          {layout === "horizontal" ? (
            <>
              <XAxis
                dataKey={xKey}
                tick={CHART_AXIS_TICK}
                axisLine={false}
                tickLine={false}
                tickMargin={8}
              />
              <YAxis
                tick={CHART_AXIS_TICK}
                axisLine={false}
                tickLine={false}
                tickMargin={8}
                tickFormatter={formatY}
                width={formatY ? 48 : 32}
              />
            </>
          ) : (
            <>
              <XAxis
                type="number"
                tick={CHART_AXIS_TICK}
                axisLine={false}
                tickLine={false}
                tickMargin={8}
                tickFormatter={formatY}
              />
              <YAxis
                dataKey={xKey}
                type="category"
                tick={CHART_AXIS_TICK}
                axisLine={false}
                tickLine={false}
                tickMargin={8}
                width={80}
              />
            </>
          )}
          <Tooltip
            contentStyle={CHART_TOOLTIP_CONTENT_STYLE}
            cursor={{ fill: "var(--secondary)", opacity: 0.5 }}
          />
          {bars.map((bar) => (
            <Bar
              key={bar.key}
              dataKey={bar.key}
              name={bar.label}
              fill={bar.color}
              radius={[4, 4, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export { EvBarChart };
