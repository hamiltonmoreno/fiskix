-- ============================================================
-- 024 — RLS hardening: configuracoes policies
--
-- A1 — config_write_admin_only (FOR ALL) covered admin_fiskix SELECT implicitly.
--   Dropping the write policy would silently remove admin read access.
--   Fix: split into explicit per-operation policies.
--
-- A2 — config_select_gestor_no_keys hard-coded ocr_claude_api_key as an
--   individual exclusion. Any future secret row that doesn't match
--   api_key_% would be readable by gestor_perdas/diretor.
--   Fix: replace the exclusion list with a pattern that auto-covers
--   any row whose key ends with _api_key, _secret, or _token.
-- ============================================================

-- ---- Drop the combined FOR ALL policy -------------------------
DROP POLICY IF EXISTS "config_write_admin_only" ON public.configuracoes;

-- ---- admin_fiskix: explicit per-operation policies ------------
CREATE POLICY "config_select_admin" ON public.configuracoes
  FOR SELECT TO authenticated
  USING (
    (SELECT public.get_user_role()) = 'admin_fiskix'::public.user_role
  );

CREATE POLICY "config_insert_admin" ON public.configuracoes
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT public.get_user_role()) = 'admin_fiskix'::public.user_role
  );

CREATE POLICY "config_update_admin" ON public.configuracoes
  FOR UPDATE TO authenticated
  USING (
    (SELECT public.get_user_role()) = 'admin_fiskix'::public.user_role
  )
  WITH CHECK (
    (SELECT public.get_user_role()) = 'admin_fiskix'::public.user_role
  );

CREATE POLICY "config_delete_admin" ON public.configuracoes
  FOR DELETE TO authenticated
  USING (
    (SELECT public.get_user_role()) = 'admin_fiskix'::public.user_role
  );

-- ---- diretor + gestor_perdas: read-only, no secret rows -------
-- Pattern covers: api_key_*, *_api_key, *_secret, *_token.
-- Non-secret ocr rows (ocr_provider, ocr_claude_model) remain readable.
DROP POLICY IF EXISTS "config_select_gestor_no_keys" ON public.configuracoes;

CREATE POLICY "config_select_gestor_no_keys" ON public.configuracoes
  FOR SELECT TO authenticated
  USING (
    (SELECT public.get_user_role()) IN ('diretor'::public.user_role, 'gestor_perdas'::public.user_role)
    AND NOT (
      chave LIKE 'api_key_%'
      OR chave LIKE '%_api_key'
      OR chave LIKE '%_secret'
      OR chave LIKE '%_token'
    )
  );
