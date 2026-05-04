"use client";

import { useTheme } from "next-themes";
import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from "recharts";
import { chartTheme, appColors } from "./RechartsConfig";

interface MosaicBarChartProps {
  data: object[];
  bars: {
    dataKey: string;
    fill?: string;
    name?: string;
    stackId?: string;
  }[];
  xAxisKey: string;
  height?: number;
  yAxisFormatter?: (value: number) => string;
  tooltipContent?: React.ReactElement;
  layout?: "horizontal" | "vertical";
  showLegend?: boolean;
}

export function MosaicBarChart({
  data,
  bars,
  xAxisKey,
  height = 260,
  yAxisFormatter,
  tooltipContent,
  layout = "horizontal",
  showLegend = false,
}: MosaicBarChartProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const t = isDark ? chartTheme.dark : chartTheme.light;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsBarChart
        data={data}
        layout={layout}
        margin={{ top: 10, right: 10, left: layout === "vertical" ? 10 : -20, bottom: 0 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke={t.gridColor}
          vertical={layout === "horizontal"}
          horizontal={layout === "vertical"}
        />
        <XAxis
          dataKey={layout === "horizontal" ? xAxisKey : undefined}
          type={layout === "horizontal" ? "category" : "number"}
          tick={{ fill: t.textColor, fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          dy={layout === "horizontal" ? 10 : 0}
        />
        <YAxis
          dataKey={layout === "vertical" ? xAxisKey : undefined}
          type={layout === "vertical" ? "category" : "number"}
          tick={{ fill: t.textColor, fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={yAxisFormatter}
          dx={-10}
        />
        <Tooltip
          content={tooltipContent}
          cursor={{ fill: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.02)" }}
          contentStyle={{
            backgroundColor: t.tooltipBg,
            borderColor: t.tooltipBorder,
            borderRadius: "8px",
            color: t.textColor,
            boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
          }}
          itemStyle={{ color: t.textColor }}
        />
        {showLegend && (
          <Legend
            wrapperStyle={{ fontSize: 12, paddingTop: 10, color: t.textColor }}
            iconType="circle"
          />
        )}
        {bars.map((b) => (
          <Bar
            key={b.dataKey}
            dataKey={b.dataKey}
            name={b.name || b.dataKey}
            fill={b.fill || appColors.primary}
            stackId={b.stackId}
            radius={layout === "vertical" ? [0, 4, 4, 0] : [4, 4, 0, 0]}
            maxBarSize={48}
          />
        ))}
      </RechartsBarChart>
    </ResponsiveContainer>
  );
}
