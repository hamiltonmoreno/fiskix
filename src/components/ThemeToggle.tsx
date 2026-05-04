"use client";

import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/Icon";
import { haptics } from "@/lib/haptics";

interface ThemeToggleProps {
  collapsed?: boolean;
  variant?: "sidebar" | "header";
}

export function ThemeToggle({ collapsed, variant = "sidebar" }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";

  function toggle() {
    haptics.light();
    setTheme(isDark ? "light" : "dark");
  }

  if (variant === "header") {
    return (
      <button
        onClick={toggle}
        aria-label={isDark ? "Activar modo claro" : "Activar modo escuro"}
        className="w-8 h-8 flex items-center justify-center rounded-full transition-colors hover:bg-gray-100 dark:hover:bg-gray-700/50 cursor-pointer"
      >
        <Icon
          name={isDark ? "light_mode" : "dark_mode"}
          size="sm"
          className="text-gray-500/80 dark:text-gray-400/80"
        />
      </button>
    );
  }

  return (
    <div className="relative group">
      <button
        onClick={toggle}
        aria-label={isDark ? "Activar modo claro" : "Activar modo escuro"}
        className={cn(
          "flex items-center gap-3 py-2 px-3 rounded-lg transition-colors duration-150 text-sm font-medium w-full cursor-pointer touch-manipulation",
          collapsed && "justify-center px-2",
          "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700/20"
        )}
      >
        <Icon
          name={isDark ? "light_mode" : "dark_mode"}
          size="sm"
          className="flex-shrink-0"
        />
        <span className={cn(
          "overflow-hidden transition-[width,opacity] duration-300 whitespace-nowrap",
          collapsed ? "w-0 opacity-0" : "w-full opacity-100"
        )}>
          {isDark ? "Modo claro" : "Modo escuro"}
        </span>
      </button>

      {collapsed && (
        <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 z-50 bg-gray-800 dark:bg-gray-700 text-white text-xs font-medium px-2.5 py-1.5 rounded-lg whitespace-nowrap shadow-lg opacity-0 -translate-x-1 scale-95 group-hover:opacity-100 group-hover:translate-x-0 group-hover:scale-100 transition-[opacity,transform] duration-150">
          {isDark ? "Modo claro" : "Modo escuro"}
          <span className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-800 dark:border-r-gray-700" />
        </div>
      )}
    </div>
  );
}
