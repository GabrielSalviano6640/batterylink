-- =========================================================
-- FASE 3 — conclusão e compatibilidade do modelo canônico
--
-- Esta migração preserva o modelo legado consumido pela aplicação
-- (companies, org_members e nomes antigos de colunas), enquanto expõe
-- os nomes e relacionamentos definidos na especificação da Fase 3.
-- =========================================================

BEGIN;

-- ---------------------------------------------------------
-- 1. profiles: aliases canônicos e vínculo explícito ao auth
-- ---------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS auth_user_id UUID,
  ADD COLUMN IF NOT EXISTS nome TEXT,
  ADD COLUMN IF NOT EXISTS telefone TEXT;

UPDATE public.profiles
SET auth_user_id = id,
    nome = COALESCE(nome, full_name),
    telefone = COALESCE(telefone, phone)
WHERE auth_user_id IS NULL
   OR nome IS DISTINCT FROM COALESCE(nome, full_name)
   OR telefone IS DISTINCT FROM COALESCE(telefone, phone);

ALTER TABLE public.profiles ALTER COLUMN auth_user_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_auth_user_id_fkey') THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_auth_user_id_fkey
      FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_auth_user_id_uidx
  ON public.profiles(auth_user_id);

CREATE OR REPLACE FUNCTION public.tg_sync_profile_phase3()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.auth_user_id := NEW.id;
  IF TG_OP = 'UPDATE' THEN
    IF NEW.nome IS DISTINCT FROM OLD.nome THEN NEW.full_name := NEW.nome;
    ELSIF NEW.full_name IS DISTINCT FROM OLD.full_name THEN NEW.nome := NEW.full_name;
    END IF;
    IF NEW.telefone IS DISTINCT FROM OLD.telefone THEN NEW.phone := NEW.telefone;
    ELSIF NEW.phone IS DISTINCT FROM OLD.phone THEN NEW.telefone := NEW.phone;
    END IF;
  ELSE
    NEW.nome := COALESCE(NEW.nome, NEW.full_name);
    NEW.full_name := COALESCE(NEW.full_name, NEW.nome);
    NEW.telefone := COALESCE(NEW.telefone, NEW.phone);
    NEW.phone := COALESCE(NEW.phone, NEW.telefone);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_profile_phase3 ON public.profiles;
CREATE TRIGGER sync_profile_phase3
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.tg_sync_profile_phase3();

-- ---------------------------------------------------------
-- 2. organizations: companies permanece como tabela física
-- ---------------------------------------------------------
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS cnpj_cpf TEXT,
  ADD COLUMN IF NOT EXISTS status_aprovacao TEXT;

UPDATE public.companies
SET cnpj_cpf = COALESCE(cnpj_cpf, cnpj),
    status_aprovacao = COALESCE(status_aprovacao, status::TEXT);

CREATE INDEX IF NOT EXISTS companies_cnpj_cpf_idx
  ON public.companies(cnpj_cpf) WHERE cnpj_cpf IS NOT NULL;
CREATE INDEX IF NOT EXISTS companies_status_aprovacao_idx
  ON public.companies(status_aprovacao);

CREATE OR REPLACE FUNCTION public.tg_sync_company_phase3()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.cnpj_cpf IS DISTINCT FROM OLD.cnpj_cpf THEN NEW.cnpj := NEW.cnpj_cpf;
    ELSIF NEW.cnpj IS DISTINCT FROM OLD.cnpj THEN NEW.cnpj_cpf := NEW.cnpj;
    END IF;
    IF NEW.status_aprovacao IS DISTINCT FROM OLD.status_aprovacao THEN
      NEW.status := NEW.status_aprovacao::public.org_status;
    ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
      NEW.status_aprovacao := NEW.status::TEXT;
    END IF;
  ELSE
    NEW.cnpj_cpf := COALESCE(NEW.cnpj_cpf, NEW.cnpj);
    NEW.cnpj := COALESCE(NEW.cnpj, NEW.cnpj_cpf);
    NEW.status_aprovacao := COALESCE(NEW.status_aprovacao, NEW.status::TEXT);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_company_phase3 ON public.companies;
