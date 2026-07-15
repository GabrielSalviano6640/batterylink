-- =========================================================
-- FASES 9 E 10 — recicladora e administração
-- =========================================================

CREATE TABLE IF NOT EXISTS public.lot_watchlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lot_id UUID NOT NULL REFERENCES public.lots(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(lot_id,user_id)
);
ALTER TABLE public.lot_watchlist ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,DELETE ON public.lot_watchlist TO authenticated;
DROP POLICY IF EXISTS "watchlist own" ON public.lot_watchlist;
CREATE POLICY "watchlist own" ON public.lot_watchlist FOR ALL TO authenticated
  USING (user_id=auth.uid()) WITH CHECK (user_id=auth.uid());

ALTER TABLE public.operations
  ADD COLUMN IF NOT EXISTS actual_received_weight_kg NUMERIC,
  ADD COLUMN IF NOT EXISTS received_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS destination_method TEXT,
  ADD COLUMN IF NOT EXISTS destination_notes TEXT,
  ADD COLUMN IF NOT EXISTS destination_completed_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.system_parameters (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT 'null'::JSONB,
  description TEXT,
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.system_parameters ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.system_parameters TO authenticated;
CREATE POLICY "system parameters admin read" ON public.system_parameters
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.current_recycler_organization()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT c.id FROM public.companies c
  WHERE (c.tipo='reciclador' OR c.tipo_organizacao IN ('reciclador','recicladora'))
    AND (c.owner_id=auth.uid() OR public.is_org_member(c.id,auth.uid()))
  ORDER BY (c.owner_id=auth.uid()) DESC,c.created_at LIMIT 1
$$;

-- Dados da recicladora são entregues por RPC para impedir qualquer leitura de
-- propostas concorrentes e limitar detalhes técnicos antes do aceite.
CREATE OR REPLACE FUNCTION public.get_recycler_dashboard_data()
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE _org UUID;
BEGIN
  IF NOT (public.has_role(auth.uid(),'reciclador') OR public.has_role(auth.uid(),'admin')) THEN
    RAISE EXCEPTION 'Acesso restrito à recicladora';
  END IF;
  _org:=public.current_recycler_organization();
  RETURN jsonb_build_object(
    'organization_id',_org,
    'lots',COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id',l.id,'code',l.codigo_lote,'title',l.titulo,'description',l.descricao,
        'chemistry',l.quimica_predominante,'classification',l.classificacao,
        'city',l.cidade,'state',COALESCE(l.estado,l.uf),'status',l.status,
        'quantity',l.quantidade_baterias,'weight_kg',l.peso_total_kg,
        'capacity_kwh',l.capacidade_total_kwh,'average_soh',l.soh_medio,
        'proposal_deadline',l.data_encerramento_propostas,'created_at',l.created_at,
        'watched',EXISTS(SELECT 1 FROM public.lot_watchlist w WHERE w.lot_id=l.id AND w.user_id=auth.uid()),
        'authorized',EXISTS(SELECT 1 FROM public.proposals p WHERE p.lot_id=l.id AND p.status='aceita'
          AND (p.reciclador_id=auth.uid() OR p.recycler_organization_id=_org))
      ) ORDER BY l.created_at DESC)
      FROM public.lots l WHERE l.status IN (
        'publicado','recebendo_propostas','em_analise','proposta_aceita','contratado',
        'em_transporte','entregue','documentacao_pendente','concluido'
      )
    ),'[]'::JSONB),
    'proposals',COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id',p.id,'lot_id',p.lot_id,'status',p.status,'amount',p.valor_proposto,
        'currency',p.moeda,'commercial_model',p.modelo_comercial,
        'withdrawal_days',p.prazo_retirada_dias,'valid_until',p.validade_proposta,
        'destination',p.destinacao_proposta,'conditions',p.condicoes,
        'submitted_at',p.submitted_at,'updated_at',p.updated_at
      ) ORDER BY p.updated_at DESC)
      FROM public.proposals p WHERE p.reciclador_id=auth.uid() OR p.recycler_organization_id=_org
    ),'[]'::JSONB),
    'operations',COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id',o.id,'lot_id',o.lot_id,'proposal_id',o.proposal_id,'status',o.status,
        'actual_weight_kg',o.actual_received_weight_kg,'received_at',o.received_at,
        'destination_method',o.destination_method,'destination_notes',o.destination_notes,
        'destination_completed_at',o.destination_completed_at,'updated_at',o.updated_at,
        'pending_documents',(SELECT count(*) FROM public.documents d WHERE d.operation_id=o.id AND COALESCE(d.status,'pendente')<>'validado')
      ) ORDER BY o.updated_at DESC)
      FROM public.operations o WHERE o.recycler_organization_id=_org
        OR EXISTS(SELECT 1 FROM public.proposals p WHERE p.id=o.proposal_id AND p.reciclador_id=auth.uid())
    ),'[]'::JSONB),
    'summary',jsonb_build_object(
      'available_lots',(SELECT count(*) FROM public.lots WHERE status IN ('publicado','recebendo_propostas')),
      'watched_lots',(SELECT count(*) FROM public.lot_watchlist WHERE user_id=auth.uid()),
      'draft_proposals',(SELECT count(*) FROM public.proposals WHERE status='rascunho' AND (reciclador_id=auth.uid() OR recycler_organization_id=_org)),
      'sent_proposals',(SELECT count(*) FROM public.proposals WHERE status IN ('enviada','em_analise') AND (reciclador_id=auth.uid() OR recycler_organization_id=_org)),
      'accepted_proposals',(SELECT count(*) FROM public.proposals WHERE status='aceita' AND (reciclador_id=auth.uid() OR recycler_organization_id=_org)),
      'active_operations',(SELECT count(*) FROM public.operations WHERE recycler_organization_id=_org AND status NOT IN ('concluida','cancelada')),
      'received_materials',(SELECT count(*) FROM public.operations WHERE recycler_organization_id=_org AND received_at IS NOT NULL),
      'pending_documents',(SELECT count(*) FROM public.documents d JOIN public.operations o ON o.id=d.operation_id WHERE o.recycler_organization_id=_org AND COALESCE(d.status,'pendente')<>'validado')
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_recycler_lot_details(_lot_id UUID)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE _lot public.lots%ROWTYPE; _org UUID; _authorized BOOLEAN;
BEGIN
  IF NOT public.has_role(auth.uid(),'reciclador') THEN RAISE EXCEPTION 'Acesso restrito'; END IF;
  _org:=public.current_recycler_organization();
  SELECT * INTO _lot FROM public.lots WHERE id=_lot_id AND status NOT IN ('rascunho','em_formacao','pronto_para_publicacao');
  IF NOT FOUND THEN RAISE EXCEPTION 'Lote indisponível'; END IF;
  SELECT EXISTS(SELECT 1 FROM public.proposals p WHERE p.lot_id=_lot_id AND p.status='aceita'
    AND (p.reciclador_id=auth.uid() OR p.recycler_organization_id=_org)) INTO _authorized;
  RETURN jsonb_build_object(
    'id',_lot.id,'code',_lot.codigo_lote,'title',_lot.titulo,'description',_lot.descricao,
    'chemistry',_lot.quimica_predominante,'classification',_lot.classificacao,
    'quantity',_lot.quantidade_baterias,'weight_kg',_lot.peso_total_kg,
    'capacity_kwh',_lot.capacidade_total_kwh,'average_soh',_lot.soh_medio,
    'city',_lot.cidade,'state',COALESCE(_lot.estado,_lot.uf),
    'proposal_deadline',_lot.data_encerramento_propostas,'authorized',_authorized,
    'batteries',CASE WHEN _authorized THEN COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'code',b.codigo_unico,'manufacturer',b.fabricante,'model',b.modelo,
        'serial',b.numero_serie,'chemistry',b.quimica,'quantity',b.quantidade,
        'weight_kg',b.peso_estimado_kg,'capacity_kwh',b.capacidade_kwh,
        'soh',b.soh_percentual,'classification',b.classificacao,
        'apparent_state',b.estado_aparente
      )) FROM public.lot_batteries lb JOIN public.batteries b ON b.id=lb.battery_id WHERE lb.lot_id=_lot_id
    ),'[]'::JSONB) ELSE '[]'::JSONB END
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.toggle_lot_watch(_lot_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _exists BOOLEAN;
BEGIN
  IF NOT public.has_role(auth.uid(),'reciclador') THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  SELECT EXISTS(SELECT 1 FROM public.lot_watchlist WHERE lot_id=_lot_id AND user_id=auth.uid()) INTO _exists;
  IF _exists THEN DELETE FROM public.lot_watchlist WHERE lot_id=_lot_id AND user_id=auth.uid(); RETURN FALSE;
  ELSE INSERT INTO public.lot_watchlist(lot_id,user_id,organization_id) VALUES(_lot_id,auth.uid(),public.current_recycler_organization()); RETURN TRUE;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_recycler_proposal(
  _lot_id UUID,_proposal_id UUID DEFAULT NULL,_amount NUMERIC DEFAULT NULL,
  _conditions TEXT DEFAULT NULL,_commercial_model TEXT DEFAULT NULL,
  _withdrawal_days INTEGER DEFAULT NULL,_valid_until TIMESTAMPTZ DEFAULT NULL,
  _destination TEXT DEFAULT NULL,_submit BOOLEAN DEFAULT FALSE
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _id UUID; _org UUID; _lot_status TEXT; _deadline TIMESTAMPTZ; _current TEXT;
BEGIN
  IF NOT public.has_role(auth.uid(),'reciclador') THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  _org:=public.current_recycler_organization();
  IF _org IS NULL OR NOT EXISTS(SELECT 1 FROM public.companies WHERE id=_org AND status='aprovada') THEN RAISE EXCEPTION 'Organização não habilitada'; END IF;
  SELECT status,data_encerramento_propostas INTO _lot_status,_deadline FROM public.lots WHERE id=_lot_id FOR UPDATE;
  IF _lot_status NOT IN ('publicado','recebendo_propostas') OR (_deadline IS NOT NULL AND _deadline<=now()) THEN RAISE EXCEPTION 'Prazo de propostas encerrado'; END IF;
  IF _amount IS NULL OR _amount<=0 THEN RAISE EXCEPTION 'Valor da proposta inválido'; END IF;
  PERFORM set_config('app.workflow_authorized','true',true);
  PERFORM set_config('app.workflow_reason',CASE WHEN _submit THEN 'Proposta enviada' ELSE 'Rascunho salvo' END,true);
  PERFORM set_config('app.workflow_org',_org::TEXT,true);
  IF _proposal_id IS NULL THEN
    IF EXISTS(SELECT 1 FROM public.proposals WHERE lot_id=_lot_id AND (reciclador_id=auth.uid() OR recycler_organization_id=_org) AND status IN ('rascunho','enviada','em_analise')) THEN RAISE EXCEPTION 'Já existe proposta ativa para este lote'; END IF;
    INSERT INTO public.proposals(lot_id,reciclador_id,recycler_organization_id,valor_total,valor_proposto,condicoes,modelo_comercial,prazo_retirada_dias,validade_proposta,destinacao_proposta,status,submitted_by,submitted_at)
    VALUES(_lot_id,auth.uid(),_org,_amount,_amount,_conditions,_commercial_model,_withdrawal_days,_valid_until,_destination,CASE WHEN _submit THEN 'enviada' ELSE 'rascunho' END,auth.uid(),CASE WHEN _submit THEN now() ELSE NULL END)
    RETURNING id INTO _id;
  ELSE
    SELECT status INTO _current FROM public.proposals WHERE id=_proposal_id AND lot_id=_lot_id
      AND (reciclador_id=auth.uid() OR recycler_organization_id=_org) FOR UPDATE;
    IF _current NOT IN ('rascunho','enviada') THEN RAISE EXCEPTION 'Proposta não pode mais ser editada'; END IF;
    UPDATE public.proposals SET valor_total=_amount,valor_proposto=_amount,condicoes=_conditions,
      modelo_comercial=_commercial_model,prazo_retirada_dias=_withdrawal_days,
      validade_proposta=_valid_until,destinacao_proposta=_destination,
      status=CASE WHEN _submit THEN 'enviada' ELSE _current END,
      submitted_at=CASE WHEN _submit THEN now() ELSE submitted_at END,updated_at=now()
    WHERE id=_proposal_id RETURNING id INTO _id;
  END IF;
  INSERT INTO public.status_history(entity_type,entity_id,status_novo,alterado_por,organization_id,justificativa)
  VALUES('proposals',_id,CASE WHEN _submit THEN 'enviada' ELSE 'rascunho' END,auth.uid(),_org,CASE WHEN _submit THEN 'Proposta enviada pela recicladora' ELSE 'Rascunho atualizado' END);
  IF _submit AND _lot_status='publicado' THEN PERFORM public.transition_lot_status(_lot_id,'recebendo_propostas','Primeira proposta recebida',_org); END IF;
  RETURN _id;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_recycler_proposal(_proposal_id UUID,_reason TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _p public.proposals%ROWTYPE; _org UUID;
BEGIN
  _org:=public.current_recycler_organization();
  SELECT * INTO _p FROM public.proposals WHERE id=_proposal_id AND (reciclador_id=auth.uid() OR recycler_organization_id=_org) FOR UPDATE;
  IF NOT FOUND OR _p.status NOT IN ('rascunho','enviada') THEN RAISE EXCEPTION 'Proposta não pode ser cancelada'; END IF;
  IF COALESCE(trim(_reason),'')='' THEN RAISE EXCEPTION 'Justificativa obrigatória'; END IF;
  PERFORM set_config('app.workflow_authorized','true',true); PERFORM set_config('app.workflow_reason',_reason,true); PERFORM set_config('app.workflow_org',_org::TEXT,true);
  UPDATE public.proposals SET status='cancelada',updated_at=now() WHERE id=_proposal_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_recycler_receipt(_operation_id UUID,_actual_weight_kg NUMERIC,_notes TEXT DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _op public.operations%ROWTYPE; _org UUID; _bid UUID;
BEGIN
  _org:=public.current_recycler_organization();
  SELECT * INTO _op FROM public.operations WHERE id=_operation_id AND recycler_organization_id=_org FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Operação não encontrada'; END IF;
  IF _actual_weight_kg IS NULL OR _actual_weight_kg<=0 THEN RAISE EXCEPTION 'Peso efetivamente recebido obrigatório'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.collections WHERE lot_id=_op.lot_id AND status='entregue_destinador') THEN RAISE EXCEPTION 'Entrega ainda não confirmada pela transportadora'; END IF;
  UPDATE public.operations SET status='recebida',actual_received_weight_kg=_actual_weight_kg,received_at=now(),destination_notes=concat_ws(E'\n',destination_notes,_notes),updated_at=now() WHERE id=_operation_id;
  IF (SELECT status FROM public.lots WHERE id=_op.lot_id)='em_transporte' THEN PERFORM public.transition_lot_status(_op.lot_id,'entregue',COALESCE(_notes,'Recebimento confirmado'),_org); END IF;
  FOR _bid IN SELECT battery_id FROM public.lot_batteries WHERE lot_id=_op.lot_id LOOP
    IF (SELECT status FROM public.batteries WHERE id=_bid)='enviada_ao_destinador' THEN PERFORM public.transition_battery_status(_bid,'recebida_pelo_destinador',COALESCE(_notes,'Recebimento confirmado'),_org); END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.register_recycler_divergence(_operation_id UUID,_type TEXT,_severity TEXT,_description TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _op public.operations%ROWTYPE; _org UUID; _id UUID;
BEGIN
  _org:=public.current_recycler_organization(); SELECT * INTO _op FROM public.operations WHERE id=_operation_id AND recycler_organization_id=_org;
  IF NOT FOUND THEN RAISE EXCEPTION 'Operação não encontrada'; END IF;
  IF COALESCE(trim(_description),'')='' THEN RAISE EXCEPTION 'Descrição obrigatória'; END IF;
  INSERT INTO public.incidents(operation_id,tipo,gravidade,descricao,status,registrado_por)
  VALUES(_operation_id,'divergencia_'||_type,_severity,_description,'aberto',auth.uid()) RETURNING id INTO _id;
  PERFORM public.notify_lot_participants(_op.lot_id,'Divergência no recebimento',_description); RETURN _id;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_recycler_destination(_operation_id UUID,_method TEXT,_notes TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _op public.operations%ROWTYPE; _org UUID; _bid UUID;
BEGIN
  _org:=public.current_recycler_organization(); SELECT * INTO _op FROM public.operations WHERE id=_operation_id AND recycler_organization_id=_org FOR UPDATE;
  IF NOT FOUND OR _op.received_at IS NULL THEN RAISE EXCEPTION 'Confirme o recebimento antes da destinação'; END IF;
  IF COALESCE(trim(_method),'')='' THEN RAISE EXCEPTION 'Forma de destinação obrigatória'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.documents WHERE operation_id=_operation_id) THEN RAISE EXCEPTION 'Anexe ao menos um comprovante'; END IF;
  UPDATE public.operations SET status='documentacao_pendente',destination_method=_method,destination_notes=concat_ws(E'\n',destination_notes,_notes),destination_completed_at=now(),updated_at=now() WHERE id=_operation_id;
  IF (SELECT status FROM public.lots WHERE id=_op.lot_id)='entregue' THEN PERFORM public.transition_lot_status(_op.lot_id,'documentacao_pendente','Destinação concluída; documentação em validação',_org); END IF;
  FOR _bid IN SELECT battery_id FROM public.lot_batteries WHERE lot_id=_op.lot_id LOOP
    IF (SELECT status FROM public.batteries WHERE id=_bid)='recebida_pelo_destinador' THEN PERFORM public.transition_battery_status(_bid,'documentacao_pendente','Destinação concluída; documentação em validação',_org); END IF;
  END LOOP;
  INSERT INTO public.status_history(entity_type,entity_id,status_anterior,status_novo,alterado_por,organization_id,justificativa)
  VALUES('operations',_operation_id,_op.status,'documentacao_pendente',auth.uid(),_org,'Destinação concluída: '||_method);
END;
$$;

-- ---------------------------------------------------------
-- Administração protegida e sempre auditável
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_record_action(_action TEXT,_entity_type TEXT,_entity_id UUID,_previous JSONB,_new JSONB,_reason TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Acesso restrito'; END IF;
  INSERT INTO public.audit_log(actor_id,action,entity_type,entity_id,payload)
  VALUES(auth.uid(),_action,_entity_type,_entity_id,jsonb_build_object('previous',_previous,'new',_new,'reason',_reason,'admin',auth.uid()));
  IF _entity_id IS NOT NULL THEN
    INSERT INTO public.status_history(entity_type,entity_id,status_anterior,status_novo,alterado_por,justificativa)
    VALUES(_entity_type,_entity_id,COALESCE(_previous->>'status',_previous->>'value'),COALESCE(_new->>'status',_new->>'value',_action),auth.uid(),_reason);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_admin_dashboard_summary()
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Acesso restrito'; END IF;
  RETURN jsonb_build_object(
    'pending_organizations',(SELECT count(*) FROM public.companies WHERE status IN ('cadastro_incompleto','aguardando_aprovacao','em_analise')),
    'users',(SELECT count(*) FROM public.profiles),'generators',(SELECT count(*) FROM public.companies WHERE tipo='gerador'),
    'operators',(SELECT count(*) FROM public.companies WHERE tipo='operador'),'carriers',(SELECT count(*) FROM public.companies WHERE tipo='transportadora'),
    'recyclers',(SELECT count(*) FROM public.companies WHERE tipo='reciclador'),'batteries',(SELECT count(*) FROM public.batteries),
    'collections',(SELECT count(*) FROM public.collections),'diagnostics',(SELECT count(*) FROM public.sorting_diagnostics),
    'lots',(SELECT count(*) FROM public.lots),'proposals',(SELECT count(*) FROM public.proposals),
    'operations',(SELECT count(*) FROM public.operations),'pending_documents',(SELECT count(*) FROM public.documents WHERE COALESCE(status,'pendente')<>'validado'),
    'open_incidents',(SELECT count(*) FROM public.incidents WHERE status NOT IN ('resolvido','encerrado')),
    'notifications',(SELECT count(*) FROM public.notifications),'audit_events',(SELECT count(*) FROM public.audit_log)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_entities(_entity TEXT,_limit INTEGER DEFAULT 200)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE _result JSONB;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Acesso restrito'; END IF;
  CASE _entity
    WHEN 'organizations' THEN SELECT COALESCE(jsonb_agg(to_jsonb(t)),'[]') INTO _result FROM (SELECT * FROM public.companies ORDER BY created_at DESC LIMIT _limit) t;
    WHEN 'users' THEN SELECT COALESCE(jsonb_agg(to_jsonb(t)),'[]') INTO _result FROM (SELECT p.*,COALESCE((SELECT jsonb_agg(role) FROM public.user_roles r WHERE r.user_id=p.id),'[]') roles FROM public.profiles p ORDER BY created_at DESC LIMIT _limit) t;
    WHEN 'generators' THEN SELECT COALESCE(jsonb_agg(to_jsonb(t)),'[]') INTO _result FROM (SELECT * FROM public.companies WHERE tipo='gerador' ORDER BY created_at DESC LIMIT _limit) t;
    WHEN 'operators' THEN SELECT COALESCE(jsonb_agg(to_jsonb(t)),'[]') INTO _result FROM (SELECT * FROM public.companies WHERE tipo='operador' ORDER BY created_at DESC LIMIT _limit) t;
    WHEN 'carriers' THEN SELECT COALESCE(jsonb_agg(to_jsonb(t)),'[]') INTO _result FROM (SELECT * FROM public.companies WHERE tipo='transportadora' ORDER BY created_at DESC LIMIT _limit) t;
    WHEN 'recyclers' THEN SELECT COALESCE(jsonb_agg(to_jsonb(t)),'[]') INTO _result FROM (SELECT * FROM public.companies WHERE tipo='reciclador' ORDER BY created_at DESC LIMIT _limit) t;
    WHEN 'batteries' THEN SELECT COALESCE(jsonb_agg(to_jsonb(t)),'[]') INTO _result FROM (SELECT * FROM public.batteries ORDER BY created_at DESC LIMIT _limit) t;
    WHEN 'collections' THEN SELECT COALESCE(jsonb_agg(to_jsonb(t)),'[]') INTO _result FROM (SELECT * FROM public.collections ORDER BY created_at DESC LIMIT _limit) t;
    WHEN 'diagnostics' THEN SELECT COALESCE(jsonb_agg(to_jsonb(t)),'[]') INTO _result FROM (SELECT * FROM public.sorting_diagnostics ORDER BY created_at DESC LIMIT _limit) t;
    WHEN 'lots' THEN SELECT COALESCE(jsonb_agg(to_jsonb(t)),'[]') INTO _result FROM (SELECT * FROM public.lots ORDER BY created_at DESC LIMIT _limit) t;
    WHEN 'proposals' THEN SELECT COALESCE(jsonb_agg(to_jsonb(t)),'[]') INTO _result FROM (SELECT * FROM public.proposals ORDER BY created_at DESC LIMIT _limit) t;
    WHEN 'operations' THEN SELECT COALESCE(jsonb_agg(to_jsonb(t)),'[]') INTO _result FROM (SELECT * FROM public.operations ORDER BY created_at DESC LIMIT _limit) t;
    WHEN 'documents' THEN SELECT COALESCE(jsonb_agg(to_jsonb(t)),'[]') INTO _result FROM (SELECT * FROM public.documents ORDER BY created_at DESC LIMIT _limit) t;
    WHEN 'organization_documents' THEN SELECT COALESCE(jsonb_agg(to_jsonb(t)),'[]') INTO _result FROM (SELECT * FROM public.organization_documents ORDER BY created_at DESC LIMIT _limit) t;
    WHEN 'incidents' THEN SELECT COALESCE(jsonb_agg(to_jsonb(t)),'[]') INTO _result FROM (SELECT * FROM public.incidents ORDER BY created_at DESC LIMIT _limit) t;
    WHEN 'notifications' THEN SELECT COALESCE(jsonb_agg(to_jsonb(t)),'[]') INTO _result FROM (SELECT * FROM public.notifications ORDER BY created_at DESC LIMIT _limit) t;
    WHEN 'audit' THEN SELECT COALESCE(jsonb_agg(to_jsonb(t)),'[]') INTO _result FROM (SELECT * FROM public.audit_log ORDER BY created_at DESC LIMIT _limit) t;
    WHEN 'parameters' THEN SELECT COALESCE(jsonb_agg(to_jsonb(t)),'[]') INTO _result FROM (SELECT * FROM public.system_parameters ORDER BY updated_at DESC LIMIT _limit) t;
    ELSE RAISE EXCEPTION 'Entidade inválida';
  END CASE;
  RETURN _result;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_organization_status(_organization_id UUID,_status TEXT,_reason TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _old JSONB; _new JSONB;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Acesso restrito'; END IF;
  IF _status NOT IN ('cadastro_incompleto','aguardando_aprovacao','em_analise','aprovada','suspensa','rejeitada') OR COALESCE(trim(_reason),'')='' THEN RAISE EXCEPTION 'Status ou justificativa inválida'; END IF;
  SELECT to_jsonb(c) INTO _old FROM public.companies c WHERE id=_organization_id FOR UPDATE;
  UPDATE public.companies SET status=_status::public.org_status,status_aprovacao=_status,
    aprovado_por=CASE WHEN _status='aprovada' THEN auth.uid() ELSE aprovado_por END,
    aprovado_em=CASE WHEN _status='aprovada' THEN now() ELSE aprovado_em END,updated_at=now()
  WHERE id=_organization_id RETURNING to_jsonb(companies.*) INTO _new;
  PERFORM public.admin_record_action('organization_status', 'organizations',_organization_id,_old,_new,_reason);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_user_status(_profile_id UUID,_active BOOLEAN,_reason TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _old JSONB; _new JSONB;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Acesso restrito'; END IF;
  IF COALESCE(trim(_reason),'')='' THEN RAISE EXCEPTION 'Justificativa obrigatória'; END IF;
  SELECT to_jsonb(p) INTO _old FROM public.profiles p WHERE id=_profile_id FOR UPDATE;
  UPDATE public.profiles SET status=CASE WHEN _active THEN 'approved' ELSE 'rejected' END,updated_at=now() WHERE id=_profile_id RETURNING to_jsonb(profiles.*) INTO _new;
  PERFORM public.admin_record_action(CASE WHEN _active THEN 'account_reactivated' ELSE 'account_suspended' END,'users',_profile_id,_old,_new,_reason);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_manage_role(_user_id UUID,_role public.app_role,_grant BOOLEAN,_reason TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _old JSONB; _new JSONB;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Acesso restrito'; END IF;
  IF COALESCE(trim(_reason),'')='' THEN RAISE EXCEPTION 'Justificativa obrigatória'; END IF;
  SELECT COALESCE(jsonb_agg(role),'[]') INTO _old FROM public.user_roles WHERE user_id=_user_id;
  IF _grant THEN INSERT INTO public.user_roles(user_id,role) VALUES(_user_id,_role) ON CONFLICT DO NOTHING;
  ELSE DELETE FROM public.user_roles WHERE user_id=_user_id AND role=_role; END IF;
  SELECT COALESCE(jsonb_agg(role),'[]') INTO _new FROM public.user_roles WHERE user_id=_user_id;
  PERFORM public.admin_record_action('permissions_changed','users',_user_id,jsonb_build_object('roles',_old),jsonb_build_object('roles',_new),_reason);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_validate_document(_document_id UUID,_organization_document BOOLEAN,_approve BOOLEAN,_reason TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _old JSONB; _new JSONB;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Acesso restrito'; END IF;
  IF COALESCE(trim(_reason),'')='' THEN RAISE EXCEPTION 'Justificativa obrigatória'; END IF;
  IF _organization_document THEN
    SELECT to_jsonb(d) INTO _old FROM public.organization_documents d WHERE id=_document_id FOR UPDATE;
    UPDATE public.organization_documents SET status_validacao=CASE WHEN _approve THEN 'validado' ELSE 'rejeitado' END,validado_por=auth.uid(),validado_em=now(),observacoes=concat_ws(E'\n',observacoes,_reason) WHERE id=_document_id RETURNING to_jsonb(organization_documents.*) INTO _new;
  ELSE
    SELECT to_jsonb(d) INTO _old FROM public.documents d WHERE id=_document_id FOR UPDATE;
    UPDATE public.documents SET status=CASE WHEN _approve THEN 'validado' ELSE 'rejeitado' END,validado_por=auth.uid(),validado_em=now(),observacoes=concat_ws(E'\n',observacoes,_reason),updated_at=now() WHERE id=_document_id RETURNING to_jsonb(documents.*) INTO _new;
  END IF;
  PERFORM public.admin_record_action('document_validation','documents',_document_id,_old,_new,_reason);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_correct_link(_entity TEXT,_entity_id UUID,_field TEXT,_organization_id UUID,_reason TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _table TEXT; _old JSONB; _new JSONB;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Acesso restrito'; END IF;
  IF COALESCE(trim(_reason),'')='' THEN RAISE EXCEPTION 'Justificativa obrigatória'; END IF;
  IF _entity='operations' AND _field IN ('generator_organization_id','operator_organization_id','carrier_organization_id','recycler_organization_id') THEN _table:='operations';
  ELSIF _entity='collections' AND _field IN ('generator_organization_id','operator_organization_id','carrier_organization_id','recycler_organization_id') THEN _table:='collections';
  ELSIF _entity='lots' AND _field='operator_organization_id' THEN _table:='lots';
  ELSIF _entity='batteries' AND _field IN ('company_id','generator_organization_id') THEN _table:='batteries';
  ELSE RAISE EXCEPTION 'Vínculo não permitido'; END IF;
  EXECUTE format('SELECT to_jsonb(t) FROM public.%I t WHERE id=$1 FOR UPDATE',_table) INTO _old USING _entity_id;
  EXECUTE format('UPDATE public.%I SET %I=$1,updated_at=now() WHERE id=$2 RETURNING to_jsonb(%I.*)',_table,_field,_table) INTO _new USING _organization_id,_entity_id;
  PERFORM public.admin_record_action('link_corrected',_entity,_entity_id,_old,_new,_reason);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_intervene_operation(_operation_id UUID,_new_status TEXT,_reason TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _old JSONB; _new JSONB;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Acesso restrito'; END IF;
  IF _new_status NOT IN ('criada','aguardando_transporte','em_transporte','aguardando_recebimento','recebida','documentacao_pendente','concluida','pausada','cancelada') OR COALESCE(trim(_reason),'')='' THEN RAISE EXCEPTION 'Status ou justificativa inválida'; END IF;
  SELECT to_jsonb(o) INTO _old FROM public.operations o WHERE id=_operation_id FOR UPDATE;
  UPDATE public.operations SET status=_new_status,updated_at=now() WHERE id=_operation_id RETURNING to_jsonb(operations.*) INTO _new;
  PERFORM public.admin_record_action(CASE WHEN _new_status='cancelada' THEN 'operation_cancelled' ELSE 'operation_intervention' END,'operations',_operation_id,_old,_new,_reason);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_parameter(_key TEXT,_value JSONB,_description TEXT,_reason TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _old JSONB; _new JSONB;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Acesso restrito'; END IF;
  IF COALESCE(trim(_key),'')='' OR COALESCE(trim(_reason),'')='' THEN RAISE EXCEPTION 'Chave e justificativa obrigatórias'; END IF;
  SELECT to_jsonb(p) INTO _old FROM public.system_parameters p WHERE key=_key;
  INSERT INTO public.system_parameters(key,value,description,updated_by,updated_at) VALUES(_key,_value,_description,auth.uid(),now())
  ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,description=EXCLUDED.description,updated_by=auth.uid(),updated_at=now()
  RETURNING to_jsonb(system_parameters.*) INTO _new;
  INSERT INTO public.audit_log(actor_id,action,entity_type,payload) VALUES(auth.uid(),'parameter_changed','system_parameters',jsonb_build_object('previous',_old,'new',_new,'reason',_reason));
END;
$$;

REVOKE ALL ON FUNCTION public.current_recycler_organization() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.admin_record_action(TEXT,TEXT,UUID,JSONB,JSONB,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_recycler_dashboard_data() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_recycler_lot_details(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.toggle_lot_watch(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_recycler_proposal(UUID,UUID,NUMERIC,TEXT,TEXT,INTEGER,TIMESTAMPTZ,TEXT,BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_recycler_proposal(UUID,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_recycler_receipt(UUID,NUMERIC,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_recycler_divergence(UUID,TEXT,TEXT,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_recycler_destination(UUID,TEXT,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_dashboard_summary() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_entities(TEXT,INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_organization_status(UUID,TEXT,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_user_status(UUID,BOOLEAN,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_manage_role(UUID,public.app_role,BOOLEAN,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_validate_document(UUID,BOOLEAN,BOOLEAN,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_correct_link(TEXT,UUID,TEXT,UUID,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_intervene_operation(UUID,TEXT,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_parameter(TEXT,JSONB,TEXT,TEXT) TO authenticated;
