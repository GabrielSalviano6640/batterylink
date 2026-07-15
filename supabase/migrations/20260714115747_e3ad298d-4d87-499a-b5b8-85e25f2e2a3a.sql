
-- Enum de papéis dentro da organização
DO $$ BEGIN
  CREATE TYPE public.org_member_role AS ENUM ('proprietario','gestor','operador','tecnico','financeiro','visualizador');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Tabela de vínculos usuário <-> organização
CREATE TABLE IF NOT EXISTS public.org_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.org_member_role NOT NULL DEFAULT 'visualizador',
  invited_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, user_id)
);

CREATE INDEX IF NOT EXISTS org_members_user_idx ON public.org_members(user_id);
CREATE INDEX IF NOT EXISTS org_members_org_idx ON public.org_members(org_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_members TO authenticated;
GRANT ALL ON public.org_members TO service_role;

ALTER TABLE public.org_members ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS org_members_updated_at ON public.org_members;
CREATE TRIGGER org_members_updated_at BEFORE UPDATE ON public.org_members
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Backfill: dono atual de cada empresa vira proprietário
INSERT INTO public.org_members (org_id, user_id, role)
SELECT c.id, c.owner_id, 'proprietario'::public.org_member_role
FROM public.companies c
ON CONFLICT (org_id, user_id) DO NOTHING;

-- ============================================================
-- Funções auxiliares (SECURITY DEFINER — evita recursão de RLS)
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_org_member(_org_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.org_members
    WHERE org_id = _org_id AND user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.get_org_member_role(_org_id UUID, _user_id UUID)
RETURNS public.org_member_role
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT role FROM public.org_members
   WHERE org_id = _org_id AND user_id = _user_id
   LIMIT 1;
$$;

-- Pode administrar (proprietário/gestor) ou é admin global
CREATE OR REPLACE FUNCTION public.can_manage_org(_org_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin')
      OR EXISTS (
        SELECT 1 FROM public.org_members
        WHERE org_id = _org_id AND user_id = _user_id
          AND role IN ('proprietario','gestor')
      );
$$;

-- ============================================================
-- Políticas RLS de org_members
-- ============================================================
DROP POLICY IF EXISTS "Members read org members" ON public.org_members;
CREATE POLICY "Members read org members" ON public.org_members
  FOR SELECT TO authenticated
  USING (
    public.is_org_member(org_id, auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

DROP POLICY IF EXISTS "Managers insert org members" ON public.org_members;
CREATE POLICY "Managers insert org members" ON public.org_members
  FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_org(org_id, auth.uid()));

DROP POLICY IF EXISTS "Managers update org members" ON public.org_members;
CREATE POLICY "Managers update org members" ON public.org_members
  FOR UPDATE TO authenticated
  USING (public.can_manage_org(org_id, auth.uid()))
  WITH CHECK (public.can_manage_org(org_id, auth.uid()));

-- Membro pode remover a si mesmo; gestores podem remover qualquer membro (menos o último proprietário)
DROP POLICY IF EXISTS "Managers or self delete org members" ON public.org_members;
CREATE POLICY "Managers or self delete org members" ON public.org_members
  FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR public.can_manage_org(org_id, auth.uid())
  );

-- Impede excluir o último proprietário da empresa
CREATE OR REPLACE FUNCTION public.tg_protect_last_owner()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _remaining INT;
BEGIN
  IF (TG_OP = 'DELETE' AND OLD.role = 'proprietario')
     OR (TG_OP = 'UPDATE' AND OLD.role = 'proprietario' AND NEW.role <> 'proprietario') THEN
    SELECT COUNT(*) INTO _remaining
      FROM public.org_members
     WHERE org_id = OLD.org_id AND role = 'proprietario' AND id <> OLD.id;
    IF _remaining = 0 THEN
      RAISE EXCEPTION 'Não é possível remover o último proprietário da organização';
    END IF;
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DROP TRIGGER IF EXISTS org_members_protect_last_owner ON public.org_members;
CREATE TRIGGER org_members_protect_last_owner
  BEFORE UPDATE OR DELETE ON public.org_members
  FOR EACH ROW EXECUTE FUNCTION public.tg_protect_last_owner();

-- ============================================================
-- Amplia visibilidade da tabela companies para todos os membros
-- (antes só o owner_id via "Owner manages company")
-- ============================================================
DROP POLICY IF EXISTS "Members read company" ON public.companies;
CREATE POLICY "Members read company" ON public.companies
  FOR SELECT TO authenticated
  USING (
    auth.uid() = owner_id
    OR public.is_org_member(id, auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

DROP POLICY IF EXISTS "Managers update company" ON public.companies;
CREATE POLICY "Managers update company" ON public.companies
  FOR UPDATE TO authenticated
  USING (public.can_manage_org(id, auth.uid()))
  WITH CHECK (public.can_manage_org(id, auth.uid()));

-- Ao criar uma nova empresa, adiciona o dono como proprietário automaticamente
CREATE OR REPLACE FUNCTION public.tg_company_add_owner_member()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.org_members (org_id, user_id, role)
    VALUES (NEW.id, NEW.owner_id, 'proprietario')
    ON CONFLICT (org_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS companies_add_owner_member ON public.companies;
CREATE TRIGGER companies_add_owner_member
  AFTER INSERT ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.tg_company_add_owner_member();
