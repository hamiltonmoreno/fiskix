-- ============================================================
-- 020 — RLS: wrap auth.uid() in (SELECT auth.uid()) — initPlan optimization
--
-- Postgres re-evaluates `auth.uid()` per row when used directly in policy
-- predicates. Wrapping in `(SELECT auth.uid())` triggers initPlan, caching
-- the value once per statement → up to 100× speedup on large tables.
--
-- Source: https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv
--
-- Identified via pg_policy live audit:
--   - storage.objects.fiscal_upload_foto (with_check)
--   - storage.objects.fotos_select_fiscal_owner (qual: owner = auth.uid())
--   - public.configuracoes_audit.audit_select_admin_diretor (qual: subquery)
--
-- Other policies in the codebase already use `(SELECT auth.uid())` (verified
-- by query: 7 wrapped vs 3 unwrapped at time of writing).
-- ============================================================

-- ─── storage.objects: fiscal_upload_foto ──────────────────────────────────────
-- Fiscal pode fazer upload em bucket 'inspecoes'. INSERT only.
DROP POLICY IF EXISTS "fiscal_upload_foto" ON storage.objects;

CREATE POLICY "fiscal_upload_foto" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'inspecoes'
    AND (SELECT auth.uid()) IS NOT NULL
  );

-- ─── storage.objects: fotos_select_fiscal_owner ───────────────────────────────
-- Fiscal vê apenas fotos que ele próprio fez upload.
DROP POLICY IF EXISTS "fotos_select_fiscal_owner" ON storage.objects;

CREATE POLICY "fotos_select_fiscal_owner" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'inspecoes'
    AND (SELECT get_user_role()) = 'fiscal'::user_role
    AND owner = (SELECT auth.uid())
  );

-- ─── public.configuracoes_audit: audit_select_admin_diretor ───────────────────
-- Apenas admin_fiskix e diretor lêem o audit log.
DROP POLICY IF EXISTS "audit_select_admin_diretor" ON public.configuracoes_audit;

CREATE POLICY "audit_select_admin_diretor" ON public.configuracoes_audit
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.perfis
      WHERE perfis.id = (SELECT auth.uid())
        AND perfis.role = ANY (ARRAY['admin_fiskix'::user_role, 'diretor'::user_role])
    )
  );
