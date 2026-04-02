-- ============================================================
-- FISKIX - Schema SQL v1.0
-- 9 tabelas + RLS + Enums + Índices
-- ============================================================

-- Extensões
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE user_role AS ENUM (
  'admin_fiskix',
  'diretor',
  'gestor_perdas',
  'supervisor',
  'fiscal'
);

CREATE TYPE alerta_status AS ENUM (
  'Pendente',
  'Notificado_SMS',
  'Pendente_Inspecao',
  'Inspecionado'
);

CREATE TYPE inspecao_resultado AS ENUM (
  'Fraude_Confirmada',
  'Anomalia_Tecnica',
  'Falso_Positivo'
);

CREATE TYPE tipo_fraude AS ENUM (
  'Bypass',
  'Contador_adulterado',
  'Ligacao_vizinha',
  'Ima',
  'Outro'
);

CREATE TYPE tipo_tarifa AS ENUM (
  'Residencial',
  'Comercial',
  'Industrial',
  'Servicos_Publicos'
);

CREATE TYPE ilha AS ENUM (
  'Santiago',
  'Sao_Vicente',
  'Sal',
  'Santo_Antao',
  'Fogo',
  'Brava',
  'Maio',
  'Boa_Vista',
  'Sao_Nicolau',
  'Sao_Filipe'
);

-- ============================================================
-- TABELA 1: perfis (estende auth.users)
-- ============================================================

