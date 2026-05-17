-- ============================================================
-- 023 — Security: A1 (handle_new_user role fixo) + A2 (ocr_claude_api_key RLS)
--
-- A1 — trigger handle_new_user aceitava role de raw_user_meta_data:
--   qualquer utilizador em sign-up podia passar role='admin_fiskix' via
--   supabase.auth.signUp({ data: { role: 'admin_fiskix' } }) e obter
--   acesso total. Corrigido: role fixo em 'fiscal'; apenas o admin
--   API route (service_role) promove roles após criação.
--
-- A2 — política config_select_gestor_no_keys excluía `chave LIKE 'api_key_%'`
--   mas ocr_claude_api_key não corresponde ao padrão → gestor_perdas e
--   diretor conseguiam ler a chave Anthropic no browser.
-- ============================================================

-- ---- A1: handle_new_user — role sempre 'fiscal' ------------------

CREATE OR REPLACE FUNCTION public.handle_new_user()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.perfis (id, nome_completo, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome_completo', NEW.email),
    'fiscal'::public.user_role
  );
  RETURN NEW;
END;
$$;

-- ---- A2: ocr_claude_api_key — excluir da política de gestor/diretor ---

DROP POLICY IF EXISTS "config_select_gestor_no_keys" ON public.configuracoes;

CREATE POLICY "config_select_gestor_no_keys" ON public.configuracoes
  FOR SELECT TO authenticated
  USING (
    (SELECT public.get_user_role()) IN ('diretor'::public.user_role, 'gestor_perdas'::public.user_role)
    AND chave NOT LIKE 'api_key_%'
    AND chave != 'ocr_claude_api_key'
  );

-- ---- A3: configuracoes — escrita restrita a admin_fiskix ----------
-- gestor_perdas/diretor só têm SELECT; sem esta policy poderiam
-- sobrescrever ocr_provider e escalar chamadas à API Anthropic.

DROP POLICY IF EXISTS "config_write_admin_only" ON public.configuracoes;

CREATE POLICY "config_write_admin_only" ON public.configuracoes
  FOR ALL TO authenticated
  USING (
    (SELECT public.get_user_role()) = 'admin_fiskix'::public.user_role
  )
  WITH CHECK (
    (SELECT public.get_user_role()) = 'admin_fiskix'::public.user_role
  );
