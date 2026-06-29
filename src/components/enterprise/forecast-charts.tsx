import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { ForecastPoint } from "@/lib/ai-brain";

/** recharts renders client-only to keep SSR/hydration clean. */
function useMounted() {
  const [m, setM] = useState(false);
  useEffect(() => setM(true), []);
  return m;
}

const axisProps = {
  stroke: "var(--muted-foreground)",
  fontSize: 11,
  tickLine: false,
  axisLine: false,
} as const;

const gridProps = { stroke: "var(--border)", strokeDasharray: "3 3", vertical: false } as const;

function tooltipStyle() {
  return {
    contentStyle: {
      background: "var(--popover)",
      border: "1px solid var(--border)",
      borderRadius: 12,
      fontSize: 12,
      color: "var(--popover-foreground)",
    },
    labelStyle: { color: "var(--popover-foreground)", fontWeight: 600 },
  };
}

const Skeleton = ({ height }: { height: number }) => (
  <div className="w-full animate-pulse rounded-xl bg-muted/40" style={{ height }} />
);

export function ForecastAreaChart({
  data,
  height = 220,
  color = "var(--chart-1)",
  unit = "€",
}: {
  data: ForecastPoint[];
  height?: number;
  color?: string;
  unit?: string;
}) {
  const mounted = useMounted();
  if (!mounted) return <Skeleton height={height} />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <defs>
          <linearGradient id="fcArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid {...gridProps} />
        <XAxis dataKey="label" {...axisProps} />
        <YAxis {...axisProps} width={48} />
        <Tooltip
          {...tooltipStyle()}
          formatter={(v: number) => [`${v.toLocaleString("de-DE")} ${unit}`, "Prognose"]}
        />
        {data.some((d) => d.ist !== undefined) && (
          <Area
            type="monotone"
            dataKey="ist"
            stroke="var(--chart-3)"
            strokeWidth={2}
            fill="transparent"
            name="Ist"
          />
        )}
        <Area
          type="monotone"
          dataKey="prognose"
          stroke={color}
          strokeWidth={2.5}
          fill="url(#fcArea)"
          name="Prognose"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function ForecastBarChart({
  data,
  height = 220,
  color = "var(--chart-2)",
  unit = "",
}: {
  data: ForecastPoint[];
  height?: number;
  color?: string;
  unit?: string;
}) {
  const mounted = useMounted();
  if (!mounted) return <Skeleton height={height} />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid {...gridProps} />
        <XAxis dataKey="label" {...axisProps} />
        <YAxis {...axisProps} width={40} />
        <Tooltip
          {...tooltipStyle()}
          cursor={{ fill: "var(--muted)", opacity: 0.4 }}
          formatter={(v: number) => [`${v.toLocaleString("de-DE")} ${unit}`.trim(), "Prognose"]}
        />
        <Bar dataKey="prognose" fill={color} radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ForecastLineChart({
  data,
  height = 220,
  unit = "",
}: {
  data: ForecastPoint[];
  height?: number;
  unit?: string;
}) {
  const mounted = useMounted();
  if (!mounted) return <Skeleton height={height} />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid {...gridProps} />
        <XAxis dataKey="label" {...axisProps} />
        <YAxis {...axisProps} width={40} />
        <Tooltip
          {...tooltipStyle()}
          formatter={(v: number) => [`${v.toLocaleString("de-DE")} ${unit}`.trim(), ""]}
        />
        <Line
          type="monotone"
          dataKey="ist"
          stroke="var(--chart-3)"
          strokeWidth={2}
          dot={false}
          name="Bedarf (Ist)"
        />
        <Line
          type="monotone"
          dataKey="prognose"
          stroke="var(--chart-1)"
          strokeWidth={2.5}
          dot={{ r: 3 }}
          name="Prognose"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
