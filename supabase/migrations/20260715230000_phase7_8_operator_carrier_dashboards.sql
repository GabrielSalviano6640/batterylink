-- =========================================================
-- FASES 7 E 8 — painéis do operador e da transportadora
-- =========================================================

ALTER TABLE public.collections
  ADD COLUMN IF NOT EXISTS arrival_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS collections_arrival_idx
  ON public.collections(arrival_at) WHERE arrival_at IS NOT NULL;

-- Ordens atribuídas ficam visíveis somente à transportadora escolhida.
DROP POLICY IF EXISTS "carrier reads open or assigned collections" ON public.collections;
CREATE POLICY "carrier reads open or assigned collections" ON public.collections
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(),'transportadora') AND (
      (status='ordem_criada' AND carrier_organization_id IS NULL)
      OR transportadora_id=auth.uid()
      OR (carrier_organization_id IS NOT NULL AND public.is_org_member(carrier_organization_id,auth.uid()))
    )
  );

DROP POLICY IF EXISTS "carrier updates assigned collection data" ON public.collections;
CREATE POLICY "carrier updates assigned collection data" ON public.collections
  FOR UPDATE TO authenticated USING (
    public.has_role(auth.uid(),'transportadora') AND (
      (status='ordem_criada' AND carrier_organization_id IS NULL)
      OR transportadora_id=auth.uid()
      OR (carrier_organization_id IS NOT NULL AND public.is_org_member(carrier_organization_id,auth.uid()))
    )
  );

-- Ocorrências deixam de ser públicas para qualquer usuário autenticado.
DROP POLICY IF EXISTS "incidents read authenticated" ON public.incidents;
DROP POLICY IF EXISTS "incidents insert self" ON public.incidents;
DROP POLICY IF EXISTS "incidents update admin" ON public.incidents;

CREATE POLICY "incidents involved read" ON public.incidents
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'operador')
    OR registrado_por=auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.collections c
      WHERE c.id=incidents.collection_id
        AND (c.transportadora_id=auth.uid()
          OR (c.carrier_organization_id IS NOT NULL AND public.is_org_member(c.carrier_organization_id,auth.uid())))
    )
  );

CREATE POLICY "incidents actor inserts" ON public.incidents
  FOR INSERT TO authenticated WITH CHECK (
    registrado_por=auth.uid()
    AND (public.has_role(auth.uid(),'admin')
      OR public.has_role(auth.uid(),'operador')
      OR public.has_role(auth.uid(),'transportadora'))
  );

CREATE POLICY "incidents actor updates" ON public.incidents
  FOR UPDATE TO authenticated USING (
    public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'operador')
    OR registrado_por=auth.uid()
  ) WITH CHECK (
    public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'operador')
    OR registrado_por=auth.uid()
  );

