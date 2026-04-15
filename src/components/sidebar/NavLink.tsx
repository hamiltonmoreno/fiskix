import Link from "next/link";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/Icon";

interface NavLinkProps {
  href: string;
  icon: string;
  label: string;
  sub?: string;
  badge?: number;
  active: boolean;
  collapsed: boolean;
}

export function NavLink({ href, icon, label, sub, badge, active, collapsed }: NavLinkProps) {
  return (
    <div className="relative group">
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex items-center gap-3 px-4 py-2.5 rounded-lg mx-2 transition-all duration-150 text-sm font-medium cursor-pointer",
          collapsed && "justify-center px-3 mx-1",
          active
            ? "bg-surface-container-lowest dark:bg-slate-900 text-primary shadow-sm"
            : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-slate-800/50"
        )}
      >
        <Icon
          name={icon}
          size="sm"
          filled={active}
          className={cn(
            "flex-shrink-0",
            active ? "text-primary" : "text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200"
          )}
        />
        {sub ? (
          <div className={cn(
            "overflow-hidden transition-[width,opacity] duration-300 min-w-0 flex-1",
            collapsed ? "w-0 opacity-0" : "opacity-100"
          )}>
            <p className="text-sm font-semibold text-[#1a1c1f] dark:text-white truncate leading-tight">{label}</p>
            <p className="text-[11px] text-slate-500 leading-tight truncate">{sub}</p>
          </div>
        ) : (
          <span className={cn(
            "overflow-hidden transition-[width,opacity] duration-300 whitespace-nowrap flex-1",
            collapsed ? "w-0 opacity-0" : "opacity-100"
          )}>
            {label}
          </span>
        )}
        {badge !== undefined && !collapsed && (
          <span className="ml-auto bg-primary text-white text-[10px] px-1.5 py-0.5 rounded-full leading-none">
            {badge}
          </span>
        )}
      </Link>

      {collapsed && (
        <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 z-50 bg-[#1a1c1f] text-white text-xs font-medium px-2.5 py-1.5 rounded-lg whitespace-nowrap shadow-lg opacity-0 -translate-x-1 scale-95 group-hover:opacity-100 group-hover:translate-x-0 group-hover:scale-100 transition-[opacity,transform] duration-150">
          {label}
          <span className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-[#1a1c1f]" />
        </div>
      )}
    </div>
  );
}
