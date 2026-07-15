-- =========================================================
-- FASES 17–21 — segurança, qualidade, testes e dados demo
-- =========================================================

-- Este arquivo é aplicado em produção. O seed demonstrativo fica separado em
-- supabase/seed.demo.sql e nunca é executado por esta migração.

-- -------------------------------------------------------------------------
-- Identidade, suspensão, fuso horário e separação de dados demonstrativos
-- -------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suspension_reason TEXT,
  ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.batteries
  ADD COLUMN IF NOT EXISTS operator_organization_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE;

DO $$
DECLARE _table TEXT;
BEGIN
  FOREACH _table IN ARRAY ARRAY[
    'registration_requests','org_members','organization_documents','battery_files',
    'battery_events','collections','sorting_diagnostics','lots','lot_batteries',
    'lot_watchlist','proposals','operations','documents','private_documents',
    'status_history','audit_log','notifications','incidents','environmental_factors'
  ] LOOP
    IF to_regclass('public.' || _table) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE', _table);
    END IF;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.is_user_active(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT _user_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id=_user_id AND p.status='approved' AND p.suspended_at IS NULL
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.status='suspensa'
        AND (c.owner_id=_user_id OR EXISTS (
          SELECT 1 FROM public.org_members om
          WHERE om.org_id=c.id AND om.user_id=_user_id AND om.ativo
        ))
    );
$$;

