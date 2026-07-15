-- =========================================================
-- FASES 4 E 5 — fluxo completo e máquina de estados
-- =========================================================

-- O modelo antigo usava enums em inglês e permitia updates diretos.
-- Os status passam a ser texto com CHECK, preservando os dados existentes
-- e permitindo que toda mudança ocorra somente pelas funções de workflow.

-- Políticas dependentes dos status precisam ser recriadas após a conversão.
DROP POLICY IF EXISTS "Owner reads own batteries" ON public.batteries;
DROP POLICY IF EXISTS "Owner inserts own batteries" ON public.batteries;
DROP POLICY IF EXISTS "Owner updates own batteries in early status" ON public.batteries;
DROP POLICY IF EXISTS "Operadores read all batteries" ON public.batteries;
DROP POLICY IF EXISTS "Operadores update batteries" ON public.batteries;
DROP POLICY IF EXISTS "Reciclador reads batteries in visible lots" ON public.batteries;
DROP POLICY IF EXISTS "Transportadora reads batteries in accepted collections" ON public.batteries;

DROP POLICY IF EXISTS "Operadores manage lots" ON public.lots;
DROP POLICY IF EXISTS "Recicladores read published lots" ON public.lots;
DROP POLICY IF EXISTS "Transportadoras read shippable lots" ON public.lots;
DROP POLICY IF EXISTS "Transportadoras read assigned lots" ON public.lots;

DROP POLICY IF EXISTS "Operadores manage lot_batteries" ON public.lot_batteries;
DROP POLICY IF EXISTS "Read lot_batteries for visible lots" ON public.lot_batteries;

DROP POLICY IF EXISTS "Reciclador manages own proposals" ON public.proposals;
DROP POLICY IF EXISTS "Operadores read all proposals" ON public.proposals;
DROP POLICY IF EXISTS "Operadores update proposals" ON public.proposals;

DROP POLICY IF EXISTS "Operadores manage collections" ON public.collections;
DROP POLICY IF EXISTS "Transportadoras read available or own" ON public.collections;
DROP POLICY IF EXISTS "Transportadoras claim/update own collections" ON public.collections;

ALTER TABLE public.batteries DISABLE TRIGGER USER;
ALTER TABLE public.lots DISABLE TRIGGER USER;
ALTER TABLE public.collections DISABLE TRIGGER USER;
ALTER TABLE public.proposals DISABLE TRIGGER USER;

ALTER TABLE public.batteries ALTER COLUMN status DROP DEFAULT;
ALTER TABLE public.batteries ALTER COLUMN status TYPE TEXT USING status::TEXT;
ALTER TABLE public.batteries ALTER COLUMN classificacao DROP DEFAULT;
ALTER TABLE public.batteries ALTER COLUMN classificacao TYPE TEXT USING classificacao::TEXT;

ALTER TABLE public.lots ALTER COLUMN status DROP DEFAULT;
ALTER TABLE public.lots ALTER COLUMN status TYPE TEXT USING status::TEXT;

ALTER TABLE public.collections ALTER COLUMN status DROP DEFAULT;
ALTER TABLE public.collections ALTER COLUMN status TYPE TEXT USING status::TEXT;
ALTER TABLE public.collections ALTER COLUMN lot_id DROP NOT NULL;
ALTER TABLE public.collections
  ADD COLUMN IF NOT EXISTS recycler_organization_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;

ALTER TABLE public.proposals ALTER COLUMN status DROP DEFAULT;
ALTER TABLE public.proposals ALTER COLUMN status TYPE TEXT USING status::TEXT;

UPDATE public.batteries SET status = CASE status
  WHEN 'registered' THEN 'aguardando_analise'
  WHEN 'triaging' THEN 'em_diagnostico'
  WHEN 'classified' THEN 'classificada'
  WHEN 'in_lot' THEN 'em_lote'
  WHEN 'collected' THEN 'em_transporte'
  WHEN 'delivered' THEN 'recebida_pelo_destinador'
  WHEN 'recycled' THEN 'concluida'
  WHEN 'second_life' THEN 'concluida'
  WHEN 'rejected' THEN 'cancelada'
  ELSE status END;

UPDATE public.batteries
SET classificacao='reciclagem_mecanica'
WHERE classificacao='reciclagem';

UPDATE public.lots SET status = CASE status
  WHEN 'open' THEN 'em_formacao'
  WHEN 'published' THEN 'publicado'
  WHEN 'negotiating' THEN 'recebendo_propostas'
  WHEN 'awarded' THEN 'proposta_aceita'
  WHEN 'shipped' THEN 'em_transporte'
  WHEN 'closed' THEN 'concluido'
  ELSE status END;

UPDATE public.collections SET status = CASE status
  WHEN 'available' THEN 'ordem_criada'
  WHEN 'accepted' THEN 'aceita'
  WHEN 'in_transit' THEN 'em_transporte'
  WHEN 'delivered' THEN CASE WHEN battery_id IS NOT NULL THEN 'entregue_triagem' ELSE 'entregue_destinador' END
  WHEN 'cancelled' THEN 'cancelada'
  ELSE status END;

UPDATE public.proposals SET status = CASE status
  WHEN 'submitted' THEN 'enviada'
  WHEN 'accepted' THEN 'aceita'
  WHEN 'rejected' THEN 'recusada'
  WHEN 'withdrawn' THEN 'cancelada'
  ELSE status END;

ALTER TABLE public.batteries ALTER COLUMN status SET DEFAULT 'cadastrada';
ALTER TABLE public.lots ALTER COLUMN status SET DEFAULT 'rascunho';
ALTER TABLE public.collections ALTER COLUMN status SET DEFAULT 'ordem_criada';
ALTER TABLE public.proposals ALTER COLUMN status SET DEFAULT 'enviada';

-- O alias status_atual acompanha status, mas nunca pode contornar a máquina.
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
    NEW.status_atual := NEW.status;
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
    NEW.status_atual := NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

ALTER TABLE public.batteries
  ADD CONSTRAINT batteries_workflow_status_check CHECK (status IN (
    'rascunho','cadastrada','aguardando_analise','informacoes_solicitadas',
    'aprovada_para_coleta','coleta_agendada','em_transporte','recebida_na_triagem',
    'em_diagnostico','classificada','em_lote','em_negociacao','destinacao_definida',
    'enviada_ao_destinador','recebida_pelo_destinador','documentacao_pendente',
    'concluida','em_quarentena','cancelada'
  ));

ALTER TABLE public.batteries
  ADD CONSTRAINT batteries_classificacao_phase4_check CHECK (
    classificacao IS NULL OR classificacao IN (
      'segunda_vida','reutilizacao_componentes','reciclagem_mecanica',
      'reciclagem_quimica','quarentena_tecnica','descarte_controlado','aguardando_analise'
    )
  );

ALTER TABLE public.lots
  ADD CONSTRAINT lots_workflow_status_check CHECK (status IN (
    'rascunho','em_formacao','pronto_para_publicacao','publicado',
    'recebendo_propostas','em_analise','proposta_aceita','contratado',
    'em_transporte','entregue','documentacao_pendente','concluido','cancelado'
  ));

ALTER TABLE public.collections
  ADD CONSTRAINT collections_workflow_status_check CHECK (status IN (
    'ordem_criada','aceita','recusada','agendada','retirada','em_transporte',
    'entregue_triagem','entregue_destinador','cancelada'
  ));

ALTER TABLE public.proposals
  ADD CONSTRAINT proposals_workflow_status_check CHECK (status IN (
    'rascunho','enviada','em_analise','aceita','recusada','cancelada','expirada'
  ));

ALTER TABLE public.batteries ENABLE TRIGGER USER;
ALTER TABLE public.lots ENABLE TRIGGER USER;
ALTER TABLE public.collections ENABLE TRIGGER USER;
ALTER TABLE public.proposals ENABLE TRIGGER USER;