-- ---------------------------------------------------------
-- Resumos dos painéis
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_operator_dashboard_summary()
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(),'operador') OR public.has_role(auth.uid(),'admin')) THEN
    RAISE EXCEPTION 'Acesso restrito ao operador';
  END IF;
  RETURN jsonb_build_object(
    'received_requests', (SELECT count(*) FROM public.batteries WHERE status='aguardando_analise'),
    'priority_requests', (SELECT count(*) FROM public.batteries WHERE status NOT IN ('concluida','cancelada') AND (
      lower(urgencia) LIKE 'alta%' OR lower(urgencia) LIKE 'emerg%'
      OR possui_risco_termico OR possui_vazamento
    )),
    'awaiting_collection', (SELECT count(*) FROM public.batteries WHERE status IN ('aprovada_para_coleta','coleta_agendada')),
    'received_batteries', (SELECT count(*) FROM public.batteries WHERE status='recebida_na_triagem'),
    'diagnostic_queue', (SELECT count(*) FROM public.batteries WHERE status IN ('recebida_na_triagem','em_diagnostico')),
    'technical_quarantine', (SELECT count(*) FROM public.batteries WHERE status='em_quarentena'),
    'forming_lots', (SELECT count(*) FROM public.lots WHERE status IN ('rascunho','em_formacao','pronto_para_publicacao')),
    'published_lots', (SELECT count(*) FROM public.lots WHERE status IN ('publicado','recebendo_propostas','em_analise')),
    'received_proposals', (SELECT count(*) FROM public.proposals WHERE status IN ('enviada','em_analise')),
    'pending_documents', (SELECT count(*) FROM public.documents WHERE COALESCE(status,'pendente')='pendente'),
    'open_incidents', (SELECT count(*) FROM public.incidents WHERE status NOT IN ('resolvido','encerrado'))
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_carrier_dashboard_summary()
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _org UUID;
BEGIN
  IF NOT (public.has_role(auth.uid(),'transportadora') OR public.has_role(auth.uid(),'admin')) THEN
    RAISE EXCEPTION 'Acesso restrito à transportadora';
  END IF;
  SELECT c.id INTO _org
  FROM public.companies c
  WHERE (c.tipo='transportadora' OR c.tipo_organizacao='transportadora')
    AND (c.owner_id=auth.uid() OR public.is_org_member(c.id,auth.uid()))
  ORDER BY (c.owner_id=auth.uid()) DESC, c.created_at
  LIMIT 1;
  _org := COALESCE(_org,public.current_actor_organization(NULL));
  RETURN jsonb_build_object(
    'organization_id', _org,
    'available_orders', (SELECT count(*) FROM public.collections WHERE status='ordem_criada' AND carrier_organization_id IS NULL),
    'assigned_orders', (SELECT count(*) FROM public.collections WHERE status='ordem_criada' AND (
      transportadora_id=auth.uid() OR carrier_organization_id=_org
    )),
    'pending_collections', (SELECT count(*) FROM public.collections WHERE status IN ('ordem_criada','aceita') AND (
      transportadora_id=auth.uid() OR carrier_organization_id=_org OR carrier_organization_id IS NULL
    )),
    'accepted_collections', (SELECT count(*) FROM public.collections WHERE status='aceita' AND (
      transportadora_id=auth.uid() OR carrier_organization_id=_org
    )),
    'scheduled_collections', (SELECT count(*) FROM public.collections WHERE status='agendada' AND (
      transportadora_id=auth.uid() OR carrier_organization_id=_org
    )),
    'in_transit', (SELECT count(*) FROM public.collections WHERE status IN ('retirada','em_transporte') AND (
      transportadora_id=auth.uid() OR carrier_organization_id=_org
    )),
    'completed_deliveries', (SELECT count(*) FROM public.collections WHERE status IN ('entregue_triagem','entregue_destinador') AND (
      transportadora_id=auth.uid() OR carrier_organization_id=_org
    )),
    'pending_documents', (
      SELECT count(*) FROM (VALUES
        ('licenca_ambiental'),('documento_transporte'),('seguro_carga'),('certificado_veiculo')
      ) required(tipo)
      WHERE NOT EXISTS (
        SELECT 1 FROM public.organization_documents od
        WHERE od.organization_id=_org AND od.tipo_documento=required.tipo
          AND od.status_validacao='validado'
          AND (od.validade IS NULL OR od.validade>=CURRENT_DATE)
      )
    ),
    'open_incidents', (SELECT count(*) FROM public.incidents i
      LEFT JOIN public.collections c ON c.id=i.collection_id
      WHERE i.status NOT IN ('resolvido','encerrado') AND (
        i.registrado_por=auth.uid() OR c.transportadora_id=auth.uid() OR c.carrier_organization_id=_org
      )
    ),
    'document_alerts', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id',od.id,'type',required.tipo,'number',od.numero,
        'valid_until',od.validade,'status',COALESCE(od.status_validacao,'ausente'),
        'alert',CASE
          WHEN od.id IS NULL THEN 'ausente'
          WHEN od.validade<CURRENT_DATE THEN 'vencido'
          WHEN od.validade<=CURRENT_DATE+30 THEN 'vence_em_breve'
          WHEN od.status_validacao<>'validado' THEN 'pendente'
          ELSE 'regular' END
      ) ORDER BY required.tipo)
      FROM (VALUES
        ('licenca_ambiental'),('documento_transporte'),('seguro_carga'),('certificado_veiculo')
      ) required(tipo)
      LEFT JOIN LATERAL (
        SELECT d.* FROM public.organization_documents d
        WHERE d.organization_id=_org AND d.tipo_documento=required.tipo
        ORDER BY d.created_at DESC LIMIT 1
      ) od ON TRUE
      WHERE od.id IS NULL OR (
        od.status_validacao<>'validado' OR od.validade<CURRENT_DATE+31
      )
    ),'[]'::JSONB)
  );
