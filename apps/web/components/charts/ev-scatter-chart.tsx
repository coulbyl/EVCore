"use client";

import {
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CHART_AXIS_TICK, CHART_TOOLTIP_CONTENT_STYLE } from "./chart-theme";

type ScatterPoint = {
  x: number;
  y: number;
  [key: string]: unknown;
};

type ScatterDataset = {
  key: string;
  label: string;
  color: string;
  data: ScatterPoint[];
};

type EvScatterChartProps = {
  datasets: ScatterDataset[];
  xLabel?: string;
  yLabel?: string;
  height?: number;
  formatX?: (value: number) => string;
  formatY?: (value: number) => string;
  showDiagonal?: boolean;
  className?: string;
};

function EvScatterChart({
  datasets,
  xLabel,
  yLabel,
  height = 240,
  formatX,
  formatY,
  showDiagonal = false,
  className,
}: EvScatterChartProps) {
  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height={height}>
        <ScatterChart margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            type="number"
            dataKey="x"
            name={xLabel}
            tick={CHART_AXIS_TICK}
            axisLine={false}
            tickLine={false}
            tickMargin={8}
            tickFormatter={formatX}
            domain={[0, 1]}
          />
          <YAxis
            type="number"
            dataKey="y"
            name={yLabel}
            tick={CHART_AXIS_TICK}
            axisLine={false}
            tickLine={false}
            tickMargin={8}
            tickFormatter={formatY}
            domain={[0, 1]}
            width={formatY ? 48 : 32}
          />
          <Tooltip
            contentStyle={CHART_TOOLTIP_CONTENT_STYLE}
            cursor={{ strokeDasharray: "3 3", stroke: "var(--border)" }}
          />
          {showDiagonal && (
            <ReferenceLine
              segment={[
                { x: 0, y: 0 },
                { x: 1, y: 1 },
              ]}
              stroke="var(--muted-foreground)"
              strokeDasharray="4 4"
              strokeOpacity={0.5}
            />
          )}
          {datasets.map((ds) => (
            <Scatter
              key={ds.key}
              name={ds.label}
              data={ds.data}
              fill={ds.color}
              opacity={0.8}
              r={4}
            />
          ))}
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

export { EvScatterChart };
export type { ScatterPoint, ScatterDataset };
