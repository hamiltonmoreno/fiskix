export interface HistoricoItem {
  id: string;
  tipo: string;
  nome_ficheiro: string;
  total_registos: number;
  registos_sucesso: number;
  registos_erro: number;
  criado_em: string;
}

export interface PreviewResult {
  preview: string[][];
  total: number;
  validos: number;
  erros_count: number;
  erros: Array<{ linha: number; campo: string; valor: string; motivo: string }>;
}

export interface ImportResult {
  total: number;
  sucesso: number;
  erros: number;
  detalhes_erros?: Array<{ linha: number; campo: string; motivo: string }>;
}
