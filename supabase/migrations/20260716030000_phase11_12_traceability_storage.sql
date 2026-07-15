-- =========================================================
-- FASES 11 E 12 — QR Code, rastreabilidade e storage privado
-- =========================================================

ALTER TABLE public.batteries
  ADD COLUMN IF NOT EXISTS tracking_token UUID DEFAULT gen_random_uuid();
ALTER TABLE public.collections
  ADD COLUMN IF NOT EXISTS tracking_token UUID DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS qr_code_data TEXT;
ALTER TABLE public.lots
  ADD COLUMN IF NOT EXISTS tracking_token UUID DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS qr_code_data TEXT;

UPDATE public.batteries SET tracking_token=COALESCE(tracking_token,gen_random_uuid());
UPDATE public.collections SET tracking_token=COALESCE(tracking_token,gen_random_uuid());
UPDATE public.lots SET tracking_token=COALESCE(tracking_token,gen_random_uuid());

ALTER TABLE public.batteries ALTER COLUMN tracking_token SET NOT NULL;
ALTER TABLE public.collections ALTER COLUMN tracking_token SET NOT NULL;
ALTER TABLE public.lots ALTER COLUMN tracking_token SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS batteries_tracking_token_uidx ON public.batteries(tracking_token);
CREATE UNIQUE INDEX IF NOT EXISTS collections_tracking_token_uidx ON public.collections(tracking_token);
CREATE UNIQUE INDEX IF NOT EXISTS lots_tracking_token_uidx ON public.lots(tracking_token);

UPDATE public.batteries SET qr_code_data='https://batterylink.com.br/rastreio/'||tracking_token::TEXT;
UPDATE public.collections SET qr_code_data='https://batterylink.com.br/rastreio/'||tracking_token::TEXT;
UPDATE public.lots SET qr_code_data='https://batterylink.com.br/rastreio/'||tracking_token::TEXT;

CREATE OR REPLACE FUNCTION public.tg_generate_trace_qr()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  NEW.tracking_token:=COALESCE(NEW.tracking_token,gen_random_uuid());
  NEW.qr_code_data:='https://batterylink.com.br/rastreio/'||NEW.tracking_token::TEXT;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS generate_battery_qr ON public.batteries;
CREATE TRIGGER generate_battery_qr BEFORE INSERT OR UPDATE OF tracking_token ON public.batteries
  FOR EACH ROW EXECUTE FUNCTION public.tg_generate_trace_qr();
DROP TRIGGER IF EXISTS generate_collection_qr ON public.collections;
CREATE TRIGGER generate_collection_qr BEFORE INSERT OR UPDATE OF tracking_token ON public.collections
  FOR EACH ROW EXECUTE FUNCTION public.tg_generate_trace_qr();
DROP TRIGGER IF EXISTS generate_lot_qr ON public.lots;
CREATE TRIGGER generate_lot_qr BEFORE INSERT OR UPDATE OF tracking_token ON public.lots
  FOR EACH ROW EXECUTE FUNCTION public.tg_generate_trace_qr();

