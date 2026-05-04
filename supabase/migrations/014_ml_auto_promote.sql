-- ============================================================
-- 014 — ML auto-promote: heuristic_v1 → logistic_v1
--
-- Hoje a transição entre modelos ML é manual: alguém tem de fazer
-- UPDATE configuracoes SET valor='logistic_v1' WHERE chave='ml_modelo_ativo'.
-- Esta migration adiciona as keys necessárias para que o cron /api/cron/ml
-- promova automaticamente quando:
--   1. Nº de inspeções confirmadas (Fraude_Confirmada + Anomalia_Tecnica) >= threshold
--   2. ml_pesos_v1_logistic está definido (regressão logística treinada offline)
-- O cron loga a promoção; ml_modelo_ativo só muda 1 vez (idempotente).
-- ============================================================

INSERT INTO configuracoes (chave, valor, descricao) VALUES
  (
    'ml_modelo_ativo',
    'heuristic_v1',
    'Modelo ML ativo (heuristic_v1 ou logistic_v1). Auto-promovido pelo cron /api/cron/ml quando ml_inspecoes_promote_threshold é atingido E ml_pesos_v1_logistic está definido.'
  ),
  (
    'ml_inspecoes_promote_threshold',
    '100',
    'Nº mínimo de inspeções confirmadas (Fraude_Confirmada + Anomalia_Tecnica) acumuladas para auto-promover ml_modelo_ativo de heuristic_v1 para logistic_v1. Default 100 (suficiente para fitting básico).'
  )
ON CONFLICT (chave) DO NOTHING;
