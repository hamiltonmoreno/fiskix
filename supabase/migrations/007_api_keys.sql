-- ============================================================
-- FISKIX - Migration 007
-- API Pública: chave de acesso para sistemas externos
-- ============================================================

-- Chave de API para a Electra (cliente inicial)
-- Formato: "api_key_<cliente>_<hash>"
-- IMPORTANTE: em produção, substituir o valor por uma chave real gerada com:
--   openssl rand -hex 32
INSERT INTO configuracoes (chave, valor, descricao)
VALUES (
  'api_key_electra',
  'fsk_electra_SUBSTITUIR_PELA_CHAVE_REAL',
  'API key para acesso externo da Electra (Cabo Verde). Revogar e regenerar se comprometida.'
)
ON CONFLICT (chave) DO NOTHING;

-- Índice para lookup rápido de API keys por prefixo
CREATE INDEX IF NOT EXISTS idx_configuracoes_api_keys
  ON configuracoes (chave)
  WHERE chave LIKE 'api_key_%';
