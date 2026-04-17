import { Play, Loader2 } from "lucide-react";
import type { Subestacao } from "./types";

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
    <div className="bg-surface-container-lowest rounded-[1.5rem] p-6 shadow-sm border border-outline-variant/10">
      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-4">
        Configuração
      </p>

      <div className="space-y-4 mb-5">
        <div>
          <label className="block text-xs font-bold text-on-surface-variant mb-1.5">
            Mês / Ano
          </label>
          <input
            type="month"
            value={mesAno}
            onChange={(e) => onMesAnoChange(e.target.value)}
            className="w-full px-4 py-2.5 bg-surface-container-low text-on-surface rounded-xl text-sm border-none focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-on-surface-variant mb-1.5">
            Subestação
          </label>
          <select
            value={subSelecionada}
            onChange={(e) => onSubChange(e.target.value)}
            className="w-full px-4 py-2.5 bg-surface-container-low text-on-surface rounded-xl text-sm border-none focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer"
          >
            <option value="todas">Todas as subestações</option>
            {subestacoes.map((s) => (
              <option key={s.id} value={s.id}>{s.nome}</option>
            ))}
          </select>
        </div>
      </div>

      <button
        onClick={onExecutar}
        disabled={executando}
        className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-primary hover:bg-primary/90 disabled:opacity-60 text-white rounded-full font-bold text-sm transition-opacity cursor-pointer touch-manipulation"
      >
        {executando ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Play className="w-4 h-4" />
        )}
        {executando ? "A calcular scores..." : "Executar Scoring"}
      </button>
    </div>
  );
}
