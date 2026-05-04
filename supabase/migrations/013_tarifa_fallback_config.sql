-- ============================================================
-- 013 — Add tarifa_fallback_cve_kwh to configuracoes
--
-- balanco-energetico edge function had a hardcoded fallback of 15 CVE/kWh
-- for the tarifa_media calculation when a substation has zero billed kWh
-- (rare, but happens for ghost substations or before the first import).
-- Move it to configuracoes so the Electra team can tune without redeploy,
-- consistent with limiar_perda_zona_pct and other tunables.
-- ============================================================

INSERT INTO configuracoes (chave, valor, descricao, atualizado_em)
VALUES (
  'tarifa_fallback_cve_kwh',
  '15',
  'Tarifa média (CVE/kWh) usada como fallback no cálculo de cve_perdido_estimado quando a subestação não tem faturação. Default: 15 (referência da tarifa Electra residencial).',
  NOW()
)
ON CONFLICT (chave) DO NOTHING;
