"use client";

import { useEffect, useMemo, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp, AlertCircle, MessageSquare, ClipboardCheck, ShieldCheck, DollarSign } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatCVE, formatMesAno, getCurrentMesAno } from "@/lib/utils";

interface Profile {
  role: string;
  nome_completo: string;
  id_zona: string | null;
}

interface AlertaRow {
  status: string;
  resultado: string | null;
  mes_ano: string;
  score_risco: number;
  id_cliente: string;
}

const PRECO_KWH = 15; // CVE/kWh estimado
// Heurística: receita recuperada estimada por fraude confirmada =
//   média de consumo "perdido" do cliente × preço × 6 meses (período típico de subfaturação)
const MESES_RECUPERACAO = 6;

export function RecuperacaoClient({ profile }: { profile: Profile }) {
  const supabase = useMemo(() => createClient(), []);
  const [alertas, setAlertas] = useState<AlertaRow[]>([]);
  const [valorRecuperadoTotal, setValorRecuperadoTotal] = useState(0);
  const [evolucao, setEvolucao] = useState<Array<{ mes: string; detectado: number; confirmado: number; recuperado: number }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const mesAtual = getCurrentMesAno();
        const [year, month] = mesAtual.split("-").map(Number);
        const meses: string[] = [];
        for (let i = 11; i >= 0; i--) {
          const d = new Date(year, month - 1 - i, 1);
          meses.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
        }

        const { data: alertasData } = await supabase
          .from("alertas_fraude")
          .select("status, resultado, mes_ano, score_risco, id_cliente")
          .in("mes_ano", meses);

        const rows = (alertasData ?? []) as AlertaRow[];
        setAlertas(rows);

        // Estimativa do valor recuperado: por fraude confirmada, recupera-se o consumo
        // não-faturado (média histórica × preço × período)
        const confirmadas = rows.filter((a) => a.resultado === "Fraude_Confirmada");
        const idsClientes = [...new Set(confirmadas.map((a) => a.id_cliente))];

        let valorTotal = 0;
        if (idsClientes.length > 0) {
          const { data: faturacao } = await supabase
            .from("faturacao_clientes")
            .select("id_cliente, kwh_faturado")
            .in("id_cliente", idsClientes);

          const consumoMedio: Record<string, number> = {};
          for (const f of faturacao ?? []) {
            if (!consumoMedio[f.id_cliente]) consumoMedio[f.id_cliente] = 0;
            consumoMedio[f.id_cliente] += f.kwh_faturado;
          }
          for (const id of idsClientes) {
            const total = consumoMedio[id] ?? 0;
            const media = total / Math.max(meses.length, 1);
            valorTotal += media * PRECO_KWH * MESES_RECUPERACAO;
          }
        }
        setValorRecuperadoTotal(valorTotal);

        // Evolução mensal
        const porMes: Record<string, { detectado: number; confirmado: number; recuperado: number }> = {};
        for (const m of meses) porMes[m] = { detectado: 0, confirmado: 0, recuperado: 0 };
        for (const a of rows) {
          if (!porMes[a.mes_ano]) continue;
          porMes[a.mes_ano].detectado++;
          if (a.resultado === "Fraude_Confirmada") {
            porMes[a.mes_ano].confirmado++;
            // Aproximação: dividir o valor total proporcionalmente ao número de fraudes confirmadas
          }
        }
        const totalConfirmadas = confirmadas.length || 1;
        const valorMedioConfirmada = valorTotal / totalConfirmadas;
        for (const m of meses) {
          porMes[m].recuperado = porMes[m].confirmado * valorMedioConfirmada;
        }
        setEvolucao(meses.map((m) => ({ mes: m, ...porMes[m] })));
      } finally {
        setLoading(false);
      }
    })();
  }, [supabase]);

  // Pipeline counts
  const pipeline = useMemo(() => {
    const detectados = alertas.length;
    const notificados = alertas.filter((a) => ["Notificado_SMS", "Pendente_Inspecao", "Inspecionado"].includes(a.status)).length;
    const inspecionados = alertas.filter((a) => a.status === "Inspecionado").length;
    const confirmados = alertas.filter((a) => a.resultado === "Fraude_Confirmada").length;
    return { detectados, notificados, inspecionados, confirmados };
  }, [alertas]);

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8 w-full max-w-9xl mx-auto">
      <div className="sm:flex sm:justify-between sm:items-center mb-8">
        <div className="mb-4 sm:mb-0">
          <h1 className="text-2xl md:text-3xl text-gray-800 dark:text-gray-100 font-bold">
            Recuperação de Receita
          </h1>
          <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">
            Pipeline de deteção → cobrança · ROI da plataforma (últimos 12 meses)
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 mb-6">
        <KpiCard icon={AlertCircle} label="Detectados" value={pipeline.detectados} subtitle="alertas gerados" tone="slate" />
        <KpiCard icon={MessageSquare} label="Notificados" value={pipeline.notificados} subtitle={pipeline.detectados > 0 ? `${((pipeline.notificados / pipeline.detectados) * 100).toFixed(0)}% conv.` : ""} tone="blue" />
        <KpiCard icon={ClipboardCheck} label="Inspecionados" value={pipeline.inspecionados} subtitle={pipeline.notificados > 0 ? `${((pipeline.inspecionados / pipeline.notificados) * 100).toFixed(0)}% conv.` : ""} tone="amber" />
        <KpiCard icon={ShieldCheck} label="Confirmados" value={pipeline.confirmados} subtitle={pipeline.inspecionados > 0 ? `${((pipeline.confirmados / pipeline.inspecionados) * 100).toFixed(0)}% taxa` : ""} tone="red" />
        <KpiCard icon={DollarSign} label="Recuperado" value={loading ? "—" : formatCVE(valorRecuperadoTotal)} subtitle="estimado YTD" tone="green" big />
        <KpiCard icon={TrendingUp} label="Ticket médio" value={loading || pipeline.confirmados === 0 ? "—" : formatCVE(valorRecuperadoTotal / pipeline.confirmados)} subtitle="por fraude" tone="green" />
      </div>

      {/* Funnel visual */}
      <div className="bg-white dark:bg-gray-800 shadow-sm rounded-xl border border-gray-200 dark:border-gray-700/60 mosaic-card-hover p-5 mb-6">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-gray-200 mb-4">Funil de conversão</h3>
        <div className="space-y-2">
          <FunnelBar label="Detectados" value={pipeline.detectados} max={pipeline.detectados || 1} color="bg-slate-400" />
          <FunnelBar label="Notificados (SMS)" value={pipeline.notificados} max={pipeline.detectados || 1} color="bg-blue-500" />
          <FunnelBar label="Inspecionados" value={pipeline.inspecionados} max={pipeline.detectados || 1} color="bg-amber-500" />
          <FunnelBar label="Fraude confirmada" value={pipeline.confirmados} max={pipeline.detectados || 1} color="bg-red-500" />
        </div>
      </div>

      {/* Evolução mensal */}
      <div className="bg-white dark:bg-gray-800 shadow-sm rounded-xl border border-gray-200 dark:border-gray-700/60 mosaic-card-hover p-5">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-gray-200 mb-4">Evolução mensal (CVE recuperados)</h3>
        {loading ? (
          <div className="h-64 bg-slate-100 dark:bg-gray-900/40 animate-pulse rounded-lg" />
        ) : evolucao.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-gray-400 py-8 text-center">Sem dados para os últimos 12 meses.</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={evolucao} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id="recuperadoGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#1e7e34" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#1e7e34" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="mes" tickFormatter={(v) => v.split("-")[1]} tick={{ fontSize: 10, fill: "#64748b" }} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#64748b" }} tickLine={false} axisLine={false} tickFormatter={(v: number) => v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`} />
              <Tooltip formatter={(v: number) => formatCVE(v)} labelFormatter={(l) => formatMesAno(l as string)} />
              <Area type="monotone" dataKey="recuperado" stroke="#1e7e34" strokeWidth={2} fill="url(#recuperadoGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      <p className="text-xs text-slate-400 dark:text-gray-500 mt-4">
        * Receita recuperada estimada com heurística de {MESES_RECUPERACAO} meses de subfaturação × {PRECO_KWH} CVE/kWh.
        Refinar com dados reais de cobrança quando disponíveis.
      </p>
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  subtitle,
  tone,
  big,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  subtitle: string;
  tone: "red" | "amber" | "slate" | "blue" | "green";
  big?: boolean;
}) {
  const palette = {
    red: "bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400",
    amber: "bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400",
    slate: "bg-slate-100 text-slate-500 dark:bg-gray-700 dark:text-gray-400",
    blue: "bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400",
    green: "bg-green-100 text-green-600 dark:bg-green-500/20 dark:text-green-400",
  };
  return (
    <div className="bg-white dark:bg-gray-800 shadow-sm rounded-xl border border-gray-200 dark:border-gray-700/60 mosaic-card-hover p-4 sm:p-5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-slate-500 dark:text-gray-400 truncate">{label}</span>
        <div className={`p-2 rounded-lg ${palette[tone]} shrink-0`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className={`${big ? "text-xl" : "text-2xl"} font-bold text-slate-900 dark:text-gray-100 truncate`}>{value}</div>
      {subtitle && <p className="text-xs text-slate-500 dark:text-gray-400 mt-1 truncate">{subtitle}</p>}
    </div>
  );
}

function FunnelBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-slate-600 dark:text-gray-300 font-medium">{label}</span>
        <span className="text-slate-500 dark:text-gray-400 tabular-nums">
          {value} <span className="text-slate-400">({pct.toFixed(0)}%)</span>
        </span>
      </div>
      <div className="h-3 bg-slate-100 dark:bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full ${color} transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
