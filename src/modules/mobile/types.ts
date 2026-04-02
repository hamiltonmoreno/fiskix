export interface OrdemFiscal {
  id: string;           // id do alerta_fraude
  score_risco: number;
  status: string;
  mes_ano: string;
  motivo: Array<{
    regra: string;
    pontos: number;
    descricao: string;
    valor?: number;
    threshold?: number;
  }>;
  cliente: {
    id: string;
    numero_contador: string;
    nome_titular: string;
    morada: string;
    tipo_tarifa: string;
    telemovel: string | null;
    lat: number | null;
    lng: number | null;
  };
  subestacao: {
    nome: string;
    zona_bairro: string;
  };
  faturacao_recente?: Array<{
    mes_ano: string;
    kwh_faturado: number;
  }>;
}

export interface RelatorioOffline {
  alerta_id: string;
  resultado: "Fraude_Confirmada" | "Anomalia_Tecnica" | "Falso_Positivo";
  tipo_fraude?: string;
  observacoes?: string;
  foto_data_url?: string;
  foto_lat?: number;
  foto_lng?: number;
  timestamp: number;
}
