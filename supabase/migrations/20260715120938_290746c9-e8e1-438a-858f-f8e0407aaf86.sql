
-- =========================================================
-- FASE 3 — Extensões e novas tabelas
-- =========================================================

-- ---------- PROFILES ----------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- ---------- COMPANIES (organizações) ----------
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS nome_fantasia TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS telefone TEXT,
  ADD COLUMN IF NOT EXISTS numero TEXT,
  ADD COLUMN IF NOT EXISTS complemento TEXT,
  ADD COLUMN IF NOT EXISTS aprovado_por UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS aprovado_em TIMESTAMPTZ;

-- ---------- BATTERIES ----------
ALTER TABLE public.batteries
  ADD COLUMN IF NOT EXISTS qr_code_data TEXT,
  ADD COLUMN IF NOT EXISTS numero_serie TEXT,
  ADD COLUMN IF NOT EXISTS tensao NUMERIC,
  ADD COLUMN IF NOT EXISTS soh_percentual NUMERIC,
  ADD COLUMN IF NOT EXISTS possui_vazamento BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS possui_avaria BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS possui_risco_termico BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS idx_batteries_company ON public.batteries(company_id);
CREATE INDEX IF NOT EXISTS idx_batteries_status ON public.batteries(status);

-- ---------- COLLECTIONS ----------
ALTER TABLE public.collections
  ADD COLUMN IF NOT EXISTS codigo_coleta TEXT,
  ADD COLUMN IF NOT EXISTS battery_id UUID REFERENCES public.batteries(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS generator_organization_id UUID REFERENCES public.companies(id),
  ADD COLUMN IF NOT EXISTS operator_organization_id UUID REFERENCES public.companies(id),
  ADD COLUMN IF NOT EXISTS data_solicitacao TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS data_agendada TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS data_coleta TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS data_entrega TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS motorista TEXT,
  ADD COLUMN IF NOT EXISTS veiculo TEXT,
  ADD COLUMN IF NOT EXISTS placa TEXT,
  ADD COLUMN IF NOT EXISTS observacoes TEXT;

-- ---------- LOTS ----------
ALTER TABLE public.lots
  ADD COLUMN IF NOT EXISTS quimica_predominante TEXT,
  ADD COLUMN IF NOT EXISTS quantidade_baterias INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS peso_total_kg NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS capacidade_total_kwh NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS soh_medio NUMERIC,
  ADD COLUMN IF NOT EXISTS classificacao TEXT,
  ADD COLUMN IF NOT EXISTS data_abertura_propostas TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS data_encerramento_propostas TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

-- ---------- PROPOSALS ----------
ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS modelo_comercial TEXT,
  ADD COLUMN IF NOT EXISTS moeda TEXT DEFAULT 'BRL',
  ADD COLUMN IF NOT EXISTS prazo_retirada_dias INTEGER,
  ADD COLUMN IF NOT EXISTS validade_proposta TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS destinacao_proposta TEXT,
  ADD COLUMN IF NOT EXISTS condicoes TEXT,
  ADD COLUMN IF NOT EXISTS submitted_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ DEFAULT now();

-- ---------- DOCUMENTS ----------
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS operation_id UUID,
  ADD COLUMN IF NOT EXISTS battery_id UUID REFERENCES public.batteries(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS lot_id UUID REFERENCES public.lots(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tipo_documento TEXT,
  ADD COLUMN IF NOT EXISTS numero_documento TEXT,
  ADD COLUMN IF NOT EXISTS emissor TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pendente',
  ADD COLUMN IF NOT EXISTS data_emissao DATE,
  ADD COLUMN IF NOT EXISTS data_validade DATE,
  ADD COLUMN IF NOT EXISTS validado_por UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS validado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS observacoes TEXT;

-- ---------- NOTIFICATIONS ----------
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.companies(id),
  ADD COLUMN IF NOT EXISTS tipo TEXT DEFAULT 'info',
  ADD COLUMN IF NOT EXISTS entity_type TEXT,
  ADD COLUMN IF NOT EXISTS entity_id UUID;

-- =========================================================
-- NOVAS TABELAS
-- =========================================================

-- ---------- organization_documents ----------
CREATE TABLE IF NOT EXISTS public.organization_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  tipo_documento TEXT NOT NULL,
  numero TEXT,
  arquivo_url TEXT,
  validade DATE,
  status_validacao TEXT NOT NULL DEFAULT 'pendente',
  validado_por UUID REFERENCES auth.users(id),
  validado_em TIMESTAMPTZ,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_documents TO authenticated;
GRANT ALL ON public.organization_documents TO service_role;
ALTER TABLE public.organization_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members read docs" ON public.organization_documents FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "org managers write docs" ON public.organization_documents FOR ALL TO authenticated
  USING (public.can_manage_org(organization_id, auth.uid()))
  WITH CHECK (public.can_manage_org(organization_id, auth.uid()));
CREATE POLICY "admin validates docs" ON public.organization_documents FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE INDEX IF NOT EXISTS idx_orgdocs_org ON public.organization_documents(organization_id);

-- ---------- battery_files ----------
CREATE TABLE IF NOT EXISTS public.battery_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  battery_id UUID NOT NULL REFERENCES public.batteries(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  nome_arquivo TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.battery_files TO authenticated;
GRANT ALL ON public.battery_files TO service_role;
ALTER TABLE public.battery_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "battery files read" ON public.battery_files FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin')
    OR EXISTS (
      SELECT 1 FROM public.batteries b
      WHERE b.id = battery_id
        AND (b.owner_id = auth.uid() OR (b.company_id IS NOT NULL AND public.is_org_member(b.company_id, auth.uid())))
    )
  );
CREATE POLICY "battery files write" ON public.battery_files FOR INSERT TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.batteries b
      WHERE b.id = battery_id
        AND (b.owner_id = auth.uid() OR (b.company_id IS NOT NULL AND public.is_org_member(b.company_id, auth.uid())))
    )
  );
CREATE POLICY "battery files delete" ON public.battery_files FOR DELETE TO authenticated
  USING (uploaded_by = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE INDEX IF NOT EXISTS idx_batteryfiles_battery ON public.battery_files(battery_id);

-- ---------- sorting_diagnostics ----------
CREATE TABLE IF NOT EXISTS public.sorting_diagnostics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  battery_id UUID NOT NULL REFERENCES public.batteries(id) ON DELETE CASCADE,
  operator_organization_id UUID NOT NULL REFERENCES public.companies(id),
  responsavel_tecnico TEXT,
  data_diagnostico TIMESTAMPTZ NOT NULL DEFAULT now(),
  tensao_medida NUMERIC,
  capacidade_medida_kwh NUMERIC,
  soh_percentual NUMERIC,
  temperatura NUMERIC,
  integridade_estrutural TEXT,
  risco_identificado TEXT,
  classificacao TEXT NOT NULL DEFAULT 'aguardando_analise',
  recomendacao_destino TEXT,
  observacoes TEXT,
  status_validacao TEXT NOT NULL DEFAULT 'pendente',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sorting_diagnostics TO authenticated;
GRANT ALL ON public.sorting_diagnostics TO service_role;
ALTER TABLE public.sorting_diagnostics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sd read" ON public.sorting_diagnostics FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin')
    OR public.is_org_member(operator_organization_id, auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.batteries b
      WHERE b.id = battery_id
        AND (b.owner_id = auth.uid() OR (b.company_id IS NOT NULL AND public.is_org_member(b.company_id, auth.uid())))
    )
  );
CREATE POLICY "sd write operator" ON public.sorting_diagnostics FOR ALL TO authenticated
  USING (public.can_manage_org(operator_organization_id, auth.uid()))
  WITH CHECK (public.can_manage_org(operator_organization_id, auth.uid()));
CREATE INDEX IF NOT EXISTS idx_sd_battery ON public.sorting_diagnostics(battery_id);
CREATE INDEX IF NOT EXISTS idx_sd_operator ON public.sorting_diagnostics(operator_organization_id);
CREATE TRIGGER trg_sd_updated BEFORE UPDATE ON public.sorting_diagnostics
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ---------- operations ----------
CREATE TABLE IF NOT EXISTS public.operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lot_id UUID NOT NULL REFERENCES public.lots(id) ON DELETE CASCADE,
  proposal_id UUID NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  generator_organization_id UUID REFERENCES public.companies(id),
  operator_organization_id UUID REFERENCES public.companies(id),
  carrier_organization_id UUID REFERENCES public.companies(id),
  recycler_organization_id UUID REFERENCES public.companies(id),
  modelo_comercial TEXT,
  valor_operacao NUMERIC,
  taxa_plataforma NUMERIC,
  status TEXT NOT NULL DEFAULT 'em_andamento',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.operations TO authenticated;
GRANT ALL ON public.operations TO service_role;
ALTER TABLE public.operations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ops parties read" ON public.operations FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin')
    OR (generator_organization_id IS NOT NULL AND public.is_org_member(generator_organization_id, auth.uid()))
    OR (operator_organization_id  IS NOT NULL AND public.is_org_member(operator_organization_id,  auth.uid()))
    OR (carrier_organization_id   IS NOT NULL AND public.is_org_member(carrier_organization_id,   auth.uid()))
    OR (recycler_organization_id  IS NOT NULL AND public.is_org_member(recycler_organization_id,  auth.uid()))
  );
