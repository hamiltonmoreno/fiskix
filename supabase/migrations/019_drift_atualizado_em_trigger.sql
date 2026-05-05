-- ============================================================
-- 019 — DRIFT D6: trigger atualizado_em em configuracoes
--
-- A coluna `atualizado_em` em `configuracoes` é DEFAULT NOW() apenas no
-- INSERT — UPDATEs não a actualizavam automaticamente. O fix manual da
-- migration 017 só funcionou porque o UPDATE incluía explicitamente
-- `SET atualizado_em = NOW()`.
--
-- Esta migration cria uma função genérica `tg_set_atualizado_em` e instala
-- um BEFORE UPDATE trigger em `configuracoes` para que qualquer UPDATE
-- (manual ou via app) actualize o timestamp automaticamente.
--
-- Deve ser instalado também em `perfis` e `alertas_fraude` no futuro
-- (ambos têm a coluna mas confirmaram-se com triggers próprios em
-- migrations anteriores — verificado via information_schema.triggers).
-- ============================================================

CREATE OR REPLACE FUNCTION public.tg_set_atualizado_em()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.atualizado_em = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS configuracoes_set_atualizado_em ON public.configuracoes;
CREATE TRIGGER configuracoes_set_atualizado_em
  BEFORE UPDATE ON public.configuracoes
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_set_atualizado_em();

COMMENT ON FUNCTION public.tg_set_atualizado_em() IS
  'Trigger genérico para BEFORE UPDATE — actualiza coluna atualizado_em para NOW(). Reutilizável em qualquer tabela com a coluna.';
