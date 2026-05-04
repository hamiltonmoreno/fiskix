-- ============================================================
-- 016 — Security HOTFIX: C1 (configuracoes leak) + C2 (ml_predicoes anon) + A3 (search_path)
--
-- Findings da revisão de segurança consolidada:
--
-- C1 — `todos_leem_config` (renomeada `config_select` em 012) usava
--      `auth.uid() IS NOT NULL` → qualquer authenticated user (incluindo
--      fiscal no PWA mobile) podia ler `api_key_electra` e `ml_pesos_v1`
--      em plaintext via cliente browser anon+JWT. A página
--      /admin/configuracao já fazia `SELECT * FROM configuracoes` no
--      browser, expondo todo o conteúdo no React state.
--
-- C2 — `service_gere_ml_predicoes` usava `auth.uid() IS NULL` → anon
--      (acesso público com NEXT_PUBLIC_SUPABASE_ANON_KEY) podia ler,
--      apagar e inserir em `ml_predicoes` via REST API. A anon key é
--      pública (Vercel build).
--
-- A3 — `get_user_role`, `get_user_zona`, `handle_new_user` tinham
--      `SET search_path TO 'public'` (em vez de `''` + qualificação).
--      Defence-in-depth: passar a `''` força qualificação explícita e
--      torna as funções imunes a search_path injection mesmo se um
--      schema malicioso for criado em `public`.
-- ============================================================

-- ---- C1: configuracoes — granular SELECT por role -----------------

DROP POLICY IF EXISTS "todos_leem_config" ON configuracoes;
DROP POLICY IF EXISTS "config_select" ON configuracoes;

-- admin_fiskix lê TUDO (incluindo api_key_*, ml_pesos_*)
CREATE POLICY "config_select_admin_full" ON configuracoes
  FOR SELECT TO authenticated
  USING ((SELECT get_user_role()) = 'admin_fiskix'::user_role);

-- diretor / gestor_perdas lêem TUDO EXCEPTO api_key_*
-- Permite que /admin/configuracao continue a funcionar para estas roles
-- (já só editam limiares; INSERT/UPDATE/DELETE continua a ser admin-only
-- via policies config_insert/update/delete pré-existentes).
CREATE POLICY "config_select_gestor_no_keys" ON configuracoes
  FOR SELECT TO authenticated
  USING (
    (SELECT get_user_role()) IN ('diretor'::user_role, 'gestor_perdas'::user_role)
    AND chave NOT LIKE 'api_key_%'
  );

-- supervisor e fiscal: sem acesso (sem policy → sem leitura)

-- ---- C2: ml_predicoes — remover policy anon -----------------------

-- Esta policy permitia auth.uid() IS NULL (anon) ALL access. Service role
-- bypassa RLS sem precisar de policy explícita; portanto o cron e o
-- ml-scoring edge function continuam a funcionar via service role key.
-- A leitura por authenticated admin/gestor é coberta por `ml_leitura`.
DROP POLICY IF EXISTS "service_gere_ml_predicoes" ON ml_predicoes;

-- ---- A3: search_path hardening em SECURITY DEFINER functions ------

-- Setting current é 'public'. Mudar para '' força qualificação explícita.
-- Funções já têm search_path SET no body via SECURITY DEFINER; re-aplicamos
-- para garantir + qualificar referência a perfis no body.

CREATE OR REPLACE FUNCTION public.get_user_role()
  RETURNS user_role
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = ''
AS $$
  SELECT role FROM public.perfis WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.get_user_zona()
  RETURNS text
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = ''
AS $$
  SELECT id_zona FROM public.perfis WHERE id = auth.uid()
$$;

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
    COALESCE((NEW.raw_user_meta_data->>'role')::public.user_role, 'fiscal'::public.user_role)
  );
  RETURN NEW;
END;
$$;
