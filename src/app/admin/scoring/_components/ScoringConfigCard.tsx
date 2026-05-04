import { Play, Loader2 } from "lucide-react";
import type { Subestacao } from "./types";
import { haptics } from "@/lib/haptics";
import { Icon } from "@/components/Icon";

interface ScoringConfigCardProps {
  subestacoes: Subestacao[];
  mesAno: string;
  onMesAnoChange: (value: string) => void;
  subSelecionada: string;
  onSubChange: (value: string) => void;
  executando: boolean;
  onExecutar: () => void;
}

export function ScoringConfigCard({
  subestacoes,
  mesAno,
  onMesAnoChange,
  subSelecionada,
  onSubChange,
  executando,
  onExecutar,
}: ScoringConfigCardProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700/60 transition-all duration-300">
      <h2 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-6">
        Configuração da Execução
      </h2>

      <div className="space-y-5 mb-8">
        <div className="space-y-2">
          <label className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
            Período de Referência
          </label>
          <input
            type="month"
            value={mesAno}
            onChange={(e) => onMesAnoChange(e.target.value)}
            onFocus={() => haptics.light()}
            className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700/60 text-gray-900 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all"
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
            Subestação / Filtro
          </label>
          <select
            value={subSelecionada}
            onChange={(e) => { haptics.light(); onSubChange(e.target.value); }}
            className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700/60 text-gray-900 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 cursor-pointer transition-all"
          >
            <option value="todas">Todas as subestações (Global)</option>
            {subestacoes.map((s) => (
              <option key={s.id} value={s.id}>{s.nome}</option>
            ))}
          </select>
        </div>
      </div>

      <button
        onClick={() => { haptics.medium(); onExecutar(); }}
        disabled={executando}
        className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-bold text-sm transition-all shadow-sm shadow-blue-100 dark:shadow-none cursor-pointer"
      >
        {executando ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Icon name="play" size="xs" />
        )}
        {executando ? "A processar scores..." : "Executar Algoritmo"}
      </button>
    </div>
  );
}
