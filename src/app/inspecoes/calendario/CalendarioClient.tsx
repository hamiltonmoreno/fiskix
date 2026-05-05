"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { ChevronLeft, ChevronRight, Calendar, AlertTriangle } from "lucide-react";

type Alerta = {
  id: string;
  criado_em: string;
  score_risco: number;
  clientes: { nome_titular: string; numero_contador: string; subestacoes: { zona_bairro: string } };
};

const MONTH_NAMES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const DAY_NAMES = ["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"];

function ScoreBadge({ score }: { score: number }) {
  const cls = score >= 75 ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700";
  return <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${cls}`}>{score}</span>;
}

export function CalendarioClient() {
  const supabase = useMemo(() => createClient(), []);
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewDate, setViewDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startOffset = (new Date(year, month, 1).getDay() + 6) % 7;

  const fetchAlertas = useCallback(async () => {
    setLoading(true);
    try {
      const from = `${year}-${String(month + 1).padStart(2, "0")}-01`;
      const to = `${year}-${String(month + 1).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}T23:59:59`;
      const { data } = await supabase
        .from("alertas_fraude")
        .select("id, criado_em, score_risco, clientes!inner(nome_titular, numero_contador, subestacoes!inner(zona_bairro))")
        .eq("status", "Pendente_Inspecao")
        .gte("criado_em", from)
        .lte("criado_em", to);
      setAlertas((data as unknown as Alerta[]) ?? []);
    } finally {
      setLoading(false);
    }
  }, [supabase, year, month, daysInMonth]);

  useEffect(() => { fetchAlertas(); }, [fetchAlertas]);

  const byDay = useMemo(() => {
    const map: Record<number, Alerta[]> = {};
    for (const a of alertas) {
      const d = new Date(a.criado_em).getDate();
      if (!map[d]) map[d] = [];
      map[d].push(a);
    }
    return map;
  }, [alertas]);

  const critical = alertas.filter((a) => a.score_risco >= 75).length;
  const selectedAlertas = selectedDay ? (byDay[selectedDay] ?? []) : [];

  const cells = Array.from({ length: startOffset + daysInMonth }, (_, i) =>
    i < startOffset ? null : i - startOffset + 1
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Calendar className="w-6 h-6 text-violet-600" />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Calendário de Inspeções</h1>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[["Pendentes", alertas.length, "text-gray-700"], ["Críticos (≥75)", critical, "text-red-600"], [`Mês: ${MONTH_NAMES[month]}`, daysInMonth + " dias", "text-violet-600"]].map(([label, val, cls]) => (
          <div key={String(label)} className="bg-white dark:bg-gray-800 shadow-sm rounded-xl border border-gray-200 dark:border-gray-700/60 mosaic-card-hover p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
            <p className={`text-2xl font-bold mt-1 ${cls}`}>{val}</p>
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-gray-800 shadow-sm rounded-xl border border-gray-200 dark:border-gray-700/60 mosaic-card-hover p-4">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setViewDate(new Date(year, month - 1, 1))} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"><ChevronLeft className="w-5 h-5" /></button>
          <span className="font-semibold text-gray-900 dark:text-white">{MONTH_NAMES[month]} {year}</span>
          <button onClick={() => setViewDate(new Date(year, month + 1, 1))} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"><ChevronRight className="w-5 h-5" /></button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-gray-500 mb-2">
          {DAY_NAMES.map((d) => <span key={d}>{d}</span>)}
        </div>
        {loading ? (
          <div className="h-48 flex items-center justify-center text-gray-400">A carregar...</div>
        ) : (
          <div className="grid grid-cols-7 gap-1">
            {cells.map((day, i) => {
              if (!day) return <div key={`e-${i}`} />;
              const count = byDay[day]?.length ?? 0;
              const isSelected = selectedDay === day;
              return (
                <button key={day} onClick={() => setSelectedDay(isSelected ? null : day)}
                  className={`aspect-square flex flex-col items-center justify-center rounded-lg text-sm transition-colors ${isSelected ? "bg-violet-100 dark:bg-violet-900/40 ring-2 ring-violet-500" : "hover:bg-gray-50 dark:hover:bg-gray-700/50"}`}>
                  <span className={`font-medium ${count > 0 ? "text-gray-900 dark:text-white" : "text-gray-400"}`}>{day}</span>
                  {count > 0 && (
                    <span className={`text-xs font-bold px-1 rounded-full mt-0.5 ${byDay[day]?.some((a) => a.score_risco >= 75) ? "bg-red-500 text-white" : "bg-amber-400 text-white"}`}>{count}</span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {selectedDay && (
        <div className="bg-white dark:bg-gray-800 shadow-sm rounded-xl border border-gray-200 dark:border-gray-700/60 mosaic-card-hover p-4 space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <h2 className="font-semibold text-gray-900 dark:text-white">Dia {selectedDay} — {selectedAlertas.length} inspeção(ões)</h2>
          </div>
          {selectedAlertas.length === 0 ? (
            <p className="text-sm text-gray-400">Sem inspeções pendentes.</p>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-700">
              {selectedAlertas.map((a) => (
                <li key={a.id} className="py-2 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{a.clientes.nome_titular}</p>
                    <p className="text-xs text-gray-500">{a.clientes.numero_contador} · {a.clientes.subestacoes.zona_bairro}</p>
                  </div>
                  <ScoreBadge score={a.score_risco} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
