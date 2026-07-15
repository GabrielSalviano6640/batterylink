-- SEED OPCIONAL EXCLUSIVO PARA DESENVOLVIMENTO
-- Execute manualmente em uma instância local/isolada:
--   SET app.environment = 'development';
--   \i supabase/seed.demo.sql
-- Senha local das cinco contas: BatteryLink-Demo-2026!

DO $$
DECLARE
  _environment TEXT:=current_setting('app.environment',TRUE);
  _password TEXT:='BatteryLink-Demo-2026!';
  _roles public.app_role[]:=ARRAY['gerador','operador','transportadora','reciclador','admin']::public.app_role[];
  _role public.app_role;
  _user_id UUID;
  _org_id UUID;
  _index INTEGER:=0;
  _email TEXT;
BEGIN
  IF _environment NOT IN ('development','local','test') THEN
    RAISE EXCEPTION 'Seed demonstrativo bloqueado: defina app.environment como development, local ou test em uma instância isolada.';
  END IF;

  FOREACH _role IN ARRAY _roles LOOP
    _index:=_index+1;
    _user_id:=uuid_generate_v5('6ba7b810-9dad-11d1-80b4-00c04fd430c8'::UUID,'batterylink-demo-'||_role::TEXT);
    _email:=_role::TEXT||'.demo@batterylink.local';

    INSERT INTO auth.users(
      instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,
      raw_app_meta_data,raw_user_meta_data,created_at,updated_at,
      confirmation_token,email_change,recovery_token
    ) VALUES(
      '00000000-0000-0000-0000-000000000000',_user_id,'authenticated','authenticated',_email,
      crypt(_password,gen_salt('bf')),now(),
      '{"provider":"email","providers":["email"]}'::JSONB,
      jsonb_build_object('full_name','Conta Demo '||initcap(_role::TEXT)),now(),now(),'','',''
    ) ON CONFLICT(id) DO UPDATE SET email=EXCLUDED.email,encrypted_password=EXCLUDED.encrypted_password,updated_at=now();

    UPDATE public.profiles SET
      email=_email,full_name='Conta Demo '||initcap(_role::TEXT),nome='Conta Demo '||initcap(_role::TEXT),
      status='approved',is_demo=TRUE,suspended_at=NULL,suspension_reason=NULL,
      timezone='America/Sao_Paulo'
    WHERE id=_user_id;

    INSERT INTO public.user_roles(user_id,role,is_demo)
    VALUES(_user_id,_role,TRUE) ON CONFLICT(user_id,role) DO UPDATE SET is_demo=TRUE;

    IF _role<>'admin' THEN
      _org_id:=uuid_generate_v5('6ba7b811-9dad-11d1-80b4-00c04fd430c8'::UUID,'batterylink-demo-org-'||_role::TEXT);
      INSERT INTO public.companies(
        id,owner_id,razao_social,nome_fantasia,cnpj,cnpj_cpf,tipo,tipo_organizacao,
        cidade,estado,status,status_aprovacao,aprovado_em,is_demo
      ) VALUES(
        _org_id,_user_id,'BatteryLink Demo '||initcap(_role::TEXT),'Demo '||initcap(_role::TEXT),
        lpad(_index::TEXT,2,'0')||'.000.000/0001-'||lpad((_index+10)::TEXT,2,'0'),
        lpad(_index::TEXT,2,'0')||'.000.000/0001-'||lpad((_index+10)::TEXT,2,'0'),
        _role,initcap(_role::TEXT),'São Paulo','SP','aprovada','aprovada',now(),TRUE
      ) ON CONFLICT(id) DO UPDATE SET is_demo=TRUE,status='aprovada',status_aprovacao='aprovada';
    END IF;
  END LOOP;
END $$;

