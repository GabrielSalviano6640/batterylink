-- =========================================================
-- FASE 6 — painel real e seguro do gerador
-- =========================================================

-- O gerador usa as funções sanitizadas abaixo. A leitura direta de operations
-- fica restrita às partes executoras para não expor proposta, preço ou CNPJ da
-- recicladora por meio das colunas internas da operação.
DROP POLICY IF EXISTS "ops parties read" ON public.operations;
CREATE POLICY "ops executing parties read" ON public.operations
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(),'admin')
    OR (operator_organization_id IS NOT NULL AND public.is_org_member(operator_organization_id,auth.uid()))
    OR (carrier_organization_id IS NOT NULL AND public.is_org_member(carrier_organization_id,auth.uid()))
    OR (recycler_organization_id IS NOT NULL AND public.is_org_member(recycler_organization_id,auth.uid()))
  );

-- Arquivos e fotos enviados pelo gerador ficam em bucket privado.
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES (
  'battery-files','battery-files',FALSE,15728640,
  ARRAY['application/pdf','image/jpeg','image/png','image/webp','text/plain']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "generator uploads battery files" ON storage.objects;
CREATE POLICY "generator uploads battery files" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id='battery-files'
    AND (storage.foldername(name))[1]=auth.uid()::TEXT
    AND EXISTS (
      SELECT 1 FROM public.batteries b
      WHERE b.owner_id=auth.uid()
        AND b.id::TEXT=(storage.foldername(name))[2]
    )
  );

DROP POLICY IF EXISTS "generator reads battery files" ON storage.objects;
CREATE POLICY "generator reads battery files" ON storage.objects
  FOR SELECT TO authenticated USING (
    bucket_id='battery-files'
    AND EXISTS (
      SELECT 1
      FROM public.battery_files bf
      JOIN public.batteries b ON b.id=bf.battery_id
      WHERE bf.storage_path=storage.objects.name
        AND (b.owner_id=auth.uid()
          OR (b.company_id IS NOT NULL AND public.is_org_member(b.company_id,auth.uid())))
    )
  );

DROP POLICY IF EXISTS "generator deletes own battery files" ON storage.objects;
CREATE POLICY "generator deletes own battery files" ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id='battery-files'
    AND EXISTS (
      SELECT 1
      FROM public.battery_files bf
      JOIN public.batteries b ON b.id=bf.battery_id
      WHERE bf.storage_path=storage.objects.name
        AND b.owner_id=auth.uid()
        AND bf.uploaded_by=auth.uid()
    )
  );

-- Documentos finais podem ser baixados pelo dono da bateria, mas a tabela
-- documents continua sem SELECT para o gerador para não expor emissor,
-- usuário de upload ou vínculos comerciais.
DROP POLICY IF EXISTS "generator reads final workflow files" ON storage.objects;
CREATE POLICY "generator reads final workflow files" ON storage.objects
  FOR SELECT TO authenticated USING (
    bucket_id='workflow-documents'
    AND EXISTS (
      SELECT 1
      FROM public.documents d
      JOIN public.operations o ON o.id=d.operation_id
      JOIN public.lot_batteries lb ON lb.lot_id=o.lot_id
      JOIN public.batteries b ON b.id=lb.battery_id
      WHERE d.storage_path=storage.objects.name
        AND b.owner_id=auth.uid()
        AND b.status IN ('documentacao_pendente','concluida')
    )
  );