CREATE OR REPLACE FUNCTION public.trace_destination_status(_entity TEXT,_status TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN _entity='battery' AND _status='concluida' THEN 'destinacao_concluida'
    WHEN _entity='battery' AND _status IN ('documentacao_pendente','recebida_pelo_destinador') THEN 'destinacao_em_validacao'
    WHEN _entity='battery' AND _status IN ('destinacao_definida','enviada_ao_destinador') THEN 'destinacao_definida'
    WHEN _entity='lot' AND _status='concluido' THEN 'destinacao_concluida'
    WHEN _entity='lot' AND _status IN ('entregue','documentacao_pendente') THEN 'destinacao_em_validacao'
    WHEN _entity='lot' AND _status IN ('proposta_aceita','contratado','em_transporte') THEN 'destinacao_definida'
    WHEN _entity='collection' AND _status IN ('entregue_triagem','entregue_destinador') THEN 'entrega_concluida'
    WHEN _entity='collection' AND _status IN ('retirada','em_transporte') THEN 'em_transporte'
    ELSE 'destinacao_pendente' END
$$;

-- Uma única regra de autorização é reutilizada pela rastreabilidade e pelo
-- storage. Ela inclui somente organizações que participam do fluxo da bateria.
CREATE OR REPLACE FUNCTION public.can_view_battery_private(_battery_id UUID,_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.batteries b WHERE b.id=_battery_id AND (
      b.owner_id=_user_id OR public.has_role(_user_id,'admin') OR public.has_role(_user_id,'operador')
      OR public.is_org_member(b.company_id,_user_id)
      OR public.is_org_member(b.generator_organization_id,_user_id)
      OR EXISTS(SELECT 1 FROM public.collections c WHERE c.battery_id=b.id AND (
        c.transportadora_id=_user_id OR public.is_org_member(c.operator_organization_id,_user_id)
        OR public.is_org_member(c.carrier_organization_id,_user_id)))
      OR EXISTS(
        SELECT 1 FROM public.lot_batteries lb
        LEFT JOIN public.collections c ON c.lot_id=lb.lot_id
        LEFT JOIN public.proposals p ON p.lot_id=lb.lot_id AND p.status='aceita'
        WHERE lb.battery_id=b.id AND (
          c.transportadora_id=_user_id OR public.is_org_member(c.carrier_organization_id,_user_id)
          OR p.reciclador_id=_user_id OR public.is_org_member(p.recycler_organization_id,_user_id)
        )
      )
    )
  )
$$;
REVOKE ALL ON FUNCTION public.can_view_battery_private(UUID,UUID) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.get_public_trace(_token TEXT)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE _result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'code',b.codigo_unico,'category','battery','status',b.status,
    'dates',jsonb_strip_nulls(jsonb_build_object('registered_at',b.created_at,'updated_at',b.updated_at)),
    'destination_status',public.trace_destination_status('battery',b.status),
    'query_valid_until',now()+interval '5 minutes'
  ) INTO _result FROM public.batteries b WHERE b.tracking_token::TEXT=_token;
  IF _result IS NOT NULL THEN RETURN _result; END IF;

  SELECT jsonb_build_object(
    'code',c.codigo_coleta,'category','collection','status',c.status,
    'dates',jsonb_strip_nulls(jsonb_build_object(
      'requested_at',c.data_solicitacao,'scheduled_at',COALESCE(c.data_agendada,c.scheduled_at),
      'collected_at',c.data_coleta,'delivered_at',c.data_entrega,'updated_at',c.updated_at)),
    'destination_status',public.trace_destination_status('collection',c.status),
    'query_valid_until',now()+interval '5 minutes'
  ) INTO _result FROM public.collections c WHERE c.tracking_token::TEXT=_token;
  IF _result IS NOT NULL THEN RETURN _result; END IF;

  SELECT jsonb_build_object(
    'code',l.codigo_lote,'category','lot','status',l.status,
    'dates',jsonb_strip_nulls(jsonb_build_object(
      'created_at',l.created_at,'proposals_open_at',l.data_abertura_propostas,
      'proposals_close_at',l.data_encerramento_propostas,'updated_at',l.updated_at)),
    'destination_status',public.trace_destination_status('lot',l.status),
    'query_valid_until',now()+interval '5 minutes'
  ) INTO _result FROM public.lots l WHERE l.tracking_token::TEXT=_token;
  IF _result IS NOT NULL THEN RETURN _result; END IF;
  RAISE EXCEPTION 'Código de rastreabilidade não encontrado';
END;
$$;

