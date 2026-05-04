"use client";

import { useState, useRef, useCallback } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { cn } from "@/lib/utils";
import { useClickOutside } from "@/hooks/useClickOutside";

export function DropdownHelp() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);
  useClickOutside(ref, close);

  const links = [
    { icon: "menu_book", label: "Documentação", href: "/docs", desc: "Guias e tutoriais" },
    { icon: "support_agent", label: "Suporte", href: "/suporte", desc: "Contactar equipa técnica" },
    { icon: "school", label: "Formação", href: "/formacao", desc: "Vídeos e material de treino" },
  ];

  return (
    <div className="relative inline-flex" ref={ref}>
      <button
        className={cn(
          "w-8 h-8 flex items-center justify-center rounded-full transition-colors cursor-pointer",
          "hover:bg-gray-100 dark:hover:bg-gray-700/50",
          open && "bg-gray-100 dark:bg-gray-700/50"
        )}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
      >
        <span className="sr-only">Ajuda</span>
        <Icon name="help_outline" size="sm" className="text-gray-500/80 dark:text-gray-400/80" />
      </button>

      {open && (
        <div className="origin-top-right z-10 absolute top-full right-0 mt-1 w-72 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700/60 rounded-lg shadow-xl py-1.5 mosaic-dropdown-enter">
          <div className="px-4 pt-1.5 pb-2 border-b border-gray-200 dark:border-gray-700/60">
            <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase">
              Centro de Ajuda
            </span>
          </div>
          <ul>
            {links.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700/20 transition-colors"
                  onClick={() => setOpen(false)}
                >
                  <Icon name={link.icon} size="sm" className="text-primary flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{link.label}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{link.desc}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