CREATE POLICY "ops admin write" ON public.operations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE INDEX IF NOT EXISTS idx_ops_lot ON public.operations(lot_id);
CREATE TRIGGER trg_ops_updated BEFORE UPDATE ON public.operations
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- backfill FK for documents.operation_id
ALTER TABLE public.documents
  ADD CONSTRAINT documents_operation_fk FOREIGN KEY (operation_id) REFERENCES public.operations(id) ON DELETE SET NULL;

-- ---------- status_history ----------
CREATE TABLE IF NOT EXISTS public.status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  status_anterior TEXT,
  status_novo TEXT NOT NULL,
  alterado_por UUID REFERENCES auth.users(id),
  organization_id UUID REFERENCES public.companies(id),
  justificativa TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.status_history TO authenticated;
GRANT ALL ON public.status_history TO service_role;
ALTER TABLE public.status_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sh read authenticated" ON public.status_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "sh insert self" ON public.status_history FOR INSERT TO authenticated
  WITH CHECK (alterado_por = auth.uid() OR alterado_por IS NULL);
CREATE INDEX IF NOT EXISTS idx_sh_entity ON public.status_history(entity_type, entity_id);

-- ---------- incidents ----------
CREATE TABLE IF NOT EXISTS public.incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  battery_id UUID REFERENCES public.batteries(id) ON DELETE SET NULL,
  collection_id UUID REFERENCES public.collections(id) ON DELETE SET NULL,
  operation_id UUID REFERENCES public.operations(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL,
  gravidade TEXT NOT NULL DEFAULT 'media',
  descricao TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'aberto',
  registrado_por UUID REFERENCES auth.users(id),
  resolvido_por UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE ON public.incidents TO authenticated;
GRANT ALL ON public.incidents TO service_role;
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "incidents read authenticated" ON public.incidents FOR SELECT TO authenticated USING (true);
CREATE POLICY "incidents insert self" ON public.incidents FOR INSERT TO authenticated
  WITH CHECK (registrado_por = auth.uid());
CREATE POLICY "incidents update admin" ON public.incidents FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR registrado_por = auth.uid())
  WITH CHECK (public.has_role(auth.uid(),'admin') OR registrado_por = auth.uid());
CREATE INDEX IF NOT EXISTS idx_incidents_battery ON public.incidents(battery_id);
