-- ============================================================
-- 012 — RLS policy consolidation + init plan fix
--
-- Three problems resolved:
--
-- (a) alertas_fraude had 3 permissive UPDATE policies. Postgres OR-combines
--     permissive policies for both USING and WITH CHECK, so the old
--     alertas_update WITH CHECK NULL made the fiscal-scoped WITH CHECKs
--     in the other two policies irrelevant. Consolidated into one policy
--     with correct per-role WITH CHECK and (SELECT ...) subqueries.
--
-- (b) relatorios_inspecao had 2 permissive INSERT policies. The old
--     relatorios_insert allowed any fiscal to insert regardless of zone
--     or alerta status, making fiscal_insere_relatorio's stricter check
--     (from migration 009) a no-op. Drop the permissive one and rebuild
--     fiscal_insere_relatorio with (SELECT ...) wrappers to fix init plan.
--
-- (c) ml_predicoes.ml_leitura called get_user_role() directly, causing
--     re-evaluation per row (auth_rls_initplan warning). Wrap in SELECT.
-- ============================================================

-- ── (a) alertas_fraude: 3 UPDATE policies → 1 ───────────────────────────

DROP POLICY IF EXISTS "fiscal_atualiza_alerta_inspecao"    ON alertas_fraude;
DROP POLICY IF EXISTS "fiscal_atualiza_alerta_inspecionado" ON alertas_fraude;
DROP POLICY IF EXISTS "alertas_update"                      ON alertas_fraude;

CREATE POLICY "alertas_update" ON alertas_fraude
  FOR UPDATE
  USING (
    (SELECT get_user_role()) = ANY (ARRAY['admin_fiskix'::user_role, 'gestor_perdas'::user_role])
    OR (
      (SELECT get_user_role()) = 'fiscal'::user_role
      AND status = 'Pendente_Inspecao'::alerta_status
      AND id_cliente IN (
        SELECT c.id FROM clientes c
        JOIN subestacoes s ON c.id_subestacao = s.id
        WHERE s.zona_bairro = (SELECT get_user_zona())
      )
    )
  )
  WITH CHECK (
    (SELECT get_user_role()) = ANY (ARRAY['admin_fiskix'::user_role, 'gestor_perdas'::user_role])
    OR (
      (SELECT get_user_role()) = 'fiscal'::user_role
      AND status = 'Inspecionado'::alerta_status
      AND id_cliente IN (
        SELECT c.id FROM clientes c
        JOIN subestacoes s ON c.id_subestacao = s.id
        WHERE s.zona_bairro = (SELECT get_user_zona())
      )
    )
  );

-- ── (b) relatorios_inspecao: 2 INSERT policies → 1 ──────────────────────

DROP POLICY IF EXISTS "relatorios_insert"     ON relatorios_inspecao;
DROP POLICY IF EXISTS "fiscal_insere_relatorio" ON relatorios_inspecao;

CREATE POLICY "fiscal_insere_relatorio" ON relatorios_inspecao
  FOR INSERT WITH CHECK (
    (SELECT get_user_role()) = ANY (ARRAY['admin_fiskix'::user_role, 'gestor_perdas'::user_role])
    OR (
      (SELECT get_user_role()) = 'fiscal'::user_role
      AND id_fiscal = (SELECT auth.uid())
      AND EXISTS (
        SELECT 1 FROM alertas_fraude a
        JOIN clientes c ON c.id = a.id_cliente
        JOIN subestacoes s ON s.id = c.id_subestacao
        WHERE a.id = relatorios_inspecao.id_alerta
          AND a.status = 'Pendente_Inspecao'::alerta_status
          AND s.zona_bairro = (SELECT get_user_zona())
      )
    )
  );

-- ── (c) ml_predicoes: fix init plan on ml_leitura ───────────────────────

DROP POLICY IF EXISTS "ml_leitura" ON ml_predicoes;

CREATE POLICY "ml_leitura" ON ml_predicoes
  FOR SELECT
  USING (
    (SELECT get_user_role()) = ANY (ARRAY['admin_fiskix'::user_role, 'gestor_perdas'::user_role])
  );
