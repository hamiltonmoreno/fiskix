-- ============================================================
-- 015 — configuracoes_audit: trail de alterações em configuracoes
--
-- Compliance Electra: pesos ML, thresholds e API keys são editáveis em
-- tempo real (sem deploy) por admin_fiskix/diretor. Falta evidência de
-- quem mudou o quê e quando — necessário para auditoria da concessionária
-- e para investigar comportamentos anómalos do scoring engine.
--
-- Esta migration cria:
--   1. tabela configuracoes_audit (append-only)
--   2. trigger function audit_configuracoes_changes()
--   3. triggers AFTER INSERT/UPDATE/DELETE em configuracoes
--   4. RLS: SELECT restricto a admin_fiskix/diretor; INSERT/UPDATE/DELETE
--      bloqueados (audit é write-once via trigger)
-- ============================================================

CREATE TABLE configuracoes_audit (
  id BIGSERIAL PRIMARY KEY,
  chave TEXT NOT NULL,
  operacao TEXT NOT NULL CHECK (operacao IN ('INSERT', 'UPDATE', 'DELETE')),
  valor_antes TEXT,
  valor_depois TEXT,
  usuario_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  usuario_role TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE configuracoes_audit IS
  'Append-only audit trail de alterações em configuracoes. Populado por trigger; nunca escrever directamente.';

CREATE INDEX idx_configuracoes_audit_chave ON configuracoes_audit(chave);
CREATE INDEX idx_configuracoes_audit_criado_em ON configuracoes_audit(criado_em DESC);
CREATE INDEX idx_configuracoes_audit_usuario ON configuracoes_audit(usuario_id);

-- ============================================================
-- Trigger function — populada com o user actual e o role do perfil.
-- Idempotente para mudanças que não alteram valor (UPDATE com valor igual
-- não regista, evitando ruído em upserts repetidos).
-- ============================================================

CREATE OR REPLACE FUNCTION audit_configuracoes_changes() RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID;
  v_user_role TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NOT NULL THEN
    SELECT role INTO v_user_role FROM public.perfis WHERE id = v_user_id;
  END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.configuracoes_audit (chave, operacao, valor_antes, valor_depois, usuario_id, usuario_role)
    VALUES (NEW.chave, 'INSERT', NULL, NEW.valor, v_user_id, v_user_role);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Skip se valor não mudou (evita ruído de upserts no-op)
    IF OLD.valor IS DISTINCT FROM NEW.valor THEN
      INSERT INTO public.configuracoes_audit (chave, operacao, valor_antes, valor_depois, usuario_id, usuario_role)
      VALUES (NEW.chave, 'UPDATE', OLD.valor, NEW.valor, v_user_id, v_user_role);
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.configuracoes_audit (chave, operacao, valor_antes, valor_depois, usuario_id, usuario_role)
    VALUES (OLD.chave, 'DELETE', OLD.valor, NULL, v_user_id, v_user_role);
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.audit_configuracoes_changes() FROM anon, authenticated;

CREATE TRIGGER trg_configuracoes_audit
  AFTER INSERT OR UPDATE OR DELETE ON configuracoes
  FOR EACH ROW EXECUTE FUNCTION audit_configuracoes_changes();

-- ============================================================
-- RLS: append-only, leitura restrita a admin_fiskix + diretor
-- ============================================================

ALTER TABLE configuracoes_audit ENABLE ROW LEVEL SECURITY;

-- Leitura: só admin_fiskix e diretor (compliance / investigação)
CREATE POLICY "audit_select_admin_diretor" ON configuracoes_audit
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM perfis
      WHERE perfis.id = auth.uid()
        AND perfis.role IN ('admin_fiskix', 'diretor')
    )
  );

-- Bloquear INSERT/UPDATE/DELETE manual: audit só pode ser escrito pelo trigger
-- (que corre com SECURITY DEFINER, ignorando RLS)
CREATE POLICY "audit_no_manual_writes" ON configuracoes_audit
  FOR ALL TO authenticated
  USING (false)
  WITH CHECK (false);
