"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { cn } from "@/lib/utils";
import { haptics } from "@/lib/haptics";
import { createClient } from "@/lib/supabase/client";
import { useClickOutside } from "@/hooks/useClickOutside";

interface Notification {
  id: string;
  icon: string;
  title: string;
  body: string;
  time: string;
}

interface AlertaRow {
  id: string;
  score_risco: number;
  status: string;
  created_at: string;
  clientes: { nome_titular: string; subestacoes: { zona_bairro: string } };
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 1) return "Há menos de 1h";
  if (hours < 24) return `Há ${hours}h`;
  const days = Math.floor(hours / 24);
  return `Há ${days}d`;
}

export function DropdownNotifications() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const ref = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  const close = useCallback(() => setOpen(false), []);
  useClickOutside(ref, close);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("alertas_fraude")
        .select(`
          id, score_risco, status, created_at,
          clientes!inner(nome_titular, subestacoes!inner(zona_bairro))
        `)
        .in("status", ["Pendente", "Notificado_SMS"])
        .gte("score_risco", 50)
        .order("score_risco", { ascending: false })
        .limit(5);

      if (!data) return;

      setNotifications(
        (data as unknown as AlertaRow[]).map((row) => {
          const cliente = row.clientes;
          const isCritical = row.score_risco >= 75;
          return {
            id: row.id,
            icon: isCritical ? "warning" : "trending_up",
            title: isCritical ? "Alerta crítico pendente" : "Alerta de risco médio",
            body: `Score ${row.score_risco} — ${cliente.nome_titular} (${cliente.subestacoes.zona_bairro.replace(/_/g, " ")})`,
            time: timeAgo(row.created_at),
          };
        })
      );
    }

    load();
  }, [supabase]);

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
        {notifications.length > 0 && (
          <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-gray-800" />
        )}
      </button>

      {open && (
        <div className="origin-top-right z-10 absolute top-full right-0 mt-1 w-80 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700/60 rounded-lg shadow-xl py-1.5 mosaic-dropdown-enter">
          <div className="px-4 pt-1.5 pb-2 border-b border-gray-200 dark:border-gray-700/60">
            <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase">Alertas pendentes</span>
          </div>
          <ul className="max-h-72 overflow-y-auto mosaic-scrollbar">
            {notifications.length === 0 ? (
              <li className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                Sem alertas pendentes
              </li>
            ) : (
              notifications.map((notif) => (
                <li key={notif.id} className="border-b border-gray-100 dark:border-gray-700/60 last:border-0">
                  <Link
                    href={`/alertas`}
                    className="flex gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/20 transition-colors"
                    onClick={() => setOpen(false)}
                  >
                    <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 bg-primary/10 text-primary">
                      <Icon name={notif.icon} size="xs" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 leading-tight">
                        {notif.title}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
                        {notif.body}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{notif.time}</p>
                    </div>
                  </Link>
                </li>
              ))
            )}
          </ul>
          {notifications.length > 0 && (
            <div className="px-4 pt-2 pb-1.5 border-t border-gray-100 dark:border-gray-700/60">
              <Link
                href="/alertas"
                className="text-xs text-primary hover:text-primary/80 font-medium"
                onClick={() => setOpen(false)}
              >
                Ver todos os alertas →
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
