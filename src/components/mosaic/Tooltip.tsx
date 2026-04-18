"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface TooltipProps {
  children: React.ReactNode;
  content: string;
  position?: "top" | "bottom" | "left" | "right";
  className?: string;
}

export function Tooltip({ children, content, position = "top", className }: TooltipProps) {
  const [show, setShow] = useState(false);

  return (
    <div
      className={cn("relative flex items-center justify-center", className)}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onFocus={() => setShow(true)}
      onBlur={() => setShow(false)}
    >
      {show && (
        <div
          className={cn(
            "absolute z-10 w-fit whitespace-nowrap bg-gray-800 dark:bg-gray-700 text-white text-xs font-medium px-2.5 py-1 rounded-lg text-center shadow-lg transition-opacity",
            position === "top" && "bottom-full mb-2",
            position === "bottom" && "top-full mt-2",
            position === "left" && "right-full mr-2",
            position === "right" && "left-full ml-2"
          )}
        >
          {content}
          {/* Arrow */}
          <div
            className={cn(
              "absolute w-2 h-2 bg-gray-800 dark:bg-gray-700 rotate-45",
              position === "top" && "bottom-[-4px] left-1/2 -translate-x-1/2",
              position === "bottom" && "top-[-4px] left-1/2 -translate-x-1/2",
              position === "left" && "right-[-4px] top-1/2 -translate-y-1/2",
              position === "right" && "left-[-4px] top-1/2 -translate-y-1/2"
            )}
          />
        </div>
      )}
      {children}
    </div>
  );
}
