-- ============================================================
-- FISKIX - Migration 006
-- Balanço Energético Avançado: config de perdas técnicas estimadas
-- ============================================================

-- Limiar de perdas técnicas normais em rede de distribuição (benchmark padrão: 5%)
-- Perdas técnicas = resistência dos cabos, transformadores, etc.
-- Perdas comerciais = diferença entre perdas totais e técnicas estimadas (fraude + erros)
INSERT INTO configuracoes (chave, valor, descricao)
VALUES (
  'perda_tecnica_estimada_pct',
  '5',
  'Percentagem estimada de perdas técnicas normais da rede (%). Perdas acima deste valor são classificadas como perdas comerciais (fraude/erros).'
)
ON CONFLICT (chave) DO UPDATE
  SET valor = EXCLUDED.valor,
      descricao = EXCLUDED.descricao,
      atualizado_em = NOW();
