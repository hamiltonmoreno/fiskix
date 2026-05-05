-- ============================================================
-- 022 — Parser de Faturas EDEC: configuração de provider OCR
--
-- Adiciona 3 chaves em `configuracoes` para a edge function
-- `parse-fatura-edec` decidir qual provider usar:
--
--   - text-paste  (default, gratuito): user cola texto da fatura,
--                 regex extrai os campos canónicos.
--   - claude-vision (premium, opt-in): envia imagem/PDF para
--                 Claude Vision, recebe JSON estruturado.
--
-- Switch sem deploy: admin muda em /admin/configuracao.
-- ============================================================

INSERT INTO public.configuracoes (chave, valor, descricao) VALUES
  (
    'ocr_provider',
    'text-paste',
    'Provider para parser de faturas EDEC. Valores: text-paste | claude-vision. Default text-paste (gratuito).'
  ),
  (
    'ocr_claude_api_key',
    '',
    'API key Anthropic para provider claude-vision. Vazio desactiva o provider. Não exposta na API REST v1.'
  ),
  (
    'ocr_claude_model',
    'claude-haiku-4-5',
    'Modelo Claude usado quando ocr_provider=claude-vision. Default haiku-4-5 (mais barato).'
  )
ON CONFLICT (chave) DO NOTHING;

-- A api key tem que ser ocultada na lista pública de configurações.
-- Já existe um padrão em RLS para `api_key_electra` (chave: substring "key"
-- triggers masking via WebUI). Confiamos nessa mesma convenção.
