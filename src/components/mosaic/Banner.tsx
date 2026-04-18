"use client";

import { useState } from "react";
import { Icon } from "@/components/Icon";
import { cn } from "@/lib/utils";

interface BannerProps {
  type?: "info" | "warning" | "success" | "error";
  children: React.ReactNode;
  className?: string;
}

const TYPE_STYLES = {
  info: "bg-primary/5 border-primary/20 text-primary",
  warning: "bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-500/20 text-amber-700 dark:text-amber-400",
  success: "bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400",
  error: "bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-400",
};

const TYPE_ICONS = {
  info: "info",
  warning: "warning",
  success: "check_circle",
  error: "error",
};

export function Banner({ type = "info", children, className }: BannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className={cn(
      "relative flex items-center gap-3 px-4 py-3 rounded-lg border text-sm",
      TYPE_STYLES[type],
      className
    )}>
      <Icon name={TYPE_ICONS[type]} size="sm" className="flex-shrink-0" />
      <div className="flex-1 min-w-0">{children}</div>
      <button
        onClick={() => setDismissed(true)}
        className="flex-shrink-0 p-0.5 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
        aria-label="Fechar"
      >
        <Icon name="close" size="xs" />
      </button>
    </div>
  );
}
