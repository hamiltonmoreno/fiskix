import { cn } from "@/lib/utils";
import { NavLink } from "./NavLink";

interface NavItem {
  label: string;
  href: string;
  icon: string;
  badge?: number;
}

interface NavGroupProps {
  label: string;
  items: NavItem[];
  collapsed: boolean;
  isActive: (href: string) => boolean;
}

export function NavGroup({ label, items, collapsed, isActive }: NavGroupProps) {
  return (
    <div>
      <div className={cn(
        "overflow-hidden transition-[max-height,opacity] duration-300",
        collapsed ? "max-h-0 opacity-0" : "max-h-10 opacity-100"
      )}>
        <p className="px-4 mb-2 text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em]">
          {label}
        </p>
      </div>
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