CREATE OR REPLACE FUNCTION public.current_user_is_demo(_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT COALESCE((SELECT p.is_demo FROM public.profiles p WHERE p.id=_user_id),FALSE);
$$;

-- Papéis deixam de autorizar imediatamente quando a conta é suspensa.
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID,_role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT public.is_user_active(_user_id) AND EXISTS(
    SELECT 1 FROM public.user_roles ur WHERE ur.user_id=_user_id AND ur.role=_role
  );
$$;

CREATE OR REPLACE FUNCTION public.is_org_member(_org_id UUID,_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT public.is_user_active(_user_id) AND EXISTS(
    SELECT 1 FROM public.companies c
    WHERE c.id=_org_id AND c.status='aprovada'
      AND (c.owner_id=_user_id OR EXISTS(
        SELECT 1 FROM public.org_members om
        WHERE om.org_id=_org_id AND om.user_id=_user_id AND om.ativo
      ))
  );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_org(_org_id UUID,_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT public.has_role(_user_id,'admin') OR EXISTS(
    SELECT 1 FROM public.companies c
    WHERE c.id=_org_id AND c.status<>'suspensa' AND (
      c.owner_id=_user_id OR EXISTS(
        SELECT 1 FROM public.org_members om
        WHERE om.org_id=_org_id AND om.user_id=_user_id AND om.ativo
          AND om.role::TEXT IN ('proprietario','gestor')
      )
    )
  );
$$;

REVOKE ALL ON FUNCTION public.is_user_active(UUID) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.current_user_is_demo(UUID) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.has_role(UUID,public.app_role) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.is_org_member(UUID,UUID) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.can_manage_org(UUID,UUID) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.is_user_active(UUID), public.current_user_is_demo(UUID),
  public.has_role(UUID,public.app_role), public.is_org_member(UUID,UUID),
  public.can_manage_org(UUID,UUID) TO authenticated;

-- -------------------------------------------------------------------------
-- Validações brasileiras no banco
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.only_digits(_value TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT regexp_replace(COALESCE(_value,''),'[^0-9]','','g');
$$;

CREATE UNIQUE INDEX IF NOT EXISTS companies_document_unique_idx
  ON public.companies(public.only_digits(COALESCE(cnpj_cpf,cnpj)))
  WHERE public.only_digits(COALESCE(cnpj_cpf,cnpj))<>'';

DO $$ BEGIN
  ALTER TABLE public.companies ADD CONSTRAINT companies_uf_check
    CHECK (estado IS NULL OR upper(estado) IN ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.batteries ADD CONSTRAINT batteries_uf_check
    CHECK (COALESCE(estado_origem,uf) IS NULL OR upper(COALESCE(estado_origem,uf)) IN ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- -------------------------------------------------------------------------
-- Políticas transversais: conta ativa e contexto demo compatível
-- -------------------------------------------------------------------------
DO $$
DECLARE _table TEXT; _policy TEXT;
BEGIN
  FOREACH _table IN ARRAY ARRAY[
    'batteries','battery_events','battery_files','collections','sorting_diagnostics',
    'lots','lot_batteries','lot_watchlist','proposals','operations','documents',
    'private_documents','status_history','notifications','incidents',
    'organization_documents','environmental_factors'
  ] LOOP
    IF to_regclass('public.' || _table) IS NOT NULL THEN
      _policy := 'active and matching demo context ' || _table;
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I',_policy,_table);
      EXECUTE format(
        'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (public.is_user_active(auth.uid()) AND is_demo=public.current_user_is_demo(auth.uid())) WITH CHECK (public.is_user_active(auth.uid()) AND is_demo=public.current_user_is_demo(auth.uid()))',
        _policy,_table
      );
    END IF;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.tg_set_demo_context()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN NEW.is_demo:=public.current_user_is_demo(auth.uid()); END IF;
  RETURN NEW;
END; $$;
DO $$
DECLARE _table TEXT;
BEGIN
  FOREACH _table IN ARRAY ARRAY[
    'companies','user_roles','registration_requests','org_members','organization_documents','batteries',
    'battery_files','battery_events','collections','sorting_diagnostics','lots','lot_batteries',
    'lot_watchlist','proposals','operations','documents','private_documents','status_history',
    'audit_log','notifications','incidents','environmental_factors'
  ] LOOP
    IF to_regclass('public.'||_table) IS NOT NULL THEN
      EXECUTE format('DROP TRIGGER IF EXISTS set_demo_context ON public.%I',_table);
      EXECUTE format('CREATE TRIGGER set_demo_context BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.tg_set_demo_context()',_table);
    END IF;
  END LOOP;
END $$;

-- -------------------------------------------------------------------------
-- Escopo por participante. Não há autorização baseada só em botão oculto.
-- -------------------------------------------------------------------------
DROP POLICY IF EXISTS "battery operator reads" ON public.batteries;
DROP POLICY IF EXISTS "battery operator updates" ON public.batteries;
CREATE POLICY "battery operator reads assigned" ON public.batteries FOR SELECT TO authenticated USING(
  public.has_role(auth.uid(),'admin') OR (
    public.has_role(auth.uid(),'operador')
    AND operator_organization_id IS NOT NULL
    AND public.is_org_member(operator_organization_id,auth.uid())
  )
);
CREATE POLICY "battery operator updates assigned" ON public.batteries FOR UPDATE TO authenticated USING(
  public.has_role(auth.uid(),'admin') OR (
    public.has_role(auth.uid(),'operador')
    AND operator_organization_id IS NOT NULL
    AND public.is_org_member(operator_organization_id,auth.uid())
  )
) WITH CHECK(
  public.has_role(auth.uid(),'admin') OR (
    public.has_role(auth.uid(),'operador')
    AND operator_organization_id IS NOT NULL
    AND public.is_org_member(operator_organization_id,auth.uid())
  )
);

DROP POLICY IF EXISTS "carrier reads open or assigned collections" ON public.collections;
DROP POLICY IF EXISTS "carrier updates assigned collection data" ON public.collections;
CREATE POLICY "carrier reads assigned collections" ON public.collections FOR SELECT TO authenticated USING(
  public.has_role(auth.uid(),'transportadora') AND (
    transportadora_id=auth.uid() OR
    (carrier_organization_id IS NOT NULL AND public.is_org_member(carrier_organization_id,auth.uid()))
  )
);
CREATE POLICY "carrier updates assigned collections" ON public.collections FOR UPDATE TO authenticated USING(
  public.has_role(auth.uid(),'transportadora') AND (
    transportadora_id=auth.uid() OR
    (carrier_organization_id IS NOT NULL AND public.is_org_member(carrier_organization_id,auth.uid()))
  )
) WITH CHECK(
  transportadora_id=auth.uid() OR
  (carrier_organization_id IS NOT NULL AND public.is_org_member(carrier_organization_id,auth.uid()))
);

DROP POLICY IF EXISTS "collection operator manages" ON public.collections;
CREATE POLICY "collection assigned operator manages" ON public.collections FOR ALL TO authenticated USING(
  public.has_role(auth.uid(),'admin') OR (
    operator_organization_id IS NOT NULL AND public.is_org_member(operator_organization_id,auth.uid())
  )
) WITH CHECK(
  public.has_role(auth.uid(),'admin') OR (
    operator_organization_id IS NOT NULL AND public.is_org_member(operator_organization_id,auth.uid())
  )
);

DROP POLICY IF EXISTS "lot operator manages" ON public.lots;
CREATE POLICY "lot assigned operator manages" ON public.lots FOR ALL TO authenticated USING(
  public.has_role(auth.uid(),'admin') OR (
    operator_organization_id IS NOT NULL AND public.is_org_member(operator_organization_id,auth.uid())
  )
) WITH CHECK(
  public.has_role(auth.uid(),'admin') OR (
    operator_organization_id IS NOT NULL AND public.is_org_member(operator_organization_id,auth.uid())
  )
);

DROP POLICY IF EXISTS "lot batteries operator manages" ON public.lot_batteries;
DROP POLICY IF EXISTS "lot batteries parties read" ON public.lot_batteries;
CREATE POLICY "lot batteries assigned operator manages" ON public.lot_batteries FOR ALL TO authenticated USING(
  public.has_role(auth.uid(),'admin') OR EXISTS(
    SELECT 1 FROM public.lots l WHERE l.id=lot_batteries.lot_id
      AND public.is_org_member(l.operator_organization_id,auth.uid())
  )
) WITH CHECK(
  public.has_role(auth.uid(),'admin') OR EXISTS(
    SELECT 1 FROM public.lots l WHERE l.id=lot_batteries.lot_id
      AND public.is_org_member(l.operator_organization_id,auth.uid())
  )
);
CREATE POLICY "lot batteries authorized parties read" ON public.lot_batteries FOR SELECT TO authenticated USING(
  public.has_role(auth.uid(),'admin') OR EXISTS(
    SELECT 1 FROM public.lots l WHERE l.id=lot_batteries.lot_id AND (
      public.is_org_member(l.operator_organization_id,auth.uid()) OR
      (l.status IN ('publicado','recebendo_propostas','em_analise','proposta_aceita','contratado','em_transporte','entregue','documentacao_pendente','concluido')
       AND public.has_role(auth.uid(),'reciclador')) OR
      EXISTS(SELECT 1 FROM public.collections c WHERE c.lot_id=l.id AND (
        c.transportadora_id=auth.uid() OR public.is_org_member(c.carrier_organization_id,auth.uid())
      ))
    )
  )
);

DROP POLICY IF EXISTS "approved recycler reads marketplace" ON public.lots;
CREATE POLICY "approved recycler reads marketplace" ON public.lots FOR SELECT TO authenticated USING(
  public.has_role(auth.uid(),'reciclador')
  AND status IN ('publicado','recebendo_propostas','em_analise','proposta_aceita','contratado','em_transporte','entregue','documentacao_pendente','concluido')
  AND EXISTS(SELECT 1 FROM public.companies c WHERE c.status='aprovada' AND
    (c.owner_id=auth.uid() OR public.is_org_member(c.id,auth.uid())) AND
    (c.tipo='reciclador' OR lower(COALESCE(c.tipo_organizacao,'')) IN ('reciclador','recicladora')))
);

DROP POLICY IF EXISTS "proposal operator reads" ON public.proposals;
DROP POLICY IF EXISTS "proposal recycler reads own" ON public.proposals;
CREATE POLICY "proposal recycler reads own" ON public.proposals FOR SELECT TO authenticated USING(
  public.has_role(auth.uid(),'reciclador') AND (
    reciclador_id=auth.uid() OR public.is_org_member(recycler_organization_id,auth.uid())
  )
);
CREATE POLICY "proposal assigned operator reads" ON public.proposals FOR SELECT TO authenticated USING(
  public.has_role(auth.uid(),'admin') OR EXISTS(
    SELECT 1 FROM public.lots l WHERE l.id=proposals.lot_id
      AND public.is_org_member(l.operator_organization_id,auth.uid())
  )
);
DROP POLICY IF EXISTS "proposal operator updates" ON public.proposals;
CREATE POLICY "proposal assigned operator updates" ON public.proposals FOR UPDATE TO authenticated USING(
  public.has_role(auth.uid(),'admin') OR EXISTS(
    SELECT 1 FROM public.lots l WHERE l.id=proposals.lot_id
      AND public.is_org_member(l.operator_organization_id,auth.uid())
  )
) WITH CHECK(
  public.has_role(auth.uid(),'admin') OR EXISTS(
    SELECT 1 FROM public.lots l WHERE l.id=proposals.lot_id
      AND public.is_org_member(l.operator_organization_id,auth.uid())
  )
);

DROP POLICY IF EXISTS "ops executing parties read" ON public.operations;
CREATE POLICY "operations authorized parties read" ON public.operations FOR SELECT TO authenticated USING(
  public.has_role(auth.uid(),'admin')
  OR public.is_org_member(generator_organization_id,auth.uid())
  OR public.is_org_member(operator_organization_id,auth.uid())
  OR public.is_org_member(carrier_organization_id,auth.uid())
  OR public.is_org_member(recycler_organization_id,auth.uid())
  OR EXISTS(
    SELECT 1 FROM public.lot_batteries lb JOIN public.batteries b ON b.id=lb.battery_id
    WHERE lb.lot_id=operations.lot_id AND b.owner_id=auth.uid()
  )
);

-- -------------------------------------------------------------------------
-- Fila sanitizada e reivindicação atômica para o operador
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_operator_intake_queue()
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'operador') THEN RAISE EXCEPTION 'Acesso restrito ao operador'; END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id',b.id,'code',b.code,'chemistry',b.quimica,'urgency',b.urgencia,
      'city',b.cidade,'state',b.uf,'created_at',b.created_at,
      'risk',COALESCE(b.possui_risco_termico,FALSE) OR COALESCE(b.possui_vazamento,FALSE)
    ) ORDER BY b.created_at)
    FROM public.batteries b
    WHERE b.status='aguardando_analise' AND b.operator_organization_id IS NULL
      AND b.is_demo=public.current_user_is_demo(auth.uid())
  ),'[]'::JSONB);
END; $$;

CREATE OR REPLACE FUNCTION public.claim_operator_battery(_battery_id UUID,_organization_id UUID DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _org UUID;
BEGIN
  IF NOT public.has_role(auth.uid(),'operador') THEN RAISE EXCEPTION 'Acesso restrito ao operador'; END IF;
  _org:=public.current_actor_organization(_organization_id);
  IF _org IS NULL OR NOT public.is_org_member(_org,auth.uid()) THEN RAISE EXCEPTION 'Organização operadora não aprovada'; END IF;
  PERFORM set_config('app.assignment_authorized','true',true);
  UPDATE public.batteries SET operator_organization_id=_org,updated_at=now()
  WHERE id=_battery_id AND status='aguardando_analise' AND operator_organization_id IS NULL
    AND is_demo=public.current_user_is_demo(auth.uid());
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitação indisponível ou já assumida'; END IF;
  INSERT INTO public.audit_log(actor_id,action,entity_type,entity_id,payload)
  VALUES(auth.uid(),'operator_custody_claimed','battery',_battery_id,jsonb_build_object('organization_id',_org));
END; $$;

CREATE OR REPLACE FUNCTION public.can_transition_lot(_lot_id UUID,_roles public.app_role[])
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT public.has_role(auth.uid(),'admin')
    OR ('operador'::public.app_role=ANY(_roles) AND public.has_role(auth.uid(),'operador') AND EXISTS(
      SELECT 1 FROM public.lots l WHERE l.id=_lot_id
        AND l.operator_organization_id IS NOT NULL
        AND public.is_org_member(l.operator_organization_id,auth.uid())))
    OR ('reciclador'::public.app_role=ANY(_roles) AND public.has_role(auth.uid(),'reciclador') AND EXISTS(
      SELECT 1 FROM public.proposals p WHERE p.lot_id=_lot_id
        AND (p.reciclador_id=auth.uid() OR public.is_org_member(p.recycler_organization_id,auth.uid()))))
    OR ('transportadora'::public.app_role=ANY(_roles) AND public.has_role(auth.uid(),'transportadora') AND EXISTS(
      SELECT 1 FROM public.collections c WHERE c.lot_id=_lot_id
        AND (c.transportadora_id=auth.uid() OR public.is_org_member(c.carrier_organization_id,auth.uid()))));
$$;

-- Mesmo funções SECURITY DEFINER não podem alterar uma bateria de outro operador.
CREATE OR REPLACE FUNCTION public.tg_enforce_operator_battery_scope()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND public.has_role(auth.uid(),'operador')
     AND NOT public.has_role(auth.uid(),'admin')
     AND COALESCE(current_setting('app.assignment_authorized',true),'')<>'true'
     AND NOT public.is_org_member(OLD.operator_organization_id,auth.uid()) THEN
    RAISE EXCEPTION 'Bateria não está sob responsabilidade deste operador';
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS enforce_operator_battery_scope ON public.batteries;
CREATE TRIGGER enforce_operator_battery_scope BEFORE UPDATE ON public.batteries
  FOR EACH ROW EXECUTE FUNCTION public.tg_enforce_operator_battery_scope();

CREATE OR REPLACE FUNCTION public.get_operator_dashboard_summary()
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE _org UUID; _is_admin BOOLEAN;
BEGIN
  _is_admin:=public.has_role(auth.uid(),'admin');
  IF NOT (_is_admin OR public.has_role(auth.uid(),'operador')) THEN RAISE EXCEPTION 'Acesso restrito ao operador'; END IF;
  _org:=public.current_actor_organization(NULL);
  RETURN jsonb_build_object(
    'received_requests',(SELECT count(*) FROM public.batteries b WHERE b.status='aguardando_analise' AND b.is_demo=public.current_user_is_demo(auth.uid()) AND (_is_admin OR b.operator_organization_id IS NULL OR b.operator_organization_id=_org)),
    'priority_requests',(SELECT count(*) FROM public.batteries b WHERE b.status NOT IN ('concluida','cancelada') AND (_is_admin OR b.operator_organization_id=_org) AND (lower(COALESCE(b.urgencia,'')) LIKE 'alta%' OR lower(COALESCE(b.urgencia,'')) LIKE 'emerg%' OR b.possui_risco_termico OR b.possui_vazamento)),
    'awaiting_collection',(SELECT count(*) FROM public.batteries b WHERE b.status IN ('aprovada_para_coleta','coleta_agendada') AND (_is_admin OR b.operator_organization_id=_org)),
    'received_batteries',(SELECT count(*) FROM public.batteries b WHERE b.status='recebida_na_triagem' AND (_is_admin OR b.operator_organization_id=_org)),
    'diagnostic_queue',(SELECT count(*) FROM public.batteries b WHERE b.status IN ('recebida_na_triagem','em_diagnostico') AND (_is_admin OR b.operator_organization_id=_org)),
    'technical_quarantine',(SELECT count(*) FROM public.batteries b WHERE b.status='em_quarentena' AND (_is_admin OR b.operator_organization_id=_org)),
    'forming_lots',(SELECT count(*) FROM public.lots l WHERE l.status IN ('rascunho','em_formacao','pronto_para_publicacao') AND (_is_admin OR l.operator_organization_id=_org)),
    'published_lots',(SELECT count(*) FROM public.lots l WHERE l.status IN ('publicado','recebendo_propostas','em_analise') AND (_is_admin OR l.operator_organization_id=_org)),
    'received_proposals',(SELECT count(*) FROM public.proposals p JOIN public.lots l ON l.id=p.lot_id WHERE p.status IN ('enviada','em_analise') AND (_is_admin OR l.operator_organization_id=_org)),
    'pending_documents',(SELECT count(*) FROM public.documents d WHERE COALESCE(d.status,'pendente')='pendente' AND (_is_admin OR public.can_access_workflow_document(d.id,auth.uid()))),
    'open_incidents',(SELECT count(*) FROM public.incidents i WHERE i.status NOT IN ('resolvido','encerrado') AND (_is_admin OR i.registrado_por=auth.uid() OR EXISTS(SELECT 1 FROM public.batteries b WHERE b.id=i.battery_id AND b.operator_organization_id=_org)))
  );
END; $$;

-- Transições do operador exigem custódia/responsabilidade explícita.
CREATE OR REPLACE FUNCTION public.can_transition_battery(_battery_id UUID,_roles public.app_role[])
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT public.has_role(auth.uid(),'admin')
    OR ('gerador'::public.app_role=ANY(_roles) AND EXISTS(
      SELECT 1 FROM public.batteries b WHERE b.id=_battery_id AND b.owner_id=auth.uid()))
    OR ('operador'::public.app_role=ANY(_roles) AND public.has_role(auth.uid(),'operador') AND EXISTS(
      SELECT 1 FROM public.batteries b WHERE b.id=_battery_id
        AND b.operator_organization_id IS NOT NULL
        AND public.is_org_member(b.operator_organization_id,auth.uid())))
    OR ('transportadora'::public.app_role=ANY(_roles) AND public.has_role(auth.uid(),'transportadora') AND EXISTS(
      SELECT 1 FROM public.collections c LEFT JOIN public.lot_batteries lb ON lb.lot_id=c.lot_id
      WHERE (c.battery_id=_battery_id OR lb.battery_id=_battery_id)
        AND (c.transportadora_id=auth.uid() OR public.is_org_member(c.carrier_organization_id,auth.uid()))))
    OR ('reciclador'::public.app_role=ANY(_roles) AND public.has_role(auth.uid(),'reciclador') AND EXISTS(
      SELECT 1 FROM public.lot_batteries lb JOIN public.proposals p ON p.lot_id=lb.lot_id AND p.status='aceita'
      WHERE lb.battery_id=_battery_id AND (p.reciclador_id=auth.uid() OR public.is_org_member(p.recycler_organization_id,auth.uid()))));
$$;

CREATE OR REPLACE FUNCTION public.review_battery_request(
  _battery_id UUID,_decision TEXT,_reason TEXT DEFAULT NULL,_organization_id UUID DEFAULT NULL
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR (
    public.has_role(auth.uid(),'operador') AND EXISTS(
      SELECT 1 FROM public.batteries b WHERE b.id=_battery_id
        AND public.is_org_member(b.operator_organization_id,auth.uid())
    )
  )) THEN RAISE EXCEPTION 'Bateria não está sob responsabilidade deste operador'; END IF;
  IF _decision='aceitar' THEN
    PERFORM public.transition_battery_status(_battery_id,'aprovada_para_coleta',_reason,_organization_id);
  ELSIF _decision='solicitar_informacoes' THEN
    IF COALESCE(trim(_reason),'')='' THEN RAISE EXCEPTION 'Informe quais dados são necessários'; END IF;
    PERFORM public.transition_battery_status(_battery_id,'informacoes_solicitadas',_reason,_organization_id);
  ELSE RAISE EXCEPTION 'Decisão inválida'; END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.create_collection_order(
  _battery_id UUID,_origin TEXT,_destination TEXT,
  _operator_organization_id UUID DEFAULT NULL,_carrier_organization_id UUID DEFAULT NULL
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _id UUID; _status TEXT; _generator UUID; _operator UUID;
BEGIN
  IF NOT (public.has_role(auth.uid(),'operador') OR public.has_role(auth.uid(),'admin')) THEN RAISE EXCEPTION 'Acesso restrito ao operador'; END IF;
  SELECT status,generator_organization_id,operator_organization_id INTO _status,_generator,_operator
  FROM public.batteries WHERE id=_battery_id FOR UPDATE;
  IF _status<>'aprovada_para_coleta' THEN RAISE EXCEPTION 'Bateria não está aprovada para coleta'; END IF;
  IF NOT public.has_role(auth.uid(),'admin') AND NOT public.is_org_member(_operator,auth.uid()) THEN RAISE EXCEPTION 'Bateria não está sob responsabilidade deste operador'; END IF;
  IF _carrier_organization_id IS NULL THEN RAISE EXCEPTION 'Selecione uma transportadora aprovada'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.companies c WHERE c.id=_carrier_organization_id AND c.status='aprovada' AND (c.tipo='transportadora' OR lower(COALESCE(c.tipo_organizacao,'')) LIKE 'transportador%')) THEN
    RAISE EXCEPTION 'Transportadora não aprovada';
  END IF;
  INSERT INTO public.collections(
    battery_id,generator_organization_id,operator_organization_id,carrier_organization_id,
    origem_endereco,destino_endereco,status,codigo_coleta,is_demo
  ) SELECT _battery_id,_generator,COALESCE(_operator,_operator_organization_id),_carrier_organization_id,
    _origin,_destination,'ordem_criada','COL-'||to_char(now(),'YYYY')||'-'||upper(substr(replace(gen_random_uuid()::TEXT,'-',''),1,8)),b.is_demo
    FROM public.batteries b WHERE b.id=_battery_id RETURNING id INTO _id;
  INSERT INTO public.status_history(entity_type,entity_id,status_novo,alterado_por,organization_id,justificativa,is_demo)
  SELECT 'collections',_id,'ordem_criada',auth.uid(),COALESCE(_operator,_operator_organization_id),'Ordem de coleta criada',b.is_demo
  FROM public.batteries b WHERE b.id=_battery_id;
  PERFORM public.notify_organization_event(_carrier_organization_id,'coleta_atribuida','Nova coleta atribuída','Uma ordem de coleta foi atribuída à sua organização.','collection',_id,'/app');
  RETURN _id;
END; $$;

CREATE OR REPLACE FUNCTION public.flag_battery_risk(_battery_id UUID,_risk_type TEXT,_notes TEXT,_quarantine BOOLEAN DEFAULT TRUE)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _status TEXT;
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR EXISTS(SELECT 1 FROM public.batteries b WHERE b.id=_battery_id AND public.is_org_member(b.operator_organization_id,auth.uid()))) THEN
    RAISE EXCEPTION 'Bateria não está sob responsabilidade deste operador';
  END IF;
  IF _risk_type NOT IN ('termico','vazamento','avaria') OR COALESCE(trim(_notes),'')='' THEN RAISE EXCEPTION 'Tipo e descrição do risco são obrigatórios'; END IF;
  SELECT status INTO _status FROM public.batteries WHERE id=_battery_id FOR UPDATE;
  UPDATE public.batteries SET
    possui_vazamento=COALESCE(possui_vazamento,FALSE) OR _risk_type='vazamento',
    possui_avaria=COALESCE(possui_avaria,FALSE) OR _risk_type='avaria',
    possui_risco_termico=COALESCE(possui_risco_termico,FALSE) OR _risk_type='termico',
    observacoes=concat_ws(E'\n',observacoes,'RISCO: '||_risk_type||' — '||_notes)
  WHERE id=_battery_id;
  INSERT INTO public.incidents(battery_id,tipo,gravidade,descricao,status,registrado_por,is_demo)
  SELECT _battery_id,'risco_'||_risk_type,'alta',_notes,'aberto',auth.uid(),b.is_demo FROM public.batteries b WHERE b.id=_battery_id;
  IF _quarantine AND _status<>'em_quarentena' THEN PERFORM public.transition_battery_status(_battery_id,'em_quarentena',_notes,NULL); END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.complete_technical_stage(_battery_id UUID,_notes TEXT DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR EXISTS(SELECT 1 FROM public.batteries b WHERE b.id=_battery_id AND public.is_org_member(b.operator_organization_id,auth.uid()))) THEN
    RAISE EXCEPTION 'Bateria não está sob responsabilidade deste operador';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.batteries WHERE id=_battery_id AND status IN ('classificada','em_quarentena')) THEN RAISE EXCEPTION 'Diagnóstico técnico ainda não foi concluído'; END IF;
  UPDATE public.sorting_diagnostics SET status_validacao='validado',updated_at=now() WHERE battery_id=_battery_id;
  INSERT INTO public.battery_events(battery_id,actor_id,event_type,notes,is_demo)
  SELECT _battery_id,auth.uid(),'etapa_tecnica_concluida',COALESCE(_notes,'Etapa técnica concluída.'),b.is_demo FROM public.batteries b WHERE b.id=_battery_id;
  PERFORM public.notify_battery_participants(_battery_id,'Etapa técnica concluída',COALESCE(_notes,'O diagnóstico técnico foi concluído.'));
