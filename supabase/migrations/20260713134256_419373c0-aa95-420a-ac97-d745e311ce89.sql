
-- Add SELECT visibility for reciclador and transportadora on batteries belonging to lots they can see/act on
CREATE POLICY "Reciclador reads batteries in visible lots" ON public.batteries FOR SELECT TO authenticated
USING (
  has_role(auth.uid(),'reciclador') AND EXISTS (
    SELECT 1 FROM public.lot_batteries lb JOIN public.lots l ON l.id=lb.lot_id
    WHERE lb.battery_id = batteries.id
      AND l.status IN ('published','negotiating','awarded','shipped','closed')
  )
);

CREATE POLICY "Transportadora reads batteries in accepted collections" ON public.batteries FOR SELECT TO authenticated
USING (
  has_role(auth.uid(),'transportadora') AND EXISTS (
    SELECT 1 FROM public.lot_batteries lb
    JOIN public.collections c ON c.lot_id = lb.lot_id
    WHERE lb.battery_id = batteries.id AND (c.transportadora_id = auth.uid() OR c.status='available')
  )
);

-- SECURITY DEFINER: transportadora marks a collection as delivered (cascades battery + lot status)
CREATE OR REPLACE FUNCTION public.deliver_collection(_collection_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _c collections%ROWTYPE;
BEGIN
  SELECT * INTO _c FROM collections WHERE id=_collection_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Collection not found'; END IF;
  IF _c.transportadora_id <> auth.uid() AND NOT has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF _c.status <> 'in_transit' THEN
    RAISE EXCEPTION 'Collection must be in_transit to be delivered';
  END IF;
  UPDATE collections SET status='delivered' WHERE id=_collection_id;
  UPDATE batteries SET status='delivered'
    WHERE id IN (SELECT battery_id FROM lot_batteries WHERE lot_id=_c.lot_id);
  UPDATE lots SET status='shipped' WHERE id=_c.lot_id;
END;
$$;

REVOKE ALL ON FUNCTION public.deliver_collection(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.deliver_collection(uuid) TO authenticated;

-- SECURITY DEFINER: reciclador finalizes a battery (recycled / second_life) — only for lots they won
CREATE OR REPLACE FUNCTION public.finalize_battery(_battery_id uuid, _final battery_status)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _lot_id uuid;
  _owns boolean;
  _remaining int;
BEGIN
  IF _final NOT IN ('recycled','second_life') THEN
    RAISE EXCEPTION 'Invalid final status';
  END IF;
  SELECT lb.lot_id INTO _lot_id FROM lot_batteries lb WHERE lb.battery_id=_battery_id LIMIT 1;
  IF _lot_id IS NULL THEN RAISE EXCEPTION 'Battery not in a lot'; END IF;

  SELECT EXISTS (
    SELECT 1 FROM proposals p WHERE p.lot_id=_lot_id AND p.reciclador_id=auth.uid() AND p.status='accepted'
  ) INTO _owns;
  IF NOT _owns AND NOT has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'Not authorized to finalize this battery';
  END IF;

  UPDATE batteries SET status=_final WHERE id=_battery_id AND status='delivered';
  IF NOT FOUND THEN RAISE EXCEPTION 'Battery must be delivered before finalization'; END IF;

  -- close lot when all batteries reached a terminal state
  SELECT COUNT(*) INTO _remaining
    FROM lot_batteries lb JOIN batteries b ON b.id=lb.battery_id
    WHERE lb.lot_id=_lot_id AND b.status NOT IN ('recycled','second_life');
  IF _remaining = 0 THEN
    UPDATE lots SET status='closed' WHERE id=_lot_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_battery(uuid, battery_status) FROM public;
GRANT EXECUTE ON FUNCTION public.finalize_battery(uuid, battery_status) TO authenticated;
