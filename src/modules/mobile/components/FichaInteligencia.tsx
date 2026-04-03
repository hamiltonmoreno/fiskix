"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { ArrowLeft, Phone, ClipboardCheck } from "lucide-react";
import { getScoreColor, getScoreLabel } from "@/lib/utils";

interface Regra {
  regra: string;
  pontos: number;
  descricao: string;
  valor?: number;
  threshold?: number;
}

interface FichaProps {
  alertaId: string;
  medianaCluster: number | null;
  alerta: {
    id: string;
    score_risco: number;
    status: string;
    mes_ano: string;
    motivo: Regra[];
    clientes: {
      numero_contador: string;
      nome_titular: string;
      morada: string;
      tipo_tarifa: string;
      telemovel: string | null;
      subestacoes: { nome: string; zona_bairro: string };
    };
  };
  faturacaoHistorico: Array<{ mes_ano: string; kwh_faturado: number }>;
}

function ScoreCircle({ score }: { score: number }) {
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  const color = score >= 75 ? "#DC2626" : score >= 50 ? "#D97706" : "#16A34A";

  return (
    <div className="flex flex-col items-center">
      <svg width="120" height="120" viewBox="0 0 120 120">
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke="#E2E8F0"
          strokeWidth="10"
        />
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 60 60)"
          style={{
            transition: "stroke-dashoffset 1s ease-out",
          }}
        />
        <text
          x="60"
          y="55"
          textAnchor="middle"
          fill={color}
          fontSize="24"
          fontWeight="700"
          dominantBaseline="middle"
        >
          {score}
        </text>
        <text
          x="60"
          y="75"
          textAnchor="middle"
          fill="#94A3B8"
          fontSize="10"
        >
          /100
        </text>
      </svg>
      <span
        className="text-sm font-bold px-3 py-0.5 rounded-full mt-1"
        style={{
          color,
          backgroundColor: color + "20",
        }}
      >
        {getScoreLabel(score)}
      </span>
    </div>
  );
}

export function FichaInteligencia({
  alertaId,
  alerta,
  faturacaoHistorico,
  medianaCluster,
}: FichaProps) {
  const router = useRouter();
  const cliente = alerta.clientes;
  const regrasPontuadas = alerta.motivo.filter((r) => r.pontos > 0);
  const regrasZero = alerta.motivo.filter((r) => r.pontos === 0);

  // Dados para o gráfico
  const chartData = faturacaoHistorico.slice(-12).map((f) => ({
    mes: f.mes_ano.slice(5), // MM
    kwh: f.kwh_faturado,
  }));

  const mediaConsumo =
    faturacaoHistorico.length > 0
      ? faturacaoHistorico.reduce((s, f) => s + f.kwh_faturado, 0) /
        faturacaoHistorico.length
      : 0;

  return (
    <div
      className="min-h-screen pb-8"
      style={{ backgroundColor: "#F1F5F9", color: "#0F172A" }}
    >
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-4 py-3 sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-xl bg-slate-100"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div>
            <p className="font-semibold text-slate-900">{cliente.nome_titular}</p>
            <p className="text-xs text-slate-400">{cliente.numero_contador}</p>
          </div>
        </div>
      </header>

      <div className="p-4 space-y-4">
        {/* Score visual */}
        <div className="bg-white rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-500 text-sm">Score de Risco</p>
              <p className="text-xs text-slate-400 mt-0.5">{alerta.mes_ano}</p>
            </div>
            <ScoreCircle score={alerta.score_risco} />
          </div>

          {/* Regras que pontuaram */}
          {regrasPontuadas.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Anomalias Detetadas
              </p>
              {regrasPontuadas.map((r) => (
                <div
                  key={r.regra}
                  className="flex items-start gap-2 p-2.5 bg-red-50 rounded-xl"
                >
                  <span className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-xs font-mono shrink-0 mt-0.5">
                    {r.regra}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm text-red-800">{r.descricao}</p>
                  </div>
                  <span className="text-red-600 font-bold text-sm shrink-0">
                    +{r.pontos}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Gráfico de consumo */}
        <div className="bg-white rounded-2xl p-5">
          <p className="font-semibold text-slate-700 mb-1">Histórico de Consumo</p>
          <p className="text-xs text-slate-400 mb-4">
            Últimos {chartData.length} meses · Média própria: {mediaConsumo.toFixed(0)} kWh
            {medianaCluster !== null && ` · Mediana bairro: ${medianaCluster.toFixed(0)} kWh`}
          </p>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
              <XAxis
                dataKey="mes"
                tick={{ fontSize: 10, fill: "#94A3B8" }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis tick={{ fontSize: 10, fill: "#94A3B8" }} tickLine={false} axisLine={false} />
              <Tooltip
                formatter={(v: number) => [`${v} kWh`, "Consumo"]}
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
              />
              <ReferenceLine
                y={mediaConsumo}
                stroke="#94A3B8"
                strokeDasharray="4 4"
                label={{ value: "média", fontSize: 9, fill: "#94A3B8" }}
              />
              {medianaCluster !== null && (
                <ReferenceLine
                  y={medianaCluster}
                  stroke="#F59E0B"
                  strokeDasharray="4 4"
                  label={{ value: "bairro", fontSize: 9, fill: "#F59E0B" }}
                />
              )}
              <Bar
                dataKey="kwh"
                fill="#3B82F6"
                radius={[4, 4, 0, 0]}
                label={false}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Dados do titular */}
        <div className="bg-white rounded-2xl p-5 space-y-3">
          <p className="font-semibold text-slate-700">Dados do Titular</p>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-slate-400 text-xs">Contador</p>
              <p className="font-mono font-medium">{cliente.numero_contador}</p>
            </div>
            <div>
              <p className="text-slate-400 text-xs">Tarifa</p>
              <p className="font-medium">{cliente.tipo_tarifa}</p>
            </div>
            <div className="col-span-2">
              <p className="text-slate-400 text-xs">Morada</p>
              <p className="font-medium">{cliente.morada}</p>
            </div>
            <div className="col-span-2">
              <p className="text-slate-400 text-xs">Subestação</p>
              <p className="font-medium">{cliente.subestacoes.nome}</p>
            </div>
          </div>

          {cliente.telemovel && (
            <a
              href={`tel:${cliente.telemovel}`}
              className="flex items-center justify-center gap-2 w-full py-3 mt-2 bg-slate-100 rounded-xl text-slate-700 font-medium"
            >
              <Phone className="w-4 h-4" />
              {cliente.telemovel}
            </a>
          )}
        </div>

        {/* Botão de iniciar inspeção */}
        <Link
          href={`/mobile/${alertaId}/report`}
          className="flex items-center justify-center gap-2 w-full py-4 bg-blue-700 text-white rounded-2xl font-semibold text-base active:bg-blue-800 transition-colors"
          style={{ minHeight: "56px" }}
        >
          <ClipboardCheck className="w-5 h-5" />
          Iniciar Inspeção
        </Link>
      </div>
    </div>
  );
}
