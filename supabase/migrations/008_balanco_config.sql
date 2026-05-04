-- ============================================================
-- 003 — Balanço Energético configurável
-- Adiciona limiares usados pelo módulo de Balanço Energético
-- (página /balanco e edge function balanco-energetico).
-- ============================================================

INSERT INTO configuracoes (chave, valor, descricao) VALUES
  ('limiar_perda_tecnica_pct', '8', 'Perda técnica máxima esperada por subestação (%). Acima deste valor, o excedente é classificado como perda comercial.'),
  ('preco_cve_por_kwh', '15', 'Preço médio de venda em CVE por kWh, usado para estimar valor monetário das perdas.'),
  ('limiar_atencao_perda_pct', '15', 'Perda (%) acima da qual subestação é classificada como ATENÇÃO.'),
  ('limiar_critico_perda_pct', '25', 'Perda (%) acima da qual subestação é classificada como CRÍTICA.')
ON CONFLICT (chave) DO NOTHING;