CREATE TRIGGER sync_company_phase3
  BEFORE INSERT OR UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.tg_sync_company_phase3();

DROP VIEW IF EXISTS public.organizations;
CREATE VIEW public.organizations
WITH (security_invoker = true)
AS
SELECT id, razao_social, nome_fantasia, cnpj_cpf, tipo_organizacao,
       email, telefone, cep, endereco, numero, complemento, cidade, estado,
       status_aprovacao, aprovado_por, aprovado_em, created_at, updated_at
FROM public.companies;

GRANT SELECT ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;

-- ---------------------------------------------------------
-- 3. organization_members: aliases sem quebrar org_members
-- ---------------------------------------------------------
ALTER TABLE public.org_members
  ADD COLUMN IF NOT EXISTS organization_id UUID,
  ADD COLUMN IF NOT EXISTS profile_id UUID,
  ADD COLUMN IF NOT EXISTS ativo BOOLEAN NOT NULL DEFAULT TRUE;

UPDATE public.org_members
SET organization_id = org_id,
    profile_id = user_id
WHERE organization_id IS NULL OR profile_id IS NULL;

ALTER TABLE public.org_members
  ALTER COLUMN organization_id SET NOT NULL,
  ALTER COLUMN profile_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'org_members_organization_id_fkey') THEN
    ALTER TABLE public.org_members
      ADD CONSTRAINT org_members_organization_id_fkey
      FOREIGN KEY (organization_id) REFERENCES public.companies(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'org_members_profile_id_fkey') THEN
    ALTER TABLE public.org_members
      ADD CONSTRAINT org_members_profile_id_fkey
      FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS org_members_organization_idx ON public.org_members(organization_id);
CREATE INDEX IF NOT EXISTS org_members_profile_idx ON public.org_members(profile_id);