-- Retorna somente informações operacionais necessárias ao gerador.
-- Não retorna proposal_id, valores, modelo comercial, nomes, usuários ou
-- organizações de recicladoras e transportadoras.
CREATE OR REPLACE FUNCTION public.get_generator_battery_context(_battery_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _battery public.batteries%ROWTYPE;
  _destination_released BOOLEAN;
  _documents_released BOOLEAN;
BEGIN
  SELECT * INTO _battery
  FROM public.batteries
  WHERE id=_battery_id;

  IF NOT FOUND OR NOT (
    _battery.owner_id=auth.uid()
    OR (_battery.company_id IS NOT NULL AND public.is_org_member(_battery.company_id,auth.uid()))
  ) THEN
    RAISE EXCEPTION 'Bateria não encontrada ou acesso não autorizado';
  END IF;

  _destination_released := _battery.status IN (
    'destinacao_definida','enviada_ao_destinador','recebida_pelo_destinador',
    'documentacao_pendente','concluida'
  );
  _documents_released := _battery.status IN ('documentacao_pendente','concluida');

  RETURN jsonb_build_object(
    'collections', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', c.id,
        'code', c.codigo_coleta,
        'kind', CASE WHEN c.battery_id=_battery_id THEN 'triagem' ELSE 'destinacao' END,
        'status', c.status,
        'requested_at', c.data_solicitacao,
        'scheduled_at', COALESCE(c.data_agendada,c.scheduled_at),
        'collected_at', c.data_coleta,
        'delivered_at', c.data_entrega,
        'origin', CASE WHEN c.battery_id=_battery_id THEN c.origem_endereco ELSE NULL END,
        'destination', CASE WHEN c.battery_id=_battery_id THEN c.destino_endereco ELSE 'Destinador autorizado' END,
        'vehicle', c.veiculo,
        'plate', c.placa,
        'driver', c.motorista
      ) ORDER BY c.created_at DESC)
      FROM public.collections c
      WHERE c.battery_id=_battery_id
        OR (_destination_released AND c.lot_id IN (
          SELECT lb.lot_id FROM public.lot_batteries lb WHERE lb.battery_id=_battery_id
        ))
    ), '[]'::JSONB),
    'diagnostic', (
      SELECT jsonb_build_object(
        'date', sd.data_diagnostico,
        'voltage', sd.tensao_medida,
        'capacity_kwh', sd.capacidade_medida_kwh,
        'soh', sd.soh_percentual,
        'temperature', sd.temperatura,
        'structural_integrity', sd.integridade_estrutural,
        'risk', sd.risco_identificado,
        'classification', sd.classificacao,
        'recommendation', sd.recomendacao_destino,
        'notes', sd.observacoes,
        'validation_status', sd.status_validacao
      )
      FROM public.sorting_diagnostics sd
      WHERE sd.battery_id=_battery_id
        AND sd.status_validacao IN ('validado','aprovado')
      ORDER BY sd.data_diagnostico DESC
      LIMIT 1
    ),
    'destination', CASE WHEN _destination_released THEN (
      SELECT jsonb_build_object(
        'lot_code', l.code,
        'lot_status', l.status,
        'destination_type', l.destino,
        'city', l.cidade,
        'state', l.uf,
        'operation_status', o.status,
        'defined_at', o.created_at
      )
      FROM public.lot_batteries lb
      JOIN public.lots l ON l.id=lb.lot_id
      LEFT JOIN LATERAL (
        SELECT op.status, op.created_at
        FROM public.operations op
        WHERE op.lot_id=l.id
        ORDER BY op.created_at DESC
        LIMIT 1
      ) o ON TRUE
      WHERE lb.battery_id=_battery_id
      ORDER BY l.created_at DESC
      LIMIT 1
    ) ELSE NULL END,
    'documents', CASE WHEN _documents_released THEN COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', d.id,
        'type', COALESCE(d.tipo_documento,d.kind),
        'number', d.numero_documento,
        'status', d.status,
        'issued_at', d.data_emissao,
        'valid_until', d.data_validade,
        'validated_at', d.validado_em,
        'created_at', d.created_at,
        'storage_path', d.storage_path
      ) ORDER BY d.created_at DESC)
      FROM public.documents d
      WHERE d.battery_id=_battery_id
        OR d.lot_id IN (
          SELECT lb.lot_id FROM public.lot_batteries lb WHERE lb.battery_id=_battery_id
        )
        OR d.operation_id IN (
          SELECT o.id
          FROM public.operations o
          JOIN public.lot_batteries lb ON lb.lot_id=o.lot_id
          WHERE lb.battery_id=_battery_id
        )
    ), '[]'::JSONB) ELSE '[]'::JSONB END,
    'privacy', jsonb_build_object(
      'commercial_data_hidden', TRUE,
      'message', 'Identidades, propostas e valores de recicladoras não são exibidos neste painel.'
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_generator_dashboard_summary()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH owned_batteries AS (
    SELECT b.*
    FROM public.batteries b
    WHERE b.owner_id=auth.uid()
      OR (b.company_id IS NOT NULL AND public.is_org_member(b.company_id,auth.uid()))
  ), owned_lots AS (
    SELECT DISTINCT lb.lot_id
    FROM public.lot_batteries lb
    JOIN owned_batteries b ON b.id=lb.battery_id
  )
  SELECT jsonb_build_object(
    'total_batteries', (SELECT count(*) FROM owned_batteries),
    'open_requests', (SELECT count(*) FROM owned_batteries WHERE status IN (
      'cadastrada','aguardando_analise','informacoes_solicitadas','aprovada_para_coleta'
    )),
    'scheduled_collections', (SELECT count(*) FROM owned_batteries WHERE status='coleta_agendada'),
    'in_triage', (SELECT count(*) FROM owned_batteries WHERE status IN ('recebida_na_triagem','em_diagnostico')),
    'completed_operations', (
      SELECT count(DISTINCT o.id) FROM public.operations o
      JOIN owned_lots l ON l.lot_id=o.lot_id
      WHERE o.status='concluida'
    ),
    'pending_documents', (
      SELECT count(DISTINCT d.id)
      FROM public.documents d
      LEFT JOIN public.operations o ON o.id=d.operation_id
      WHERE COALESCE(d.status,'pendente')='pendente'
        AND (
          d.battery_id IN (SELECT id FROM owned_batteries)
          OR d.lot_id IN (SELECT lot_id FROM owned_lots)
          OR o.lot_id IN (SELECT lot_id FROM owned_lots)
        )
    ),
    'estimated_mass_kg', COALESCE((
      SELECT sum(COALESCE(peso_kg,0)*quantidade) FROM owned_batteries WHERE status='concluida'
    ),0),
    'estimated_capacity_kwh', COALESCE((
      SELECT sum(COALESCE(capacidade_kwh,0)*quantidade) FROM owned_batteries WHERE status='concluida'
    ),0)
  );
$$;

REVOKE ALL ON FUNCTION public.get_generator_battery_context(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_generator_battery_context(UUID) TO authenticated;
REVOKE ALL ON FUNCTION public.get_generator_dashboard_summary() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_generator_dashboard_summary() TO authenticated;
