import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  className?: string;
  children?: React.ReactNode;
}

export function EmptyState({ icon: Icon, title, description, className, children }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-12 text-center", className)}>
      {Icon && <Icon className="w-10 h-10 text-slate-300 mb-3" />}
      <p className="text-slate-500 font-medium">{title}</p>
      {description && <p className="text-slate-400 text-sm mt-1">{description}</p>}
      {children}
    </div>
  );
}
