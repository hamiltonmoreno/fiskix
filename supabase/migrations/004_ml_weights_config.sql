-- ============================================================
-- FISKIX - Migration 004
-- ML: pesos heurísticos v1 em configuracoes + RLS ml_predicoes
-- ============================================================

-- Inserir pesos do modelo ML (heurística calibrada a partir das regras R1-R9)
-- modelo_versao: "heuristic_v1" — substituir por "logistic_v1" após 100+ inspeções confirmadas
INSERT INTO configuracoes (chave, valor, descricao)
VALUES (
  'ml_pesos_v1',
  '{"queda_pct":0.35,"cv":0.20,"zscore":0.15,"slope":0.10,"ratio_pico":0.08,"alertas_12m":0.07,"perda_zona":0.05}',
  'Pesos da regressão logística v1 para score ML (Feature 1 - Fase 2)'
)
ON CONFLICT (chave) DO UPDATE
  SET valor = EXCLUDED.valor,
      descricao = EXCLUDED.descricao,
      atualizado_em = NOW();

-- Permitir que o service role insira/actualize ml_predicoes (via edge function)
CREATE POLICY "service_gere_ml_predicoes" ON ml_predicoes
  FOR ALL USING (auth.uid() IS NULL);
