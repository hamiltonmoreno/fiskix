export interface KPIData {
  perda_cve_total: number;
  clientes_risco_critico: number;
  ordens_pendentes: number;
  receita_recuperada_ytd: number;
  variacao_perda_pct: number;   // vs mês anterior
  alertas_criticos: Array<{
    id: string;
    score_risco: number;
    status: string;
    cliente: { nome_titular: string; numero_contador: string };
    subestacao: { zona_bairro: string };
  }>;
}

export interface SubestacaoMapa {
  id: string;
  nome: string;
  zona_bairro: string;
  lat: number;
  lng: number;
  perda_pct: number;
  kwh_injetado: number;
  kwh_faturado: number;
  alertas_criticos: number;
}

export interface AlertaTabela {
  id: string;
  id_cliente: string;
  score_risco: number;
  status: string;
  mes_ano: string;
  resultado: string | null;
  motivo: Array<{ regra: string; pontos: number; descricao: string }>;
  cliente: {
    numero_contador: string;
    nome_titular: string;
    morada: string;
    tipo_tarifa: string;
    telemovel: string | null;
    email: string | null;
  };
  subestacao: {
    nome: string;
    zona_bairro: string;
  };
}

export interface Top5Transformador {
  nome: string;
  kwh_injetado: number;
  kwh_faturado: number;
  perda_pct: number;
  cve_recuperavel: number;
}
