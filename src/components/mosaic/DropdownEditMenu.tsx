"use client";

import { useState, useRef, useEffect } from "react";
import { Icon } from "@/components/Icon";
import { cn } from "@/lib/utils";

interface EditMenuItem {
  label: string;
  icon?: string;
  onClick: () => void;
  danger?: boolean;
}

interface DropdownEditMenuProps {
  items: EditMenuItem[];
  align?: "left" | "right";
}

export function DropdownEditMenu({ items, align = "right" }: DropdownEditMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative inline-flex" ref={ref}>
      <button
        className={cn(
          "p-1 rounded-full transition-colors cursor-pointer",
          "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300",
          "hover:bg-gray-100 dark:hover:bg-gray-700/50",
          open && "bg-gray-100 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300"
        )}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
      >
        <span className="sr-only">Menu</span>
        <Icon name="more_horiz" size="sm" />
      </button>

      {open && (
        <div className={cn(
          "z-10 absolute top-full mt-1 w-40 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700/60 rounded-lg shadow-xl py-1.5 mosaic-dropdown-enter",
          align === "right" ? "right-0 origin-top-right" : "left-0 origin-top-left"
        )}>
          <ul>
            {items.map((item) => (
              <li key={item.label}>
                <button
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-1.5 text-sm transition-colors cursor-pointer",
                    item.danger
                      ? "text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                      : "text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700/20"
                  )}
                  onClick={() => {
                    setOpen(false);
                    item.onClick();
                  }}
                >
                  {item.icon && <Icon name={item.icon} size="xs" className="flex-shrink-0" />}
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
