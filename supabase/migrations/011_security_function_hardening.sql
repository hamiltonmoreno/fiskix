-- ============================================================
-- 011 — Security: function search_path + REVOKE on trigger-only functions
--
-- (a) enforce_fiscal_alerta_immutability is a SECURITY DEFINER function
--     without a fixed search_path — vulnerable to search_path injection.
--
-- (b) Trigger-only functions (enforce_fiscal_alerta_immutability,
--     handle_new_user, update_alerta_after_relatorio, update_atualizado_em)
--     are callable via /rest/v1/rpc/ by anon and authenticated roles,
--     which is not intentional. REVOKE removes them from the public API.
--     get_user_role() and get_user_zona() are legitimately callable
--     (used in client-side RLS checks) — not revoked.
--
-- Idempotent: each block only fires if the function exists. Some of
-- these functions live in the initial schema setup (not in this repo's
-- migration history), so fresh-clone environments — Supabase preview
-- branches in particular — would otherwise fail when trying to revoke
-- from a function that doesn't exist yet.
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'enforce_fiscal_alerta_immutability'
      AND pronamespace = 'public'::regnamespace
  ) THEN
    EXECUTE $sql$ALTER FUNCTION public.enforce_fiscal_alerta_immutability() SET search_path = ''$sql$;
    EXECUTE $sql$REVOKE EXECUTE ON FUNCTION public.enforce_fiscal_alerta_immutability() FROM anon, authenticated$sql$;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'handle_new_user'
      AND pronamespace = 'public'::regnamespace
  ) THEN
    EXECUTE $sql$REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated$sql$;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'update_alerta_after_relatorio'
      AND pronamespace = 'public'::regnamespace
  ) THEN
    EXECUTE $sql$REVOKE EXECUTE ON FUNCTION public.update_alerta_after_relatorio() FROM anon, authenticated$sql$;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'update_atualizado_em'
      AND pronamespace = 'public'::regnamespace
  ) THEN
    EXECUTE $sql$REVOKE EXECUTE ON FUNCTION public.update_atualizado_em() FROM anon, authenticated$sql$;
  END IF;
END $$;
