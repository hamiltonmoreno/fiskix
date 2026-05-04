-- ============================================================
-- 005 — Fiscal alerta column immutability
--
-- The policy `fiscal_atualiza_alerta_inspecionado` (migration 004) lets
-- a fiscal UPDATE rows in `alertas_fraude` constrained to status and
-- zone. But Postgres RLS is row-level, not column-level: the policy
-- did not prevent the fiscal from also changing `score_risco`,
-- `motivo`, `id_cliente` or `mes_ano` in the same UPDATE. A corrupt
-- fiscal could therefore flip a Pendente_Inspecao alert straight to
-- Inspecionado / Falso_Positivo with score=0 and motivo=[], destroying
-- detection evidence and bypassing the relatorio_inspecao audit trail.
--
-- This migration installs a BEFORE UPDATE trigger that, when the
-- caller's role resolves to 'fiscal', enforces immutability of every
-- field except `status`, `resultado` and the bookkeeping `atualizado_em`.
-- Admin / gestor / system roles are unaffected.
-- ============================================================

CREATE OR REPLACE FUNCTION enforce_fiscal_alerta_immutability()
RETURNS TRIGGER AS $$
DECLARE
  caller_role user_role;
BEGIN
  -- get_user_role() already returns NULL for the service role, so this
  -- short-circuits cleanly when the scoring engine / edge functions run.
  caller_role := get_user_role();

  IF caller_role IS DISTINCT FROM 'fiscal' THEN
    RETURN NEW;
  END IF;

  -- Fiscal: only `status`, `resultado` and `atualizado_em` may change.
  IF NEW.id_cliente   IS DISTINCT FROM OLD.id_cliente   OR
     NEW.score_risco  IS DISTINCT FROM OLD.score_risco  OR
     NEW.motivo       IS DISTINCT FROM OLD.motivo       OR
     NEW.mes_ano      IS DISTINCT FROM OLD.mes_ano      OR
     NEW.criado_em    IS DISTINCT FROM OLD.criado_em
  THEN
    RAISE EXCEPTION 'fiscal pode alterar apenas status/resultado em alertas_fraude'
      USING ERRCODE = '42501';
  END IF;

  -- Only the documented Pendente_Inspecao -> Inspecionado transition.
  IF NOT (OLD.status = 'Pendente_Inspecao' AND NEW.status = 'Inspecionado') THEN
    RAISE EXCEPTION 'fiscal só pode marcar Pendente_Inspecao como Inspecionado'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_fiscal_alerta_immutability ON alertas_fraude;

CREATE TRIGGER trigger_fiscal_alerta_immutability
  BEFORE UPDATE ON alertas_fraude
  FOR EACH ROW EXECUTE FUNCTION enforce_fiscal_alerta_immutability();
