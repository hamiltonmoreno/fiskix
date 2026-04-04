-- ============================================================
-- FISKIX - Migration 003
-- Corrige RLS: fiscal pode fazer UPDATE em alertas_fraude
-- apenas em alertas com status 'Pendente_Inspecao' na sua zona
-- ============================================================

-- Permite que fiscal atualize o status/resultado de um alerta
-- quando esse alerta está em estado 'Pendente_Inspecao'
-- e o cliente pertence à zona do fiscal.
CREATE POLICY "fiscal_atualiza_alerta_inspecao" ON alertas_fraude
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
    AND id_cliente IN (
      SELECT c.id FROM clientes c
      JOIN subestacoes s ON c.id_subestacao = s.id
      WHERE s.zona_bairro = get_user_zona()
    )
  );
