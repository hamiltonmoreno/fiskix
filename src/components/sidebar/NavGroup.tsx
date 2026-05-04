import { cn } from "@/lib/utils";
import { NavLink } from "./NavLink";
import type { NavItem } from "./types";

interface NavGroupProps {
  label: string;
  items: NavItem[];
  collapsed: boolean;
  isActive: (href: string) => boolean;
}

export function NavGroup({ label, items, collapsed, isActive }: NavGroupProps) {
  return (
    <div>
      {/* Group label — hidden when sidebar collapsed */}
      <div className={cn(
        "overflow-hidden transition-[max-height,opacity] duration-300",
        collapsed ? "max-h-0 opacity-0" : "max-h-10 opacity-100"
      )}>
        <h3 className="px-3 mb-2 text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-[0.08em]">
          {label}
        </h3>
      </div>

      {/* Collapsed: tiny divider line */}
      {collapsed && (
        <div className="mx-auto mb-2 w-4 border-t border-gray-200 dark:border-gray-700/60" />
      )}

      <div className="space-y-0.5">
        {items.map((item) => (
          <NavLink
            key={item.href}
            href={item.href}
            icon={item.icon}
            label={item.label}
            badge={item.badge}
            active={isActive(item.href)}
            collapsed={collapsed}
          />
        ))}
      </div>
    </div>
  );
}
