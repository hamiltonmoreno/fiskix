"use client";

import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/Icon";

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
          "flex items-center gap-3 py-2.5 rounded-xl transition-[background-color,color] duration-150 text-sm font-medium w-full cursor-pointer touch-manipulation",
          collapsed ? "justify-center px-3" : "px-3",
          "text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
      >
        <Icon
          name={isDark ? "light_mode" : "dark_mode"}
          size="sm"
          className="flex-shrink-0 text-muted-foreground group-hover:text-foreground transition-colors"
        />
        <span
          className={cn(
            "overflow-hidden transition-[width,opacity] duration-300 whitespace-nowrap",
            collapsed ? "w-0 opacity-0" : "w-full opacity-100"
          )}
        >
          {isDark ? "Modo claro" : "Modo escuro"}
        </span>
      </button>

      {collapsed && (
        <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 z-50 bg-foreground text-background text-xs font-medium px-2.5 py-1.5 rounded-lg whitespace-nowrap shadow-lg opacity-0 -translate-x-1 scale-95 group-hover:opacity-100 group-hover:translate-x-0 group-hover:scale-100 transition-[opacity,transform] duration-150 ease-out">
          {isDark ? "Modo claro" : "Modo escuro"}
          <span className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-foreground" />
        </div>
      )}
    </div>
  );
}
