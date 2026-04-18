"use client";

import { useState } from "react";
import { Icon } from "@/components/Icon";
import { cn } from "@/lib/utils";

interface DatepickerMosaicProps {
  align?: "left" | "right";
}

export function DatepickerMosaic({ align = "left" }: DatepickerMosaicProps) {
  // Simple mock implementation for the UI
  // Proper date-picker logic would use a library like react-day-picker
  const [startDateStr] = useState("01 Mar, 2026");
  const [endDateStr] = useState("28 Mar, 2026");

  return (
    <div className="relative">
      <button
        className={cn(
          "flex items-center justify-between min-w-[15.5rem] px-3 py-2 border rounded-lg transition-colors cursor-pointer text-sm font-medium",
          "bg-white dark:bg-gray-800",
          "border-gray-200 dark:border-gray-700/60 hover:border-gray-300 dark:hover:border-gray-600",
          "text-gray-500 dark:text-gray-400"
        )}
      >
        <span className="flex items-center">
          <Icon name="calendar_today" size="xs" className="text-gray-500 dark:text-gray-400 mr-2" />
          <span className="text-gray-600 dark:text-gray-300">
            {startDateStr}
          </span>
          <span className="text-gray-400 dark:text-gray-500 mx-1">-</span>
          <span className="text-gray-600 dark:text-gray-300">
            {endDateStr}
          </span>
        </span>
        <Icon name="arrow_drop_down" size="sm" className="text-gray-400" />
      </button>
    </div>
  );
}
