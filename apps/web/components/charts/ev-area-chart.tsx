"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CHART_AXIS_TICK, CHART_TOOLTIP_CONTENT_STYLE } from "./chart-theme";

type EvAreaChartProps = {
  data: Record<string, unknown>[];
  xKey: string;
  yKey: string;
  color?: string;
  height?: number;
  formatY?: (value: number) => string;
  gradientId?: string;
  className?: string;
  projectionKey?: string;
  projectionColor?: string;
  /** Largeur de l'axe vertical : 48 px coupait « 500 M F » en « 00 M F ». */
  yAxisWidth?: number;
  /** Nom de la valeur dans l'infobulle (sinon la clé brute, « balance »). */
  valueLabel?: string;
  /** Axe calé sur les valeurs plutôt que sur 0, qui aplatissait la courbe. */
  fitDomain?: boolean;
};

function EvAreaChart({
  data,
  xKey,
  yKey,
  color = "#0f766e",
  height = 180,
  formatY,
  gradientId = "ev-area-gradient",
  className,
  projectionKey,
  projectionColor,
  yAxisWidth,
  valueLabel,
  fitDomain = false,
}: EvAreaChartProps) {
  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart
          data={data}
          margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.22} />
              <stop offset="100%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>
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
            width={yAxisWidth ?? (formatY ? 48 : 32)}
            domain={fitDomain ? ["auto", "auto"] : undefined}
          />
          <Tooltip
            contentStyle={CHART_TOOLTIP_CONTENT_STYLE}
            cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
            formatter={(value) => [
              formatY && typeof value === "number" ? formatY(value) : value,
              valueLabel ?? yKey,
            ]}
          />
          <Area
            type="monotone"
            dataKey={yKey}
            stroke={color}
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            dot={false}
            activeDot={{ r: 4, fill: color, strokeWidth: 0 }}
            connectNulls={false}
          />
          {projectionKey && (
            <Line
              type="monotone"
              dataKey={projectionKey}
              stroke={projectionColor ?? color}
              strokeWidth={1.5}
              strokeDasharray="5 3"
              dot={false}
              activeDot={{ r: 3, strokeWidth: 0 }}
              connectNulls={false}
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export { EvAreaChart };
