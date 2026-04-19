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
          "relative flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-150 text-sm font-medium cursor-pointer",
          collapsed && "justify-center px-2",
          active
            ? "bg-gray-100 dark:bg-gray-700/30 text-primary"
            : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700/20"
        )}
      >
        {/* Active indicator bar */}
        {active && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-primary rounded-r-full" />
        )}

        <Icon
          name={icon}
          size="sm"
          filled={active}
          className={cn(
            "flex-shrink-0 transition-colors duration-150",
            active ? "text-primary" : "text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300"
          )}
        />

        {sub ? (
          <div className={cn(
            "overflow-hidden transition-[width,opacity] duration-300 min-w-0 flex-1",
            collapsed ? "w-0 opacity-0" : "opacity-100"
          )}>
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate leading-tight">{label}</p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-tight truncate">{sub}</p>
          </div>
        ) : (
          <span className={cn(
            "overflow-hidden transition-[width,opacity] duration-300 whitespace-nowrap flex-1 truncate",
            collapsed ? "w-0 opacity-0" : "opacity-100"
          )}>
            {label}
          </span>
        )}

        {badge !== undefined && !collapsed && (
          <span className="ml-auto bg-primary text-white text-[10px] px-1.5 py-0.5 rounded-full leading-none font-medium">
            {badge}
          </span>
        )}
      </Link>

      {/* Collapsed tooltip */}
      {collapsed && (
        <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 z-50 bg-gray-800 dark:bg-gray-700 text-white text-xs font-medium px-2.5 py-1.5 rounded-lg whitespace-nowrap shadow-lg opacity-0 -translate-x-1 scale-95 group-hover:opacity-100 group-hover:translate-x-0 group-hover:scale-100 transition-[opacity,transform] duration-150">
          {label || sub}
          <span className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-800 dark:border-r-gray-700" />
        </div>
      )}
    </div>
  );
}