-- QR Code persistente e código único no cadastro.
CREATE OR REPLACE FUNCTION public.tg_generate_battery_qr()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.code := COALESCE(NEW.code, public.next_battery_code());
  NEW.codigo_unico := COALESCE(NEW.codigo_unico, NEW.code);
  NEW.qr_code_data := COALESCE(
    NEW.qr_code_data,
    jsonb_build_object(
      'battery_id', NEW.id,
      'codigo', NEW.code,
      'url', 'https://batterylink.com.br/rastreio/' || NEW.code
    )::TEXT
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS generate_battery_qr ON public.batteries;
CREATE TRIGGER generate_battery_qr
  BEFORE INSERT ON public.batteries
  FOR EACH ROW EXECUTE FUNCTION public.tg_generate_battery_qr();

-- Tabelas declarativas da máquina de estados.
CREATE TABLE IF NOT EXISTS public.battery_status_transitions (
  from_status TEXT NOT NULL,
  to_status TEXT NOT NULL,
  allowed_roles public.app_role[] NOT NULL,
  PRIMARY KEY (from_status, to_status)
);

CREATE TABLE IF NOT EXISTS public.lot_status_transitions (
  from_status TEXT NOT NULL,
  to_status TEXT NOT NULL,
  allowed_roles public.app_role[] NOT NULL,
  PRIMARY KEY (from_status, to_status)
);

ALTER TABLE public.battery_status_transitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lot_status_transitions ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.battery_status_transitions, public.lot_status_transitions TO authenticated;
GRANT ALL ON public.battery_status_transitions, public.lot_status_transitions TO service_role;

CREATE POLICY "workflow reads battery transitions" ON public.battery_status_transitions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "workflow reads lot transitions" ON public.lot_status_transitions
  FOR SELECT TO authenticated USING (true);

INSERT INTO public.battery_status_transitions(from_status, to_status, allowed_roles) VALUES
  ('rascunho','cadastrada',ARRAY['gerador','admin']::public.app_role[]),
  ('cadastrada','aguardando_analise',ARRAY['gerador','operador','admin']::public.app_role[]),
  ('aguardando_analise','informacoes_solicitadas',ARRAY['operador','admin']::public.app_role[]),
  ('informacoes_solicitadas','aguardando_analise',ARRAY['gerador','admin']::public.app_role[]),
  ('aguardando_analise','aprovada_para_coleta',ARRAY['operador','admin']::public.app_role[]),
  ('aprovada_para_coleta','coleta_agendada',ARRAY['transportadora','operador','admin']::public.app_role[]),
  ('coleta_agendada','em_transporte',ARRAY['transportadora','admin']::public.app_role[]),
  ('em_transporte','recebida_na_triagem',ARRAY['operador','admin']::public.app_role[]),
  ('recebida_na_triagem','em_diagnostico',ARRAY['operador','admin']::public.app_role[]),
  ('em_diagnostico','classificada',ARRAY['operador','admin']::public.app_role[]),
  ('classificada','em_lote',ARRAY['operador','admin']::public.app_role[]),
  ('em_lote','classificada',ARRAY['operador','admin']::public.app_role[]),
  ('em_lote','em_negociacao',ARRAY['operador','admin']::public.app_role[]),
  ('em_negociacao','destinacao_definida',ARRAY['operador','admin']::public.app_role[]),
  ('destinacao_definida','enviada_ao_destinador',ARRAY['transportadora','operador','admin']::public.app_role[]),
  ('enviada_ao_destinador','recebida_pelo_destinador',ARRAY['reciclador','admin']::public.app_role[]),
  ('recebida_pelo_destinador','documentacao_pendente',ARRAY['reciclador','operador','admin']::public.app_role[]),
  ('documentacao_pendente','concluida',ARRAY['operador','admin']::public.app_role[]),
  ('em_quarentena','aguardando_analise',ARRAY['operador','admin']::public.app_role[])
ON CONFLICT DO NOTHING;

-- Quarentena e cancelamento são saídas controladas a partir dos estados não terminais.
INSERT INTO public.battery_status_transitions(from_status, to_status, allowed_roles)
SELECT s, 'em_quarentena', ARRAY['operador','admin']::public.app_role[]
FROM unnest(ARRAY[
  'cadastrada','aguardando_analise','informacoes_solicitadas','aprovada_para_coleta',
  'coleta_agendada','em_transporte','recebida_na_triagem','em_diagnostico','classificada'
]) s ON CONFLICT DO NOTHING;

INSERT INTO public.battery_status_transitions(from_status, to_status, allowed_roles)
SELECT s, 'cancelada', ARRAY['gerador','operador','admin']::public.app_role[]
FROM unnest(ARRAY[
  'rascunho','cadastrada','aguardando_analise','informacoes_solicitadas',
  'aprovada_para_coleta','coleta_agendada','em_quarentena'
]) s ON CONFLICT DO NOTHING;

INSERT INTO public.lot_status_transitions(from_status, to_status, allowed_roles) VALUES
  ('rascunho','em_formacao',ARRAY['operador','admin']::public.app_role[]),
  ('em_formacao','pronto_para_publicacao',ARRAY['operador','admin']::public.app_role[]),
  ('pronto_para_publicacao','em_formacao',ARRAY['operador','admin']::public.app_role[]),
  ('pronto_para_publicacao','publicado',ARRAY['operador','admin']::public.app_role[]),
  ('publicado','recebendo_propostas',ARRAY['reciclador','operador','admin']::public.app_role[]),
  ('recebendo_propostas','em_analise',ARRAY['operador','admin']::public.app_role[]),
  ('em_analise','proposta_aceita',ARRAY['operador','admin']::public.app_role[]),
  ('proposta_aceita','contratado',ARRAY['operador','admin']::public.app_role[]),
  ('contratado','em_transporte',ARRAY['transportadora','operador','admin']::public.app_role[]),
  ('em_transporte','entregue',ARRAY['reciclador','admin']::public.app_role[]),
  ('entregue','documentacao_pendente',ARRAY['reciclador','operador','admin']::public.app_role[]),
  ('documentacao_pendente','concluido',ARRAY['operador','admin']::public.app_role[])
ON CONFLICT DO NOTHING;

INSERT INTO public.lot_status_transitions(from_status, to_status, allowed_roles)
SELECT s, 'cancelado', ARRAY['operador','admin']::public.app_role[]
FROM unnest(ARRAY[
  'rascunho','em_formacao','pronto_para_publicacao','publicado',
  'recebendo_propostas','em_analise','proposta_aceita'
]) s ON CONFLICT DO NOTHING;

-- Organização responsável pela ação atual.
CREATE OR REPLACE FUNCTION public.current_actor_organization(_preferred UUID DEFAULT NULL)
RETURNS UUID
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _org UUID;
BEGIN
  IF _preferred IS NOT NULL AND (
    public.has_role(auth.uid(),'admin') OR public.is_org_member(_preferred, auth.uid())
  ) THEN RETURN _preferred; END IF;

  SELECT org_id INTO _org FROM public.org_members
  WHERE user_id = auth.uid() AND ativo = TRUE
  ORDER BY created_at LIMIT 1;
  IF _org IS NOT NULL THEN RETURN _org; END IF;

  SELECT id INTO _org FROM public.companies
  WHERE owner_id = auth.uid() ORDER BY created_at LIMIT 1;
  RETURN _org;
END;
$$;

-- Resolve se o papel do usuário permite agir naquela bateria.
CREATE OR REPLACE FUNCTION public.can_transition_battery(
  _battery_id UUID, _roles public.app_role[]
) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(),'admin')
    OR ('gerador'::public.app_role = ANY(_roles) AND EXISTS (
      SELECT 1 FROM public.batteries b WHERE b.id = _battery_id AND b.owner_id = auth.uid()
    ))
    OR ('operador'::public.app_role = ANY(_roles) AND public.has_role(auth.uid(),'operador'))
    OR ('transportadora'::public.app_role = ANY(_roles) AND public.has_role(auth.uid(),'transportadora') AND EXISTS (
      SELECT 1 FROM public.collections c
      LEFT JOIN public.lot_batteries lb ON lb.lot_id = c.lot_id
      WHERE (c.battery_id = _battery_id OR lb.battery_id = _battery_id)
        AND (c.transportadora_id = auth.uid()
          OR (c.carrier_organization_id IS NOT NULL AND public.is_org_member(c.carrier_organization_id, auth.uid())))
    ))
    OR ('reciclador'::public.app_role = ANY(_roles) AND public.has_role(auth.uid(),'reciclador') AND EXISTS (
      SELECT 1 FROM public.lot_batteries lb
      JOIN public.proposals p ON p.lot_id = lb.lot_id AND p.status = 'aceita'
      WHERE lb.battery_id = _battery_id
        AND (p.reciclador_id = auth.uid()
          OR (p.recycler_organization_id IS NOT NULL AND public.is_org_member(p.recycler_organization_id, auth.uid())))
    ));
