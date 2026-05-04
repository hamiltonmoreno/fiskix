-- ============================================================
-- 004 — Fiscal RLS hardening
--
-- Two gaps fixed:
--   (a) `fiscal_insere_relatorio` only checked `id_fiscal = auth.uid()`,
--       so a fiscal could submit a relatório for an alerta outside their
--       zone or for an alerta not in `Pendente_Inspecao`.
--   (b) There was no UPDATE policy on `alertas_fraude` for fiscals, even
--       though the mobile flow (RelatorioInspecao) sets the alerta status
--       to `Inspecionado` after submitting. The CLAUDE.md doc claimed
--       "fiscal só faz UPDATE em alertas Pendente_Inspecao na sua zona"
--       but no policy enforced this.
-- ============================================================

-- (a) Replace the relatório insert policy with a stricter version
DROP POLICY IF EXISTS "fiscal_insere_relatorio" ON relatorios_inspecao;

CREATE POLICY "fiscal_insere_relatorio" ON relatorios_inspecao
  FOR INSERT WITH CHECK (
    -- Admin / gestor: always allowed
    get_user_role() IN ('admin_fiskix', 'gestor_perdas')
    OR (
      get_user_role() = 'fiscal'
      AND id_fiscal = auth.uid()
      AND EXISTS (
        SELECT 1 FROM alertas_fraude a
        JOIN clientes c ON c.id = a.id_cliente
        JOIN subestacoes s ON s.id = c.id_subestacao
        WHERE a.id = relatorios_inspecao.id_alerta
          AND a.status = 'Pendente_Inspecao'
          AND s.zona_bairro = get_user_zona()
      )
    )
  );

-- (b) Add scoped UPDATE policy for fiscal on alertas_fraude.
-- Fiscal can only set status from Pendente_Inspecao to Inspecionado on
-- alertas in their own zone.
CREATE POLICY "fiscal_atualiza_alerta_inspecionado" ON alertas_fraude
  FOR UPDATE
  USING (
    get_user_role() = 'fiscal'
    AND status = 'Pendente_Inspecao'
    AND id_cliente IN (
      SELECT c.id FROM clientes c
      JOIN subestacoes s ON c.id_subestacao = s.id
      WHERE s.zona_bairro = get_user_zona()
    )
  )
  WITH CHECK (
    get_user_role() = 'fiscal'
    AND status = 'Inspecionado'
    AND id_cliente IN (
      SELECT c.id FROM clientes c
      JOIN subestacoes s ON c.id_subestacao = s.id
      WHERE s.zona_bairro = get_user_zona()
    )
  );
