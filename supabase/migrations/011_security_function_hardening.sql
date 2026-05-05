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
-- IDEMPOTENCY NOTE: REVOKE is wrapped in DO blocks with pg_proc lookups so
-- this migration can be re-applied to fresh databases (e.g. Supabase
-- preview branches) where some functions may not yet exist. Production
-- already has the migration applied; editing here does not re-run there.
-- The original failure was that update_alerta_after_relatorio() exists in
-- production but its creation migration (`trigger_update_alerta_status_on_relatorio`)
-- was never committed to this repo, so fresh DBs aborted at REVOKE.
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'enforce_fiscal_alerta_immutability'
      AND pronamespace = 'public'::regnamespace
  ) THEN
    EXECUTE 'ALTER FUNCTION public.enforce_fiscal_alerta_immutability() SET search_path = ''''';
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.enforce_fiscal_alerta_immutability() FROM anon, authenticated';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'handle_new_user'
      AND pronamespace = 'public'::regnamespace
  ) THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'update_alerta_after_relatorio'
      AND pronamespace = 'public'::regnamespace
  ) THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.update_alerta_after_relatorio() FROM anon, authenticated';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'update_atualizado_em'
      AND pronamespace = 'public'::regnamespace
  ) THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.update_atualizado_em() FROM anon, authenticated';
  END IF;
END $$;