CREATE OR REPLACE FUNCTION public.tg_sync_org_member_phase3()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN NEW.org_id := NEW.organization_id;
    ELSIF NEW.org_id IS DISTINCT FROM OLD.org_id THEN NEW.organization_id := NEW.org_id;
    END IF;
    IF NEW.profile_id IS DISTINCT FROM OLD.profile_id THEN NEW.user_id := NEW.profile_id;
    ELSIF NEW.user_id IS DISTINCT FROM OLD.user_id THEN NEW.profile_id := NEW.user_id;
    END IF;
  ELSE
    NEW.organization_id := COALESCE(NEW.organization_id, NEW.org_id);
    NEW.org_id := COALESCE(NEW.org_id, NEW.organization_id);
    NEW.profile_id := COALESCE(NEW.profile_id, NEW.user_id);
    NEW.user_id := COALESCE(NEW.user_id, NEW.profile_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_org_member_phase3 ON public.org_members;
CREATE TRIGGER sync_org_member_phase3
  BEFORE INSERT OR UPDATE ON public.org_members
  FOR EACH ROW EXECUTE FUNCTION public.tg_sync_org_member_phase3();

DROP VIEW IF EXISTS public.organization_members;
CREATE VIEW public.organization_members
WITH (security_invoker = true)
AS
SELECT id, organization_id, profile_id, role, ativo, created_at
FROM public.org_members;

GRANT SELECT ON public.organization_members TO authenticated;
GRANT ALL ON public.organization_members TO service_role;

-- ---------------------------------------------------------
-- 5. batteries: aliases canônicos e organização geradora
-- ---------------------------------------------------------
ALTER TABLE public.batteries
  ADD COLUMN IF NOT EXISTS codigo_unico TEXT,
  ADD COLUMN IF NOT EXISTS generator_organization_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS peso_estimado_kg NUMERIC,
  ADD COLUMN IF NOT EXISTS estado_aparente TEXT,
  ADD COLUMN IF NOT EXISTS cep_origem TEXT,
  ADD COLUMN IF NOT EXISTS cidade_origem TEXT,
  ADD COLUMN IF NOT EXISTS estado_origem TEXT,
  ADD COLUMN IF NOT EXISTS endereco_coleta TEXT,
  ADD COLUMN IF NOT EXISTS status_atual TEXT;

UPDATE public.batteries
SET codigo_unico = COALESCE(codigo_unico, code),
    generator_organization_id = COALESCE(generator_organization_id, company_id),
    peso_estimado_kg = COALESCE(peso_estimado_kg, peso_kg),
    estado_aparente = COALESCE(estado_aparente, estado),
    cep_origem = COALESCE(cep_origem, cep),
    cidade_origem = COALESCE(cidade_origem, cidade),
    estado_origem = COALESCE(estado_origem, uf),
    endereco_coleta = COALESCE(endereco_coleta, endereco),
    status_atual = COALESCE(status_atual, status::TEXT);

ALTER TABLE public.batteries ALTER COLUMN codigo_unico SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS batteries_codigo_unico_uidx ON public.batteries(codigo_unico);
CREATE INDEX IF NOT EXISTS batteries_generator_org_idx ON public.batteries(generator_organization_id);
CREATE INDEX IF NOT EXISTS batteries_created_by_idx ON public.batteries(created_by);

CREATE OR REPLACE FUNCTION public.tg_sync_battery_phase3()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.codigo_unico IS DISTINCT FROM OLD.codigo_unico THEN NEW.code := NEW.codigo_unico;
    ELSIF NEW.code IS DISTINCT FROM OLD.code THEN NEW.codigo_unico := NEW.code;
    END IF;
    IF NEW.generator_organization_id IS DISTINCT FROM OLD.generator_organization_id THEN NEW.company_id := NEW.generator_organization_id;
    ELSIF NEW.company_id IS DISTINCT FROM OLD.company_id THEN NEW.generator_organization_id := NEW.company_id;
    END IF;
    IF NEW.peso_estimado_kg IS DISTINCT FROM OLD.peso_estimado_kg THEN NEW.peso_kg := NEW.peso_estimado_kg;
    ELSIF NEW.peso_kg IS DISTINCT FROM OLD.peso_kg THEN NEW.peso_estimado_kg := NEW.peso_kg;
    END IF;
    IF NEW.estado_aparente IS DISTINCT FROM OLD.estado_aparente THEN NEW.estado := NEW.estado_aparente;
    ELSIF NEW.estado IS DISTINCT FROM OLD.estado THEN NEW.estado_aparente := NEW.estado;
    END IF;
    IF NEW.cep_origem IS DISTINCT FROM OLD.cep_origem THEN NEW.cep := NEW.cep_origem;
    ELSIF NEW.cep IS DISTINCT FROM OLD.cep THEN NEW.cep_origem := NEW.cep;
    END IF;
    IF NEW.cidade_origem IS DISTINCT FROM OLD.cidade_origem THEN NEW.cidade := NEW.cidade_origem;
    ELSIF NEW.cidade IS DISTINCT FROM OLD.cidade THEN NEW.cidade_origem := NEW.cidade;
    END IF;
    IF NEW.estado_origem IS DISTINCT FROM OLD.estado_origem THEN NEW.uf := NEW.estado_origem;
    ELSIF NEW.uf IS DISTINCT FROM OLD.uf THEN NEW.estado_origem := NEW.uf;
    END IF;
    IF NEW.endereco_coleta IS DISTINCT FROM OLD.endereco_coleta THEN NEW.endereco := NEW.endereco_coleta;
    ELSIF NEW.endereco IS DISTINCT FROM OLD.endereco THEN NEW.endereco_coleta := NEW.endereco;
    END IF;
    IF NEW.status_atual IS DISTINCT FROM OLD.status_atual THEN NEW.status := NEW.status_atual::public.battery_status;
    ELSIF NEW.status IS DISTINCT FROM OLD.status THEN NEW.status_atual := NEW.status::TEXT;
    END IF;
  ELSE
    NEW.codigo_unico := COALESCE(NEW.codigo_unico, NEW.code, public.next_battery_code());
    NEW.code := COALESCE(NEW.code, NEW.codigo_unico);
    NEW.generator_organization_id := COALESCE(NEW.generator_organization_id, NEW.company_id);
    NEW.company_id := COALESCE(NEW.company_id, NEW.generator_organization_id);
    NEW.peso_estimado_kg := COALESCE(NEW.peso_estimado_kg, NEW.peso_kg);
    NEW.peso_kg := COALESCE(NEW.peso_kg, NEW.peso_estimado_kg);
    NEW.estado_aparente := COALESCE(NEW.estado_aparente, NEW.estado);
    NEW.estado := COALESCE(NEW.estado, NEW.estado_aparente);
    NEW.cep_origem := COALESCE(NEW.cep_origem, NEW.cep);
    NEW.cep := COALESCE(NEW.cep, NEW.cep_origem);
    NEW.cidade_origem := COALESCE(NEW.cidade_origem, NEW.cidade);
    NEW.cidade := COALESCE(NEW.cidade, NEW.cidade_origem);
    NEW.estado_origem := COALESCE(NEW.estado_origem, NEW.uf);
    NEW.uf := COALESCE(NEW.uf, NEW.estado_origem);
    NEW.endereco_coleta := COALESCE(NEW.endereco_coleta, NEW.endereco);
    NEW.endereco := COALESCE(NEW.endereco, NEW.endereco_coleta);
    NEW.status_atual := COALESCE(NEW.status_atual, NEW.status::TEXT);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_battery_phase3 ON public.batteries;
CREATE TRIGGER sync_battery_phase3
  BEFORE INSERT OR UPDATE ON public.batteries
  FOR EACH ROW EXECUTE FUNCTION public.tg_sync_battery_phase3();

-- ---------------------------------------------------------
-- 7. collections: vínculo da transportadora com organização
-- ---------------------------------------------------------
ALTER TABLE public.collections
  ADD COLUMN IF NOT EXISTS carrier_organization_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;

UPDATE public.collections c
SET carrier_organization_id = (
  SELECT m.org_id
  FROM public.org_members m
  JOIN public.companies co ON co.id = m.org_id
  WHERE m.user_id = c.transportadora_id
    AND (co.tipo = 'transportadora' OR co.tipo_organizacao = 'transportadora')
  ORDER BY m.created_at
  LIMIT 1
)
WHERE c.carrier_organization_id IS NULL
  AND c.transportadora_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS collections_codigo_coleta_idx
  ON public.collections(codigo_coleta) WHERE codigo_coleta IS NOT NULL;
CREATE INDEX IF NOT EXISTS collections_battery_idx ON public.collections(battery_id);
CREATE INDEX IF NOT EXISTS collections_generator_org_idx ON public.collections(generator_organization_id);
CREATE INDEX IF NOT EXISTS collections_carrier_org_idx ON public.collections(carrier_organization_id);
CREATE INDEX IF NOT EXISTS collections_operator_org_idx ON public.collections(operator_organization_id);
CREATE INDEX IF NOT EXISTS collections_status_idx ON public.collections(status);

-- ---------------------------------------------------------
-- 8. sorting_diagnostics: domínio completo de classificação
-- ---------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sorting_diagnostics_classificacao_check') THEN
    UPDATE public.sorting_diagnostics
    SET classificacao = CASE
      WHEN classificacao = 'reciclagem' THEN 'reciclagem_mecanica'
      WHEN classificacao IN (
        'segunda_vida', 'reutilizacao_componentes', 'reciclagem_mecanica',
        'reciclagem_quimica', 'quarentena_tecnica', 'descarte_controlado',
        'aguardando_analise'
      ) THEN classificacao
      ELSE 'aguardando_analise'
    END;
    ALTER TABLE public.sorting_diagnostics
      ADD CONSTRAINT sorting_diagnostics_classificacao_check CHECK (
        classificacao IN (
          'segunda_vida', 'reutilizacao_componentes', 'reciclagem_mecanica',
          'reciclagem_quimica', 'quarentena_tecnica', 'descarte_controlado',
          'aguardando_analise'
        )
      );
  END IF;
END $$;

-- ---------------------------------------------------------
-- 9. lots: código, organização operadora e UF canônicos
-- ---------------------------------------------------------
ALTER TABLE public.lots
  ADD COLUMN IF NOT EXISTS codigo_lote TEXT,
  ADD COLUMN IF NOT EXISTS operator_organization_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS estado TEXT;

UPDATE public.lots l
SET codigo_lote = COALESCE(l.codigo_lote, l.code),
    estado = COALESCE(l.estado, l.uf),
    operator_organization_id = COALESCE(
      l.operator_organization_id,
      (
        SELECT m.org_id
        FROM public.org_members m
        JOIN public.companies co ON co.id = m.org_id
        WHERE m.user_id = l.operador_id
          AND (co.tipo = 'operador' OR co.tipo_organizacao = 'operador')
        ORDER BY m.created_at
        LIMIT 1
      )
    );

-- Lotes sem associação ainda precisam receber aliases mesmo sem membro encontrado.
UPDATE public.lots
SET codigo_lote = COALESCE(codigo_lote, code),
    estado = COALESCE(estado, uf)
WHERE codigo_lote IS NULL OR estado IS NULL;

ALTER TABLE public.lots ALTER COLUMN codigo_lote SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS lots_codigo_lote_uidx ON public.lots(codigo_lote);
CREATE INDEX IF NOT EXISTS lots_operator_org_idx ON public.lots(operator_organization_id);
CREATE INDEX IF NOT EXISTS lots_status_idx ON public.lots(status);
CREATE INDEX IF NOT EXISTS lots_proposal_window_idx
  ON public.lots(data_abertura_propostas, data_encerramento_propostas);

CREATE OR REPLACE FUNCTION public.tg_sync_lot_phase3()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.codigo_lote IS DISTINCT FROM OLD.codigo_lote THEN NEW.code := NEW.codigo_lote;
    ELSIF NEW.code IS DISTINCT FROM OLD.code THEN NEW.codigo_lote := NEW.code;
    END IF;
    IF NEW.estado IS DISTINCT FROM OLD.estado THEN NEW.uf := NEW.estado;
    ELSIF NEW.uf IS DISTINCT FROM OLD.uf THEN NEW.estado := NEW.uf;
    END IF;
  ELSE
    NEW.codigo_lote := COALESCE(NEW.codigo_lote, NEW.code, public.next_lot_code());
    NEW.code := COALESCE(NEW.code, NEW.codigo_lote);
    NEW.estado := COALESCE(NEW.estado, NEW.uf);
    NEW.uf := COALESCE(NEW.uf, NEW.estado);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_lot_phase3 ON public.lots;
CREATE TRIGGER sync_lot_phase3
  BEFORE INSERT OR UPDATE ON public.lots
  FOR EACH ROW EXECUTE FUNCTION public.tg_sync_lot_phase3();

-- ---------------------------------------------------------
-- 10. lot_batteries: identificador e timestamp canônicos
-- ---------------------------------------------------------
ALTER TABLE public.lot_batteries
  ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS added_at TIMESTAMPTZ;

UPDATE public.lot_batteries
SET id = COALESCE(id, gen_random_uuid()),
    added_at = COALESCE(added_at, created_at);

ALTER TABLE public.lot_batteries
  ALTER COLUMN id SET NOT NULL,
  ALTER COLUMN added_at SET NOT NULL,
  ALTER COLUMN added_at SET DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS lot_batteries_id_uidx ON public.lot_batteries(id);
CREATE INDEX IF NOT EXISTS lot_batteries_battery_idx ON public.lot_batteries(battery_id);

-- ---------------------------------------------------------
-- 11. proposals: organização recicladora e valor canônico
-- ---------------------------------------------------------
ALTER TYPE public.proposal_status ADD VALUE IF NOT EXISTS 'rascunho';
ALTER TYPE public.proposal_status ADD VALUE IF NOT EXISTS 'enviada';
ALTER TYPE public.proposal_status ADD VALUE IF NOT EXISTS 'em_analise';
ALTER TYPE public.proposal_status ADD VALUE IF NOT EXISTS 'aceita';
ALTER TYPE public.proposal_status ADD VALUE IF NOT EXISTS 'recusada';
ALTER TYPE public.proposal_status ADD VALUE IF NOT EXISTS 'cancelada';
ALTER TYPE public.proposal_status ADD VALUE IF NOT EXISTS 'expirada';

ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS recycler_organization_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS valor_proposto NUMERIC;

UPDATE public.proposals p
SET valor_proposto = COALESCE(p.valor_proposto, p.valor_total),
    recycler_organization_id = COALESCE(
      p.recycler_organization_id,
      (
        SELECT m.org_id
        FROM public.org_members m
        JOIN public.companies co ON co.id = m.org_id
        WHERE m.user_id = p.reciclador_id
          AND (co.tipo = 'reciclador' OR co.tipo_organizacao IN ('reciclador', 'recicladora'))
        ORDER BY m.created_at
        LIMIT 1
      )
    );

UPDATE public.proposals
SET valor_proposto = COALESCE(valor_proposto, valor_total)
WHERE valor_proposto IS NULL;

ALTER TABLE public.proposals ALTER COLUMN valor_proposto SET NOT NULL;
CREATE INDEX IF NOT EXISTS proposals_recycler_org_idx ON public.proposals(recycler_organization_id);
CREATE INDEX IF NOT EXISTS proposals_status_idx ON public.proposals(status);
CREATE INDEX IF NOT EXISTS proposals_lot_idx ON public.proposals(lot_id);

CREATE OR REPLACE FUNCTION public.tg_sync_proposal_phase3()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.valor_proposto IS DISTINCT FROM OLD.valor_proposto THEN NEW.valor_total := NEW.valor_proposto;
    ELSIF NEW.valor_total IS DISTINCT FROM OLD.valor_total THEN NEW.valor_proposto := NEW.valor_total;
    END IF;
  ELSE
    NEW.valor_proposto := COALESCE(NEW.valor_proposto, NEW.valor_total);
    NEW.valor_total := COALESCE(NEW.valor_total, NEW.valor_proposto);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_proposal_phase3 ON public.proposals;
CREATE TRIGGER sync_proposal_phase3
  BEFORE INSERT OR UPDATE ON public.proposals
  FOR EACH ROW EXECUTE FUNCTION public.tg_sync_proposal_phase3();

-- ---------------------------------------------------------
-- 12. operations: índices das partes e proposta única
-- ---------------------------------------------------------
CREATE INDEX IF NOT EXISTS operations_proposal_idx ON public.operations(proposal_id);
CREATE INDEX IF NOT EXISTS operations_generator_org_idx ON public.operations(generator_organization_id);
CREATE INDEX IF NOT EXISTS operations_operator_org_idx ON public.operations(operator_organization_id);
CREATE INDEX IF NOT EXISTS operations_carrier_org_idx ON public.operations(carrier_organization_id);
CREATE INDEX IF NOT EXISTS operations_recycler_org_idx ON public.operations(recycler_organization_id);
CREATE INDEX IF NOT EXISTS operations_status_idx ON public.operations(status);

-- ---------------------------------------------------------
-- 13. documents: storage canônico e compatibilidade legada
-- ---------------------------------------------------------
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS storage_path TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

UPDATE public.documents
SET storage_path = COALESCE(storage_path, url),
    tipo_documento = COALESCE(tipo_documento, kind);

-- Campos legados deixam de ser obrigatórios para permitir documentos ligados
-- diretamente a operação, bateria ou lote conforme a especificação nova.
ALTER TABLE public.documents
  ALTER COLUMN entity_type DROP NOT NULL,
  ALTER COLUMN entity_id DROP NOT NULL,
  ALTER COLUMN kind DROP NOT NULL,
  ALTER COLUMN url DROP NOT NULL,
  ALTER COLUMN uploaded_by DROP NOT NULL;

CREATE INDEX IF NOT EXISTS documents_operation_idx ON public.documents(operation_id);
CREATE INDEX IF NOT EXISTS documents_battery_idx ON public.documents(battery_id);
CREATE INDEX IF NOT EXISTS documents_lot_idx ON public.documents(lot_id);
CREATE INDEX IF NOT EXISTS documents_tipo_idx ON public.documents(tipo_documento);

CREATE OR REPLACE FUNCTION public.tg_sync_document_phase3()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.storage_path IS DISTINCT FROM OLD.storage_path THEN NEW.url := NEW.storage_path;
    ELSIF NEW.url IS DISTINCT FROM OLD.url THEN NEW.storage_path := NEW.url;
    END IF;
    IF NEW.tipo_documento IS DISTINCT FROM OLD.tipo_documento THEN NEW.kind := NEW.tipo_documento;
    ELSIF NEW.kind IS DISTINCT FROM OLD.kind THEN NEW.tipo_documento := NEW.kind;
    END IF;
  ELSE
    NEW.storage_path := COALESCE(NEW.storage_path, NEW.url);
    NEW.url := COALESCE(NEW.url, NEW.storage_path);
    NEW.tipo_documento := COALESCE(NEW.tipo_documento, NEW.kind);
    NEW.kind := COALESCE(NEW.kind, NEW.tipo_documento);
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_document_phase3 ON public.documents;
CREATE TRIGGER sync_document_phase3
  BEFORE INSERT OR UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.tg_sync_document_phase3();

-- ---------------------------------------------------------
-- 14. status_history: índices adicionais
-- ---------------------------------------------------------
CREATE INDEX IF NOT EXISTS status_history_org_idx ON public.status_history(organization_id);
CREATE INDEX IF NOT EXISTS status_history_created_idx ON public.status_history(created_at DESC);

-- ---------------------------------------------------------
-- 15. audit_logs: estrutura completa e append-only
-- ---------------------------------------------------------
ALTER TABLE public.audit_log
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.companies(id),
  ADD COLUMN IF NOT EXISTS previous_data JSONB,
  ADD COLUMN IF NOT EXISTS new_data JSONB,
  ADD COLUMN IF NOT EXISTS ip_address INET,
  ADD COLUMN IF NOT EXISTS user_agent TEXT;

UPDATE public.audit_log
SET user_id = COALESCE(user_id, actor_id),
    previous_data = COALESCE(previous_data, payload->'previous_data'),
    new_data = COALESCE(new_data, payload->'new_data', payload);

-- Corrige política antiga que ainda permitia INSERT direto pelo cliente.
DROP POLICY IF EXISTS "Any authenticated inserts audit" ON public.audit_log;
REVOKE INSERT, UPDATE, DELETE ON public.audit_log FROM authenticated, anon;
GRANT SELECT ON public.audit_log TO authenticated;

CREATE INDEX IF NOT EXISTS audit_log_user_idx ON public.audit_log(user_id);
CREATE INDEX IF NOT EXISTS audit_log_org_idx ON public.audit_log(organization_id);

DROP VIEW IF EXISTS public.audit_logs;
CREATE VIEW public.audit_logs
WITH (security_invoker = true)
AS
SELECT id, user_id, organization_id, action, entity_type, entity_id,
       previous_data, new_data, ip_address, user_agent, created_at
FROM public.audit_log;

GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
REVOKE INSERT, UPDATE, DELETE ON public.audit_logs FROM authenticated, anon;

-- Auditoria passa a registrar os dados anterior e novo de forma estruturada.
CREATE OR REPLACE FUNCTION public.tg_audit_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _entity_id UUID := (to_jsonb(NEW)->>'id')::UUID;
  _old_status TEXT := to_jsonb(OLD)->>'status';
  _new_status TEXT := to_jsonb(NEW)->>'status';
BEGIN
  IF _old_status IS DISTINCT FROM _new_status THEN
    INSERT INTO public.audit_log(
      actor_id, user_id, entity_type, entity_id, action,
      payload, previous_data, new_data
    ) VALUES (
      auth.uid(), auth.uid(), TG_TABLE_NAME, _entity_id, 'status_change',
      jsonb_build_object('from', _old_status, 'to', _new_status),
      to_jsonb(OLD), to_jsonb(NEW)
    );
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.tg_audit_status() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.tg_audit_create()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _entity_id UUID := (to_jsonb(NEW)->>'id')::UUID;
BEGIN
  INSERT INTO public.audit_log(
    actor_id, user_id, entity_type, entity_id, action,
    payload, new_data
  ) VALUES (
    auth.uid(), auth.uid(), TG_TABLE_NAME, _entity_id, 'created',
    '{}'::JSONB, to_jsonb(NEW)
  );
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.tg_audit_create() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------
-- 16. notifications: aliases canônicos
-- ---------------------------------------------------------
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS mensagem TEXT,
  ADD COLUMN IF NOT EXISTS lida BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE public.notifications
SET profile_id = COALESCE(profile_id, user_id),
    mensagem = COALESCE(mensagem, body),
    lida = (read_at IS NOT NULL);

ALTER TABLE public.notifications ALTER COLUMN profile_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS notifications_profile_created_idx
  ON public.notifications(profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_org_created_idx
  ON public.notifications(organization_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.tg_sync_notification_phase3()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.profile_id IS DISTINCT FROM OLD.profile_id THEN NEW.user_id := NEW.profile_id;
    ELSIF NEW.user_id IS DISTINCT FROM OLD.user_id THEN NEW.profile_id := NEW.user_id;
    END IF;
    IF NEW.mensagem IS DISTINCT FROM OLD.mensagem THEN NEW.body := NEW.mensagem;
    ELSIF NEW.body IS DISTINCT FROM OLD.body THEN NEW.mensagem := NEW.body;
    END IF;
    IF NEW.lida IS DISTINCT FROM OLD.lida THEN
      NEW.read_at := CASE WHEN NEW.lida THEN COALESCE(NEW.read_at, now()) ELSE NULL END;
    ELSIF NEW.read_at IS DISTINCT FROM OLD.read_at THEN
      NEW.lida := NEW.read_at IS NOT NULL;
    END IF;
  ELSE
    NEW.profile_id := COALESCE(NEW.profile_id, NEW.user_id);
    NEW.user_id := COALESCE(NEW.user_id, NEW.profile_id);
    NEW.mensagem := COALESCE(NEW.mensagem, NEW.body);
    NEW.body := COALESCE(NEW.body, NEW.mensagem);
    NEW.lida := COALESCE(NEW.lida, NEW.read_at IS NOT NULL);
    IF NEW.lida AND NEW.read_at IS NULL THEN NEW.read_at := now(); END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_notification_phase3 ON public.notifications;
CREATE TRIGGER sync_notification_phase3
  BEFORE INSERT OR UPDATE ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.tg_sync_notification_phase3();

-- ---------------------------------------------------------
-- 17. incidents: índices de todos os relacionamentos
-- ---------------------------------------------------------
CREATE INDEX IF NOT EXISTS incidents_collection_idx ON public.incidents(collection_id);
CREATE INDEX IF NOT EXISTS incidents_operation_idx ON public.incidents(operation_id);
CREATE INDEX IF NOT EXISTS incidents_status_idx ON public.incidents(status);
CREATE INDEX IF NOT EXISTS incidents_created_idx ON public.incidents(created_at DESC);

-- Índices restantes de FKs das tabelas já completas.
CREATE INDEX IF NOT EXISTS organization_documents_validado_por_idx
  ON public.organization_documents(validado_por);
CREATE INDEX IF NOT EXISTS battery_files_uploaded_by_idx
  ON public.battery_files(uploaded_by);
CREATE INDEX IF NOT EXISTS sorting_diagnostics_status_idx
  ON public.sorting_diagnostics(status_validacao);

COMMIT;
