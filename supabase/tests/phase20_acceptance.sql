-- Testes de contrato do banco. Executar em instância local/CI após as migrations.
BEGIN;

DO $$
DECLARE _missing TEXT[];
BEGIN
  SELECT array_agg(name) INTO _missing FROM unnest(ARRAY[
    'profiles','companies','batteries','collections','sorting_diagnostics','lots',
    'lot_batteries','proposals','operations','documents','private_documents',
    'status_history','audit_log','notifications','incidents'
  ]) name WHERE to_regclass('public.'||name) IS NULL;
  IF _missing IS NOT NULL THEN RAISE EXCEPTION 'Tabelas ausentes: %',_missing; END IF;

  IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname IN ('batteries','collections','lots','proposals','operations','documents','private_documents','notifications') AND NOT c.relrowsecurity)
  THEN RAISE EXCEPTION 'RLS ausente em tabela sensível'; END IF;

  IF EXISTS(SELECT 1 FROM storage.buckets WHERE id IN ('battery-files','workflow-documents','private-documents') AND public)
  THEN RAISE EXCEPTION 'Bucket privado configurado como público'; END IF;

  IF NOT EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='is_user_active')
  THEN RAISE EXCEPTION 'Função de bloqueio de usuário suspenso ausente'; END IF;

  IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='proposals' AND policyname='proposal recycler reads own')
  THEN RAISE EXCEPTION 'Isolamento de propostas próprias ausente'; END IF;

  IF EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='collections' AND policyname ILIKE '%open or assigned%')
  THEN RAISE EXCEPTION 'Transportadora ainda possui acesso a ordens não atribuídas'; END IF;
END $$;

-- A máquina de estados deve rejeitar uma transição inexistente antes de qualquer escrita.
DO $$
BEGIN
  IF EXISTS(SELECT 1 FROM public.battery_status_transitions WHERE from_status='rascunho' AND to_status='concluida')
  THEN RAISE EXCEPTION 'Transição inválida rascunho -> concluída encontrada'; END IF;
END $$;

ROLLBACK;

