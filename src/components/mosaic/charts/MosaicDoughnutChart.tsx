"use client";

import { useTheme } from "next-themes";
import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend
} from "recharts";
import { chartTheme } from "./RechartsConfig";

interface DoughnutDataPoint {
  name: string;
  value: number;
  color: string;
}

interface MosaicDoughnutChartProps {
  data: DoughnutDataPoint[];
  height?: number;
  innerRadius?: number;
  outerRadius?: number;
  tooltipContent?: React.ReactElement;
  showLegend?: boolean;
}

export function MosaicDoughnutChart({
  data,
  height = 260,
  innerRadius = 60,
  outerRadius = 80,
  tooltipContent,
  showLegend = true,
}: MosaicDoughnutChartProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const t = isDark ? chartTheme.dark : chartTheme.light;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsPieChart margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={innerRadius}
          outerRadius={outerRadius}
          stroke={isDark ? "#1f2937" : "#ffffff"}
          strokeWidth={3}
          paddingAngle={2}
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip
          content={tooltipContent}
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
            verticalAlign="bottom"
            height={36}
            iconType="circle"
            wrapperStyle={{ fontSize: 13, color: t.textColor }}
          />
        )}
      </RechartsPieChart>
    </ResponsiveContainer>
  );
}
