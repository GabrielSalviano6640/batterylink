
-- 1) Duplicate admin policy on audit_log
DROP POLICY IF EXISTS "Admin reads audit" ON public.audit_log;

-- 2) Incidents: restrict SELECT
DROP POLICY IF EXISTS "incidents read authenticated" ON public.incidents;
CREATE POLICY "incidents read involved" ON public.incidents
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR registrado_por = auth.uid()
    OR resolvido_por = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.batteries b
      WHERE b.id = incidents.battery_id
        AND (b.owner_id = auth.uid() OR (b.company_id IS NOT NULL AND public.is_org_member(b.company_id, auth.uid())))
    )
    OR EXISTS (
      SELECT 1 FROM public.collections c
      WHERE c.id = incidents.collection_id
        AND (c.transportadora_id = auth.uid()
          OR (c.generator_organization_id IS NOT NULL AND public.is_org_member(c.generator_organization_id, auth.uid()))
          OR (c.operator_organization_id IS NOT NULL AND public.is_org_member(c.operator_organization_id, auth.uid())))
    )
  );

-- 3) Status history: restrict SELECT to admins only (no ownership column reliably)
DROP POLICY IF EXISTS "sh read authenticated" ON public.status_history;
CREATE POLICY "sh read admin" ON public.status_history
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR alterado_por = auth.uid());

-- 4) Transportadoras: restrict lot visibility
DROP POLICY IF EXISTS "Transportadoras read shippable lots" ON public.lots;
CREATE POLICY "Transportadoras read assigned lots" ON public.lots
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'transportadora'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.collections c
      WHERE c.lot_id = lots.id
        AND (c.transportadora_id = auth.uid() OR c.status = 'available'::collection_status)
    )
  );

-- 5) Lock down SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.tg_audit_create() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_audit_status() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_notify_registration() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_notify_proposal() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_notify_battery_status() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_protect_last_owner() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_company_add_owner_member() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_user(uuid, text, text, text) FROM PUBLIC, anon, authenticated;

-- Keep RPC-callable ones scoped to authenticated only (they perform internal auth checks)
REVOKE EXECUTE ON FUNCTION public.approve_registration(uuid, boolean, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.deliver_collection(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.finalize_battery(uuid, battery_status) FROM PUBLIC, anon;

-- RLS helper functions: needed by authenticated (used in policies)
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_org_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_org_member_role(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_manage_org(uuid, uuid) FROM PUBLIC, anon;