$$;

CREATE OR REPLACE FUNCTION public.can_transition_lot(
  _lot_id UUID, _roles public.app_role[]
) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(),'admin')
    OR ('operador'::public.app_role = ANY(_roles) AND public.has_role(auth.uid(),'operador') AND EXISTS (
      SELECT 1 FROM public.lots l WHERE l.id = _lot_id
        AND (l.operador_id = auth.uid() OR l.operator_organization_id IS NULL
          OR public.is_org_member(l.operator_organization_id, auth.uid()))
    ))
    OR ('reciclador'::public.app_role = ANY(_roles) AND public.has_role(auth.uid(),'reciclador'))
    OR ('transportadora'::public.app_role = ANY(_roles) AND public.has_role(auth.uid(),'transportadora') AND EXISTS (
      SELECT 1 FROM public.collections c WHERE c.lot_id = _lot_id
        AND (c.transportadora_id = auth.uid()
          OR (c.carrier_organization_id IS NOT NULL AND public.is_org_member(c.carrier_organization_id, auth.uid())))
    ));
$$;

-- Updates diretos de status são bloqueados; apenas RPCs autorizadas podem mudar.
CREATE OR REPLACE FUNCTION public.tg_enforce_workflow_status()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     AND COALESCE(current_setting('app.workflow_authorized', true),'') <> 'true' THEN
    RAISE EXCEPTION 'Mudança de status inválida. Use a ação de workflow correspondente.';
  END IF;
  RETURN NEW;
END;
$$;

-- Também impede que um registro seja criado já em uma etapa avançada.
CREATE OR REPLACE FUNCTION public.tg_enforce_initial_workflow_status()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF (TG_TABLE_NAME = 'batteries' AND NEW.status NOT IN ('rascunho','cadastrada'))
     OR (TG_TABLE_NAME = 'lots' AND NEW.status <> 'rascunho')
     OR (TG_TABLE_NAME = 'collections' AND NEW.status <> 'ordem_criada')
     OR (TG_TABLE_NAME = 'proposals' AND NEW.status NOT IN ('rascunho','enviada')) THEN
    RAISE EXCEPTION 'Status inicial inválido para %: %', TG_TABLE_NAME, NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_battery_initial_status ON public.batteries;
CREATE TRIGGER enforce_battery_initial_status BEFORE INSERT ON public.batteries
  FOR EACH ROW EXECUTE FUNCTION public.tg_enforce_initial_workflow_status();
DROP TRIGGER IF EXISTS enforce_lot_initial_status ON public.lots;
CREATE TRIGGER enforce_lot_initial_status BEFORE INSERT ON public.lots
  FOR EACH ROW EXECUTE FUNCTION public.tg_enforce_initial_workflow_status();
DROP TRIGGER IF EXISTS enforce_collection_initial_status ON public.collections;
CREATE TRIGGER enforce_collection_initial_status BEFORE INSERT ON public.collections
  FOR EACH ROW EXECUTE FUNCTION public.tg_enforce_initial_workflow_status();
DROP TRIGGER IF EXISTS enforce_proposal_initial_status ON public.proposals;
CREATE TRIGGER enforce_proposal_initial_status BEFORE INSERT ON public.proposals
  FOR EACH ROW EXECUTE FUNCTION public.tg_enforce_initial_workflow_status();

DROP TRIGGER IF EXISTS enforce_battery_workflow_status ON public.batteries;
CREATE TRIGGER enforce_battery_workflow_status
  BEFORE UPDATE OF status ON public.batteries
  FOR EACH ROW EXECUTE FUNCTION public.tg_enforce_workflow_status();

DROP TRIGGER IF EXISTS enforce_lot_workflow_status ON public.lots;
CREATE TRIGGER enforce_lot_workflow_status
  BEFORE UPDATE OF status ON public.lots
  FOR EACH ROW EXECUTE FUNCTION public.tg_enforce_workflow_status();

DROP TRIGGER IF EXISTS enforce_collection_workflow_status ON public.collections;
CREATE TRIGGER enforce_collection_workflow_status
  BEFORE UPDATE OF status ON public.collections
  FOR EACH ROW EXECUTE FUNCTION public.tg_enforce_workflow_status();

DROP TRIGGER IF EXISTS enforce_proposal_workflow_status ON public.proposals;
CREATE TRIGGER enforce_proposal_workflow_status
  BEFORE UPDATE OF status ON public.proposals
  FOR EACH ROW EXECUTE FUNCTION public.tg_enforce_workflow_status();

