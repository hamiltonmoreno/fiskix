"use client";

import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { createClient } from "@/lib/supabase/client";
import { formatCVE } from "@/lib/utils";

interface Top5Props {
  mesAno: string;
}

interface ChartDatum {
  nome: string;
  injetado: number;
  faturado: number;
  perda_pct: number;
  cve_recuperavel: number;
}

const CustomTooltip = ({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) => {
  if (!active || !payload?.length) return null;

  const inj = payload.find((p) => p.name === "Injetado")?.value ?? 0;
  const fat = payload.find((p) => p.name === "Faturado")?.value ?? 0;
  const perdaKwh = inj - fat;
  const perdaCVE = perdaKwh * 15;

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm text-sm">
      <p className="font-semibold text-slate-900 mb-2">{label}</p>
      <p className="text-blue-600">Injetado: {inj.toLocaleString("pt-CV")} kWh</p>
      <p className="text-green-600">Faturado: {fat.toLocaleString("pt-CV")} kWh</p>
      <p className="text-red-600 font-medium">
        Perda: {perdaKwh.toLocaleString("pt-CV")} kWh (~{formatCVE(Math.max(0, perdaCVE))})
      </p>
    </div>
  );
};

export function Top5Transformadores({ mesAno }: Top5Props) {
  const [data, setData] = useState<ChartDatum[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      setLoading(true);

      const { data: injecoes } = await supabase
        .from("injecao_energia")
        .select("id_subestacao, total_kwh_injetado, subestacoes(nome)")
        .eq("mes_ano", mesAno)
        .order("total_kwh_injetado", { ascending: false })
        .limit(5);

      if (!injecoes?.length) {
        setLoading(false);
        return;
      }

      const subIds = injecoes.map((i) => i.id_subestacao);

      const { data: clientes } = await supabase
        .from("clientes")
        .select("id, id_subestacao")
        .in("id_subestacao", subIds);

      const clienteIds = (clientes ?? []).map((c) => c.id);

      const { data: faturacao } = await supabase
        .from("faturacao_clientes")
        .select("id_cliente, kwh_faturado")
        .eq("mes_ano", mesAno)
        .in("id_cliente", clienteIds);

      const faturacaoPorCliente: Record<string, number> = {};
      for (const f of faturacao ?? []) {
        faturacaoPorCliente[f.id_cliente] = f.kwh_faturado;
      }

      const faturacaoPorSub: Record<string, number> = {};
      for (const c of clientes ?? []) {
        faturacaoPorSub[c.id_subestacao] =
          (faturacaoPorSub[c.id_subestacao] ?? 0) +
          (faturacaoPorCliente[c.id] ?? 0);
      }

      const chartData: ChartDatum[] = injecoes.map((inj) => {
        const sub = inj.subestacoes as unknown as { nome: string } | null;
        const kwh_injetado = inj.total_kwh_injetado;
        const kwh_faturado = faturacaoPorSub[inj.id_subestacao] ?? 0;
        const perda_pct =
          kwh_injetado > 0
            ? ((kwh_injetado - kwh_faturado) / kwh_injetado) * 100
            : 0;

        return {
          nome: sub?.nome ?? "Desconhecida",
          injetado: Math.round(kwh_injetado),
          faturado: Math.round(kwh_faturado),
          perda_pct: parseFloat(perda_pct.toFixed(1)),
          cve_recuperavel: Math.max(0, (kwh_injetado - kwh_faturado) * 15),
        };
      });

      setData(chartData);
      setLoading(false);
    }

    load();
  }, [mesAno]);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <h3 className="font-semibold text-slate-700 mb-4">
        Top 5 Transformadores — Energia Injetada vs Faturada
      </h3>
      {loading ? (
        <div className="h-64 bg-slate-100 animate-pulse rounded-lg" />
      ) : data.length === 0 ? (
        <div className="h-64 flex items-center justify-center text-slate-400 text-sm">
          Sem dados de injeção para {mesAno}
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis
              dataKey="nome"
              tick={{ fontSize: 11, fill: "#64748b" }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "#64748b" }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
            />
            <Bar dataKey="injetado" name="Injetado" fill="#3B82F6" radius={[4, 4, 0, 0]} />
            <Bar dataKey="faturado" name="Faturado" fill="#22C55E" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