CREATE OR REPLACE FUNCTION public.get_authorized_trace(_token TEXT)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE _public JSONB; _id UUID; _category TEXT; _allowed BOOLEAN:=FALSE; _details JSONB; _related JSONB;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Autenticação obrigatória'; END IF;
  _public:=public.get_public_trace(_token); _category:=_public->>'category';
  IF _category='battery' THEN
    SELECT id INTO _id FROM public.batteries WHERE tracking_token::TEXT=_token;
    _allowed:=public.can_view_battery_private(_id,auth.uid());
    IF _allowed THEN
      SELECT to_jsonb(b)-'tracking_token' INTO _details FROM public.batteries b WHERE id=_id;
      SELECT jsonb_build_object(
        'timeline',COALESCE((SELECT jsonb_agg(to_jsonb(e) ORDER BY e.created_at) FROM public.battery_events e WHERE e.battery_id=_id),'[]'::JSONB),
        'collections',COALESCE((SELECT jsonb_agg(to_jsonb(c)-'tracking_token') FROM public.collections c WHERE c.battery_id=_id),'[]'::JSONB)
      ) INTO _related;
    END IF;
  ELSIF _category='collection' THEN
    SELECT id INTO _id FROM public.collections WHERE tracking_token::TEXT=_token;
    SELECT EXISTS(SELECT 1 FROM public.collections c WHERE c.id=_id AND (
      public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'operador') OR c.transportadora_id=auth.uid()
      OR (c.generator_organization_id IS NOT NULL AND public.is_org_member(c.generator_organization_id,auth.uid()))
      OR (c.operator_organization_id IS NOT NULL AND public.is_org_member(c.operator_organization_id,auth.uid()))
      OR (c.carrier_organization_id IS NOT NULL AND public.is_org_member(c.carrier_organization_id,auth.uid()))
      OR (c.recycler_organization_id IS NOT NULL AND public.is_org_member(c.recycler_organization_id,auth.uid()))
      OR EXISTS(SELECT 1 FROM public.batteries b WHERE b.id=c.battery_id AND b.owner_id=auth.uid())
    )) INTO _allowed;
    IF _allowed THEN
      SELECT to_jsonb(c)-'tracking_token' INTO _details FROM public.collections c WHERE id=_id;
      SELECT jsonb_build_object('history',COALESCE((SELECT jsonb_agg(to_jsonb(h) ORDER BY h.created_at) FROM public.status_history h WHERE h.entity_type='collections' AND h.entity_id=_id),'[]'::JSONB)) INTO _related;
    END IF;
  ELSE
    SELECT id INTO _id FROM public.lots WHERE tracking_token::TEXT=_token;
    SELECT EXISTS(SELECT 1 FROM public.lots l WHERE l.id=_id AND (
      public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'operador')
      OR (l.operator_organization_id IS NOT NULL AND public.is_org_member(l.operator_organization_id,auth.uid()))
      OR EXISTS(SELECT 1 FROM public.proposals p WHERE p.lot_id=l.id AND p.status='aceita' AND (p.reciclador_id=auth.uid() OR public.is_org_member(p.recycler_organization_id,auth.uid())))
      OR EXISTS(SELECT 1 FROM public.collections c WHERE c.lot_id=l.id AND (c.transportadora_id=auth.uid() OR public.is_org_member(c.carrier_organization_id,auth.uid())))
      OR EXISTS(SELECT 1 FROM public.lot_batteries lb JOIN public.batteries b ON b.id=lb.battery_id WHERE lb.lot_id=l.id AND b.owner_id=auth.uid())
    )) INTO _allowed;
    IF _allowed THEN
      SELECT to_jsonb(l)-'tracking_token' INTO _details FROM public.lots l WHERE id=_id;
      SELECT jsonb_build_object(
        'batteries',COALESCE((SELECT jsonb_agg(to_jsonb(b)-'tracking_token') FROM public.lot_batteries lb JOIN public.batteries b ON b.id=lb.battery_id WHERE lb.lot_id=_id),'[]'::JSONB),
        'history',COALESCE((SELECT jsonb_agg(to_jsonb(h) ORDER BY h.created_at) FROM public.status_history h WHERE h.entity_type='lots' AND h.entity_id=_id),'[]'::JSONB)
      ) INTO _related;
    END IF;
  END IF;
  RETURN _public||jsonb_build_object('authorized',_allowed,'details',CASE WHEN _allowed THEN _details ELSE NULL END,'related',CASE WHEN _allowed THEN _related ELSE NULL END);
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_trace(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_authorized_trace(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_trace(TEXT) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_authorized_trace(TEXT) TO authenticated;

-- ---------------------------------------------------------
-- Storage privado padronizado
-- ---------------------------------------------------------
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('private-documents','private-documents',FALSE,15728640,ARRAY[
  'application/pdf','image/jpeg','image/png','image/webp','text/csv',
  'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
]) ON CONFLICT(id) DO UPDATE SET public=FALSE,file_size_limit=EXCLUDED.file_size_limit,allowed_mime_types=EXCLUDED.allowed_mime_types;
UPDATE storage.buckets SET public=FALSE WHERE id IN ('battery-files','workflow-documents','private-documents');

CREATE TABLE IF NOT EXISTS public.private_documents(
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  entity_type TEXT NOT NULL CHECK(entity_type IN ('organization','battery','collection','lot','operation')),
  entity_id UUID NOT NULL,
  document_type TEXT NOT NULL,
  bucket_id TEXT NOT NULL DEFAULT 'private-documents',
  storage_path TEXT NOT NULL UNIQUE,
  original_name TEXT NOT NULL,
  extension TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL CHECK(size_bytes>0 AND size_bytes<=15728640),
  uploaded_by UUID NOT NULL REFERENCES auth.users(id),
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'uploading' CHECK(status IN ('uploading','pendente','validado','rejeitado','excluido')),
  validated_by UUID REFERENCES auth.users(id),
  validated_at TIMESTAMPTZ,
  validation_notes TEXT,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES auth.users(id),
  deletion_reason TEXT
);
CREATE INDEX IF NOT EXISTS private_documents_entity_idx ON public.private_documents(entity_type,entity_id);
CREATE INDEX IF NOT EXISTS private_documents_org_idx ON public.private_documents(organization_id);
CREATE INDEX IF NOT EXISTS private_documents_status_idx ON public.private_documents(status);
ALTER TABLE public.private_documents ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.private_documents TO authenticated;

ALTER TABLE public.battery_files
  ADD COLUMN IF NOT EXISTS bucket_id TEXT NOT NULL DEFAULT 'battery-files',
  ADD COLUMN IF NOT EXISTS private_document_id UUID REFERENCES public.private_documents(id),
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS bucket_id TEXT NOT NULL DEFAULT 'workflow-documents',
  ADD COLUMN IF NOT EXISTS private_document_id UUID REFERENCES public.private_documents(id),
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
CREATE UNIQUE INDEX IF NOT EXISTS battery_files_private_doc_uidx ON public.battery_files(private_document_id) WHERE private_document_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS documents_private_doc_uidx ON public.documents(private_document_id) WHERE private_document_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.can_access_private_document(_document_id UUID,_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.private_documents d WHERE d.id=_document_id AND d.deleted_at IS NULL AND d.status<>'excluido' AND (
      d.uploaded_by=_user_id OR public.has_role(_user_id,'admin') OR public.has_role(_user_id,'operador')
      OR public.is_org_member(d.organization_id,_user_id)
      OR EXISTS(SELECT 1 FROM public.companies c WHERE c.id=d.organization_id AND c.owner_id=_user_id)
      OR (d.entity_type='battery' AND public.can_view_battery_private(d.entity_id,_user_id))
      OR (d.entity_type='collection' AND EXISTS(SELECT 1 FROM public.collections c WHERE c.id=d.entity_id AND (
        c.transportadora_id=_user_id OR public.is_org_member(c.generator_organization_id,_user_id)
        OR public.is_org_member(c.operator_organization_id,_user_id) OR public.is_org_member(c.carrier_organization_id,_user_id)
        OR public.is_org_member(c.recycler_organization_id,_user_id))))
      OR (d.entity_type='lot' AND EXISTS(SELECT 1 FROM public.lots l WHERE l.id=d.entity_id AND (
        public.is_org_member(l.operator_organization_id,_user_id)
        OR EXISTS(SELECT 1 FROM public.proposals p WHERE p.lot_id=l.id AND p.status='aceita' AND (p.reciclador_id=_user_id OR public.is_org_member(p.recycler_organization_id,_user_id))))))
      OR (d.entity_type='operation' AND EXISTS(SELECT 1 FROM public.operations o WHERE o.id=d.entity_id AND (
        public.is_org_member(o.generator_organization_id,_user_id) OR public.is_org_member(o.operator_organization_id,_user_id)
        OR public.is_org_member(o.carrier_organization_id,_user_id) OR public.is_org_member(o.recycler_organization_id,_user_id))))
    )
  )
$$;

CREATE OR REPLACE FUNCTION public.can_upload_private_entity(_entity_type TEXT,_entity_id UUID,_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT public.has_role(_user_id,'admin') OR public.has_role(_user_id,'operador')
    OR (_entity_type='organization' AND EXISTS(SELECT 1 FROM public.companies c WHERE c.id=_entity_id AND (c.owner_id=_user_id OR public.is_org_member(c.id,_user_id))))
    OR (_entity_type='battery' AND public.can_view_battery_private(_entity_id,_user_id))
    OR (_entity_type='collection' AND EXISTS(SELECT 1 FROM public.collections c WHERE c.id=_entity_id AND (c.transportadora_id=_user_id OR public.is_org_member(c.generator_organization_id,_user_id) OR public.is_org_member(c.operator_organization_id,_user_id) OR public.is_org_member(c.carrier_organization_id,_user_id) OR public.is_org_member(c.recycler_organization_id,_user_id))))
    OR (_entity_type='lot' AND EXISTS(SELECT 1 FROM public.lots l WHERE l.id=_entity_id AND (public.is_org_member(l.operator_organization_id,_user_id) OR EXISTS(SELECT 1 FROM public.proposals p WHERE p.lot_id=l.id AND p.status='aceita' AND (p.reciclador_id=_user_id OR public.is_org_member(p.recycler_organization_id,_user_id))))))
    OR (_entity_type='operation' AND EXISTS(SELECT 1 FROM public.operations o WHERE o.id=_entity_id AND (public.is_org_member(o.operator_organization_id,_user_id) OR public.is_org_member(o.carrier_organization_id,_user_id) OR public.is_org_member(o.recycler_organization_id,_user_id))))
$$;

CREATE OR REPLACE FUNCTION public.prepare_private_document_upload(
  _entity_type TEXT,_entity_id UUID,_document_type TEXT,_file_name TEXT,_mime_type TEXT,_size_bytes BIGINT
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,storage AS $$
DECLARE _org UUID; _id UUID:=gen_random_uuid(); _ext TEXT; _safe TEXT; _path TEXT;
BEGIN
  IF NOT public.can_upload_private_entity(_entity_type,_entity_id,auth.uid()) THEN RAISE EXCEPTION 'Sem permissão para anexar nesta entidade'; END IF;
  IF _size_bytes<=0 OR _size_bytes>15728640 THEN RAISE EXCEPTION 'Arquivo deve ter no máximo 15 MB'; END IF;
  _ext:=lower(regexp_replace(_file_name,'.*\.','','g'));
  IF _ext NOT IN ('pdf','jpg','jpeg','png','webp','csv','doc','docx','xls','xlsx') THEN RAISE EXCEPTION 'Extensão não permitida'; END IF;
  IF _mime_type NOT IN ('application/pdf','image/jpeg','image/png','image/webp','text/csv','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') THEN RAISE EXCEPTION 'Tipo de arquivo não permitido'; END IF;
  IF _entity_type='organization' THEN
    _org:=_entity_id;
  ELSIF _entity_type='battery' THEN
    SELECT COALESCE(generator_organization_id,company_id) INTO _org FROM public.batteries WHERE id=_entity_id;
  ELSIF _entity_type='collection' THEN
    SELECT x.org_id INTO _org FROM public.collections c
    CROSS JOIN LATERAL unnest(ARRAY[c.carrier_organization_id,c.operator_organization_id,c.generator_organization_id,c.recycler_organization_id]) x(org_id)
    WHERE c.id=_entity_id AND x.org_id IS NOT NULL AND public.is_org_member(x.org_id,auth.uid()) LIMIT 1;
  ELSIF _entity_type='lot' THEN
    SELECT l.operator_organization_id INTO _org FROM public.lots l
    WHERE l.id=_entity_id AND public.is_org_member(l.operator_organization_id,auth.uid());
    IF _org IS NULL THEN
      SELECT p.recycler_organization_id INTO _org FROM public.proposals p
      WHERE p.lot_id=_entity_id AND p.status='aceita' AND public.is_org_member(p.recycler_organization_id,auth.uid()) LIMIT 1;
    END IF;
  ELSIF _entity_type='operation' THEN
    SELECT x.org_id INTO _org FROM public.operations o
    CROSS JOIN LATERAL unnest(ARRAY[o.operator_organization_id,o.carrier_organization_id,o.recycler_organization_id,o.generator_organization_id]) x(org_id)
    WHERE o.id=_entity_id AND x.org_id IS NOT NULL AND public.is_org_member(x.org_id,auth.uid()) LIMIT 1;
  END IF;
  _org:=COALESCE(_org,public.current_actor_organization(NULL));
  IF _org IS NULL THEN RAISE EXCEPTION 'Organização do anexo não encontrada'; END IF;
  _safe:=regexp_replace(_file_name,'[^a-zA-Z0-9._-]','-','g');
  _path:=format('organizations/%s/%s/%s/%s/%s-%s',_org,_entity_type,_entity_id,regexp_replace(lower(_document_type),'[^a-z0-9_-]','-','g'),_id,_safe);
  INSERT INTO public.private_documents(id,organization_id,entity_type,entity_id,document_type,storage_path,original_name,extension,mime_type,size_bytes,uploaded_by)
  VALUES(_id,_org,_entity_type,_entity_id,_document_type,_path,_file_name,_ext,_mime_type,_size_bytes,auth.uid());
  RETURN jsonb_build_object('document_id',_id,'bucket','private-documents','path',_path,'max_size',15728640);
END;
$$;

CREATE OR REPLACE FUNCTION public.finalize_private_document_upload(_document_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,storage AS $$
DECLARE _d public.private_documents%ROWTYPE; _lot UUID; _battery UUID; _operation UUID;
BEGIN
  SELECT * INTO _d FROM public.private_documents WHERE id=_document_id AND uploaded_by=auth.uid() AND status='uploading' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Reserva de upload inválida'; END IF;
  IF NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id=_d.bucket_id AND name=_d.storage_path) THEN RAISE EXCEPTION 'Arquivo ainda não foi enviado'; END IF;
  UPDATE public.private_documents SET status='pendente' WHERE id=_document_id;
  IF _d.entity_type='battery' THEN _battery:=_d.entity_id;
  ELSIF _d.entity_type='lot' THEN _lot:=_d.entity_id;
  ELSIF _d.entity_type='operation' THEN _operation:=_d.entity_id; SELECT lot_id INTO _lot FROM public.operations WHERE id=_operation;
  ELSIF _d.entity_type='collection' THEN
    SELECT c.battery_id,c.lot_id INTO _battery,_lot FROM public.collections c WHERE c.id=_d.entity_id;
    SELECT id INTO _operation FROM public.operations WHERE lot_id=_lot ORDER BY created_at DESC LIMIT 1;
  END IF;
  INSERT INTO public.documents(operation_id,battery_id,lot_id,entity_type,entity_id,kind,tipo_documento,url,storage_path,bucket_id,uploaded_by,status,private_document_id)
  VALUES(_operation,_battery,_lot,_d.entity_type,_d.entity_id,_d.document_type,_d.document_type,_d.storage_path,_d.storage_path,_d.bucket_id,auth.uid(),'pendente',_d.id)
  ON CONFLICT(private_document_id) WHERE private_document_id IS NOT NULL DO NOTHING;
  IF _d.entity_type='battery' THEN
    INSERT INTO public.battery_files(battery_id,tipo,nome_arquivo,storage_path,bucket_id,uploaded_by,private_document_id)
    VALUES(_d.entity_id,_d.document_type,_d.original_name,_d.storage_path,_d.bucket_id,auth.uid(),_d.id)
    ON CONFLICT(private_document_id) WHERE private_document_id IS NOT NULL DO NOTHING;
  END IF;
  RETURN jsonb_build_object('id',_d.id,'status','pendente','bucket',_d.bucket_id,'path',_d.storage_path);
END;
$$;

CREATE OR REPLACE FUNCTION public.list_private_documents(_entity_type TEXT,_entity_id UUID)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
  RETURN COALESCE((SELECT jsonb_agg(jsonb_build_object(
    'id',d.id,'document_type',d.document_type,'original_name',d.original_name,
    'mime_type',d.mime_type,'size_bytes',d.size_bytes,'uploaded_at',d.uploaded_at,
    'uploaded_by',d.uploaded_by,'status',d.status,'validated_at',d.validated_at
  ) ORDER BY d.uploaded_at DESC) FROM public.private_documents d
  WHERE d.entity_type=_entity_type AND d.entity_id=_entity_id AND d.deleted_at IS NULL
    AND public.can_access_private_document(d.id,auth.uid())),'[]'::JSONB);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_private_document_access(_document_id UUID)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE _d public.private_documents%ROWTYPE;
BEGIN
  IF NOT public.can_access_private_document(_document_id,auth.uid()) THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  SELECT * INTO _d FROM public.private_documents WHERE id=_document_id AND deleted_at IS NULL;
  RETURN jsonb_build_object('id',_d.id,'bucket',_d.bucket_id,'path',_d.storage_path,'name',_d.original_name,'mime_type',_d.mime_type,'size_bytes',_d.size_bytes,'status',_d.status);
END;
$$;

-- Acesso uniforme para registros antigos e para documentos ligados ao novo
-- catálogo privado. O cliente recebe apenas bucket/caminho e cria URL assinada.
CREATE OR REPLACE FUNCTION public.get_workflow_document_access(_document_id UUID)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE _d public.documents%ROWTYPE; _allowed BOOLEAN:=FALSE;
BEGIN
  SELECT * INTO _d FROM public.documents WHERE id=_document_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Documento indisponível'; END IF;
  IF _d.private_document_id IS NOT NULL THEN
    RETURN public.get_private_document_access(_d.private_document_id);
  END IF;
  _allowed:=public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'operador') OR _d.uploaded_by=auth.uid()
    OR EXISTS(SELECT 1 FROM public.operations o WHERE o.id=_d.operation_id AND (
      public.is_org_member(o.operator_organization_id,auth.uid()) OR public.is_org_member(o.carrier_organization_id,auth.uid())
      OR public.is_org_member(o.recycler_organization_id,auth.uid())
      OR (public.is_org_member(o.generator_organization_id,auth.uid()) AND EXISTS(
        SELECT 1 FROM public.lot_batteries lb JOIN public.batteries b ON b.id=lb.battery_id
        WHERE lb.lot_id=o.lot_id AND b.status IN ('documentacao_pendente','concluida')))))
    OR (_d.battery_id IS NOT NULL AND public.can_view_battery_private(_d.battery_id,auth.uid()));
  IF NOT _allowed THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  RETURN jsonb_build_object('id',_d.id,'bucket',COALESCE(_d.bucket_id,'workflow-documents'),'path',_d.storage_path,'name',COALESCE(_d.numero_documento,_d.tipo_documento,_d.kind,'documento'),'mime_type',NULL,'size_bytes',NULL,'status',_d.status);
END;
$$;

CREATE OR REPLACE FUNCTION public.logical_delete_private_document(_document_id UUID,_reason TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _d public.private_documents%ROWTYPE;
BEGIN
  SELECT * INTO _d FROM public.private_documents WHERE id=_document_id FOR UPDATE;
  IF NOT FOUND OR NOT (_d.uploaded_by=auth.uid() OR public.has_role(auth.uid(),'admin')) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  IF COALESCE(trim(_reason),'')='' THEN RAISE EXCEPTION 'Justificativa obrigatória'; END IF;
  UPDATE public.private_documents SET status='excluido',deleted_at=now(),deleted_by=auth.uid(),deletion_reason=_reason WHERE id=_document_id;
  UPDATE public.documents SET deleted_at=now() WHERE private_document_id=_document_id;
  UPDATE public.battery_files SET deleted_at=now() WHERE private_document_id=_document_id;
  INSERT INTO public.audit_log(actor_id,action,entity_type,entity_id,payload)
  VALUES(auth.uid(),'document_logical_delete','private_documents',_document_id,jsonb_build_object('reason',_reason,'storage_path',_d.storage_path));
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_private_document(_document_id UUID,_approve BOOLEAN,_notes TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'operador')) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  IF COALESCE(trim(_notes),'')='' THEN RAISE EXCEPTION 'Parecer obrigatório'; END IF;
  UPDATE public.private_documents SET status=CASE WHEN _approve THEN 'validado' ELSE 'rejeitado' END,validated_by=auth.uid(),validated_at=now(),validation_notes=_notes WHERE id=_document_id AND deleted_at IS NULL;
  UPDATE public.documents SET status=CASE WHEN _approve THEN 'validado' ELSE 'rejeitado' END,validado_por=auth.uid(),validado_em=now(),observacoes=concat_ws(E'\n',observacoes,_notes) WHERE private_document_id=_document_id;
  INSERT INTO public.audit_log(actor_id,action,entity_type,entity_id,payload)
  VALUES(auth.uid(),'private_document_validation','private_documents',_document_id,jsonb_build_object('approved',_approve,'notes',_notes));
END;
$$;

DROP POLICY IF EXISTS "private documents metadata read" ON public.private_documents;
CREATE POLICY "private documents metadata read" ON public.private_documents FOR SELECT TO authenticated
  USING(public.can_access_private_document(id,auth.uid()));

DROP POLICY IF EXISTS "private documents reserved uploads" ON storage.objects;
CREATE POLICY "private documents reserved uploads" ON storage.objects FOR INSERT TO authenticated WITH CHECK(
  bucket_id='private-documents' AND EXISTS(SELECT 1 FROM public.private_documents d
    WHERE d.storage_path=storage.objects.name AND d.bucket_id=storage.objects.bucket_id
      AND d.uploaded_by=auth.uid() AND d.status='uploading')
);
DROP POLICY IF EXISTS "private documents authorized reads" ON storage.objects;
CREATE POLICY "private documents authorized reads" ON storage.objects FOR SELECT TO authenticated USING(
  bucket_id='private-documents' AND EXISTS(SELECT 1 FROM public.private_documents d
    WHERE d.storage_path=storage.objects.name AND d.bucket_id=storage.objects.bucket_id
      AND public.can_access_private_document(d.id,auth.uid()))
);

DROP POLICY IF EXISTS "generator deletes own battery files" ON storage.objects;

REVOKE ALL ON FUNCTION public.can_access_private_document(UUID,UUID) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.can_upload_private_entity(TEXT,UUID,UUID) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_private_document(UUID,UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_private_document_upload(TEXT,UUID,TEXT,TEXT,TEXT,BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_private_document_upload(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_private_documents(TEXT,UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_private_document_access(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_workflow_document_access(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.logical_delete_private_document(UUID,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_private_document(UUID,BOOLEAN,TEXT) TO authenticated;

-- O centro administrativo também passa a listar os novos metadados privados.
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
    WHEN 'private_documents' THEN SELECT COALESCE(jsonb_agg(to_jsonb(t)-'storage_path') ,'[]') INTO _result FROM (SELECT * FROM public.private_documents ORDER BY uploaded_at DESC LIMIT _limit) t;
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