-- Notifica participantes da cadeia sem expor dados a concorrentes.
CREATE OR REPLACE FUNCTION public.notify_battery_participants(
  _battery_id UUID, _title TEXT, _body TEXT
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid UUID;
BEGIN
  FOR _uid IN
    SELECT DISTINCT user_id FROM (
      SELECT b.owner_id AS user_id FROM public.batteries b WHERE b.id = _battery_id
      UNION ALL
      SELECT ur.user_id FROM public.user_roles ur WHERE ur.role = 'admin'
      UNION ALL
      SELECT om.user_id FROM public.batteries b JOIN public.org_members om ON om.org_id = b.company_id
        WHERE b.id = _battery_id AND om.ativo
      UNION ALL
      SELECT c.transportadora_id FROM public.collections c
        LEFT JOIN public.lot_batteries lb ON lb.lot_id = c.lot_id
        WHERE c.battery_id = _battery_id OR lb.battery_id = _battery_id
      UNION ALL
      SELECT p.reciclador_id FROM public.lot_batteries lb
        JOIN public.proposals p ON p.lot_id = lb.lot_id AND p.status = 'aceita'
        WHERE lb.battery_id = _battery_id
    ) participants WHERE user_id IS NOT NULL
  LOOP
    PERFORM public.notify_user(_uid, _title, _body, '/app');
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_lot_participants(
  _lot_id UUID, _title TEXT, _body TEXT
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid UUID;
BEGIN
  FOR _uid IN
    SELECT DISTINCT user_id FROM (
      SELECT l.operador_id AS user_id FROM public.lots l WHERE l.id = _lot_id
      UNION ALL SELECT ur.user_id FROM public.user_roles ur WHERE ur.role = 'admin'
      UNION ALL SELECT p.reciclador_id FROM public.proposals p WHERE p.lot_id = _lot_id
      UNION ALL SELECT c.transportadora_id FROM public.collections c WHERE c.lot_id = _lot_id
    ) participants WHERE user_id IS NOT NULL
  LOOP
    PERFORM public.notify_user(_uid, _title, _body, '/app');
  END LOOP;
END;
$$;

-- Histórico e linha do tempo automáticos em toda mudança.
CREATE OR REPLACE FUNCTION public.tg_battery_workflow_history()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _org UUID := NULLIF(current_setting('app.workflow_org', true),'')::UUID;
  _reason TEXT := NULLIF(current_setting('app.workflow_reason', true),'');
BEGIN
  INSERT INTO public.status_history(
    entity_type, entity_id, status_anterior, status_novo,
    alterado_por, organization_id, justificativa
  ) VALUES ('battery', NEW.id, OLD.status, NEW.status, auth.uid(), _org, _reason);

  INSERT INTO public.battery_events(battery_id, actor_id, event_type, notes)
  VALUES (NEW.id, auth.uid(), NEW.status,
    concat_ws(' ', 'Status:', OLD.status || ' → ' || NEW.status || '.', _reason));

  PERFORM public.notify_battery_participants(
    NEW.id, 'Bateria ' || NEW.code || ': ' || NEW.status,
    concat_ws(' ', 'O status foi atualizado.', _reason)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS battery_workflow_history ON public.batteries;
CREATE TRIGGER battery_workflow_history
  AFTER UPDATE OF status ON public.batteries
  FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.tg_battery_workflow_history();

CREATE OR REPLACE FUNCTION public.tg_lot_workflow_history()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _org UUID := NULLIF(current_setting('app.workflow_org', true),'')::UUID;
  _reason TEXT := NULLIF(current_setting('app.workflow_reason', true),'');
BEGIN
  INSERT INTO public.status_history(
    entity_type, entity_id, status_anterior, status_novo,
    alterado_por, organization_id, justificativa
  ) VALUES ('lot', NEW.id, OLD.status, NEW.status, auth.uid(), _org, _reason);
  PERFORM public.notify_lot_participants(
    NEW.id, 'Lote ' || NEW.code || ': ' || NEW.status,
    concat_ws(' ', 'O status do lote foi atualizado.', _reason)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS lot_workflow_history ON public.lots;
CREATE TRIGGER lot_workflow_history
  AFTER UPDATE OF status ON public.lots
  FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.tg_lot_workflow_history();

CREATE OR REPLACE FUNCTION public.tg_generic_workflow_history()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _org UUID := NULLIF(current_setting('app.workflow_org', true),'')::UUID;
  _reason TEXT := NULLIF(current_setting('app.workflow_reason', true),'');
BEGIN
  INSERT INTO public.status_history(
    entity_type, entity_id, status_anterior, status_novo,
    alterado_por, organization_id, justificativa
  ) VALUES (TG_TABLE_NAME, NEW.id, OLD.status, NEW.status, auth.uid(), _org, _reason);
  IF TG_TABLE_NAME = 'collections' THEN
    IF (to_jsonb(NEW)->>'battery_id') IS NOT NULL THEN
      PERFORM public.notify_battery_participants(
        (to_jsonb(NEW)->>'battery_id')::UUID,
        'Coleta atualizada: ' || NEW.status,
        concat_ws(' ', 'A ordem de coleta mudou de status.', _reason)
      );
    END IF;
    IF (to_jsonb(NEW)->>'lot_id') IS NOT NULL THEN
      PERFORM public.notify_lot_participants(
        (to_jsonb(NEW)->>'lot_id')::UUID,
        'Transporte do lote: ' || NEW.status,
        concat_ws(' ', 'A ordem de transporte foi atualizada.', _reason)
      );
    END IF;
  ELSIF TG_TABLE_NAME = 'proposals' THEN
    PERFORM public.notify_lot_participants(
      (to_jsonb(NEW)->>'lot_id')::UUID,
      'Proposta atualizada: ' || NEW.status,
      concat_ws(' ', 'O status de uma proposta foi atualizado.', _reason)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS collection_workflow_history ON public.collections;
CREATE TRIGGER collection_workflow_history
  AFTER UPDATE OF status ON public.collections
  FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.tg_generic_workflow_history();

DROP TRIGGER IF EXISTS proposal_workflow_history ON public.proposals;
CREATE TRIGGER proposal_workflow_history
  AFTER UPDATE OF status ON public.proposals
  FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.tg_generic_workflow_history();

-- Registra o estado inicial da bateria e do lote.
CREATE OR REPLACE FUNCTION public.tg_initial_workflow_history()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _org UUID := public.current_actor_organization(NULL);
BEGIN
  INSERT INTO public.status_history(
    entity_type, entity_id, status_anterior, status_novo, alterado_por, organization_id, justificativa
  ) VALUES (TG_ARGV[0], NEW.id, NULL, NEW.status, auth.uid(), _org, 'Registro criado');
  IF TG_TABLE_NAME = 'batteries' THEN
    INSERT INTO public.battery_events(battery_id, actor_id, event_type, notes)
    VALUES (NEW.id, auth.uid(), NEW.status, 'Bateria cadastrada; código e QR Code gerados.');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS battery_initial_workflow ON public.batteries;
CREATE TRIGGER battery_initial_workflow AFTER INSERT ON public.batteries
  FOR EACH ROW EXECUTE FUNCTION public.tg_initial_workflow_history('battery');
DROP TRIGGER IF EXISTS lot_initial_workflow ON public.lots;
CREATE TRIGGER lot_initial_workflow AFTER INSERT ON public.lots
  FOR EACH ROW EXECUTE FUNCTION public.tg_initial_workflow_history('lot');

-- Funções centrais de transição.
CREATE OR REPLACE FUNCTION public.transition_battery_status(
  _battery_id UUID, _new_status TEXT, _reason TEXT DEFAULT NULL, _organization_id UUID DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _current TEXT; _roles public.app_role[]; _org UUID;
BEGIN
  SELECT status INTO _current FROM public.batteries WHERE id = _battery_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Bateria não encontrada'; END IF;
  IF _current = _new_status THEN RETURN; END IF;

  SELECT allowed_roles INTO _roles FROM public.battery_status_transitions
  WHERE from_status = _current AND to_status = _new_status;
  IF _roles IS NULL THEN
    RAISE EXCEPTION 'Transição inválida da bateria: % → %', _current, _new_status;
  END IF;
  IF NOT public.can_transition_battery(_battery_id, _roles) THEN
    RAISE EXCEPTION 'Usuário sem permissão para esta transição';
  END IF;
  IF _new_status = 'documentacao_pendente'
     AND NOT EXISTS (
       SELECT 1 FROM public.lot_batteries lb
       JOIN public.operations o ON o.lot_id=lb.lot_id
       JOIN public.documents d ON d.operation_id=o.id
       WHERE lb.battery_id=_battery_id
     ) THEN
    RAISE EXCEPTION 'É necessário anexar ao menos um comprovante';
  END IF;

  _org := public.current_actor_organization(_organization_id);
  PERFORM set_config('app.workflow_authorized','true',true);
  PERFORM set_config('app.workflow_reason',COALESCE(_reason,''),true);
  PERFORM set_config('app.workflow_org',COALESCE(_org::TEXT,''),true);
  UPDATE public.batteries SET status = _new_status, status_atual = _new_status WHERE id = _battery_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.transition_lot_status(
  _lot_id UUID, _new_status TEXT, _reason TEXT DEFAULT NULL, _organization_id UUID DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _current TEXT; _roles public.app_role[]; _org UUID;
BEGIN
  SELECT status INTO _current FROM public.lots WHERE id = _lot_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Lote não encontrado'; END IF;
  IF _current = _new_status THEN RETURN; END IF;

  SELECT allowed_roles INTO _roles FROM public.lot_status_transitions
  WHERE from_status = _current AND to_status = _new_status;
  IF _roles IS NULL THEN RAISE EXCEPTION 'Transição inválida do lote: % → %', _current, _new_status; END IF;
  IF NOT public.can_transition_lot(_lot_id, _roles) THEN RAISE EXCEPTION 'Usuário sem permissão para esta transição'; END IF;
  IF _current='publicado' AND _new_status='recebendo_propostas'
     AND public.has_role(auth.uid(),'reciclador')
     AND NOT EXISTS (SELECT 1 FROM public.proposals WHERE lot_id=_lot_id AND reciclador_id=auth.uid() AND status='enviada') THEN
    RAISE EXCEPTION 'O lote só entra em propostas após o envio de uma proposta válida';
  END IF;

  _org := public.current_actor_organization(_organization_id);
  PERFORM set_config('app.workflow_authorized','true',true);
  PERFORM set_config('app.workflow_reason',COALESCE(_reason,''),true);
  PERFORM set_config('app.workflow_org',COALESCE(_org::TEXT,''),true);
  UPDATE public.lots SET status = _new_status WHERE id = _lot_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.transition_battery_status(UUID,TEXT,TEXT,UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.transition_lot_status(UUID,TEXT,TEXT,UUID) TO authenticated;

-- ---------------------------------------------------------
-- Ações operacionais da Fase 4
-- ---------------------------------------------------------

CREATE OR REPLACE FUNCTION public.review_battery_request(
  _battery_id UUID, _decision TEXT, _reason TEXT DEFAULT NULL, _organization_id UUID DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(),'operador') OR public.has_role(auth.uid(),'admin')) THEN
    RAISE EXCEPTION 'Apenas operador ou administrador pode analisar solicitações';
  END IF;
  IF _decision = 'aceitar' THEN
    PERFORM public.transition_battery_status(_battery_id,'aprovada_para_coleta',_reason,_organization_id);
  ELSIF _decision = 'solicitar_informacoes' THEN
    IF COALESCE(trim(_reason),'') = '' THEN RAISE EXCEPTION 'Informe quais dados são necessários'; END IF;
    PERFORM public.transition_battery_status(_battery_id,'informacoes_solicitadas',_reason,_organization_id);
  ELSE RAISE EXCEPTION 'Decisão inválida'; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_collection_order(
  _battery_id UUID, _origin TEXT, _destination TEXT,
  _operator_organization_id UUID DEFAULT NULL, _carrier_organization_id UUID DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id UUID; _status TEXT; _generator UUID; _transporter UUID;
BEGIN
  IF NOT (public.has_role(auth.uid(),'operador') OR public.has_role(auth.uid(),'admin')) THEN
    RAISE EXCEPTION 'Apenas operador ou administrador pode criar a coleta';
  END IF;
  SELECT status, generator_organization_id INTO _status, _generator
  FROM public.batteries WHERE id = _battery_id FOR UPDATE;
  IF _status <> 'aprovada_para_coleta' THEN RAISE EXCEPTION 'Bateria não está aprovada para coleta'; END IF;

  INSERT INTO public.collections(
    battery_id, generator_organization_id, operator_organization_id,
    carrier_organization_id, origem_endereco, destino_endereco, status, codigo_coleta
  ) VALUES (
    _battery_id, _generator, public.current_actor_organization(_operator_organization_id),
    _carrier_organization_id, _origin, _destination, 'ordem_criada',
    'COL-' || to_char(now(),'YYYY') || '-' || upper(substr(replace(gen_random_uuid()::TEXT,'-',''),1,8))
  ) RETURNING id INTO _id;

  INSERT INTO public.status_history(entity_type, entity_id, status_novo, alterado_por, organization_id, justificativa)
  VALUES ('collections', _id, 'ordem_criada', auth.uid(), public.current_actor_organization(_operator_organization_id), 'Ordem de coleta criada');

  FOR _transporter IN
    SELECT DISTINCT ur.user_id FROM public.user_roles ur
    JOIN public.profiles pr ON pr.id=ur.user_id AND pr.status='approved'
    WHERE ur.role='transportadora'
  LOOP
    PERFORM public.notify_user(_transporter,'Nova ordem de coleta','Uma nova ordem compatível está disponível.','/app');
  END LOOP;

  RETURN _id;
END;
$$;

CREATE OR REPLACE FUNCTION public.respond_collection_order(
  _collection_id UUID, _accept BOOLEAN, _reason TEXT DEFAULT NULL, _carrier_organization_id UUID DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _c public.collections%ROWTYPE; _org UUID;
BEGIN
  IF NOT (public.has_role(auth.uid(),'transportadora') OR public.has_role(auth.uid(),'admin')) THEN
    RAISE EXCEPTION 'Apenas transportadora ou administrador pode responder à ordem';
  END IF;
  SELECT * INTO _c FROM public.collections WHERE id = _collection_id FOR UPDATE;
  IF _c.status <> 'ordem_criada' THEN RAISE EXCEPTION 'Ordem não está disponível'; END IF;
  _org := public.current_actor_organization(_carrier_organization_id);
  PERFORM set_config('app.workflow_authorized','true',true);
  PERFORM set_config('app.workflow_reason',COALESCE(_reason,''),true);
  PERFORM set_config('app.workflow_org',COALESCE(_org::TEXT,''),true);
  UPDATE public.collections SET
    status = CASE WHEN _accept THEN 'aceita' ELSE 'recusada' END,
    transportadora_id = CASE WHEN _accept THEN auth.uid() ELSE transportadora_id END,
    carrier_organization_id = CASE WHEN _accept THEN _org ELSE carrier_organization_id END,
    observacoes = concat_ws(E'\n', observacoes, _reason)
  WHERE id = _collection_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.schedule_collection(
  _collection_id UUID, _scheduled_at TIMESTAMPTZ, _vehicle TEXT DEFAULT NULL,
  _plate TEXT DEFAULT NULL, _driver TEXT DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _c public.collections%ROWTYPE; _org UUID;
BEGIN
  SELECT * INTO _c FROM public.collections WHERE id = _collection_id FOR UPDATE;
  IF _c.status <> 'aceita' THEN RAISE EXCEPTION 'A coleta precisa estar aceita'; END IF;
  IF NOT (public.has_role(auth.uid(),'admin') OR _c.transportadora_id = auth.uid()
    OR (_c.carrier_organization_id IS NOT NULL AND public.can_manage_org(_c.carrier_organization_id, auth.uid()))) THEN
    RAISE EXCEPTION 'Usuário sem permissão para agendar';
  END IF;
  _org := public.current_actor_organization(_c.carrier_organization_id);
  PERFORM set_config('app.workflow_authorized','true',true);
  PERFORM set_config('app.workflow_reason','Coleta agendada',true);
  PERFORM set_config('app.workflow_org',COALESCE(_org::TEXT,''),true);
  UPDATE public.collections SET status='agendada', data_agendada=_scheduled_at,
    scheduled_at=_scheduled_at, veiculo=_vehicle, placa=_plate, motorista=_driver
  WHERE id=_collection_id;
  IF _c.battery_id IS NOT NULL THEN
    PERFORM public.transition_battery_status(_c.battery_id,'coleta_agendada','Coleta agendada',_org);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.advance_collection(
  _collection_id UUID, _action TEXT, _reason TEXT DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _c public.collections%ROWTYPE; _new TEXT; _org UUID; _bid UUID;
BEGIN
  SELECT * INTO _c FROM public.collections WHERE id=_collection_id FOR UPDATE;
  IF NOT (public.has_role(auth.uid(),'admin') OR _c.transportadora_id=auth.uid()
    OR (_c.carrier_organization_id IS NOT NULL AND public.is_org_member(_c.carrier_organization_id,auth.uid()))) THEN
    RAISE EXCEPTION 'Usuário sem permissão para atualizar a coleta';
  END IF;

  IF _action='confirmar_retirada' AND _c.status='agendada' THEN _new := 'retirada';
  ELSIF _action='iniciar_transporte' AND _c.status='retirada' THEN _new := 'em_transporte';
  ELSIF _action='confirmar_entrega' AND _c.status='em_transporte' THEN
    _new := CASE WHEN _c.battery_id IS NOT NULL THEN 'entregue_triagem' ELSE 'entregue_destinador' END;
  ELSE RAISE EXCEPTION 'Ação inválida para o status atual da coleta'; END IF;

  _org := public.current_actor_organization(_c.carrier_organization_id);
  PERFORM set_config('app.workflow_authorized','true',true);
  PERFORM set_config('app.workflow_reason',COALESCE(_reason,_action),true);
  PERFORM set_config('app.workflow_org',COALESCE(_org::TEXT,''),true);
  UPDATE public.collections SET status=_new,
    data_coleta=CASE WHEN _new='retirada' THEN now() ELSE data_coleta END,
    data_entrega=CASE WHEN _new IN ('entregue_triagem','entregue_destinador') THEN now() ELSE data_entrega END
  WHERE id=_collection_id;

  IF _new='em_transporte' AND _c.battery_id IS NOT NULL THEN
    PERFORM public.transition_battery_status(_c.battery_id,'em_transporte','Bateria retirada e em transporte',_org);
  ELSIF _new='em_transporte' AND _c.lot_id IS NOT NULL THEN
    PERFORM public.transition_lot_status(_c.lot_id,'em_transporte','Lote em transporte',_org);
    UPDATE public.operations SET status='em_transporte',carrier_organization_id=_org,updated_at=now()
    WHERE lot_id=_c.lot_id AND status IN ('criada','aguardando_transporte');
    FOR _bid IN SELECT battery_id FROM public.lot_batteries WHERE lot_id=_c.lot_id LOOP
      PERFORM public.transition_battery_status(_bid,'enviada_ao_destinador','Material enviado ao destinador',_org);
    END LOOP;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_triage_receipt(
  _collection_id UUID, _reason TEXT DEFAULT NULL, _organization_id UUID DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _c public.collections%ROWTYPE;
BEGIN
  IF NOT (public.has_role(auth.uid(),'operador') OR public.has_role(auth.uid(),'admin')) THEN
    RAISE EXCEPTION 'Apenas operador ou administrador confirma a triagem';
  END IF;
  SELECT * INTO _c FROM public.collections WHERE id=_collection_id FOR UPDATE;
  IF _c.status <> 'entregue_triagem' OR _c.battery_id IS NULL THEN
    RAISE EXCEPTION 'Coleta ainda não foi entregue à triagem';
  END IF;
  PERFORM public.transition_battery_status(_c.battery_id,'recebida_na_triagem',COALESCE(_reason,'Recebimento confirmado na triagem'),_organization_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.start_battery_diagnostic(
  _battery_id UUID, _organization_id UUID DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.transition_battery_status(_battery_id,'em_diagnostico','Diagnóstico técnico iniciado',_organization_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.record_battery_diagnostic(
  _battery_id UUID, _classification TEXT, _soh NUMERIC DEFAULT NULL,
  _voltage NUMERIC DEFAULT NULL, _capacity NUMERIC DEFAULT NULL,
  _temperature NUMERIC DEFAULT NULL, _integrity TEXT DEFAULT NULL,
  _risk TEXT DEFAULT NULL, _recommendation TEXT DEFAULT NULL,
  _notes TEXT DEFAULT NULL, _organization_id UUID DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id UUID; _org UUID;
BEGIN
  IF _classification NOT IN (
    'segunda_vida','reutilizacao_componentes','reciclagem_mecanica',
    'reciclagem_quimica','quarentena_tecnica','descarte_controlado'
  ) THEN RAISE EXCEPTION 'Classificação inválida'; END IF;
  IF NOT (public.has_role(auth.uid(),'operador') OR public.has_role(auth.uid(),'admin')) THEN
    RAISE EXCEPTION 'Apenas operador ou administrador registra diagnóstico';
  END IF;
  _org := public.current_actor_organization(_organization_id);
  INSERT INTO public.sorting_diagnostics(
    battery_id, operator_organization_id, responsavel_tecnico,
    tensao_medida, capacidade_medida_kwh, soh_percentual, temperatura,
    integridade_estrutural, risco_identificado, classificacao,
    recomendacao_destino, observacoes, status_validacao
  ) VALUES (
    _battery_id, _org, auth.uid()::TEXT, _voltage, _capacity, _soh, _temperature,
    _integrity, _risk, _classification, _recommendation, _notes, 'validado'
  ) RETURNING id INTO _id;
  UPDATE public.batteries SET classificacao=_classification, soh_percentual=_soh,
    diagnostico=jsonb_build_object('soh',_soh,'tensao',_voltage,'capacidade',_capacity,
      'temperatura',_temperature,'integridade',_integrity,'risco',_risk,'notas',_notes)
  WHERE id=_battery_id;
  PERFORM public.transition_battery_status(_battery_id,'classificada','Diagnóstico concluído: ' || _classification,_org);
  RETURN _id;
END;
$$;

CREATE OR REPLACE FUNCTION public.add_battery_to_lot(
  _lot_id UUID, _battery_id UUID, _organization_id UUID DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _ls TEXT;
BEGIN
  IF NOT (public.has_role(auth.uid(),'operador') OR public.has_role(auth.uid(),'admin')) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  SELECT status INTO _ls FROM public.lots WHERE id=_lot_id FOR UPDATE;
  IF _ls NOT IN ('rascunho','em_formacao') THEN RAISE EXCEPTION 'Lote não permite inclusão de baterias'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.batteries WHERE id=_battery_id AND status='classificada') THEN
    RAISE EXCEPTION 'Bateria precisa estar classificada';
  END IF;
  INSERT INTO public.lot_batteries(lot_id,battery_id) VALUES(_lot_id,_battery_id);
  PERFORM public.transition_battery_status(_battery_id,'em_lote','Adicionada ao lote',_organization_id);
  IF _ls='rascunho' THEN PERFORM public.transition_lot_status(_lot_id,'em_formacao','Formação do lote iniciada',_organization_id); END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_battery_from_lot(
  _lot_id UUID, _battery_id UUID, _organization_id UUID DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(),'operador') OR public.has_role(auth.uid(),'admin')) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.lots WHERE id=_lot_id AND status IN ('rascunho','em_formacao','pronto_para_publicacao')) THEN
    RAISE EXCEPTION 'Lote não permite remoção';
  END IF;
  DELETE FROM public.lot_batteries WHERE lot_id=_lot_id AND battery_id=_battery_id;
  PERFORM public.transition_battery_status(_battery_id,'classificada','Removida do lote',_organization_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.publish_lot(
  _lot_id UUID, _organization_id UUID DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _status TEXT; _bid UUID;
BEGIN
  SELECT status INTO _status FROM public.lots WHERE id=_lot_id FOR UPDATE;
  IF NOT EXISTS (SELECT 1 FROM public.lot_batteries WHERE lot_id=_lot_id) THEN RAISE EXCEPTION 'Lote vazio'; END IF;
  IF _status='em_formacao' THEN
    PERFORM public.transition_lot_status(_lot_id,'pronto_para_publicacao','Lote conferido e pronto',_organization_id);
  END IF;
  PERFORM public.transition_lot_status(_lot_id,'publicado','Lote publicado para recicladoras habilitadas',_organization_id);
  FOR _bid IN SELECT battery_id FROM public.lot_batteries WHERE lot_id=_lot_id LOOP
    PERFORM public.transition_battery_status(_bid,'em_negociacao','Lote publicado para propostas',_organization_id);
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_lot_proposal(
  _lot_id UUID, _amount NUMERIC, _conditions TEXT DEFAULT NULL,
  _commercial_model TEXT DEFAULT NULL, _withdrawal_days INTEGER DEFAULT NULL,
  _valid_until TIMESTAMPTZ DEFAULT NULL, _destination TEXT DEFAULT NULL,
  _organization_id UUID DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id UUID; _ls TEXT; _org UUID;
BEGIN
  IF NOT public.has_role(auth.uid(),'reciclador') THEN RAISE EXCEPTION 'Apenas recicladoras habilitadas podem propor'; END IF;
  _org := public.current_actor_organization(_organization_id);
  IF _org IS NULL OR NOT EXISTS (SELECT 1 FROM public.companies WHERE id=_org AND status='aprovada') THEN
    RAISE EXCEPTION 'Organização recicladora ainda não está habilitada';
  END IF;
  SELECT status INTO _ls FROM public.lots WHERE id=_lot_id FOR UPDATE;
  IF _ls NOT IN ('publicado','recebendo_propostas') THEN RAISE EXCEPTION 'Lote não está recebendo propostas'; END IF;
  IF EXISTS (SELECT 1 FROM public.proposals WHERE lot_id=_lot_id AND reciclador_id=auth.uid() AND status IN ('enviada','em_analise')) THEN
    RAISE EXCEPTION 'Já existe proposta ativa para este lote';
  END IF;
  INSERT INTO public.proposals(
    lot_id, reciclador_id, recycler_organization_id, valor_total, valor_proposto,
    condicoes, modelo_comercial, prazo_retirada_dias, validade_proposta,
    destinacao_proposta, status, submitted_by, submitted_at
  ) VALUES (
    _lot_id, auth.uid(), _org, _amount, _amount, _conditions, _commercial_model,
    _withdrawal_days, _valid_until, _destination, 'enviada', auth.uid(), now()
  ) RETURNING id INTO _id;
  INSERT INTO public.status_history(
    entity_type,entity_id,status_novo,alterado_por,organization_id,justificativa
  ) VALUES ('proposals',_id,'enviada',auth.uid(),_org,'Proposta enviada pela recicladora');
  IF _ls='publicado' THEN PERFORM public.transition_lot_status(_lot_id,'recebendo_propostas','Primeira proposta recebida',_org); END IF;
  PERFORM public.notify_lot_participants(_lot_id,'Nova proposta recebida','Uma recicladora habilitada enviou proposta para o lote.');
  RETURN _id;
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_lot_proposal(
  _proposal_id UUID, _organization_id UUID DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _p public.proposals%ROWTYPE; _lot public.lots%ROWTYPE; _operation UUID; _bid UUID; _org UUID;
BEGIN
  IF NOT (public.has_role(auth.uid(),'operador') OR public.has_role(auth.uid(),'admin')) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  SELECT * INTO _p FROM public.proposals WHERE id=_proposal_id FOR UPDATE;
  SELECT * INTO _lot FROM public.lots WHERE id=_p.lot_id FOR UPDATE;
  IF _p.status <> 'enviada' OR _lot.status NOT IN ('recebendo_propostas','em_analise') THEN
    RAISE EXCEPTION 'Proposta ou lote não está disponível para aceite';
  END IF;
  _org := public.current_actor_organization(_organization_id);
  IF _lot.status='recebendo_propostas' THEN PERFORM public.transition_lot_status(_lot.id,'em_analise','Propostas em análise',_org); END IF;

  PERFORM set_config('app.workflow_authorized','true',true);
  PERFORM set_config('app.workflow_reason','Proposta selecionada',true);
  PERFORM set_config('app.workflow_org',COALESCE(_org::TEXT,''),true);
  UPDATE public.proposals SET status='aceita' WHERE id=_p.id;
  UPDATE public.proposals SET status='recusada' WHERE lot_id=_p.lot_id AND id<>_p.id AND status IN ('enviada','em_analise');
  PERFORM public.transition_lot_status(_lot.id,'proposta_aceita','Proposta aceita',_org);

  INSERT INTO public.operations(
    lot_id, proposal_id, operator_organization_id, recycler_organization_id,
    modelo_comercial, valor_operacao, status
  ) VALUES (
    _lot.id, _p.id, COALESCE(_lot.operator_organization_id,_org), _p.recycler_organization_id,
    _p.modelo_comercial, COALESCE(_p.valor_proposto,_p.valor_total), 'criada'
  ) RETURNING id INTO _operation;
  INSERT INTO public.status_history(
    entity_type,entity_id,status_novo,alterado_por,organization_id,justificativa
  ) VALUES ('operations',_operation,'criada',auth.uid(),_org,'Operação criada pela proposta aceita');
  PERFORM public.transition_lot_status(_lot.id,'contratado','Operação comercial criada',_org);
  FOR _bid IN SELECT battery_id FROM public.lot_batteries WHERE lot_id=_lot.id LOOP
    PERFORM public.transition_battery_status(_bid,'destinacao_definida','Destinação definida pela proposta aceita',_org);
  END LOOP;

  INSERT INTO public.collections(
    lot_id, operator_organization_id, recycler_organization_id,
    origem_endereco, destino_endereco, status, codigo_coleta
  ) VALUES (
    _lot.id, COALESCE(_lot.operator_organization_id,_org), _p.recycler_organization_id,
    concat_ws('/',_lot.cidade,_lot.uf), 'Endereço da recicladora a confirmar', 'ordem_criada',
    'COL-' || to_char(now(),'YYYY') || '-' || upper(substr(replace(gen_random_uuid()::TEXT,'-',''),1,8))
  );
  RETURN _operation;
END;
$$;

CREATE INDEX IF NOT EXISTS collections_recycler_org_idx ON public.collections(recycler_organization_id);

CREATE OR REPLACE FUNCTION public.confirm_destination_receipt(
  _operation_id UUID, _reason TEXT DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _op public.operations%ROWTYPE; _p public.proposals%ROWTYPE; _bid UUID;
BEGIN
  SELECT * INTO _op FROM public.operations WHERE id=_operation_id FOR UPDATE;
  SELECT * INTO _p FROM public.proposals WHERE id=_op.proposal_id;
  IF NOT (public.has_role(auth.uid(),'admin') OR _p.reciclador_id=auth.uid()
    OR (_op.recycler_organization_id IS NOT NULL AND public.is_org_member(_op.recycler_organization_id,auth.uid()))) THEN
    RAISE EXCEPTION 'Sem permissão para confirmar o recebimento';
  END IF;
  IF _op.status NOT IN ('criada','em_transporte','aguardando_recebimento') THEN RAISE EXCEPTION 'Operação não aguarda recebimento'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.collections c
    WHERE c.lot_id=_op.lot_id AND c.status='entregue_destinador'
  ) THEN RAISE EXCEPTION 'O transporte ainda não confirmou a entrega ao destinador'; END IF;
  UPDATE public.operations SET status='recebida', updated_at=now() WHERE id=_operation_id;
  IF (SELECT status FROM public.lots WHERE id=_op.lot_id)='em_transporte' THEN
    PERFORM public.transition_lot_status(_op.lot_id,'entregue',COALESCE(_reason,'Recebimento confirmado pelo destinador'),_op.recycler_organization_id);
  END IF;
  FOR _bid IN SELECT battery_id FROM public.lot_batteries WHERE lot_id=_op.lot_id LOOP
    PERFORM public.transition_battery_status(_bid,'recebida_pelo_destinador',COALESCE(_reason,'Recebimento confirmado pelo destinador'),_op.recycler_organization_id);
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.register_operation_document(
  _operation_id UUID, _document_type TEXT, _storage_path TEXT,
  _document_number TEXT DEFAULT NULL, _issuer TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _op public.operations%ROWTYPE; _p public.proposals%ROWTYPE; _id UUID; _bid UUID;
BEGIN
  SELECT * INTO _op FROM public.operations WHERE id=_operation_id;
  SELECT * INTO _p FROM public.proposals WHERE id=_op.proposal_id;
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'operador')
    OR _p.reciclador_id=auth.uid()
    OR EXISTS (SELECT 1 FROM public.collections c WHERE c.lot_id=_op.lot_id AND c.transportadora_id=auth.uid())) THEN
    RAISE EXCEPTION 'Sem permissão para anexar documento';
  END IF;
  INSERT INTO public.documents(
    operation_id, lot_id, entity_type, entity_id, kind, tipo_documento,
    numero_documento, emissor, url, storage_path, uploaded_by, status
  ) VALUES (
    _operation_id, _op.lot_id, 'operation', _operation_id, _document_type, _document_type,
    _document_number, _issuer, _storage_path, _storage_path, auth.uid(), 'pendente'
  ) RETURNING id INTO _id;
  UPDATE public.operations SET status='documentacao_pendente',updated_at=now() WHERE id=_operation_id;
  IF (SELECT status FROM public.lots WHERE id=_op.lot_id)='entregue' THEN
    PERFORM public.transition_lot_status(_op.lot_id,'documentacao_pendente','Comprovantes anexados; aguardando validação',NULL);
  END IF;
  FOR _bid IN SELECT battery_id FROM public.lot_batteries WHERE lot_id=_op.lot_id LOOP
    IF (SELECT status FROM public.batteries WHERE id=_bid)='recebida_pelo_destinador' THEN
      PERFORM public.transition_battery_status(_bid,'documentacao_pendente','Documentação final pendente de validação',NULL);
    END IF;
  END LOOP;
  RETURN _id;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_and_complete_operation(
  _operation_id UUID, _notes TEXT DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _op public.operations%ROWTYPE; _bid UUID; _org UUID;
BEGIN
  IF NOT (public.has_role(auth.uid(),'operador') OR public.has_role(auth.uid(),'admin')) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  SELECT * INTO _op FROM public.operations WHERE id=_operation_id FOR UPDATE;
  IF _op.status <> 'documentacao_pendente' THEN RAISE EXCEPTION 'Operação não está aguardando documentação'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.documents WHERE operation_id=_operation_id) THEN RAISE EXCEPTION 'Nenhum comprovante anexado'; END IF;
  _org := public.current_actor_organization(_op.operator_organization_id);
  UPDATE public.documents SET status='validado',validado_por=auth.uid(),validado_em=now(),observacoes=concat_ws(E'\n',observacoes,_notes)
  WHERE operation_id=_operation_id;
  UPDATE public.operations SET status='concluida',updated_at=now() WHERE id=_operation_id;
  PERFORM public.transition_lot_status(_op.lot_id,'concluido',COALESCE(_notes,'Documentação validada e operação concluída'),_org);
  FOR _bid IN SELECT battery_id FROM public.lot_batteries WHERE lot_id=_op.lot_id LOOP
    PERFORM public.transition_battery_status(_bid,'concluida',COALESCE(_notes,'Documentação validada e destinação concluída'),_org);
  END LOOP;
END;
$$;

-- Bucket privado para comprovantes. Cada usuário grava em sua própria pasta.
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES ('workflow-documents','workflow-documents',FALSE,15728640,
  ARRAY['application/pdf','image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "workflow documents upload own folder" ON storage.objects;
CREATE POLICY "workflow documents upload own folder" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id='workflow-documents' AND (storage.foldername(name))[1]=auth.uid()::TEXT
  );
DROP POLICY IF EXISTS "workflow documents read involved" ON storage.objects;
CREATE POLICY "workflow documents read involved" ON storage.objects
  FOR SELECT TO authenticated USING (
    bucket_id='workflow-documents' AND (
      owner_id=auth.uid()::TEXT OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'operador')
    )
  );

-- RLS atualizada para o novo fluxo.
CREATE POLICY "battery owner reads" ON public.batteries FOR SELECT TO authenticated
  USING (owner_id=auth.uid());
CREATE POLICY "battery owner inserts" ON public.batteries FOR INSERT TO authenticated
  WITH CHECK (owner_id=auth.uid() AND public.has_role(auth.uid(),'gerador'));
CREATE POLICY "battery owner edits requested info" ON public.batteries FOR UPDATE TO authenticated
  USING (owner_id=auth.uid() AND status IN ('rascunho','cadastrada','informacoes_solicitadas'))
  WITH CHECK (owner_id=auth.uid());
CREATE POLICY "battery operator reads" ON public.batteries FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'operador') OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "battery operator updates" ON public.batteries FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'operador') OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "battery recycler reads won lots" ON public.batteries FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.lot_batteries lb JOIN public.proposals p ON p.lot_id=lb.lot_id
    WHERE lb.battery_id=batteries.id AND p.status='aceita' AND p.reciclador_id=auth.uid()
  ));
CREATE POLICY "battery carrier reads assigned" ON public.batteries FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.collections c LEFT JOIN public.lot_batteries lb ON lb.lot_id=c.lot_id
    WHERE (c.battery_id=batteries.id OR lb.battery_id=batteries.id) AND c.transportadora_id=auth.uid()
  ));

CREATE POLICY "lot operator manages" ON public.lots FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'operador') OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'operador') OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "approved recycler reads marketplace" ON public.lots FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'reciclador') AND status IN (
    'publicado','recebendo_propostas','em_analise','proposta_aceita','contratado',
    'em_transporte','entregue','documentacao_pendente','concluido'
  ));
CREATE POLICY "carrier reads assigned lots" ON public.lots FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'transportadora') AND EXISTS (
    SELECT 1 FROM public.collections c WHERE c.lot_id=lots.id
      AND (c.transportadora_id=auth.uid() OR c.status='ordem_criada')
  ));

CREATE POLICY "lot batteries operator manages" ON public.lot_batteries FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'operador') OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'operador') OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "lot batteries parties read" ON public.lot_batteries FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.lots l WHERE l.id=lot_id AND (
    public.has_role(auth.uid(),'operador') OR public.has_role(auth.uid(),'admin')
    OR (public.has_role(auth.uid(),'reciclador') AND l.status NOT IN ('rascunho','em_formacao','pronto_para_publicacao'))
    OR public.has_role(auth.uid(),'transportadora')
  )));

CREATE POLICY "proposal recycler reads own" ON public.proposals FOR SELECT TO authenticated
  USING (reciclador_id=auth.uid());
CREATE POLICY "proposal operator reads" ON public.proposals FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'operador') OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "collection operator manages" ON public.collections FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'operador') OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'operador') OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "carrier reads open or assigned collections" ON public.collections FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'transportadora') AND (
    status='ordem_criada' OR transportadora_id=auth.uid()
    OR (carrier_organization_id IS NOT NULL AND public.is_org_member(carrier_organization_id,auth.uid()))
  ));
