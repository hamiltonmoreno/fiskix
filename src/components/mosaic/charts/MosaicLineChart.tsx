"use client";

import { createElement } from "react";
import { useTheme } from "next-themes";
import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineProps
} from "recharts";
import { chartTheme, appColors } from "./RechartsConfig";

interface MosaicLineChartProps {
  data: any[];
  lines: {
    dataKey: string;
    stroke?: string;
    name?: string;
    isPrimary?: boolean;
  }[];
  xAxisKey: string;
  height?: number;
  yAxisFormatter?: (value: number) => string;
  tooltipContent?: React.ReactElement;
  showGrid?: boolean;
}

export function MosaicLineChart({
  data,
  lines,
  xAxisKey,
  height = 260,
  yAxisFormatter,
  tooltipContent,
  showGrid = true,
}: MosaicLineChartProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const t = isDark ? chartTheme.dark : chartTheme.light;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsLineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        {showGrid && (
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={t.gridColor}
            vertical={false}
          />
        )}
        <XAxis
          dataKey={xAxisKey}
          tick={{ fill: t.textColor, fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          dy={10}
        />
        <YAxis
          tick={{ fill: t.textColor, fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={yAxisFormatter}
          dx={-10}
        />
        <Tooltip
          content={tooltipContent}
          cursor={{ stroke: t.gridColor, strokeWidth: 1, strokeDasharray: "3 3" }}
          contentStyle={{
            backgroundColor: t.tooltipBg,
            borderColor: t.tooltipBorder,
            borderRadius: "8px",
            color: t.textColor,
            boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
          }}
          itemStyle={{ color: t.textColor }}
        />
        {lines.map((line, i) => (
          <Line
            key={line.dataKey}
            type="monotone"
            dataKey={line.dataKey}
            name={line.name || line.dataKey}
            stroke={line.stroke || (line.isPrimary ? appColors.primary : appColors.gray[400])}
            strokeWidth={line.isPrimary ? 3 : 2}
            dot={false}
            activeDot={{
              r: 6,
              fill: t.tooltipBg,
              stroke: line.stroke || (line.isPrimary ? appColors.primary : appColors.gray[400]),
              strokeWidth: 2,
            }}
          />
        ))}
      </RechartsLineChart>
    </ResponsiveContainer>
  );
}