END;
$$;

-- Lista sanitizada de transportadoras aprovadas para atribuição.
CREATE OR REPLACE FUNCTION public.list_eligible_carriers()
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(),'operador') OR public.has_role(auth.uid(),'admin')) THEN
    RAISE EXCEPTION 'Acesso restrito ao operador';
  END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id',c.id,'name',COALESCE(c.nome_fantasia,c.razao_social),
      'city',c.cidade,'state',c.estado,
      'documents_ok',NOT EXISTS (
        SELECT 1 FROM public.organization_documents od
        WHERE od.organization_id=c.id AND (
          od.status_validacao<>'validado' OR od.validade IS NULL OR od.validade<CURRENT_DATE
        )
      )
    ) ORDER BY COALESCE(c.nome_fantasia,c.razao_social))
    FROM public.companies c
    WHERE (c.tipo='transportadora' OR c.tipo_organizacao='transportadora')
      AND (c.status='aprovada' OR c.status_aprovacao='aprovada')
  ),'[]'::JSONB);
END;
$$;

-- ---------------------------------------------------------
-- Ações do operador
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.flag_battery_risk(
  _battery_id UUID, _risk_type TEXT, _notes TEXT, _quarantine BOOLEAN DEFAULT TRUE
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _status TEXT;
BEGIN
  IF NOT (public.has_role(auth.uid(),'operador') OR public.has_role(auth.uid(),'admin')) THEN
    RAISE EXCEPTION 'Acesso restrito ao operador';
  END IF;
  SELECT status INTO _status FROM public.batteries WHERE id=_battery_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Bateria não encontrada'; END IF;
  UPDATE public.batteries SET
    possui_vazamento=COALESCE(possui_vazamento,FALSE) OR _risk_type='vazamento',
    possui_avaria=COALESCE(possui_avaria,FALSE) OR _risk_type='avaria',
    possui_risco_termico=COALESCE(possui_risco_termico,FALSE) OR _risk_type='termico',
    observacoes=concat_ws(E'\n',observacoes,'RISCO: '||_risk_type||' — '||_notes)
  WHERE id=_battery_id;
  INSERT INTO public.incidents(battery_id,tipo,gravidade,descricao,status,registrado_por)
  VALUES (_battery_id,'risco_'||_risk_type,'alta',_notes,'aberto',auth.uid());
  IF _quarantine AND _status<>'em_quarentena' THEN
    PERFORM public.transition_battery_status(_battery_id,'em_quarentena',_notes,NULL);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.forward_proposal_for_approval(
  _proposal_id UUID, _notes TEXT DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _p public.proposals%ROWTYPE; _lot_status TEXT;
BEGIN
  IF NOT (public.has_role(auth.uid(),'operador') OR public.has_role(auth.uid(),'admin')) THEN
    RAISE EXCEPTION 'Acesso restrito ao operador';
  END IF;
  SELECT * INTO _p FROM public.proposals WHERE id=_proposal_id FOR UPDATE;
  IF _p.status<>'enviada' THEN RAISE EXCEPTION 'Proposta não está disponível para análise'; END IF;
  SELECT status INTO _lot_status FROM public.lots WHERE id=_p.lot_id FOR UPDATE;
  PERFORM set_config('app.workflow_authorized','true',true);
  PERFORM set_config('app.workflow_reason',COALESCE(_notes,'Proposta encaminhada para aprovação'),true);
  PERFORM set_config('app.workflow_org',COALESCE(public.current_actor_organization(NULL)::TEXT,''),true);
  UPDATE public.proposals SET status='em_analise',updated_at=now() WHERE id=_proposal_id;
  IF _lot_status='recebendo_propostas' THEN
    PERFORM public.transition_lot_status(_p.lot_id,'em_analise',COALESCE(_notes,'Propostas em análise'),NULL);
  END IF;
  PERFORM public.notify_lot_participants(_p.lot_id,'Proposta em análise','A proposta foi encaminhada para aprovação interna.');
END;
$$;

-- Aceite passa a exigir proposta previamente analisada.
CREATE OR REPLACE FUNCTION public.accept_lot_proposal(
  _proposal_id UUID, _organization_id UUID DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _p public.proposals%ROWTYPE; _lot public.lots%ROWTYPE; _operation UUID; _bid UUID; _org UUID;
BEGIN
  IF NOT (public.has_role(auth.uid(),'operador') OR public.has_role(auth.uid(),'admin')) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  SELECT * INTO _p FROM public.proposals WHERE id=_proposal_id FOR UPDATE;
  SELECT * INTO _lot FROM public.lots WHERE id=_p.lot_id FOR UPDATE;
  IF _p.status<>'em_analise' OR _lot.status<>'em_analise' THEN
    RAISE EXCEPTION 'A proposta precisa ser analisada antes da aprovação';
  END IF;
  _org := public.current_actor_organization(_organization_id);
  PERFORM set_config('app.workflow_authorized','true',true);
  PERFORM set_config('app.workflow_reason','Proposta aprovada',true);
  PERFORM set_config('app.workflow_org',COALESCE(_org::TEXT,''),true);
  UPDATE public.proposals SET status='aceita' WHERE id=_p.id;
  UPDATE public.proposals SET status='recusada' WHERE lot_id=_p.lot_id AND id<>_p.id AND status IN ('enviada','em_analise');
  PERFORM public.transition_lot_status(_lot.id,'proposta_aceita','Proposta aprovada',_org);
  INSERT INTO public.operations(
    lot_id,proposal_id,operator_organization_id,recycler_organization_id,
    modelo_comercial,valor_operacao,status
  ) VALUES (
    _lot.id,_p.id,COALESCE(_lot.operator_organization_id,_org),_p.recycler_organization_id,
    _p.modelo_comercial,COALESCE(_p.valor_proposto,_p.valor_total),'criada'
  ) RETURNING id INTO _operation;
  INSERT INTO public.status_history(entity_type,entity_id,status_novo,alterado_por,organization_id,justificativa)
  VALUES ('operations',_operation,'criada',auth.uid(),_org,'Operação criada pela proposta aprovada');
  PERFORM public.transition_lot_status(_lot.id,'contratado','Operação comercial criada',_org);
  FOR _bid IN SELECT battery_id FROM public.lot_batteries WHERE lot_id=_lot.id LOOP
    PERFORM public.transition_battery_status(_bid,'destinacao_definida','Destinação definida pela proposta aprovada',_org);
  END LOOP;
  INSERT INTO public.collections(
    lot_id,operator_organization_id,recycler_organization_id,
    origem_endereco,destino_endereco,status,codigo_coleta
  ) VALUES (
    _lot.id,COALESCE(_lot.operator_organization_id,_org),_p.recycler_organization_id,
    concat_ws('/',_lot.cidade,_lot.uf),'Endereço da recicladora a confirmar','ordem_criada',
    'COL-'||to_char(now(),'YYYY')||'-'||upper(substr(replace(gen_random_uuid()::TEXT,'-',''),1,8))
  );
  RETURN _operation;
END;
$$;

CREATE OR REPLACE FUNCTION public.register_technical_report(
  _battery_id UUID, _storage_path TEXT, _number TEXT DEFAULT NULL, _notes TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id UUID;
BEGIN
  IF NOT (public.has_role(auth.uid(),'operador') OR public.has_role(auth.uid(),'admin')) THEN
    RAISE EXCEPTION 'Acesso restrito ao operador';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.batteries WHERE id=_battery_id) THEN RAISE EXCEPTION 'Bateria não encontrada'; END IF;
  INSERT INTO public.documents(
    battery_id,entity_type,entity_id,kind,tipo_documento,numero_documento,
    url,storage_path,uploaded_by,status,observacoes
  ) VALUES (
    _battery_id,'battery',_battery_id,'laudo_triagem','laudo_triagem',_number,
    _storage_path,_storage_path,auth.uid(),'validado',_notes
  ) RETURNING id INTO _id;
  INSERT INTO public.battery_events(battery_id,actor_id,event_type,notes)
  VALUES (_battery_id,auth.uid(),'laudo_triagem','Laudo técnico anexado ao processo.');
  RETURN _id;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_technical_stage(
  _battery_id UUID, _notes TEXT DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(),'operador') OR public.has_role(auth.uid(),'admin')) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.batteries WHERE id=_battery_id AND status IN ('classificada','em_quarentena')) THEN
    RAISE EXCEPTION 'Diagnóstico técnico ainda não foi concluído';
  END IF;
  UPDATE public.sorting_diagnostics SET status_validacao='validado',updated_at=now()
  WHERE battery_id=_battery_id;
  INSERT INTO public.battery_events(battery_id,actor_id,event_type,notes)
  VALUES (_battery_id,auth.uid(),'etapa_tecnica_concluida',COALESCE(_notes,'Etapa técnica concluída.'));
  PERFORM public.notify_battery_participants(_battery_id,'Etapa técnica concluída',COALESCE(_notes,'O diagnóstico técnico foi concluído.'));
END;
$$;

-- Quarentena técnica passa a refletir o status final do diagnóstico.
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
  IF _classification NOT IN ('segunda_vida','reutilizacao_componentes','reciclagem_mecanica','reciclagem_quimica','quarentena_tecnica','descarte_controlado') THEN
    RAISE EXCEPTION 'Classificação inválida';
  END IF;
  IF NOT (public.has_role(auth.uid(),'operador') OR public.has_role(auth.uid(),'admin')) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  _org := public.current_actor_organization(_organization_id);
  INSERT INTO public.sorting_diagnostics(
    battery_id,operator_organization_id,responsavel_tecnico,tensao_medida,
    capacidade_medida_kwh,soh_percentual,temperatura,integridade_estrutural,
    risco_identificado,classificacao,recomendacao_destino,observacoes,status_validacao
  ) VALUES (
    _battery_id,_org,auth.uid()::TEXT,_voltage,_capacity,_soh,_temperature,
    _integrity,_risk,_classification,_recommendation,_notes,'validado'
  ) RETURNING id INTO _id;
  UPDATE public.batteries SET classificacao=_classification,soh_percentual=_soh,
    diagnostico=jsonb_build_object('soh',_soh,'tensao',_voltage,'capacidade',_capacity,'temperatura',_temperature,'integridade',_integrity,'risco',_risk,'notas',_notes)
  WHERE id=_battery_id;
  IF _classification='quarentena_tecnica' THEN
    PERFORM public.transition_battery_status(_battery_id,'em_quarentena','Diagnóstico determinou quarentena técnica',_org);
  ELSE
    PERFORM public.transition_battery_status(_battery_id,'classificada','Diagnóstico concluído: '||_classification,_org);
  END IF;
  RETURN _id;
END;
$$;

CREATE OR REPLACE FUNCTION public.register_operational_incident(
  _type TEXT, _severity TEXT, _description TEXT,
  _battery_id UUID DEFAULT NULL, _collection_id UUID DEFAULT NULL, _operation_id UUID DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id UUID; _battery UUID;
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'operador') OR public.has_role(auth.uid(),'transportadora')) THEN
    RAISE EXCEPTION 'Perfil sem permissão para registrar ocorrência';
  END IF;
  IF COALESCE(trim(_description),'')='' THEN RAISE EXCEPTION 'Descrição obrigatória'; END IF;
  IF public.has_role(auth.uid(),'transportadora') AND NOT public.has_role(auth.uid(),'admin') THEN
    IF _collection_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.collections c WHERE c.id=_collection_id AND (
        c.transportadora_id=auth.uid()
        OR (c.carrier_organization_id IS NOT NULL AND public.is_org_member(c.carrier_organization_id,auth.uid()))
      )
    ) THEN RAISE EXCEPTION 'Ocorrência deve estar vinculada a uma coleta da transportadora'; END IF;
  END IF;
  SELECT battery_id INTO _battery FROM public.collections WHERE id=_collection_id;
  INSERT INTO public.incidents(
    battery_id,collection_id,operation_id,tipo,gravidade,descricao,status,registrado_por
  ) VALUES (
    COALESCE(_battery_id,_battery),_collection_id,_operation_id,_type,_severity,_description,'aberto',auth.uid()
  ) RETURNING id INTO _id;
  IF COALESCE(_battery_id,_battery) IS NOT NULL THEN
    PERFORM public.notify_battery_participants(COALESCE(_battery_id,_battery),'Ocorrência operacional registrada',_description);
  END IF;
  RETURN _id;
