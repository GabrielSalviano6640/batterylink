
-- Block UPDATE/DELETE on audit_log via RLS (only INSERT via SECURITY DEFINER triggers)
DROP POLICY IF EXISTS "Admins read audit" ON public.audit_log;
DROP POLICY IF EXISTS "No update audit" ON public.audit_log;
DROP POLICY IF EXISTS "No delete audit" ON public.audit_log;

CREATE POLICY "Admins read audit" ON public.audit_log
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Absence of INSERT/UPDATE/DELETE policies for authenticated = denied (immutable from client).

CREATE INDEX IF NOT EXISTS audit_log_created_idx ON public.audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_entity_idx ON public.audit_log(entity_type, entity_id);

-- Generic status-change audit trigger
CREATE OR REPLACE FUNCTION public.tg_audit_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _entity TEXT := TG_TABLE_NAME;
  _entity_id UUID;
  _old_status TEXT;
  _new_status TEXT;
BEGIN
  _entity_id := (row_to_json(NEW)->>'id')::UUID;
  _old_status := row_to_json(OLD)->>'status';
  _new_status := row_to_json(NEW)->>'status';
  IF _old_status IS DISTINCT FROM _new_status THEN
    INSERT INTO public.audit_log(actor_id, entity_type, entity_id, action, payload)
    VALUES (
      auth.uid(),
      _entity,
      _entity_id,
      'status_change',
      jsonb_build_object('from', _old_status, 'to', _new_status)
    );
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.tg_audit_status() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_audit_batteries ON public.batteries;
CREATE TRIGGER trg_audit_batteries AFTER UPDATE ON public.batteries
FOR EACH ROW EXECUTE FUNCTION public.tg_audit_status();

DROP TRIGGER IF EXISTS trg_audit_lots ON public.lots;
CREATE TRIGGER trg_audit_lots AFTER UPDATE ON public.lots
FOR EACH ROW EXECUTE FUNCTION public.tg_audit_status();

DROP TRIGGER IF EXISTS trg_audit_proposals ON public.proposals;
CREATE TRIGGER trg_audit_proposals AFTER UPDATE ON public.proposals
FOR EACH ROW EXECUTE FUNCTION public.tg_audit_status();

DROP TRIGGER IF EXISTS trg_audit_collections ON public.collections;
CREATE TRIGGER trg_audit_collections AFTER UPDATE ON public.collections
FOR EACH ROW EXECUTE FUNCTION public.tg_audit_status();

-- Audit trigger for INSERT (creation)
CREATE OR REPLACE FUNCTION public.tg_audit_create()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _entity_id UUID := (row_to_json(NEW)->>'id')::UUID;
BEGIN
  INSERT INTO public.audit_log(actor_id, entity_type, entity_id, action, payload)
  VALUES (auth.uid(), TG_TABLE_NAME, _entity_id, 'created', '{}'::jsonb);
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.tg_audit_create() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_audit_create_batteries ON public.batteries;
CREATE TRIGGER trg_audit_create_batteries AFTER INSERT ON public.batteries
FOR EACH ROW EXECUTE FUNCTION public.tg_audit_create();

DROP TRIGGER IF EXISTS trg_audit_create_lots ON public.lots;
CREATE TRIGGER trg_audit_create_lots AFTER INSERT ON public.lots
FOR EACH ROW EXECUTE FUNCTION public.tg_audit_create();

DROP TRIGGER IF EXISTS trg_audit_create_proposals ON public.proposals;
CREATE TRIGGER trg_audit_create_proposals AFTER INSERT ON public.proposals
FOR EACH ROW EXECUTE FUNCTION public.tg_audit_create();
