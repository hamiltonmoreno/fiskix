"use client";

import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ThemeToggleProps {
  collapsed?: boolean;
}

export function ThemeToggle({ collapsed }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <div className="relative group">
      <button
        onClick={() => setTheme(isDark ? "light" : "dark")}
        aria-label={isDark ? "Activar modo claro" : "Activar modo escuro"}
        className={cn(
          "flex items-center gap-3 py-2.5 rounded-lg transition-all duration-150 text-sm font-medium w-full",
          collapsed ? "justify-center px-3" : "px-3",
          "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
        )}
      >
        {isDark ? (
          <Sun className="w-4 h-4 flex-shrink-0 text-slate-400 group-hover:text-slate-200" />
        ) : (
          <Moon className="w-4 h-4 flex-shrink-0 text-slate-400 group-hover:text-slate-200" />
        )}
        <span
          className={cn(
            "overflow-hidden transition-all duration-300 whitespace-nowrap",
            collapsed ? "w-0 opacity-0" : "w-full opacity-100"
          )}
        >
          {isDark ? "Modo claro" : "Modo escuro"}
        </span>
      </button>

      {collapsed && (
        <div
          className="
            pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 z-50
            bg-slate-900 text-white text-xs font-medium px-2.5 py-1.5 rounded-md
            whitespace-nowrap shadow-lg
            opacity-0 -translate-x-1 scale-95
            group-hover:opacity-100 group-hover:translate-x-0 group-hover:scale-100
            transition-all duration-150 ease-out
          "
        >
          {isDark ? "Modo claro" : "Modo escuro"}
          <span className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-slate-900" />
        </div>
      )}
    </div>
  );
}
