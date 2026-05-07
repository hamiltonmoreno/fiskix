-- ============================================================
-- 021 — EDEC enrichment Fase 1
--
-- Adiciona campos extraídos da fatura EDEC que actualmente não capturamos:
--   - Identificadores fiscais (NIF, CIL, nº conta)
--   - Potência contratada (kW × 1000 → guardado em watts para integer)
--   - Unidade comercial (Praia, Mindelo, etc.)
--   - Meta-fatura: tipo de leitura (real vs estimada), leituras inicial/final,
--     saldo anterior/atual (dívida acumulada), componentes (electricidade,
--     IVA, audiovisual, IP, tarifa fixa) em JSONB, número de fatura, período
--     exacto de faturação.
--
-- Motivação: estes campos alimentam 3 novas regras de scoring (R10/R11/R12)
-- que exploram sinais financeiros/operacionais previamente invisíveis.
--
-- Compatibilidade: TODOS os campos novos são NULLABLE — `ingest-data` aceita
-- ficheiros sem eles, scoring engine retorna 0 quando dados em falta.
-- ============================================================

-- ─── clientes — identificação fiscal + potência + unidade comercial ──────────

ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS nif TEXT,
  ADD COLUMN IF NOT EXISTS cil TEXT,
  ADD COLUMN IF NOT EXISTS numero_conta TEXT,
  ADD COLUMN IF NOT EXISTS potencia_contratada_w INTEGER,
  ADD COLUMN IF NOT EXISTS unidade_comercial TEXT;

COMMENT ON COLUMN public.clientes.nif IS 'Número Identificação Fiscal do titular do contrato.';
COMMENT ON COLUMN public.clientes.cil IS 'Código Local Consumo (EDEC). Identifica fisicamente o ponto de consumo, invariante a mudanças de titular.';
COMMENT ON COLUMN public.clientes.numero_conta IS 'Nº Cliente/Conta EDEC (formato XXXXXXXX/XXX). Distinto de numero_contador (que identifica o equipamento).';
COMMENT ON COLUMN public.clientes.potencia_contratada_w IS 'Potência contratada em watts. Ex: 6.6 kW = 6600. Usado por R12 (subutilização anormal).';
COMMENT ON COLUMN public.clientes.unidade_comercial IS 'Praça comercial EDEC: PRAIA, MINDELO, etc. Para segmentação por região.';

-- Índice em CIL — usado em lookups quando muda o titular mas mantém-se o local
CREATE INDEX IF NOT EXISTS idx_clientes_cil ON public.clientes (cil) WHERE cil IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clientes_nif ON public.clientes (nif) WHERE nif IS NOT NULL;

-- ─── faturacao_clientes — meta-fatura + saldos + componentes ─────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tipo_leitura_enum') THEN
    CREATE TYPE public.tipo_leitura_enum AS ENUM ('real', 'estimada', 'empresa', 'cliente');
  END IF;
END $$;

ALTER TABLE public.faturacao_clientes
  ADD COLUMN IF NOT EXISTS numero_fatura TEXT,
  ADD COLUMN IF NOT EXISTS tipo_leitura public.tipo_leitura_enum,
  ADD COLUMN IF NOT EXISTS leitura_inicial NUMERIC,
  ADD COLUMN IF NOT EXISTS leitura_final NUMERIC,
  ADD COLUMN IF NOT EXISTS saldo_anterior_cve NUMERIC,
  ADD COLUMN IF NOT EXISTS saldo_atual_cve NUMERIC,
  ADD COLUMN IF NOT EXISTS componentes_jsonb JSONB,
  ADD COLUMN IF NOT EXISTS periodo_inicio DATE,
  ADD COLUMN IF NOT EXISTS periodo_fim DATE;

COMMENT ON COLUMN public.faturacao_clientes.numero_fatura IS 'Identificador único EDEC da fatura (ex: 017260306038690). Para conciliação.';
COMMENT ON COLUMN public.faturacao_clientes.tipo_leitura IS 'real (técnico no local) | estimada (algorítmica, recusa de acesso) | empresa | cliente. Estimada recorrente é sinal R11.';
COMMENT ON COLUMN public.faturacao_clientes.leitura_inicial IS 'Valor do contador no início do período. leitura_final - leitura_inicial == kwh_faturado quando tipo_leitura=real.';
COMMENT ON COLUMN public.faturacao_clientes.leitura_final IS 'Valor do contador no fim do período.';
COMMENT ON COLUMN public.faturacao_clientes.saldo_anterior_cve IS 'Saldo em dívida no início do período de faturação.';
COMMENT ON COLUMN public.faturacao_clientes.saldo_atual_cve IS 'Saldo em dívida após emissão da fatura. R10 dispara em saldos altos.';
COMMENT ON COLUMN public.faturacao_clientes.componentes_jsonb IS 'Decomposição: { electricidade, tarifa_fixa, iva, audiovisual, ip }. Soma == valor_cve quando completo.';
COMMENT ON COLUMN public.faturacao_clientes.periodo_inicio IS 'Data início do período facturado (ex: 2026-02-21).';
COMMENT ON COLUMN public.faturacao_clientes.periodo_fim IS 'Data fim do período facturado (ex: 2026-03-20).';

-- Índice em numero_fatura — para deduplicação no upsert da ingestão
CREATE UNIQUE INDEX IF NOT EXISTS idx_faturacao_numero_fatura
  ON public.faturacao_clientes (numero_fatura)
  WHERE numero_fatura IS NOT NULL;

-- ─── configuracoes — defaults para R10/R11/R12 ───────────────────────────────

INSERT INTO public.configuracoes (chave, valor, descricao) VALUES
  ('limiar_divida_acumulada_cve', '3000', 'R10: saldo_atual_cve >= este valor pontua. Default 3000 CVE (~30€).'),
  ('r10_pontos_max', '10', 'R10: pontuação máxima para dívida muito alta.'),
  ('r10_factor', '0.001', 'R10: pontos por CVE acima do limiar (linear, capped em r10_pontos_max).'),
  ('r11_meses_min_estimada', '3', 'R11: nº mínimo de meses consecutivos com leitura estimada para disparar.'),
  ('r11_pontos', '5', 'R11: pontos fixos quando R11 dispara.'),
  ('r12_threshold_pct', '1', 'R12: percentagem mínima (kWh real / capacidade contratada). Abaixo disto pontua.'),
  ('r12_pontos_max', '5', 'R12: pontuação máxima para subutilização extrema.')
ON CONFLICT (chave) DO NOTHING;
