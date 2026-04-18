"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { cn } from "@/lib/utils";
import { haptics } from "@/lib/haptics";

interface Notification {
  id: string;
  icon: string;
  title: string;
  body: string;
  time: string;
  unread?: boolean;
}

const SAMPLE_NOTIFICATIONS: Notification[] = [
  {
    id: "1",
    icon: "warning",
    title: "Alerta de fraude detectado",
    body: "Score de risco 95 identificado na zona Palmarejo",
    time: "Há 2h",
    unread: true,
  },
  {
    id: "2",
    icon: "trending_up",
    title: "Perdas acima do limite",
    body: "Subestação Achada Grande com 18.5% de perda técnica",
    time: "Há 5h",
    unread: true,
  },
  {
    id: "3",
    icon: "check_circle",
    title: "Relatório mensal gerado",
    body: "O relatório de Março 2026 está pronto para download",
    time: "Há 1d",
  },
];

export function DropdownNotifications() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const unreadCount = SAMPLE_NOTIFICATIONS.filter((n) => n.unread).length;

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
          "w-8 h-8 flex items-center justify-center rounded-full transition-colors cursor-pointer",
          "hover:bg-gray-100 dark:hover:bg-gray-700/50",
          open && "bg-gray-100 dark:bg-gray-700/50"
        )}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={(e) => { 
          e.stopPropagation(); 
          if (!open) haptics.light();
          setOpen(!open); 
        }}
      >
        <span className="sr-only">Notificações</span>
        <Icon name="notifications" size="sm" className="text-gray-500/80 dark:text-gray-400/80" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-gray-800" />
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="origin-top-right z-10 absolute top-full right-0 mt-1 w-80 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700/60 rounded-lg shadow-xl py-1.5 mosaic-dropdown-enter">
          <div className="px-4 pt-1.5 pb-2 border-b border-gray-200 dark:border-gray-700/60">
            <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase">Notificações</span>
          </div>
          <ul className="max-h-72 overflow-y-auto mosaic-scrollbar">
            {SAMPLE_NOTIFICATIONS.map((notif) => (
              <li key={notif.id} className="border-b border-gray-100 dark:border-gray-700/60 last:border-0">
                <Link
                  href="/alertas"
                  className="flex gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/20 transition-colors"
                  onClick={() => setOpen(false)}
                >
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5",
                    notif.unread
                      ? "bg-primary/10 text-primary"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-400"
                  )}>
                    <Icon name={notif.icon} size="xs" />
                  </div>
                  <div className="min-w-0">
                    <p className={cn(
                      "text-sm leading-tight",
                      notif.unread
                        ? "font-semibold text-gray-800 dark:text-gray-100"
                        : "text-gray-600 dark:text-gray-300"
                    )}>
                      {notif.title}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
                      {notif.body}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{notif.time}</p>
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
