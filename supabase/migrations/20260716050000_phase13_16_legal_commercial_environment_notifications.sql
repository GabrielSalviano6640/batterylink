-- =========================================================
-- FASES 13–16 — documentos legais, comercial, indicadores e avisos
-- =========================================================

-- 13. MTR, CDF e avisos legais -------------------------------------------
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS collection_id UUID REFERENCES public.collections(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS orgao_sistema_emissor TEXT,
  ADD COLUMN IF NOT EXISTS responsavel_validado BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS aviso_legal TEXT;

CREATE INDEX IF NOT EXISTS documents_collection_idx ON public.documents(collection_id);

UPDATE public.documents SET aviso_legal=CASE COALESCE(tipo_documento,kind)
  WHEN 'mtr' THEN 'MTR: documento registrado ou anexado à operação. A emissão oficial deve ocorrer no sistema ambiental competente.'
  WHEN 'cdf' THEN 'CDF: certificado emitido ou validado pelo destinador responsável, conforme o sistema ambiental aplicável.'
  ELSE aviso_legal END
WHERE COALESCE(tipo_documento,kind) IN ('mtr','cdf');

CREATE OR REPLACE FUNCTION public.register_regulatory_document_metadata(
  _private_document_id UUID,_number TEXT DEFAULT NULL,_issuer_system TEXT DEFAULT NULL,
  _status TEXT DEFAULT 'pendente',_collection_id UUID DEFAULT NULL,
  _operation_id UUID DEFAULT NULL,_responsible_validated BOOLEAN DEFAULT FALSE,
  _notes TEXT DEFAULT NULL
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _d public.documents%ROWTYPE; _kind TEXT; _notice TEXT;
BEGIN
  SELECT * INTO _d FROM public.documents WHERE private_document_id=_private_document_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND OR NOT public.can_access_private_document(_private_document_id,auth.uid()) THEN RAISE EXCEPTION 'Documento não encontrado ou acesso negado'; END IF;
  _kind:=COALESCE(_d.tipo_documento,_d.kind);
  IF _kind NOT IN ('mtr','cdf') THEN RAISE EXCEPTION 'Metadados regulatórios disponíveis somente para MTR e CDF'; END IF;
  IF _kind='mtr' AND _collection_id IS NULL THEN RAISE EXCEPTION 'O MTR deve ser vinculado a uma coleta'; END IF;
  IF _kind='cdf' AND _operation_id IS NULL THEN RAISE EXCEPTION 'O CDF deve ser vinculado a uma operação'; END IF;
  IF _status NOT IN ('pendente','registrado','anexado','em_validacao','validado','rejeitado','vencido') THEN RAISE EXCEPTION 'Status documental inválido'; END IF;
  _notice:=CASE _kind
    WHEN 'mtr' THEN 'MTR: documento registrado ou anexado à operação. A emissão oficial deve ocorrer no sistema ambiental competente.'
    ELSE 'CDF: certificado emitido ou validado pelo destinador responsável, conforme o sistema ambiental aplicável.' END;
  UPDATE public.documents SET numero_documento=NULLIF(trim(_number),''),emissor=NULLIF(trim(_issuer_system),''),
    orgao_sistema_emissor=NULLIF(trim(_issuer_system),''),status=_status,collection_id=_collection_id,
    operation_id=COALESCE(_operation_id,operation_id),responsavel_validado=_responsible_validated,
    aviso_legal=_notice,observacoes=concat_ws(E'\n',observacoes,NULLIF(trim(_notes),'')),updated_at=now()
  WHERE id=_d.id;
  IF _responsible_validated THEN
    UPDATE public.documents SET validado_por=auth.uid(),validado_em=now() WHERE id=_d.id;
  END IF;
  INSERT INTO public.status_history(entity_type,entity_id,status_anterior,status_novo,alterado_por,organization_id,justificativa)
  VALUES('documents',_d.id,_d.status,_status,auth.uid(),public.current_actor_organization(NULL),'Metadados regulatórios registrados: '||_kind);
  RETURN _d.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_battery_document_timeline(_battery_id UUID)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT public.can_view_battery_private(_battery_id,auth.uid()) THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  RETURN COALESCE((SELECT jsonb_agg(jsonb_build_object(
    'id',d.id,'type',COALESCE(d.tipo_documento,d.kind),'number',d.numero_documento,
    'issuer_system',COALESCE(d.orgao_sistema_emissor,d.emissor),'status',d.status,
    'collection_id',d.collection_id,'operation_id',d.operation_id,
    'responsible_validated',d.responsavel_validado,'legal_notice',d.aviso_legal,
    'created_at',d.created_at,'validated_at',d.validado_em
  ) ORDER BY d.created_at DESC) FROM public.documents d
  WHERE d.deleted_at IS NULL AND (d.battery_id=_battery_id
    OR d.collection_id IN (SELECT c.id FROM public.collections c WHERE c.battery_id=_battery_id)
    OR d.lot_id IN (SELECT lb.lot_id FROM public.lot_batteries lb WHERE lb.battery_id=_battery_id)
    OR d.operation_id IN (SELECT o.id FROM public.operations o JOIN public.lot_batteries lb ON lb.lot_id=o.lot_id WHERE lb.battery_id=_battery_id)
  )),'[]'::JSONB);
END;
$$;

-- 14. Propostas e modelos comerciais ------------------------------------
ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS payer_type TEXT,
  ADD COLUMN IF NOT EXISTS recipient_type TEXT,
  ADD COLUMN IF NOT EXISTS logistics_cost NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS platform_fee NUMERIC NOT NULL DEFAULT 0;

UPDATE public.proposals SET modelo_comercial=CASE
  WHEN modelo_comercial IN ('gerador_paga_destinacao','generator_pays_destination') THEN 'gerador_paga_destinacao'
  WHEN modelo_comercial IN ('compra_lote','recicladora_compra_lote','recycler_buys_lot') THEN 'recicladora_compra_lote'
  ELSE 'intermediacao_neutra' END;
UPDATE public.proposals SET
  payer_type=COALESCE(payer_type,CASE modelo_comercial WHEN 'gerador_paga_destinacao' THEN 'gerador' WHEN 'recicladora_compra_lote' THEN 'recicladora' ELSE 'a_definir' END),
  recipient_type=COALESCE(recipient_type,CASE modelo_comercial WHEN 'gerador_paga_destinacao' THEN 'recicladora' WHEN 'recicladora_compra_lote' THEN 'gerador' ELSE 'a_definir' END);

ALTER TABLE public.proposals DROP CONSTRAINT IF EXISTS proposals_commercial_model_check;
ALTER TABLE public.proposals ADD CONSTRAINT proposals_commercial_model_check CHECK(modelo_comercial IN ('gerador_paga_destinacao','recicladora_compra_lote','intermediacao_neutra')) NOT VALID;
ALTER TABLE public.proposals DROP CONSTRAINT IF EXISTS proposals_costs_check;
ALTER TABLE public.proposals ADD CONSTRAINT proposals_costs_check CHECK(logistics_cost>=0 AND platform_fee>=0) NOT VALID;

ALTER TABLE public.operations
  ADD COLUMN IF NOT EXISTS agreed_value NUMERIC,
  ADD COLUMN IF NOT EXISTS logistics_cost NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payer_type TEXT,
  ADD COLUMN IF NOT EXISTS recipient_type TEXT,
  ADD COLUMN IF NOT EXISTS financial_status TEXT NOT NULL DEFAULT 'nao_aplicavel',
  ADD COLUMN IF NOT EXISTS financial_due_date DATE,
  ADD COLUMN IF NOT EXISTS payment_receipt_document_id UUID REFERENCES public.private_documents(id),
  ADD COLUMN IF NOT EXISTS financial_admin_note TEXT;

ALTER TABLE public.operations DROP CONSTRAINT IF EXISTS operations_financial_status_check;
ALTER TABLE public.operations ADD CONSTRAINT operations_financial_status_check CHECK(financial_status IN (
  'nao_aplicavel','aguardando_cobranca','cobranca_emitida','aguardando_pagamento','pago','vencido','cancelado'
));

DROP FUNCTION IF EXISTS public.save_recycler_proposal(UUID,UUID,NUMERIC,TEXT,TEXT,INTEGER,TIMESTAMPTZ,TEXT,BOOLEAN);
CREATE FUNCTION public.save_recycler_proposal(
  _lot_id UUID,_proposal_id UUID DEFAULT NULL,_amount NUMERIC DEFAULT NULL,
  _conditions TEXT DEFAULT NULL,_commercial_model TEXT DEFAULT NULL,
  _withdrawal_days INTEGER DEFAULT NULL,_valid_until TIMESTAMPTZ DEFAULT NULL,
  _destination TEXT DEFAULT NULL,_submit BOOLEAN DEFAULT FALSE,
  _payer_type TEXT DEFAULT NULL,_recipient_type TEXT DEFAULT NULL,
  _logistics_cost NUMERIC DEFAULT 0,_platform_fee NUMERIC DEFAULT 0
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _id UUID; _org UUID; _lot_status TEXT; _deadline TIMESTAMPTZ; _current TEXT; _payer TEXT; _recipient TEXT;
BEGIN
  IF NOT public.has_role(auth.uid(),'reciclador') THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  IF _commercial_model NOT IN ('gerador_paga_destinacao','recicladora_compra_lote','intermediacao_neutra') THEN RAISE EXCEPTION 'Modelo comercial inválido'; END IF;
  _payer:=CASE _commercial_model WHEN 'gerador_paga_destinacao' THEN 'gerador' WHEN 'recicladora_compra_lote' THEN 'recicladora' ELSE COALESCE(_payer_type,'a_definir') END;
  _recipient:=CASE _commercial_model WHEN 'gerador_paga_destinacao' THEN 'recicladora' WHEN 'recicladora_compra_lote' THEN 'gerador' ELSE COALESCE(_recipient_type,'a_definir') END;
  IF _payer=_recipient AND _payer<>'a_definir' THEN RAISE EXCEPTION 'Pagador e recebedor devem ser diferentes'; END IF;
  IF COALESCE(_logistics_cost,0)<0 OR COALESCE(_platform_fee,0)<0 THEN RAISE EXCEPTION 'Custos não podem ser negativos'; END IF;
  _org:=public.current_recycler_organization();
  IF _org IS NULL OR NOT EXISTS(SELECT 1 FROM public.companies WHERE id=_org AND status='aprovada') THEN RAISE EXCEPTION 'Organização não habilitada'; END IF;
  SELECT status,data_encerramento_propostas INTO _lot_status,_deadline FROM public.lots WHERE id=_lot_id FOR UPDATE;
  IF _lot_status NOT IN ('publicado','recebendo_propostas') OR (_deadline IS NOT NULL AND _deadline<=now()) THEN RAISE EXCEPTION 'Prazo de propostas encerrado'; END IF;
  IF _amount IS NULL OR _amount<=0 THEN RAISE EXCEPTION 'Valor da proposta inválido'; END IF;
  PERFORM set_config('app.workflow_authorized','true',true); PERFORM set_config('app.workflow_org',_org::TEXT,true);
  IF _proposal_id IS NULL THEN
    IF EXISTS(SELECT 1 FROM public.proposals WHERE lot_id=_lot_id AND (reciclador_id=auth.uid() OR recycler_organization_id=_org) AND status IN ('rascunho','enviada','em_analise')) THEN RAISE EXCEPTION 'Já existe proposta ativa para este lote'; END IF;
    INSERT INTO public.proposals(lot_id,reciclador_id,recycler_organization_id,valor_total,valor_proposto,condicoes,modelo_comercial,
      prazo_retirada_dias,validade_proposta,destinacao_proposta,status,submitted_by,submitted_at,payer_type,recipient_type,logistics_cost,platform_fee)
    VALUES(_lot_id,auth.uid(),_org,_amount,_amount,_conditions,_commercial_model,_withdrawal_days,_valid_until,_destination,
      CASE WHEN _submit THEN 'enviada' ELSE 'rascunho' END,auth.uid(),CASE WHEN _submit THEN now() ELSE NULL END,
      _payer,_recipient,COALESCE(_logistics_cost,0),COALESCE(_platform_fee,0)) RETURNING id INTO _id;
  ELSE
    SELECT status INTO _current FROM public.proposals WHERE id=_proposal_id AND lot_id=_lot_id
      AND (reciclador_id=auth.uid() OR recycler_organization_id=_org) FOR UPDATE;
    IF _current NOT IN ('rascunho','enviada') THEN RAISE EXCEPTION 'Proposta não pode mais ser editada'; END IF;
    UPDATE public.proposals SET valor_total=_amount,valor_proposto=_amount,condicoes=_conditions,modelo_comercial=_commercial_model,
      prazo_retirada_dias=_withdrawal_days,validade_proposta=_valid_until,destinacao_proposta=_destination,
      payer_type=_payer,recipient_type=_recipient,logistics_cost=COALESCE(_logistics_cost,0),platform_fee=COALESCE(_platform_fee,0),
      status=CASE WHEN _submit THEN 'enviada' ELSE _current END,submitted_at=CASE WHEN _submit THEN now() ELSE submitted_at END,updated_at=now()
    WHERE id=_proposal_id RETURNING id INTO _id;
  END IF;
  INSERT INTO public.status_history(entity_type,entity_id,status_novo,alterado_por,organization_id,justificativa)
  VALUES('proposals',_id,CASE WHEN _submit THEN 'enviada' ELSE 'rascunho' END,auth.uid(),_org,CASE WHEN _submit THEN 'Proposta enviada' ELSE 'Rascunho atualizado' END);
  IF _submit AND _lot_status='publicado' THEN PERFORM public.transition_lot_status(_lot_id,'recebendo_propostas','Primeira proposta recebida',_org); END IF;
  RETURN _id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_operation_financial(
  _operation_id UUID,_status TEXT,_due_date DATE DEFAULT NULL,
  _receipt_document_id UUID DEFAULT NULL,_admin_note TEXT DEFAULT NULL
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'operador')) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  IF _status NOT IN ('nao_aplicavel','aguardando_cobranca','cobranca_emitida','aguardando_pagamento','pago','vencido','cancelado') THEN RAISE EXCEPTION 'Status financeiro inválido'; END IF;
  IF _receipt_document_id IS NOT NULL AND NOT public.can_access_private_document(_receipt_document_id,auth.uid()) THEN RAISE EXCEPTION 'Comprovante inválido'; END IF;
  UPDATE public.operations SET financial_status=_status,financial_due_date=_due_date,
    payment_receipt_document_id=COALESCE(_receipt_document_id,payment_receipt_document_id),
    financial_admin_note=NULLIF(trim(_admin_note),''),updated_at=now() WHERE id=_operation_id;
  INSERT INTO public.audit_log(actor_id,action,entity_type,entity_id,payload) VALUES(auth.uid(),'financial_status_update','operations',_operation_id,
    jsonb_build_object('status',_status,'due_date',_due_date,'note',_admin_note));
END;
$$;

-- Copia os termos comerciais quando a operação é criada por uma proposta.
CREATE OR REPLACE FUNCTION public.tg_copy_operation_commercial_terms()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path=public AS $$
DECLARE _p public.proposals%ROWTYPE;
BEGIN
  SELECT * INTO _p FROM public.proposals WHERE id=NEW.proposal_id;
  NEW.modelo_comercial:=COALESCE(NEW.modelo_comercial,_p.modelo_comercial);
  NEW.valor_operacao:=COALESCE(NEW.valor_operacao,_p.valor_proposto,_p.valor_total);
  NEW.agreed_value:=COALESCE(NEW.agreed_value,NEW.valor_operacao);
  NEW.logistics_cost:=COALESCE(NEW.logistics_cost,_p.logistics_cost,0);
  NEW.taxa_plataforma:=COALESCE(NEW.taxa_plataforma,_p.platform_fee,0);
  NEW.payer_type:=COALESCE(NEW.payer_type,_p.payer_type);
  NEW.recipient_type:=COALESCE(NEW.recipient_type,_p.recipient_type);
  IF NEW.financial_status IS NULL OR NEW.financial_status='nao_aplicavel' THEN
    NEW.financial_status:=CASE WHEN _p.modelo_comercial='intermediacao_neutra' THEN 'nao_aplicavel' ELSE 'aguardando_cobranca' END;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS copy_operation_commercial_terms ON public.operations;
CREATE TRIGGER copy_operation_commercial_terms BEFORE INSERT ON public.operations FOR EACH ROW EXECUTE FUNCTION public.tg_copy_operation_commercial_terms();

-- 15. Indicadores ambientais configuráveis -------------------------------
CREATE TABLE IF NOT EXISTS public.environmental_factors(
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chemistry TEXT NOT NULL,
  min_weight_kg NUMERIC NOT NULL DEFAULT 0,
  max_weight_kg NUMERIC,
  estimated_composition JSONB NOT NULL DEFAULT '{}'::JSONB,
  lithium_kg_per_kg NUMERIC,
  nickel_kg_per_kg NUMERIC,
  cobalt_kg_per_kg NUMERIC,
  copper_kg_per_kg NUMERIC,
  avoided_emissions_kgco2e_per_kg NUMERIC,
  methodology TEXT NOT NULL,
  source TEXT NOT NULL,
  version TEXT NOT NULL,
  effective_from DATE NOT NULL,
  effective_to DATE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK(max_weight_kg IS NULL OR max_weight_kg>min_weight_kg),
  CHECK(COALESCE(lithium_kg_per_kg,0)>=0 AND COALESCE(nickel_kg_per_kg,0)>=0 AND COALESCE(cobalt_kg_per_kg,0)>=0 AND COALESCE(copper_kg_per_kg,0)>=0 AND COALESCE(avoided_emissions_kgco2e_per_kg,0)>=0)
);
CREATE INDEX IF NOT EXISTS environmental_factors_lookup_idx ON public.environmental_factors(chemistry,effective_from DESC) WHERE active;
ALTER TABLE public.environmental_factors ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.environmental_factors TO authenticated;
GRANT INSERT,UPDATE,DELETE ON public.environmental_factors TO authenticated;
DROP POLICY IF EXISTS "environmental factors read" ON public.environmental_factors;
CREATE POLICY "environmental factors read" ON public.environmental_factors FOR SELECT TO authenticated USING(active OR public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "environmental factors admin manage" ON public.environmental_factors;
CREATE POLICY "environmental factors admin manage" ON public.environmental_factors FOR ALL TO authenticated USING(public.has_role(auth.uid(),'admin')) WITH CHECK(public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.get_environmental_indicators(_from DATE DEFAULT NULL,_to DATE DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE _result JSONB; _has_factor BOOLEAN;
BEGIN
  WITH eligible AS (
    SELECT b.*,COALESCE(b.peso_estimado_kg,b.peso_kg,0)*b.quantidade AS mass_kg
    FROM public.batteries b WHERE b.status IN ('recebida_pelo_destinador','documentacao_pendente','concluida')
      AND (_from IS NULL OR b.updated_at::DATE>=_from) AND (_to IS NULL OR b.updated_at::DATE<=_to)
      AND (public.has_role(auth.uid(),'admin') OR b.owner_id=auth.uid() OR public.is_org_member(b.generator_organization_id,auth.uid()) OR public.is_org_member(b.company_id,auth.uid()))
  ), matched AS (
    SELECT e.*,f.id factor_id,f.lithium_kg_per_kg,f.nickel_kg_per_kg,f.cobalt_kg_per_kg,f.copper_kg_per_kg,
      f.avoided_emissions_kgco2e_per_kg,f.methodology,f.source,f.version
    FROM eligible e LEFT JOIN LATERAL (SELECT * FROM public.environmental_factors f
      WHERE f.active AND lower(f.chemistry)=lower(e.quimica) AND e.mass_kg>=f.min_weight_kg
        AND (f.max_weight_kg IS NULL OR e.mass_kg<f.max_weight_kg)
        AND f.effective_from<=e.updated_at::DATE AND (f.effective_to IS NULL OR f.effective_to>=e.updated_at::DATE)
      ORDER BY f.effective_from DESC LIMIT 1) f ON TRUE
  )
  SELECT EXISTS(SELECT 1 FROM matched WHERE factor_id IS NOT NULL),jsonb_build_object(
    'disclaimer','Estimativas para fins gerenciais, sujeitas à validação técnica.',
    'available',EXISTS(SELECT 1 FROM matched WHERE factor_id IS NOT NULL),
    'unavailable_message','Indicador indisponível — metodologia não configurada.',
    'mass_processed_kg',COALESCE(sum(mass_kg) FILTER(WHERE factor_id IS NOT NULL),0),
    'second_life_kg',COALESCE(sum(mass_kg) FILTER(WHERE factor_id IS NOT NULL AND classificacao='segunda_vida'),0),
    'recycling_kg',COALESCE(sum(mass_kg) FILTER(WHERE factor_id IS NOT NULL AND classificacao<>'segunda_vida'),0),
    'lithium_recoverable_kg',sum(mass_kg*lithium_kg_per_kg) FILTER(WHERE factor_id IS NOT NULL AND lithium_kg_per_kg IS NOT NULL),
    'nickel_recoverable_kg',sum(mass_kg*nickel_kg_per_kg) FILTER(WHERE factor_id IS NOT NULL AND nickel_kg_per_kg IS NOT NULL),
    'cobalt_recoverable_kg',sum(mass_kg*cobalt_kg_per_kg) FILTER(WHERE factor_id IS NOT NULL AND cobalt_kg_per_kg IS NOT NULL),
    'copper_recoverable_kg',sum(mass_kg*copper_kg_per_kg) FILTER(WHERE factor_id IS NOT NULL AND copper_kg_per_kg IS NOT NULL),
    'avoided_emissions_kgco2e',sum(mass_kg*avoided_emissions_kgco2e_per_kg) FILTER(WHERE factor_id IS NOT NULL AND avoided_emissions_kgco2e_per_kg IS NOT NULL),
    'methodologies',COALESCE(jsonb_agg(DISTINCT jsonb_build_object('methodology',methodology,'source',source,'version',version)) FILTER(WHERE factor_id IS NOT NULL),'[]'::JSONB)
  ) INTO _has_factor,_result FROM matched;
  RETURN _result;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_environmental_factors()
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Acesso restrito'; END IF;
  RETURN COALESCE((SELECT jsonb_agg(to_jsonb(f) ORDER BY effective_from DESC,chemistry) FROM public.environmental_factors f),'[]'::JSONB);
END;
$$;

CREATE OR REPLACE FUNCTION public.save_environmental_factor(
  _chemistry TEXT,_methodology TEXT,_source TEXT,_version TEXT,_effective_from DATE,
  _min_weight_kg NUMERIC DEFAULT 0,_max_weight_kg NUMERIC DEFAULT NULL,
  _composition JSONB DEFAULT '{}'::JSONB,_lithium NUMERIC DEFAULT NULL,_nickel NUMERIC DEFAULT NULL,
  _cobalt NUMERIC DEFAULT NULL,_copper NUMERIC DEFAULT NULL,_avoided_emissions NUMERIC DEFAULT NULL
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _id UUID;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Acesso restrito'; END IF;
  IF COALESCE(trim(_chemistry),'')='' OR COALESCE(trim(_methodology),'')='' OR COALESCE(trim(_source),'')='' OR COALESCE(trim(_version),'')='' THEN RAISE EXCEPTION 'Química, metodologia, fonte e versão são obrigatórias'; END IF;
  INSERT INTO public.environmental_factors(chemistry,min_weight_kg,max_weight_kg,estimated_composition,lithium_kg_per_kg,
    nickel_kg_per_kg,cobalt_kg_per_kg,copper_kg_per_kg,avoided_emissions_kgco2e_per_kg,methodology,source,version,effective_from,created_by)
  VALUES(trim(_chemistry),COALESCE(_min_weight_kg,0),_max_weight_kg,COALESCE(_composition,'{}'::JSONB),_lithium,_nickel,_cobalt,_copper,_avoided_emissions,
    trim(_methodology),trim(_source),trim(_version),_effective_from,auth.uid()) RETURNING id INTO _id;
  INSERT INTO public.audit_log(actor_id,action,entity_type,entity_id,payload) VALUES(auth.uid(),'environmental_factor_created','environmental_factors',_id,
    jsonb_build_object('chemistry',_chemistry,'methodology',_methodology,'source',_source,'version',_version));
  RETURN _id;
END;
$$;

-- 16. Central e eventos de notificações ---------------------------------
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS event_key TEXT,
  ADD COLUMN IF NOT EXISTS email_status TEXT NOT NULL DEFAULT 'integracao_pendente',
  ADD COLUMN IF NOT EXISTS email_error TEXT;
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_email_status_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_email_status_check CHECK(email_status IN ('integracao_pendente','enfileirado','enviado','falhou','nao_aplicavel'));
CREATE UNIQUE INDEX IF NOT EXISTS notifications_event_dedupe_uidx ON public.notifications(user_id,event_key,entity_type,entity_id) WHERE event_key IS NOT NULL;

CREATE OR REPLACE FUNCTION public.notify_user_event(
  _user_id UUID,_event_key TEXT,_title TEXT,_body TEXT,_entity_type TEXT DEFAULT NULL,
  _entity_id UUID DEFAULT NULL,_organization_id UUID DEFAULT NULL,_link TEXT DEFAULT '/app'
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF _user_id IS NULL THEN RETURN; END IF;
  INSERT INTO public.notifications(user_id,profile_id,title,body,mensagem,link,tipo,entity_type,entity_id,organization_id,event_key,email_status)
  VALUES(_user_id,_user_id,_title,_body,_body,_link,'interna',_entity_type,_entity_id,_organization_id,_event_key,'integracao_pendente')
  ON CONFLICT(user_id,event_key,entity_type,entity_id) WHERE event_key IS NOT NULL DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_organization_event(
  _organization_id UUID,_event_key TEXT,_title TEXT,_body TEXT,_entity_type TEXT,_entity_id UUID,_link TEXT DEFAULT '/app'
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _uid UUID;
BEGIN
  FOR _uid IN
    SELECT owner_id FROM public.companies WHERE id=_organization_id
    UNION SELECT user_id FROM public.org_members WHERE org_id=_organization_id AND ativo
  LOOP PERFORM public.notify_user_event(_uid,_event_key,_title,_body,_entity_type,_entity_id,_organization_id,_link); END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.tg_phase16_company_notifications()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _admin UUID;
BEGIN
  IF TG_OP='INSERT' THEN
    FOR _admin IN SELECT user_id FROM public.user_roles WHERE role='admin' LOOP
      PERFORM public.notify_user_event(_admin,'organization_pending','Cadastro aguardando aprovação','A organização '||NEW.razao_social||' aguarda análise.','organizations',NEW.id,NULL,'/app/admin');
    END LOOP;
  ELSIF NEW.status IS DISTINCT FROM OLD.status OR NEW.status_aprovacao IS DISTINCT FROM OLD.status_aprovacao THEN
    PERFORM public.notify_organization_event(NEW.id,'organization_'||COALESCE(NEW.status_aprovacao,NEW.status::TEXT),'Organização '||CASE WHEN COALESCE(NEW.status_aprovacao,NEW.status::TEXT) IN ('aprovada','approved') THEN 'aprovada' ELSE 'rejeitada ou suspensa' END,
      'O cadastro da organização foi atualizado para '||COALESCE(NEW.status_aprovacao,NEW.status::TEXT)||'.','organizations',NEW.id,'/app');
  END IF; RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS phase16_company_notifications ON public.companies;
CREATE TRIGGER phase16_company_notifications AFTER INSERT OR UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.tg_phase16_company_notifications();

CREATE OR REPLACE FUNCTION public.tg_phase16_battery_notifications()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _title TEXT; _operator UUID;
BEGIN
  IF TG_OP='INSERT' THEN
    PERFORM public.notify_user_event(NEW.owner_id,'battery_created','Nova bateria cadastrada','A bateria '||NEW.codigo_unico||' foi cadastrada.','batteries',NEW.id,NEW.generator_organization_id,'/app');
    FOR _operator IN SELECT user_id FROM public.user_roles WHERE role IN ('admin','operador') LOOP
      PERFORM public.notify_user_event(_operator,'battery_created','Nova bateria cadastrada','A bateria '||NEW.codigo_unico||' aguarda acompanhamento.','batteries',NEW.id,NEW.generator_organization_id,'/app');
    END LOOP;
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    _title:=CASE NEW.status WHEN 'informacoes_solicitadas' THEN 'Informações solicitadas' WHEN 'recebida_na_triagem' THEN 'Bateria recebida' WHEN 'classificada' THEN 'Diagnóstico concluído' WHEN 'concluida' THEN 'Operação concluída' ELSE 'Mudança de status' END;
    PERFORM public.notify_user_event(NEW.owner_id,'battery_status_'||NEW.status,_title,'A bateria '||NEW.codigo_unico||' mudou para '||NEW.status||'.','batteries',NEW.id,NEW.generator_organization_id,'/app');
    PERFORM public.notify_organization_event(NEW.generator_organization_id,'battery_status_'||NEW.status,_title,'A bateria '||NEW.codigo_unico||' mudou para '||NEW.status||'.','batteries',NEW.id,'/app');
  END IF; RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS phase16_battery_notifications ON public.batteries;
CREATE TRIGGER phase16_battery_notifications AFTER INSERT OR UPDATE OF status ON public.batteries FOR EACH ROW EXECUTE FUNCTION public.tg_phase16_battery_notifications();

CREATE OR REPLACE FUNCTION public.tg_phase16_collection_notifications()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _event TEXT; _title TEXT;
BEGIN
  IF TG_OP='INSERT' THEN _event:='collection_assigned'; _title:='Coleta atribuída';
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    _event:='collection_status_'||NEW.status;
    _title:=CASE NEW.status WHEN 'aceita' THEN 'Coleta aceita' WHEN 'recusada' THEN 'Coleta recusada' ELSE 'Status da coleta atualizado' END;
  ELSE RETURN NEW; END IF;
  PERFORM public.notify_organization_event(NEW.carrier_organization_id,_event,_title,'A coleta '||COALESCE(NEW.codigo_coleta,NEW.id::TEXT)||' requer acompanhamento.','collections',NEW.id,'/app');
  PERFORM public.notify_organization_event(NEW.generator_organization_id,_event,_title,'A coleta '||COALESCE(NEW.codigo_coleta,NEW.id::TEXT)||' foi atualizada.','collections',NEW.id,'/app');
  IF NEW.transportadora_id IS NOT NULL THEN PERFORM public.notify_user_event(NEW.transportadora_id,_event,_title,'A coleta foi atualizada.','collections',NEW.id,NEW.carrier_organization_id,'/app'); END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS phase16_collection_notifications ON public.collections;
CREATE TRIGGER phase16_collection_notifications AFTER INSERT OR UPDATE OF status ON public.collections FOR EACH ROW EXECUTE FUNCTION public.tg_phase16_collection_notifications();

CREATE OR REPLACE FUNCTION public.tg_phase16_lot_notifications()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _uid UUID;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('publicado','recebendo_propostas') THEN
    FOR _uid IN SELECT DISTINCT c.owner_id FROM public.companies c WHERE c.status='aprovada' AND (c.tipo='reciclador' OR c.tipo_organizacao IN ('reciclador','recicladora')) LOOP
      PERFORM public.notify_user_event(_uid,'lot_published','Lote publicado','O lote '||NEW.codigo_lote||' está disponível para propostas.','lots',NEW.id,NEW.operator_organization_id,'/app');
    END LOOP;
  END IF; RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS phase16_lot_notifications ON public.lots;
CREATE TRIGGER phase16_lot_notifications AFTER UPDATE OF status ON public.lots FOR EACH ROW EXECUTE FUNCTION public.tg_phase16_lot_notifications();

CREATE OR REPLACE FUNCTION public.tg_phase16_proposal_notifications()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _lot public.lots%ROWTYPE; _event TEXT; _title TEXT;
BEGIN
  SELECT * INTO _lot FROM public.lots WHERE id=NEW.lot_id;
  IF TG_OP='INSERT' AND NEW.status='enviada' THEN _event:='proposal_new'; _title:='Nova proposta';
  ELSIF TG_OP='UPDATE' AND NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('enviada','aceita','recusada') THEN _event:='proposal_'||NEW.status; _title:=CASE NEW.status WHEN 'aceita' THEN 'Proposta aceita' WHEN 'recusada' THEN 'Proposta recusada' ELSE 'Nova proposta' END;
  ELSE RETURN NEW; END IF;
  PERFORM public.notify_organization_event(_lot.operator_organization_id,_event,_title,'Proposta atualizada para o lote '||_lot.codigo_lote||'.','proposals',NEW.id,'/app');
  PERFORM public.notify_user_event(NEW.reciclador_id,_event,_title,'Sua proposta para o lote '||_lot.codigo_lote||' está como '||NEW.status||'.','proposals',NEW.id,NEW.recycler_organization_id,'/app');
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS phase16_proposal_notifications ON public.proposals;
CREATE TRIGGER phase16_proposal_notifications AFTER INSERT OR UPDATE OF status ON public.proposals FOR EACH ROW EXECUTE FUNCTION public.tg_phase16_proposal_notifications();

CREATE OR REPLACE FUNCTION public.tg_phase16_document_notifications()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF COALESCE(NEW.status,'pendente') IN ('pendente','em_validacao') THEN
    PERFORM public.notify_user_event(NEW.uploaded_by,'document_pending','Documento pendente','O documento '||COALESCE(NEW.tipo_documento,NEW.kind,'documento')||' aguarda validação.','documents',NEW.id,NULL,'/app');
  END IF;
  IF NEW.data_validade IS NOT NULL AND NEW.data_validade<=current_date+30 THEN
    PERFORM public.notify_user_event(NEW.uploaded_by,'document_expiring','Documento vencendo','Documento com validade em '||to_char(NEW.data_validade,'DD/MM/YYYY')||'.','documents',NEW.id,NULL,'/app');
  END IF; RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS phase16_document_notifications ON public.documents;
CREATE TRIGGER phase16_document_notifications AFTER INSERT OR UPDATE OF status,data_validade ON public.documents FOR EACH ROW EXECUTE FUNCTION public.tg_phase16_document_notifications();

CREATE OR REPLACE FUNCTION public.tg_phase16_incident_notifications()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _admin UUID;
BEGIN
  PERFORM public.notify_user_event(NEW.registrado_por,'incident_created','Ocorrência registrada','A ocorrência foi registrada e será acompanhada.','incidents',NEW.id,NULL,'/app');
  FOR _admin IN SELECT user_id FROM public.user_roles WHERE role IN ('admin','operador') LOOP
    PERFORM public.notify_user_event(_admin,'incident_created','Ocorrência registrada',NEW.descricao,'incidents',NEW.id,NULL,'/app/admin');
  END LOOP; RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS phase16_incident_notifications ON public.incidents;
CREATE TRIGGER phase16_incident_notifications AFTER INSERT ON public.incidents FOR EACH ROW EXECUTE FUNCTION public.tg_phase16_incident_notifications();

CREATE OR REPLACE FUNCTION public.tg_phase16_operation_notifications()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('concluida','concluido') THEN
    PERFORM public.notify_organization_event(NEW.generator_organization_id,'operation_completed','Operação concluída','A operação foi concluída.','operations',NEW.id,'/app');
    PERFORM public.notify_organization_event(NEW.operator_organization_id,'operation_completed','Operação concluída','A operação foi concluída.','operations',NEW.id,'/app');
    PERFORM public.notify_organization_event(NEW.carrier_organization_id,'operation_completed','Operação concluída','A operação foi concluída.','operations',NEW.id,'/app');
    PERFORM public.notify_organization_event(NEW.recycler_organization_id,'operation_completed','Operação concluída','A operação foi concluída.','operations',NEW.id,'/app');
  END IF; RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS phase16_operation_notifications ON public.operations;
CREATE TRIGGER phase16_operation_notifications AFTER UPDATE OF status ON public.operations FOR EACH ROW EXECUTE FUNCTION public.tg_phase16_operation_notifications();

-- Diagnóstico concluído é notificado mesmo quando a classificação não altera status no mesmo comando.
CREATE OR REPLACE FUNCTION public.tg_phase16_diagnostic_notifications()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _b public.batteries%ROWTYPE;
BEGIN
  SELECT * INTO _b FROM public.batteries WHERE id=NEW.battery_id;
  PERFORM public.notify_user_event(_b.owner_id,'diagnostic_completed','Diagnóstico concluído','O diagnóstico da bateria '||_b.codigo_unico||' foi registrado.','sorting_diagnostics',NEW.id,_b.generator_organization_id,'/app');
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS phase16_diagnostic_notifications ON public.sorting_diagnostics;
CREATE TRIGGER phase16_diagnostic_notifications AFTER INSERT ON public.sorting_diagnostics FOR EACH ROW EXECUTE FUNCTION public.tg_phase16_diagnostic_notifications();

REVOKE ALL ON FUNCTION public.register_regulatory_document_metadata(UUID,TEXT,TEXT,TEXT,UUID,UUID,BOOLEAN,TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_regulatory_document_metadata(UUID,TEXT,TEXT,TEXT,UUID,UUID,BOOLEAN,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_battery_document_timeline(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_recycler_proposal(UUID,UUID,NUMERIC,TEXT,TEXT,INTEGER,TIMESTAMPTZ,TEXT,BOOLEAN,TEXT,TEXT,NUMERIC,NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_operation_financial(UUID,TEXT,DATE,UUID,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_environmental_indicators(DATE,DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_environmental_factors() TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_environmental_factor(TEXT,TEXT,TEXT,TEXT,DATE,NUMERIC,NUMERIC,JSONB,NUMERIC,NUMERIC,NUMERIC,NUMERIC,NUMERIC) TO authenticated;

COMMENT ON COLUMN public.notifications.email_status IS 'Sem serviço configurado, permanece integracao_pendente; nenhum envio é simulado.';