END;
$$;

-- ---------------------------------------------------------
-- Ações da transportadora
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.respond_collection_order(
  _collection_id UUID, _accept BOOLEAN, _reason TEXT DEFAULT NULL, _carrier_organization_id UUID DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _c public.collections%ROWTYPE; _org UUID;
BEGIN
  IF NOT (public.has_role(auth.uid(),'transportadora') OR public.has_role(auth.uid(),'admin')) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  SELECT * INTO _c FROM public.collections WHERE id=_collection_id FOR UPDATE;
  IF _c.status<>'ordem_criada' THEN RAISE EXCEPTION 'Ordem não está disponível'; END IF;
  _org := public.current_actor_organization(_carrier_organization_id);
  IF _c.carrier_organization_id IS NOT NULL AND NOT (
    public.has_role(auth.uid(),'admin') OR public.is_org_member(_c.carrier_organization_id,auth.uid())
  ) THEN RAISE EXCEPTION 'Ordem atribuída a outra transportadora'; END IF;
  IF NOT _accept AND COALESCE(trim(_reason),'')='' THEN RAISE EXCEPTION 'Informe o motivo da recusa'; END IF;
  PERFORM set_config('app.workflow_authorized','true',true);
  PERFORM set_config('app.workflow_reason',COALESCE(_reason,CASE WHEN _accept THEN 'Ordem aceita' ELSE 'Ordem recusada' END),true);
  PERFORM set_config('app.workflow_org',COALESCE(_org::TEXT,''),true);
  UPDATE public.collections SET
    status=CASE WHEN _accept THEN 'aceita' ELSE 'recusada' END,
    transportadora_id=CASE WHEN _accept THEN auth.uid() ELSE transportadora_id END,
    carrier_organization_id=CASE WHEN _accept THEN COALESCE(_c.carrier_organization_id,_org) ELSE _c.carrier_organization_id END,
    observacoes=concat_ws(E'\n',observacoes,_reason)
  WHERE id=_collection_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_collection_arrival(
  _collection_id UUID, _notes TEXT DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _c public.collections%ROWTYPE; _org UUID;
BEGIN
  SELECT * INTO _c FROM public.collections WHERE id=_collection_id FOR UPDATE;
  IF _c.status<>'agendada' THEN RAISE EXCEPTION 'Coleta não está agendada'; END IF;
  IF NOT (public.has_role(auth.uid(),'admin') OR _c.transportadora_id=auth.uid()
    OR (_c.carrier_organization_id IS NOT NULL AND public.is_org_member(_c.carrier_organization_id,auth.uid()))) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;
  _org := public.current_actor_organization(_c.carrier_organization_id);
  UPDATE public.collections SET arrival_at=now(),observacoes=concat_ws(E'\n',observacoes,_notes),updated_at=now()
  WHERE id=_collection_id;
  INSERT INTO public.status_history(entity_type,entity_id,status_anterior,status_novo,alterado_por,organization_id,justificativa)
  VALUES ('collections',_collection_id,'agendada','agendada',auth.uid(),_org,COALESCE(_notes,'Chegada confirmada na origem'));
  IF _c.battery_id IS NOT NULL THEN
    INSERT INTO public.battery_events(battery_id,actor_id,event_type,notes)
    VALUES (_c.battery_id,auth.uid(),'transportadora_na_origem',COALESCE(_notes,'Transportadora chegou ao local de coleta.'));
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
    OR (_c.carrier_organization_id IS NOT NULL AND public.is_org_member(_c.carrier_organization_id,auth.uid()))) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  IF _action='confirmar_retirada' AND _c.status='agendada' THEN
    IF _c.arrival_at IS NULL THEN RAISE EXCEPTION 'Confirme a chegada antes da retirada'; END IF;
    _new := 'retirada';
  ELSIF _action='iniciar_transporte' AND _c.status='retirada' THEN _new := 'em_transporte';
  ELSIF _action='confirmar_entrega' AND _c.status='em_transporte' THEN
    _new := CASE WHEN _c.battery_id IS NOT NULL THEN 'entregue_triagem' ELSE 'entregue_destinador' END;
  ELSE RAISE EXCEPTION 'Ação inválida para o status atual'; END IF;
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

CREATE OR REPLACE FUNCTION public.register_collection_document(
  _collection_id UUID, _document_type TEXT, _storage_path TEXT,
  _document_number TEXT DEFAULT NULL, _notes TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _c public.collections%ROWTYPE; _id UUID; _operation UUID;
BEGIN
  SELECT * INTO _c FROM public.collections WHERE id=_collection_id;
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'operador')
    OR _c.transportadora_id=auth.uid()
    OR (_c.carrier_organization_id IS NOT NULL AND public.is_org_member(_c.carrier_organization_id,auth.uid()))) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;
  SELECT id INTO _operation FROM public.operations WHERE lot_id=_c.lot_id ORDER BY created_at DESC LIMIT 1;
  INSERT INTO public.documents(
    operation_id,battery_id,lot_id,entity_type,entity_id,kind,tipo_documento,
    numero_documento,url,storage_path,uploaded_by,status,observacoes
  ) VALUES (
    _operation,_c.battery_id,_c.lot_id,'collection',_collection_id,_document_type,_document_type,
    _document_number,_storage_path,_storage_path,auth.uid(),'pendente',_notes
  ) RETURNING id INTO _id;
  INSERT INTO public.status_history(entity_type,entity_id,status_anterior,status_novo,alterado_por,organization_id,justificativa)
  VALUES ('collection_documents',_id,NULL,'pendente',auth.uid(),public.current_actor_organization(_c.carrier_organization_id),'Documento anexado à coleta');
  RETURN _id;