END; $$;

-- Uma transportadora só pode responder a uma ordem previamente atribuída.
CREATE OR REPLACE FUNCTION public.respond_collection_order(
  _collection_id UUID,_accept BOOLEAN,_reason TEXT DEFAULT NULL,_carrier_organization_id UUID DEFAULT NULL
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _c public.collections%ROWTYPE; _org UUID;
BEGIN
  IF NOT (public.has_role(auth.uid(),'transportadora') OR public.has_role(auth.uid(),'admin')) THEN
    RAISE EXCEPTION 'Apenas transportadora ou administrador pode responder à ordem';
  END IF;
  SELECT * INTO _c FROM public.collections WHERE id=_collection_id FOR UPDATE;
  IF NOT FOUND OR _c.status<>'ordem_criada' THEN RAISE EXCEPTION 'Ordem não está disponível'; END IF;
  _org:=COALESCE(_carrier_organization_id,public.current_actor_organization(NULL));
  IF NOT public.has_role(auth.uid(),'admin') AND NOT (
    _c.transportadora_id=auth.uid() OR
    (_c.carrier_organization_id IS NOT NULL AND public.is_org_member(_c.carrier_organization_id,auth.uid()))
  ) THEN RAISE EXCEPTION 'Ordem não atribuída a esta transportadora'; END IF;
  IF NOT _accept AND COALESCE(trim(_reason),'')='' THEN RAISE EXCEPTION 'Motivo da recusa obrigatório'; END IF;
  PERFORM set_config('app.workflow_authorized','true',true);
  PERFORM set_config('app.workflow_reason',COALESCE(_reason,''),true);
  PERFORM set_config('app.workflow_org',COALESCE(_org::TEXT,''),true);
  UPDATE public.collections SET
    status=CASE WHEN _accept THEN 'aceita' ELSE 'recusada' END,
    transportadora_id=CASE WHEN _accept THEN auth.uid() ELSE transportadora_id END,
    carrier_organization_id=COALESCE(carrier_organization_id,_org),
    observacoes=concat_ws(E'\n',observacoes,_reason),updated_at=now()
  WHERE id=_collection_id;
END; $$;

-- Resumo da transportadora sem ordens abertas de terceiros.
CREATE OR REPLACE FUNCTION public.get_carrier_dashboard_summary()
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE _org UUID;
BEGIN
  IF NOT (public.has_role(auth.uid(),'transportadora') OR public.has_role(auth.uid(),'admin')) THEN RAISE EXCEPTION 'Acesso restrito à transportadora'; END IF;
  _org:=public.current_actor_organization(NULL);
  RETURN jsonb_build_object(
    'organization_id',_org,'available_orders',0,
    'assigned_orders',(SELECT count(*) FROM public.collections WHERE status='ordem_criada' AND (transportadora_id=auth.uid() OR carrier_organization_id=_org)),
    'pending_collections',(SELECT count(*) FROM public.collections WHERE status IN ('ordem_criada','aceita') AND (transportadora_id=auth.uid() OR carrier_organization_id=_org)),
    'accepted_collections',(SELECT count(*) FROM public.collections WHERE status='aceita' AND (transportadora_id=auth.uid() OR carrier_organization_id=_org)),
    'scheduled_collections',(SELECT count(*) FROM public.collections WHERE status='agendada' AND (transportadora_id=auth.uid() OR carrier_organization_id=_org)),
    'in_transit',(SELECT count(*) FROM public.collections WHERE status IN ('retirada','em_transporte') AND (transportadora_id=auth.uid() OR carrier_organization_id=_org)),
    'completed_deliveries',(SELECT count(*) FROM public.collections WHERE status IN ('entregue_triagem','entregue_destinador') AND (transportadora_id=auth.uid() OR carrier_organization_id=_org)),
    'pending_documents',(SELECT count(*) FROM (VALUES('licenca_ambiental'),('documento_transporte'),('seguro_carga'),('certificado_veiculo')) required(tipo)
      WHERE NOT EXISTS(SELECT 1 FROM public.organization_documents od WHERE od.organization_id=_org AND od.tipo_documento=required.tipo AND od.status_validacao='validado' AND (od.validade IS NULL OR od.validade>=CURRENT_DATE))),
    'open_incidents',(SELECT count(*) FROM public.incidents i LEFT JOIN public.collections c ON c.id=i.collection_id WHERE i.status NOT IN ('resolvido','encerrado') AND (i.registrado_por=auth.uid() OR c.transportadora_id=auth.uid() OR c.carrier_organization_id=_org)),
    'document_alerts',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',od.id,'type',required.tipo,'number',od.numero,'valid_until',od.validade,'status',COALESCE(od.status_validacao,'ausente'),'alert',CASE WHEN od.id IS NULL THEN 'ausente' WHEN od.validade<CURRENT_DATE THEN 'vencido' WHEN od.validade<=CURRENT_DATE+30 THEN 'vence_em_breve' WHEN od.status_validacao<>'validado' THEN 'pendente' ELSE 'regular' END) ORDER BY required.tipo)
      FROM (VALUES('licenca_ambiental'),('documento_transporte'),('seguro_carga'),('certificado_veiculo')) required(tipo)
      LEFT JOIN LATERAL (SELECT d.* FROM public.organization_documents d WHERE d.organization_id=_org AND d.tipo_documento=required.tipo ORDER BY d.created_at DESC LIMIT 1) od ON TRUE
      WHERE od.id IS NULL OR od.status_validacao<>'validado' OR od.validade<CURRENT_DATE+31),'[]'::JSONB)
  );
