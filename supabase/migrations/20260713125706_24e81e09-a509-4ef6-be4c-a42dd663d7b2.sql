
-- Status enums
CREATE TYPE public.battery_status AS ENUM ('registered','triaging','classified','in_lot','collected','delivered','recycled','second_life','rejected');
CREATE TYPE public.battery_classification AS ENUM ('segunda_vida','reciclagem');
CREATE TYPE public.lot_status AS ENUM ('open','published','negotiating','awarded','shipped','closed');
CREATE TYPE public.lot_destination AS ENUM ('reciclagem','segunda_vida');
CREATE TYPE public.proposal_status AS ENUM ('submitted','accepted','rejected','withdrawn');
CREATE TYPE public.collection_status AS ENUM ('available','accepted','in_transit','delivered','cancelled');

-- Sequences for human-readable codes
CREATE SEQUENCE public.battery_code_seq;
CREATE SEQUENCE public.lot_code_seq;

CREATE OR REPLACE FUNCTION public.next_battery_code() RETURNS text LANGUAGE sql VOLATILE SET search_path = public AS $$
  SELECT 'BAT-' || to_char(now(),'YYYY') || '-' || lpad(nextval('public.battery_code_seq')::text,6,'0')
$$;
CREATE OR REPLACE FUNCTION public.next_lot_code() RETURNS text LANGUAGE sql VOLATILE SET search_path = public AS $$
  SELECT 'LOT-' || to_char(now(),'YYYY') || '-' || lpad(nextval('public.lot_code_seq')::text,6,'0')
$$;

-- BATTERIES
CREATE TABLE public.batteries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE DEFAULT public.next_battery_code(),
  owner_id uuid NOT NULL,
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  origem text NOT NULL,
  fabricante text,
  modelo text,
  quimica text NOT NULL,
  capacidade_kwh numeric,
  quantidade integer NOT NULL DEFAULT 1,
  peso_kg numeric,
  estado text NOT NULL,
  urgencia text NOT NULL,
  cep text,
  cidade text,
  uf text,
  endereco text,
  observacoes text,
  status public.battery_status NOT NULL DEFAULT 'registered',
  classificacao public.battery_classification,
  diagnostico jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.batteries TO authenticated;
GRANT ALL ON public.batteries TO service_role;
ALTER TABLE public.batteries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner reads own batteries" ON public.batteries FOR SELECT TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "Owner inserts own batteries" ON public.batteries FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id AND public.has_role(auth.uid(),'gerador'));
CREATE POLICY "Owner updates own batteries in early status" ON public.batteries FOR UPDATE TO authenticated USING (auth.uid() = owner_id AND status IN ('registered')) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Operadores read all batteries" ON public.batteries FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'operador') OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Operadores update batteries" ON public.batteries FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'operador') OR public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_batteries_updated_at BEFORE UPDATE ON public.batteries FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- BATTERY EVENTS
CREATE TABLE public.battery_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  battery_id uuid NOT NULL REFERENCES public.batteries(id) ON DELETE CASCADE,
  actor_id uuid,
  event_type text NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.battery_events TO authenticated;
GRANT ALL ON public.battery_events TO service_role;
ALTER TABLE public.battery_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read events for visible batteries" ON public.battery_events FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.batteries b WHERE b.id = battery_id AND (b.owner_id = auth.uid() OR public.has_role(auth.uid(),'operador') OR public.has_role(auth.uid(),'admin')))
);
CREATE POLICY "Insert events by involved users" ON public.battery_events FOR INSERT TO authenticated WITH CHECK (
  actor_id = auth.uid() AND EXISTS (SELECT 1 FROM public.batteries b WHERE b.id = battery_id AND (b.owner_id = auth.uid() OR public.has_role(auth.uid(),'operador') OR public.has_role(auth.uid(),'admin')))
);

-- LOTS
CREATE TABLE public.lots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE DEFAULT public.next_lot_code(),
  operador_id uuid NOT NULL,
  destino public.lot_destination NOT NULL,
  status public.lot_status NOT NULL DEFAULT 'open',
  titulo text NOT NULL,
  descricao text,
  cidade text,
  uf text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lots TO authenticated;