END;
$$;

CREATE OR REPLACE FUNCTION public.register_carrier_organization_document(
  _document_type TEXT, _storage_path TEXT, _document_number TEXT DEFAULT NULL,
  _valid_until DATE DEFAULT NULL, _notes TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _org UUID; _id UUID;
BEGIN
  IF NOT (public.has_role(auth.uid(),'transportadora') OR public.has_role(auth.uid(),'admin')) THEN
    RAISE EXCEPTION 'Acesso restrito à transportadora';
  END IF;
  SELECT c.id INTO _org FROM public.companies c
  WHERE (c.tipo='transportadora' OR c.tipo_organizacao='transportadora')
    AND (c.owner_id=auth.uid() OR public.is_org_member(c.id,auth.uid()))
  ORDER BY (c.owner_id=auth.uid()) DESC, c.created_at LIMIT 1;
  IF _org IS NULL THEN RAISE EXCEPTION 'Organização transportadora não encontrada'; END IF;
  IF _document_type NOT IN ('licenca_ambiental','documento_transporte','seguro_carga','certificado_veiculo') THEN
    RAISE EXCEPTION 'Tipo de documento inválido';
  END IF;
  INSERT INTO public.organization_documents(
    organization_id,tipo_documento,numero,arquivo_url,validade,status_validacao,observacoes
  ) VALUES (_org,_document_type,_document_number,_storage_path,_valid_until,'pendente',_notes)
  RETURNING id INTO _id;
  RETURN _id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_operator_dashboard_summary() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.get_carrier_dashboard_summary() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.list_eligible_carriers() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_operator_dashboard_summary() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_carrier_dashboard_summary() TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_eligible_carriers() TO authenticated;
GRANT EXECUTE ON FUNCTION public.flag_battery_risk(UUID,TEXT,TEXT,BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.forward_proposal_for_approval(UUID,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_technical_report(UUID,TEXT,TEXT,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_technical_stage(UUID,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_operational_incident(TEXT,TEXT,TEXT,UUID,UUID,UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_collection_arrival(UUID,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_collection_document(UUID,TEXT,TEXT,TEXT,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_carrier_organization_document(TEXT,TEXT,TEXT,DATE,TEXT) TO authenticated;
