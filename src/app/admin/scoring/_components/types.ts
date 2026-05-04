export interface Subestacao {
  id: string;
  nome: string;
  zona_bairro: string;
}

export interface ResultadoScoring {
  subestacao_id: string;
  nome: string;
  perda_pct: string;
  zona_vermelha: boolean;
  alertas_gerados: number;
  duracao_ms: number;
  error?: string;
}

export interface HistoricoRun {
  id: string;
  executado_em: string;
  mes_ano: string;
  subestacao: string;
  total_alertas: number;
  total_subestacoes: number;
  duracao_total_ms: number;
  resultados: ResultadoScoring[];
  sucesso: boolean;
}