END; $$;

CREATE OR REPLACE FUNCTION public.register_collection_document(
  _collection_id UUID,_document_type TEXT,_storage_path TEXT,
  _document_number TEXT DEFAULT NULL,_notes TEXT DEFAULT NULL
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _c public.collections%ROWTYPE; _id UUID; _operation UUID;
BEGIN
  SELECT * INTO _c FROM public.collections WHERE id=_collection_id;
  IF NOT FOUND OR NOT (
    public.has_role(auth.uid(),'admin')
    OR public.is_org_member(_c.operator_organization_id,auth.uid())
    OR _c.transportadora_id=auth.uid()
    OR public.is_org_member(_c.carrier_organization_id,auth.uid())
  ) THEN RAISE EXCEPTION 'Sem permissão para esta coleta'; END IF;
  IF COALESCE(trim(_storage_path),'')='' THEN RAISE EXCEPTION 'Arquivo obrigatório'; END IF;
  SELECT id INTO _operation FROM public.operations WHERE lot_id=_c.lot_id ORDER BY created_at DESC LIMIT 1;
  INSERT INTO public.documents(operation_id,battery_id,lot_id,collection_id,entity_type,entity_id,kind,tipo_documento,numero_documento,url,storage_path,uploaded_by,status,observacoes,is_demo)
  VALUES(_operation,_c.battery_id,_c.lot_id,_collection_id,'collection',_collection_id,_document_type,_document_type,_document_number,_storage_path,_storage_path,auth.uid(),'pendente',_notes,_c.is_demo)
  RETURNING id INTO _id;
  INSERT INTO public.status_history(entity_type,entity_id,status_novo,alterado_por,organization_id,justificativa,is_demo)
  VALUES('collection_documents',_id,'pendente',auth.uid(),public.current_actor_organization(_c.carrier_organization_id),'Documento anexado à coleta',_c.is_demo);
  RETURN _id;
END; $$;

-- -------------------------------------------------------------------------
-- Documentos: autorização por entidade e storage exclusivamente privado
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_access_workflow_document(_document_id UUID,_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT public.is_user_active(_user_id) AND EXISTS(
    SELECT 1 FROM public.documents d WHERE d.id=_document_id AND d.deleted_at IS NULL AND (
      d.uploaded_by=_user_id OR public.has_role(_user_id,'admin')
      OR (d.private_document_id IS NOT NULL AND public.can_access_private_document(d.private_document_id,_user_id))
      OR (d.battery_id IS NOT NULL AND EXISTS(SELECT 1 FROM public.batteries b WHERE b.id=d.battery_id AND (
        b.owner_id=_user_id OR public.is_org_member(b.operator_organization_id,_user_id))))
      OR (d.collection_id IS NOT NULL AND EXISTS(SELECT 1 FROM public.collections c WHERE c.id=d.collection_id AND (
        c.transportadora_id=_user_id OR public.is_org_member(c.generator_organization_id,_user_id)
        OR public.is_org_member(c.operator_organization_id,_user_id) OR public.is_org_member(c.carrier_organization_id,_user_id))))
      OR (d.lot_id IS NOT NULL AND EXISTS(SELECT 1 FROM public.lots l WHERE l.id=d.lot_id AND public.is_org_member(l.operator_organization_id,_user_id)))
      OR (d.operation_id IS NOT NULL AND EXISTS(SELECT 1 FROM public.operations o WHERE o.id=d.operation_id AND (
        public.is_org_member(o.generator_organization_id,_user_id) OR public.is_org_member(o.operator_organization_id,_user_id)
        OR public.is_org_member(o.carrier_organization_id,_user_id) OR public.is_org_member(o.recycler_organization_id,_user_id))))
    )
  );
$$;

DROP POLICY IF EXISTS "Uploader reads own docs" ON public.documents;
CREATE POLICY "workflow documents authorized read" ON public.documents FOR SELECT TO authenticated USING(
  public.can_access_workflow_document(id,auth.uid())
);

CREATE OR REPLACE FUNCTION public.can_access_private_document(_document_id UUID,_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT public.is_user_active(_user_id) AND EXISTS(
    SELECT 1 FROM public.private_documents d WHERE d.id=_document_id AND d.deleted_at IS NULL AND d.status<>'excluido'
      AND d.is_demo=public.current_user_is_demo(_user_id) AND (
        d.uploaded_by=_user_id OR public.has_role(_user_id,'admin') OR public.is_org_member(d.organization_id,_user_id)
        OR (d.entity_type='battery' AND public.can_view_battery_private(d.entity_id,_user_id))
        OR (d.entity_type='collection' AND EXISTS(SELECT 1 FROM public.collections c WHERE c.id=d.entity_id AND (
          c.transportadora_id=_user_id OR public.is_org_member(c.generator_organization_id,_user_id)
          OR public.is_org_member(c.operator_organization_id,_user_id) OR public.is_org_member(c.carrier_organization_id,_user_id)
          OR public.is_org_member(c.recycler_organization_id,_user_id))))
        OR (d.entity_type='lot' AND EXISTS(SELECT 1 FROM public.lots l WHERE l.id=d.entity_id AND (
          public.is_org_member(l.operator_organization_id,_user_id) OR EXISTS(SELECT 1 FROM public.proposals p WHERE p.lot_id=l.id AND p.status='aceita' AND (p.reciclador_id=_user_id OR public.is_org_member(p.recycler_organization_id,_user_id))))))
        OR (d.entity_type='operation' AND EXISTS(SELECT 1 FROM public.operations o WHERE o.id=d.entity_id AND (
          public.is_org_member(o.generator_organization_id,_user_id) OR public.is_org_member(o.operator_organization_id,_user_id)
          OR public.is_org_member(o.carrier_organization_id,_user_id) OR public.is_org_member(o.recycler_organization_id,_user_id))))
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.notify_user_event(
  _user_id UUID,_event_key TEXT,_title TEXT,_body TEXT,_entity_type TEXT DEFAULT NULL,
  _entity_id UUID DEFAULT NULL,_organization_id UUID DEFAULT NULL,_link TEXT DEFAULT '/app'
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF _user_id IS NULL THEN RETURN; END IF;
  INSERT INTO public.notifications(user_id,profile_id,title,body,mensagem,link,tipo,entity_type,entity_id,organization_id,event_key,email_status,is_demo)
  VALUES(_user_id,_user_id,_title,_body,_body,_link,'interna',_entity_type,_entity_id,_organization_id,_event_key,'integracao_pendente',public.current_user_is_demo(_user_id))
  ON CONFLICT(user_id,event_key,entity_type,entity_id) WHERE event_key IS NOT NULL DO NOTHING;
END; $$;

CREATE OR REPLACE FUNCTION public.can_upload_private_entity(_entity_type TEXT,_entity_id UUID,_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT public.is_user_active(_user_id) AND (
    public.has_role(_user_id,'admin')
    OR (_entity_type='organization' AND public.can_manage_org(_entity_id,_user_id))
    OR (_entity_type='battery' AND public.can_view_battery_private(_entity_id,_user_id))
    OR (_entity_type='collection' AND EXISTS(SELECT 1 FROM public.collections c WHERE c.id=_entity_id AND (
      c.transportadora_id=_user_id OR public.is_org_member(c.generator_organization_id,_user_id)
      OR public.is_org_member(c.operator_organization_id,_user_id) OR public.is_org_member(c.carrier_organization_id,_user_id))))
    OR (_entity_type='lot' AND EXISTS(SELECT 1 FROM public.lots l WHERE l.id=_entity_id AND (
      public.is_org_member(l.operator_organization_id,_user_id) OR EXISTS(SELECT 1 FROM public.proposals p WHERE p.lot_id=l.id AND p.status='aceita' AND (p.reciclador_id=_user_id OR public.is_org_member(p.recycler_organization_id,_user_id))))))
    OR (_entity_type='operation' AND EXISTS(SELECT 1 FROM public.operations o WHERE o.id=_entity_id AND (
      public.is_org_member(o.operator_organization_id,_user_id) OR public.is_org_member(o.carrier_organization_id,_user_id) OR public.is_org_member(o.recycler_organization_id,_user_id))))
  );
$$;

UPDATE storage.buckets SET public=FALSE WHERE id IN ('battery-files','workflow-documents','private-documents');
DROP POLICY IF EXISTS "workflow documents read involved" ON storage.objects;
CREATE POLICY "workflow documents read authorized" ON storage.objects FOR SELECT TO authenticated USING(
  bucket_id='workflow-documents' AND public.is_user_active(auth.uid()) AND EXISTS(
    SELECT 1 FROM public.documents d WHERE d.storage_path=storage.objects.name
      AND public.can_access_workflow_document(d.id,auth.uid())
  )
);
DROP POLICY IF EXISTS "workflow documents upload own folder" ON storage.objects;
CREATE POLICY "workflow documents upload active own folder" ON storage.objects FOR INSERT TO authenticated WITH CHECK(
  bucket_id='workflow-documents' AND public.is_user_active(auth.uid())
  AND (storage.foldername(name))[1]=auth.uid()::TEXT
);

-- -------------------------------------------------------------------------
-- Auditoria append-only para ações sensíveis
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tg_audit_sensitive_action()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _id UUID; _payload JSONB;
BEGIN
  _id:=COALESCE((to_jsonb(NEW)->>'id')::UUID,(to_jsonb(OLD)->>'id')::UUID);
  _payload:=jsonb_build_object('operation',TG_OP,'previous',CASE WHEN TG_OP<>'INSERT' THEN to_jsonb(OLD) ELSE NULL END,'new',CASE WHEN TG_OP<>'DELETE' THEN to_jsonb(NEW) ELSE NULL END);
  INSERT INTO public.audit_log(actor_id,action,entity_type,entity_id,payload)
  VALUES(auth.uid(),lower(TG_OP),TG_TABLE_NAME,_id,_payload);
  RETURN COALESCE(NEW,OLD);
END; $$;

DO $$
DECLARE _table TEXT;
BEGIN
  FOREACH _table IN ARRAY ARRAY['companies','user_roles','collections','sorting_diagnostics','lots','proposals','operations','documents','private_documents','incidents'] LOOP
    IF to_regclass('public.'||_table) IS NOT NULL THEN
      EXECUTE format('DROP TRIGGER IF EXISTS audit_sensitive_action ON public.%I',_table);
      EXECUTE format('CREATE TRIGGER audit_sensitive_action AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.tg_audit_sensitive_action()',_table);
    END IF;
  END LOOP;
END $$;

REVOKE INSERT,UPDATE,DELETE,TRUNCATE ON public.audit_log FROM authenticated,anon;

-- Suspensão explícita, preservando o histórico anterior.
CREATE OR REPLACE FUNCTION public.admin_set_user_status(_profile_id UUID,_active BOOLEAN,_reason TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _old JSONB; _new JSONB;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Acesso restrito'; END IF;
  IF COALESCE(trim(_reason),'')='' THEN RAISE EXCEPTION 'Justificativa obrigatória'; END IF;
  SELECT to_jsonb(p) INTO _old FROM public.profiles p WHERE id=_profile_id FOR UPDATE;
  UPDATE public.profiles SET
    status=CASE WHEN _active THEN 'approved' ELSE 'rejected' END,
    suspended_at=CASE WHEN _active THEN NULL ELSE now() END,
    suspension_reason=CASE WHEN _active THEN NULL ELSE _reason END,
    updated_at=now()
  WHERE id=_profile_id RETURNING to_jsonb(profiles.*) INTO _new;
  PERFORM public.admin_record_action(CASE WHEN _active THEN 'account_reactivated' ELSE 'account_suspended' END,'users',_profile_id,_old,_new,_reason);
END; $$;

REVOKE ALL ON FUNCTION public.list_operator_intake_queue() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.claim_operator_battery(UUID,UUID) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.can_access_workflow_document(UUID,UUID) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.list_operator_intake_queue(), public.claim_operator_battery(UUID,UUID),
  public.can_access_workflow_document(UUID,UUID) TO authenticated;

-- Parâmetros de qualidade e integrações, sem simular disponibilidade.
INSERT INTO public.system_parameters(key,value,description)
VALUES
  ('default_timezone','"America/Sao_Paulo"'::JSONB,'Fuso horário padrão da plataforma'),
  ('email_integration','"pendente"'::JSONB,'Integração de e-mail pendente'),
  ('demo_seed_enabled','false'::JSONB,'Seed demonstrativo separado e desativado em produção')
ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,description=EXCLUDED.description,updated_at=now();
