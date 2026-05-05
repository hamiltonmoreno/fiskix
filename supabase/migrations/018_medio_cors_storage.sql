-- ============================================================
-- 018 — MÉDIO: CORS allowlist + storage RLS por owner
--
-- M4 — CORS allowlist via configuracoes
--   Adiciona chave api_v1_allowed_origins (CSV de origins permitidas).
--   apiCors() em código passa a filtrar origin por esta lista em vez de
--   wildcard *. Vazio = permite todas (compat retroativa para testes).
--
-- M5 — Storage RLS para fotos por owner+role
--   `staff_le_fotos` permitia qualquer authenticated SELECT em bucket
--   `inspecoes`. Restringido a:
--     - admin_fiskix/diretor/gestor_perdas: vêem todas
--     - fiscal: só vê fotos que ele próprio fez upload (owner = auth.uid())
--     - supervisor: sem acesso (pode adicionar-se depois se necessário)
-- ============================================================

-- M4: CORS allowlist
INSERT INTO configuracoes (chave, valor, descricao)
VALUES (
  'api_v1_allowed_origins',
  '',
  'CSV de origins (Origin header) permitidas em /api/v1/. Vazio = wildcard *. Exemplo: "https://erp.electra.cv,https://admin.electra.cv".'
)
ON CONFLICT (chave) DO NOTHING;

-- M5: Storage RLS — fotos por owner + role
DROP POLICY IF EXISTS "staff_le_fotos" ON storage.objects;
DROP POLICY IF EXISTS "staff_lê_fotos" ON storage.objects;

CREATE POLICY "fotos_select_admin_gestor" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'inspecoes'
    AND (SELECT get_user_role()) IN (
      'admin_fiskix'::user_role,
      'diretor'::user_role,
      'gestor_perdas'::user_role
    )
  );

CREATE POLICY "fotos_select_fiscal_owner" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'inspecoes'
    AND (SELECT get_user_role()) = 'fiscal'::user_role
    AND owner = auth.uid()
  );
