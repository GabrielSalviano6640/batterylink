
-- Organization status enum
DO $$ BEGIN
  CREATE TYPE public.org_status AS ENUM ('cadastro_incompleto','aguardando_aprovacao','em_analise','aprovada','suspensa','rejeitada');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Companies extended fields
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS cargo TEXT,
  ADD COLUMN IF NOT EXISTS tipo_organizacao TEXT,
  ADD COLUMN IF NOT EXISTS endereco TEXT,
  ADD COLUMN IF NOT EXISTS cep TEXT,
  ADD COLUMN IF NOT EXISTS status public.org_status NOT NULL DEFAULT 'aguardando_aprovacao',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS companies_updated_at ON public.companies;
CREATE TRIGGER companies_updated_at BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Profiles: cargo + consent timestamps
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cargo TEXT,
  ADD COLUMN IF NOT EXISTS aceite_termos_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS aceite_privacidade_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS aceite_consentimento_at TIMESTAMPTZ;

-- Extend approve_registration to also set the company status
CREATE OR REPLACE FUNCTION public.approve_registration(_request_id uuid, _approve boolean, _notes text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _req public.registration_requests%ROWTYPE;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'Only admins can approve registrations';
  END IF;

  SELECT * INTO _req FROM public.registration_requests WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;

  IF _approve THEN
    INSERT INTO public.user_roles(user_id, role) VALUES (_req.user_id, _req.requested_role)
      ON CONFLICT (user_id, role) DO NOTHING;
    UPDATE public.profiles SET status = 'approved' WHERE id = _req.user_id;
    UPDATE public.companies SET status = 'aprovada' WHERE owner_id = _req.user_id;
    UPDATE public.registration_requests SET status='approved', reviewed_at=now(), reviewed_by=auth.uid(), admin_notes=_notes WHERE id=_request_id;
  ELSE
    UPDATE public.profiles SET status = 'rejected' WHERE id = _req.user_id;
    UPDATE public.companies SET status = 'rejeitada' WHERE owner_id = _req.user_id;
    UPDATE public.registration_requests SET status='rejected', reviewed_at=now(), reviewed_by=auth.uid(), admin_notes=_notes WHERE id=_request_id;
  END IF;
END;
$function$;
