
-- Notifications
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_created_idx ON public.notifications(user_id, created_at DESC);

GRANT SELECT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own notifications" ON public.notifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users update own notifications" ON public.notifications
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own notifications" ON public.notifications
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
-- Only service_role / triggers insert (definer functions run as owner).

-- Helper to insert (SECURITY DEFINER bypasses RLS insert restriction)
CREATE OR REPLACE FUNCTION public.notify_user(_user_id UUID, _title TEXT, _body TEXT, _link TEXT DEFAULT NULL)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.notifications(user_id, title, body, link) VALUES (_user_id, _title, _body, _link);
$$;

-- Trigger: notify when registration_request status changes
CREATE OR REPLACE FUNCTION public.tg_notify_registration()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status <> OLD.status THEN
    IF NEW.status = 'approved' THEN
      PERFORM public.notify_user(NEW.user_id, 'Acesso aprovado', 'Sua solicitação de acesso foi aprovada.', '/app');
    ELSIF NEW.status = 'rejected' THEN
      PERFORM public.notify_user(NEW.user_id, 'Acesso recusado', COALESCE(NEW.admin_notes, 'Sua solicitação foi recusada.'), '/app');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_notify_registration
AFTER UPDATE ON public.registration_requests
FOR EACH ROW EXECUTE FUNCTION public.tg_notify_registration();

-- Trigger: notify reciclador on proposal status change
CREATE OR REPLACE FUNCTION public.tg_notify_proposal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _lot_code TEXT;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status <> OLD.status THEN
    SELECT code INTO _lot_code FROM public.lots WHERE id = NEW.lot_id;
    IF NEW.status = 'accepted' THEN
      PERFORM public.notify_user(NEW.reciclador_id, 'Proposta aceita', 'Sua proposta para o lote ' || COALESCE(_lot_code,'') || ' foi aceita.', '/app');
    ELSIF NEW.status = 'rejected' THEN
      PERFORM public.notify_user(NEW.reciclador_id, 'Proposta recusada', 'Sua proposta para o lote ' || COALESCE(_lot_code,'') || ' foi recusada.', '/app');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_notify_proposal
AFTER UPDATE ON public.proposals
FOR EACH ROW EXECUTE FUNCTION public.tg_notify_proposal();

-- Trigger: notify gerador when battery reaches delivered / recycled / second_life
CREATE OR REPLACE FUNCTION public.tg_notify_battery_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status <> OLD.status THEN
    IF NEW.status IN ('delivered','recycled','second_life') THEN
      PERFORM public.notify_user(
        NEW.owner_id,
        'Bateria ' || NEW.code || ' — ' || NEW.status::text,
        'Status atualizado. Certificado de destinação disponível.',
        '/app'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_notify_battery_status
AFTER UPDATE ON public.batteries
FOR EACH ROW EXECUTE FUNCTION public.tg_notify_battery_status();
