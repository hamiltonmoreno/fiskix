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
-- ============================================================

ALTER FUNCTION public.enforce_fiscal_alerta_immutability()
  SET search_path = '';

REVOKE EXECUTE ON FUNCTION public.enforce_fiscal_alerta_immutability()
  FROM anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.handle_new_user()
  FROM anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.update_alerta_after_relatorio()
  FROM anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.update_atualizado_em()
  FROM anon, authenticated;
