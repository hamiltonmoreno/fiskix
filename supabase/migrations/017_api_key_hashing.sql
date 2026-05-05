-- ============================================================
-- 017 — API key hashing (A2): plaintext → SHA-256 hex
--
-- Antes desta migration, configuracoes.valor para chaves api_key_* era
-- guardado em plaintext. Qualquer leitura da tabela (admin authorized via
-- RLS de 016, backups, logs Supabase) expõe a chave irreversivelmente.
--
-- Esta migration:
--   1. Hasha as chaves existentes em-place (SHA-256 hex)
--   2. Documenta o novo formato em comentário
--
-- O código aplicacional (src/lib/api/auth.ts) já suporta ambos os formatos
-- via `.in("valor", [inputHash, key])` durante a transição. Após esta
-- migration aplicar e o deploy estabilizar (24h), a aceitação plaintext
-- pode ser removida do auth.ts.
--
-- IMPORTANTE: clientes B2B (Electra) continuam a enviar plaintext no
-- header `Authorization: Bearer <plaintext>`. O servidor hasha e compara.
-- ============================================================

-- pgcrypto está disponível em schema `extensions` (verificado).
UPDATE configuracoes
SET valor = encode(extensions.digest(valor, 'sha256'), 'hex'),
    atualizado_em = NOW()
WHERE chave LIKE 'api_key_%'
  AND length(valor) <> 64;  -- 64 hex chars = SHA-256 already hashed; skip se já feito (idempotente)

COMMENT ON COLUMN configuracoes.valor IS
  'Para chaves api_key_*, o valor é SHA-256 hex digest (64 chars). Verificação:
   sha256(input) == valor. Para outras chaves (limiares, ml_pesos_*), valor é
   plaintext serializado.';

-- Índice composto acelera o lookup .like("chave","api_key_%").in("valor",[...])
CREATE INDEX IF NOT EXISTS idx_configuracoes_api_key_lookup
  ON configuracoes (chave, valor)
  WHERE chave LIKE 'api_key_%';