CREATE POLICY "carrier updates assigned collection data" ON public.collections FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'transportadora') AND (
    status='ordem_criada' OR transportadora_id=auth.uid()
    OR (carrier_organization_id IS NOT NULL AND public.is_org_member(carrier_organization_id,auth.uid()))
  ));

-- Acesso às RPCs; funções auxiliares permanecem protegidas pelo próprio código.
GRANT EXECUTE ON FUNCTION public.review_battery_request(UUID,TEXT,TEXT,UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_collection_order(UUID,TEXT,TEXT,UUID,UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_collection_order(UUID,BOOLEAN,TEXT,UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.schedule_collection(UUID,TIMESTAMPTZ,TEXT,TEXT,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.advance_collection(UUID,TEXT,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_triage_receipt(UUID,TEXT,UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_battery_diagnostic(UUID,UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_battery_diagnostic(UUID,TEXT,NUMERIC,NUMERIC,NUMERIC,NUMERIC,TEXT,TEXT,TEXT,TEXT,UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_battery_to_lot(UUID,UUID,UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_battery_from_lot(UUID,UUID,UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.publish_lot(UUID,UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_lot_proposal(UUID,NUMERIC,TEXT,TEXT,INTEGER,TIMESTAMPTZ,TEXT,UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_lot_proposal(UUID,UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_destination_receipt(UUID,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_operation_document(UUID,TEXT,TEXT,TEXT,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_and_complete_operation(UUID,TEXT) TO authenticated;

CREATE INDEX IF NOT EXISTS status_history_entity_created_idx
  ON public.status_history(entity_type,entity_id,created_at);
CREATE INDEX IF NOT EXISTS collections_lot_status_idx ON public.collections(lot_id,status);
CREATE INDEX IF NOT EXISTS collections_battery_status_idx ON public.collections(battery_id,status);
CREATE INDEX IF NOT EXISTS proposals_lot_status_idx ON public.proposals(lot_id,status);
CREATE INDEX IF NOT EXISTS operations_lot_status_idx ON public.operations(lot_id,status);