CREATE TABLE perfis (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'fiscal',
  id_zona TEXT,                          -- nome da zona/bairro (pode ser NULL = acesso global)
  nome_completo TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger para atualizar atualizado_em
CREATE OR REPLACE FUNCTION update_atualizado_em()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_perfis_atualizado_em
  BEFORE UPDATE ON perfis
  FOR EACH ROW EXECUTE FUNCTION update_atualizado_em();

-- Trigger para criar perfil automaticamente ao registar
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO perfis (id, nome_completo, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome_completo', NEW.email),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'fiscal')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- TABELA 2: subestacoes (postos de transformação)
-- ============================================================

CREATE TABLE subestacoes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome TEXT NOT NULL,
  zona_bairro TEXT NOT NULL,
  ilha ilha NOT NULL DEFAULT 'Santiago',
  capacidade_kwh NUMERIC,
  lat NUMERIC(10, 7) NOT NULL,
  lng NUMERIC(10, 7) NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_subestacoes_ilha ON subestacoes(ilha);
CREATE INDEX idx_subestacoes_zona ON subestacoes(zona_bairro);

-- ============================================================
-- TABELA 3: clientes (cadastro de instalações)
-- ============================================================

CREATE TABLE clientes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  numero_contador TEXT NOT NULL UNIQUE,
  id_subestacao UUID NOT NULL REFERENCES subestacoes(id),
  tipo_tarifa tipo_tarifa NOT NULL DEFAULT 'Residencial',
  nome_titular TEXT NOT NULL,
  morada TEXT NOT NULL,
  lat NUMERIC(10, 7),
  lng NUMERIC(10, 7),
  telemovel TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_clientes_subestacao ON clientes(id_subestacao);
CREATE INDEX idx_clientes_tarifa ON clientes(tipo_tarifa);
CREATE INDEX idx_clientes_contador ON clientes(numero_contador);

-- ============================================================
-- TABELA 4: injecao_energia (energia saída do transformador)
-- ============================================================

CREATE TABLE injecao_energia (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  id_subestacao UUID NOT NULL REFERENCES subestacoes(id),
  mes_ano TEXT NOT NULL,              -- formato: 'YYYY-MM'
  total_kwh_injetado NUMERIC NOT NULL CHECK (total_kwh_injetado >= 0),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(id_subestacao, mes_ano)
);

CREATE INDEX idx_injecao_subestacao_mes ON injecao_energia(id_subestacao, mes_ano);
CREATE INDEX idx_injecao_mes_ano ON injecao_energia(mes_ano);

-- ============================================================
-- TABELA 5: faturacao_clientes (faturação mensal por cliente)
-- ============================================================

CREATE TABLE faturacao_clientes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  id_cliente UUID NOT NULL REFERENCES clientes(id),
  mes_ano TEXT NOT NULL,              -- formato: 'YYYY-MM'
  kwh_faturado NUMERIC NOT NULL CHECK (kwh_faturado >= 0),
  valor_cve NUMERIC NOT NULL CHECK (valor_cve >= 0),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(id_cliente, mes_ano)
);

CREATE INDEX idx_faturacao_cliente_mes ON faturacao_clientes(id_cliente, mes_ano);
CREATE INDEX idx_faturacao_mes_ano ON faturacao_clientes(mes_ano);

-- ============================================================
-- TABELA 6: alertas_fraude (output do motor de scoring)
-- ============================================================

CREATE TABLE alertas_fraude (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  id_cliente UUID NOT NULL REFERENCES clientes(id),
  score_risco INTEGER NOT NULL CHECK (score_risco >= 0 AND score_risco <= 100),
  motivo JSONB NOT NULL DEFAULT '[]',  -- array de RegraMotivo
  status alerta_status NOT NULL DEFAULT 'Pendente',
  mes_ano TEXT NOT NULL,
  resultado inspecao_resultado,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(id_cliente, mes_ano)
);

CREATE INDEX idx_alertas_cliente ON alertas_fraude(id_cliente);
CREATE INDEX idx_alertas_mes_ano ON alertas_fraude(mes_ano);
CREATE INDEX idx_alertas_score ON alertas_fraude(score_risco DESC);
CREATE INDEX idx_alertas_status ON alertas_fraude(status);

CREATE TRIGGER trigger_alertas_atualizado_em
  BEFORE UPDATE ON alertas_fraude
  FOR EACH ROW EXECUTE FUNCTION update_atualizado_em();

-- ============================================================
-- TABELA 7: relatorios_inspecao (prova jurídica)
-- ============================================================

CREATE TABLE relatorios_inspecao (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  id_alerta UUID NOT NULL REFERENCES alertas_fraude(id),
  id_fiscal UUID NOT NULL REFERENCES perfis(id),
  resultado inspecao_resultado NOT NULL,
  tipo_fraude tipo_fraude,
  foto_url TEXT,
  foto_lat NUMERIC(10, 7),
  foto_lng NUMERIC(10, 7),
  observacoes TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_relatorios_alerta ON relatorios_inspecao(id_alerta);
CREATE INDEX idx_relatorios_fiscal ON relatorios_inspecao(id_fiscal);
CREATE INDEX idx_relatorios_resultado ON relatorios_inspecao(resultado);

-- ============================================================
-- TABELA 8: importacoes (log de uploads de dados)
-- ============================================================

CREATE TABLE importacoes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  id_utilizador UUID NOT NULL REFERENCES perfis(id),
  tipo TEXT NOT NULL CHECK (tipo IN ('faturacao', 'injecao')),
  nome_ficheiro TEXT NOT NULL,
  total_registos INTEGER NOT NULL DEFAULT 0,
  registos_sucesso INTEGER NOT NULL DEFAULT 0,
  registos_erro INTEGER NOT NULL DEFAULT 0,
  erros_json JSONB,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_importacoes_utilizador ON importacoes(id_utilizador);
CREATE INDEX idx_importacoes_tipo ON importacoes(tipo);
CREATE INDEX idx_importacoes_data ON importacoes(criado_em DESC);

-- ============================================================
-- TABELA 9: ml_predicoes (Fase 2 — vazia na PoC)
-- ============================================================

CREATE TABLE ml_predicoes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  id_cliente UUID NOT NULL REFERENCES clientes(id),
  mes_ano TEXT NOT NULL,
  score_ml NUMERIC NOT NULL CHECK (score_ml >= 0 AND score_ml <= 1),
  modelo_versao TEXT NOT NULL,
  features_json JSONB NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(id_cliente, mes_ano, modelo_versao)
);

-- ============================================================
-- TABELA 10: configuracoes (limiares ajustáveis)
-- ============================================================

CREATE TABLE configuracoes (
  chave TEXT PRIMARY KEY,
  valor TEXT NOT NULL,
  descricao TEXT,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Valores padrão
INSERT INTO configuracoes (chave, valor, descricao) VALUES
  ('limiar_queda_pct', '30', 'Percentagem mínima de queda para R1 (%)'),
  ('limiar_cv_maximo', '0.03', 'Coeficiente de variação máximo para R2'),
  ('limiar_mu_minimo', '15', 'Consumo médio mínimo (kWh) para R2'),
  ('limiar_zscore_cluster', '-2', 'Z-score mínimo para R3'),
  ('limiar_div_sazonal', '20', 'Divergência mínima sazonal para R4 (%)'),
  ('limiar_slope_tendencia', '-5', 'Slope mínimo para R5 (kWh/mês)'),
  ('limiar_ratio_racio', '2', 'Desvios padrão para R6'),
  ('limiar_pico_ratio', '0.20', 'Rácio mínimo pico histórico para R8'),
  ('limiar_perda_zona_pct', '15', 'Perda mínima por zona para Filtro Macro (%)'),
  ('limiar_score_medio', '50', 'Score mínimo para nível MÉDIO'),
  ('limiar_score_critico', '75', 'Score mínimo para nível CRÍTICO');

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE perfis ENABLE ROW LEVEL SECURITY;
ALTER TABLE subestacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE injecao_energia ENABLE ROW LEVEL SECURITY;
ALTER TABLE faturacao_clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE alertas_fraude ENABLE ROW LEVEL SECURITY;
ALTER TABLE relatorios_inspecao ENABLE ROW LEVEL SECURITY;
ALTER TABLE importacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ml_predicoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE configuracoes ENABLE ROW LEVEL SECURITY;

-- Função auxiliar para obter role do utilizador atual
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role AS $$
  SELECT role FROM perfis WHERE id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Função auxiliar para obter zona do utilizador atual
CREATE OR REPLACE FUNCTION get_user_zona()
RETURNS TEXT AS $$
  SELECT id_zona FROM perfis WHERE id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- ---- PERFIS ----
CREATE POLICY "utilizadores_veem_proprio_perfil" ON perfis
  FOR SELECT USING (id = auth.uid() OR get_user_role() IN ('admin_fiskix', 'gestor_perdas', 'supervisor'));

CREATE POLICY "admin_gere_perfis" ON perfis
  FOR ALL USING (get_user_role() = 'admin_fiskix');

CREATE POLICY "utilizadores_atualizam_proprio" ON perfis
  FOR UPDATE USING (id = auth.uid());

-- ---- SUBESTACOES ----
CREATE POLICY "todos_leem_subestacoes" ON subestacoes
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "admin_gestor_gerem_subestacoes" ON subestacoes
  FOR ALL USING (get_user_role() IN ('admin_fiskix', 'gestor_perdas'));

-- ---- CLIENTES ----
CREATE POLICY "clientes_leitura_autenticados" ON clientes
  FOR SELECT USING (
    auth.uid() IS NOT NULL AND (
      get_user_role() IN ('admin_fiskix', 'diretor', 'gestor_perdas', 'supervisor')
      OR (
        get_user_role() = 'fiscal' AND
        id_subestacao IN (
          SELECT id FROM subestacoes WHERE zona_bairro = get_user_zona()
        )
      )
    )
  );

CREATE POLICY "admin_gestor_gerem_clientes" ON clientes
  FOR ALL USING (get_user_role() IN ('admin_fiskix', 'gestor_perdas'));

-- ---- INJECAO_ENERGIA ----
CREATE POLICY "injecao_leitura" ON injecao_energia
  FOR SELECT USING (get_user_role() IN ('admin_fiskix', 'diretor', 'gestor_perdas', 'supervisor'));

CREATE POLICY "admin_gestor_inserem_injecao" ON injecao_energia
  FOR INSERT WITH CHECK (get_user_role() IN ('admin_fiskix', 'gestor_perdas'));

-- ---- FATURACAO_CLIENTES ----
CREATE POLICY "faturacao_leitura" ON faturacao_clientes
  FOR SELECT USING (get_user_role() IN ('admin_fiskix', 'diretor', 'gestor_perdas', 'supervisor'));

CREATE POLICY "admin_gestor_inserem_faturacao" ON faturacao_clientes
  FOR INSERT WITH CHECK (get_user_role() IN ('admin_fiskix', 'gestor_perdas'));

-- ---- ALERTAS_FRAUDE ----
CREATE POLICY "alertas_leitura_dashboard" ON alertas_fraude
  FOR SELECT USING (
    auth.uid() IS NOT NULL AND (
      get_user_role() IN ('admin_fiskix', 'diretor', 'gestor_perdas', 'supervisor')
      OR (
        get_user_role() = 'fiscal' AND
        status = 'Pendente_Inspecao' AND
        id_cliente IN (
          SELECT c.id FROM clientes c
          JOIN subestacoes s ON c.id_subestacao = s.id
          WHERE s.zona_bairro = get_user_zona()
        )
      )
    )
  );

CREATE POLICY "sistema_gere_alertas" ON alertas_fraude
  FOR ALL USING (get_user_role() IN ('admin_fiskix', 'gestor_perdas'));

-- ---- RELATORIOS_INSPECAO ----
CREATE POLICY "relatorios_leitura" ON relatorios_inspecao
  FOR SELECT USING (
    get_user_role() IN ('admin_fiskix', 'diretor', 'gestor_perdas', 'supervisor')
    OR (get_user_role() = 'fiscal' AND id_fiscal = auth.uid())
  );

CREATE POLICY "fiscal_insere_relatorio" ON relatorios_inspecao
  FOR INSERT WITH CHECK (
    get_user_role() IN ('admin_fiskix', 'gestor_perdas', 'fiscal') AND
    id_fiscal = auth.uid()
  );

-- ---- IMPORTACOES ----
CREATE POLICY "importacoes_leitura" ON importacoes
  FOR SELECT USING (get_user_role() IN ('admin_fiskix', 'gestor_perdas'));

CREATE POLICY "gestor_insere_importacoes" ON importacoes
  FOR INSERT WITH CHECK (get_user_role() IN ('admin_fiskix', 'gestor_perdas'));

-- ---- ML_PREDICOES ----
CREATE POLICY "ml_leitura" ON ml_predicoes
  FOR SELECT USING (get_user_role() IN ('admin_fiskix', 'gestor_perdas'));

-- ---- CONFIGURACOES ----
CREATE POLICY "todos_leem_config" ON configuracoes
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "admin_gere_config" ON configuracoes
  FOR ALL USING (get_user_role() = 'admin_fiskix');

-- ============================================================
-- STORAGE: bucket para fotos de inspeção
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'inspecoes',
  'inspecoes',
  false,
  10485760,  -- 10MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
);

CREATE POLICY "fiscal_upload_foto" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'inspecoes' AND
    auth.uid() IS NOT NULL
  );

CREATE POLICY "staff_lê_fotos" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'inspecoes' AND
    auth.uid() IS NOT NULL
  );
