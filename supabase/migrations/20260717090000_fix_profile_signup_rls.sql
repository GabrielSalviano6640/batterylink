-- Permite que o usuario autenticado crie o proprio perfil pendente apos signup.
-- Sem esta policy, o upsert em /auth falha com:
-- "new row violates row-level security policy for table profiles".

DROP POLICY IF EXISTS "Users insert own pending profile" ON public.profiles;
CREATE POLICY "Users insert own pending profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = id
  AND status = 'pending'::public.request_status
  AND COALESCE(is_demo, FALSE) = public.current_user_is_demo(auth.uid())
  AND suspended_at IS NULL
);
