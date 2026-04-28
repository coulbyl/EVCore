"use client";

import {
  CartesianGrid,
  Legend,
  LineChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CHART_AXIS_TICK, CHART_TOOLTIP_CONTENT_STYLE } from "./chart-theme";

type LineDef = {
  key: string;
  color: string;
  label: string;
  dashed?: boolean;
};

type EvLineChartProps = {
  data: Record<string, unknown>[];
  xKey: string;
  lines: LineDef[];
  height?: number;
  formatY?: (value: number) => string;
  showLegend?: boolean;
  className?: string;
};

function EvLineChart({
  data,
  xKey,
  lines,
  height = 180,
  formatY,
  showLegend = false,
  className,
}: EvLineChartProps) {
  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart
          data={data}
          margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--border)"
            vertical={false}
          />
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
          <Tooltip
            contentStyle={CHART_TOOLTIP_CONTENT_STYLE}
            cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
          />
          {showLegend && <Legend />}
          {lines.map((line) => (
            <Line
              key={line.key}
              type="monotone"
              dataKey={line.key}
              name={line.label}
              stroke={line.color}
              strokeWidth={2}
              strokeDasharray={line.dashed ? "5 3" : undefined}
              dot={false}
              activeDot={{ r: 4, fill: line.color, strokeWidth: 0 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export { EvLineChart };
export type { LineDef };
