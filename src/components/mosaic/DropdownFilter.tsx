"use client";

import { useState, useRef, useCallback } from "react";
import { Icon } from "@/components/Icon";
import { cn } from "@/lib/utils";
import { useClickOutside } from "@/hooks/useClickOutside";

interface FilterOption {
  label: string;
  value: string;
}

interface DropdownFilterProps {
  label?: string;
  options: FilterOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
}

export function DropdownFilter({ label = "Filtro", options, selected, onChange }: DropdownFilterProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);
  useClickOutside(ref, close);

  function toggleValue(value: string) {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  }

  return (
    <div className="relative inline-flex" ref={ref}>
      <button
        className={cn(
          "inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors cursor-pointer",
          "border-gray-200 dark:border-gray-700/60",
          "hover:border-gray-300 dark:hover:border-gray-600",
          "bg-white dark:bg-gray-800",
          "text-gray-600 dark:text-gray-300",
          open && "border-gray-300 dark:border-gray-600"
        )}
        onClick={() => setOpen(!open)}
      >
        <Icon name="filter_list" size="xs" className="text-gray-400" />
        {label}
        {selected.length > 0 && (
          <span className="bg-primary text-white text-[10px] px-1.5 py-0.5 rounded-full leading-none">
            {selected.length}
          </span>
        )}
      </button>

      {open && (
        <div className="origin-top-left z-10 absolute top-full left-0 mt-1 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700/60 rounded-lg shadow-xl py-1.5 mosaic-dropdown-enter">
          <div className="px-3 pt-1.5 pb-2 border-b border-gray-100 dark:border-gray-700/60">
            <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase">{label}</span>
          </div>
          <ul className="py-1.5">
            {options.map((opt) => (
              <li key={opt.value}>
                <label className="flex items-center gap-3 px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-700/20 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={selected.includes(opt.value)}
                    onChange={() => toggleValue(opt.value)}
                    className="rounded border-gray-300 dark:border-gray-600 text-primary focus:ring-primary/30"
                  />
                  <span className="text-sm text-gray-600 dark:text-gray-300">{opt.label}</span>
                </label>
              </li>
            ))}
          </ul>
          <div className="px-3 pt-1.5 pb-0.5 border-t border-gray-100 dark:border-gray-700/60">
            <button
              className="text-xs text-primary hover:text-primary/80 font-medium cursor-pointer"
              onClick={() => onChange([])}
            >
              Limpar filtros
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
