-- P0: administrative profile fields are writable only through privileged RPCs.
-- Additive migration: do not rewrite already deployed migrations.
BEGIN;

REVOKE INSERT, UPDATE ON public.profiles FROM PUBLIC, anon, authenticated;
GRANT INSERT (id, email, full_name, nome, phone, telefone, cargo, avatar_url,
  timezone, aceite_termos_at, aceite_privacidade_at, aceite_consentimento_at)
  ON public.profiles TO authenticated;
GRANT UPDATE (id, full_name, nome, phone, telefone, cargo, avatar_url,
  timezone, aceite_termos_at, aceite_privacidade_at, aceite_consentimento_at)
  ON public.profiles TO authenticated;
-- Existing row policies still limit these safe columns to the user's own profile.
-- SECURITY DEFINER admin RPCs retain access to status/suspension/demo columns.

-- One authenticated, idempotent transaction completes the metadata captured at signup.
-- No user id, organization id or administrative state can be supplied by the caller.
CREATE OR REPLACE FUNCTION public.complete_signup_registration()
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _user auth.users%ROWTYPE;
  _meta JSONB;
  _role public.app_role;
  _company_id UUID;
  _document TEXT;
  _now TIMESTAMPTZ := now();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Autenticação obrigatória'; END IF;
  -- Serialize simultaneous callbacks/tabs for the same account.
  SELECT * INTO _user FROM auth.users WHERE id=_uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Usuário não encontrado'; END IF;
  IF _user.email_confirmed_at IS NULL THEN RETURN FALSE; END IF;
  IF EXISTS(SELECT 1 FROM public.registration_requests WHERE user_id=_uid)
    OR EXISTS(SELECT 1 FROM public.profiles WHERE id=_uid AND status<>'pending')
  THEN RETURN FALSE; END IF;

  _meta := COALESCE(_user.raw_user_meta_data,'{}'::JSONB);
  -- OAuth and historical accounts without complete signup metadata keep manual onboarding.
  IF COALESCE(_meta->>'requested_role','') NOT IN ('gerador','operador','transportadora','reciclador')
    OR COALESCE(_meta->>'accepted_terms','') <> 'true'
    OR COALESCE(_meta->>'accepted_privacy','') <> 'true'
    OR COALESCE(_meta->>'accepted_data_processing','') <> 'true'
  THEN RETURN FALSE; END IF;
  IF EXISTS(SELECT 1 FROM unnest(ARRAY['full_name','phone','company_name','cnpj_cpf',
      'tipo_organizacao','cargo','endereco','cidade','estado','cep']) AS field
      WHERE NULLIF(btrim(_meta->>field),'') IS NULL)
  THEN RAISE EXCEPTION 'Dados do cadastro incompletos'; END IF;
  _role := (_meta->>'requested_role')::public.app_role;
  _document := public.only_digits(_meta->>'cnpj_cpf');
  IF length(_document) NOT IN (11,14) OR length(public.only_digits(_meta->>'cep'))<>8
  THEN RAISE EXCEPTION 'Documento ou CEP inválido'; END IF;

  INSERT INTO public.profiles(id,email,full_name,phone,cargo,timezone,
    aceite_termos_at,aceite_privacidade_at,aceite_consentimento_at)
  VALUES(_uid,_user.email,_meta->>'full_name',_meta->>'phone',_meta->>'cargo',
    'America/Sao_Paulo',_now,_now,_now)
  ON CONFLICT(id) DO UPDATE SET
    full_name=EXCLUDED.full_name,phone=EXCLUDED.phone,cargo=EXCLUDED.cargo,
    aceite_termos_at=COALESCE(profiles.aceite_termos_at,EXCLUDED.aceite_termos_at),
    aceite_privacidade_at=COALESCE(profiles.aceite_privacidade_at,EXCLUDED.aceite_privacidade_at),
    aceite_consentimento_at=COALESCE(profiles.aceite_consentimento_at,EXCLUDED.aceite_consentimento_at);

  SELECT id INTO _company_id FROM public.companies
    WHERE owner_id=_uid AND public.only_digits(COALESCE(cnpj_cpf,cnpj))=_document;
  IF _company_id IS NULL THEN
    INSERT INTO public.companies(owner_id,razao_social,cnpj,cnpj_cpf,tipo,tipo_organizacao,
      email,telefone,cargo,cep,endereco,cidade,estado,status,status_aprovacao,is_demo)
    VALUES(_uid,_meta->>'company_name',_document,_document,_role,_meta->>'tipo_organizacao',
      _user.email,_meta->>'phone',_meta->>'cargo',public.only_digits(_meta->>'cep'),
      _meta->>'endereco',_meta->>'cidade',upper(_meta->>'estado'),
      'aguardando_aprovacao','aguardando_aprovacao',FALSE)
    RETURNING id INTO _company_id;
  END IF;

  INSERT INTO public.registration_requests(user_id,requested_role,company_data,status)
  VALUES(_uid,_role,jsonb_build_object('organization_id',_company_id,
    'razao_social',_meta->>'company_name','cnpj',_document,'cnpj_cpf',_document,
    'tipo_organizacao',_meta->>'tipo_organizacao','cargo',_meta->>'cargo',
    'endereco',_meta->>'endereco','cidade',_meta->>'cidade','estado',upper(_meta->>'estado'),
    'cep',public.only_digits(_meta->>'cep'),'telefone',_meta->>'phone','email',_user.email),'pending');
  RETURN TRUE;
END;
$$;
REVOKE ALL ON FUNCTION public.complete_signup_registration() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_signup_registration() TO authenticated;

COMMIT;