GRANT ALL ON public.lots TO service_role;
ALTER TABLE public.lots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Operadores manage lots" ON public.lots FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'operador') OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'operador') OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Recicladores read published lots" ON public.lots FOR SELECT TO authenticated USING (
  status IN ('published','negotiating','awarded') AND public.has_role(auth.uid(),'reciclador')
);
CREATE POLICY "Transportadoras read shippable lots" ON public.lots FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(),'transportadora')
);
CREATE TRIGGER trg_lots_updated_at BEFORE UPDATE ON public.lots FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- LOT_BATTERIES
CREATE TABLE public.lot_batteries (
  lot_id uuid NOT NULL REFERENCES public.lots(id) ON DELETE CASCADE,
  battery_id uuid NOT NULL REFERENCES public.batteries(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (lot_id, battery_id),
  UNIQUE (battery_id)
);
GRANT SELECT, INSERT, DELETE ON public.lot_batteries TO authenticated;
GRANT ALL ON public.lot_batteries TO service_role;
ALTER TABLE public.lot_batteries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Operadores manage lot_batteries" ON public.lot_batteries FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'operador') OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'operador') OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Read lot_batteries for visible lots" ON public.lot_batteries FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.lots l WHERE l.id = lot_id AND (
    public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'operador')
    OR (public.has_role(auth.uid(),'reciclador') AND l.status IN ('published','negotiating','awarded'))
    OR public.has_role(auth.uid(),'transportadora')
  ))
);

-- PROPOSALS
CREATE TABLE public.proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lot_id uuid NOT NULL REFERENCES public.lots(id) ON DELETE CASCADE,
  reciclador_id uuid NOT NULL,
  valor_total numeric NOT NULL,
  condicoes text,
  status public.proposal_status NOT NULL DEFAULT 'submitted',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.proposals TO authenticated;
GRANT ALL ON public.proposals TO service_role;
ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Reciclador manages own proposals" ON public.proposals FOR ALL TO authenticated
  USING (auth.uid() = reciclador_id AND public.has_role(auth.uid(),'reciclador'))
  WITH CHECK (auth.uid() = reciclador_id AND public.has_role(auth.uid(),'reciclador'));
CREATE POLICY "Operadores read all proposals" ON public.proposals FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(),'operador') OR public.has_role(auth.uid(),'admin')
);
CREATE POLICY "Operadores update proposals" ON public.proposals FOR UPDATE TO authenticated USING (
  public.has_role(auth.uid(),'operador') OR public.has_role(auth.uid(),'admin')
);
CREATE TRIGGER trg_proposals_updated_at BEFORE UPDATE ON public.proposals FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- COLLECTIONS
CREATE TABLE public.collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lot_id uuid NOT NULL REFERENCES public.lots(id) ON DELETE CASCADE,
  transportadora_id uuid,
  origem_endereco text NOT NULL,
  destino_endereco text NOT NULL,
  status public.collection_status NOT NULL DEFAULT 'available',
  scheduled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.collections TO authenticated;
GRANT ALL ON public.collections TO service_role;
ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Operadores manage collections" ON public.collections FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'operador') OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'operador') OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Transportadoras read available or own" ON public.collections FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(),'transportadora') AND (status = 'available' OR transportadora_id = auth.uid())
);
CREATE POLICY "Transportadoras claim/update own collections" ON public.collections FOR UPDATE TO authenticated USING (
  public.has_role(auth.uid(),'transportadora') AND (status = 'available' OR transportadora_id = auth.uid())
) WITH CHECK (
  public.has_role(auth.uid(),'transportadora') AND (transportadora_id = auth.uid())
);
CREATE TRIGGER trg_collections_updated_at BEFORE UPDATE ON public.collections FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- DOCUMENTS
CREATE TABLE public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  kind text NOT NULL,
  url text NOT NULL,
  uploaded_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.documents TO authenticated;
GRANT ALL ON public.documents TO service_role;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Uploader reads own docs" ON public.documents FOR SELECT TO authenticated USING (uploaded_by = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'operador'));
CREATE POLICY "Users insert own docs" ON public.documents FOR INSERT TO authenticated WITH CHECK (uploaded_by = auth.uid());

-- AUDIT LOG
CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  entity_type text NOT NULL,
  entity_id uuid,
  action text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin reads audit" ON public.audit_log FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Any authenticated inserts audit" ON public.audit_log FOR INSERT TO authenticated WITH CHECK (actor_id = auth.uid());
