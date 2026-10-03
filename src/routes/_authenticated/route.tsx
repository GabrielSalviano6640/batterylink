import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { workflowRpc } from "@/lib/workflow";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: AuthenticatedRoute,
});

function AuthenticatedRoute() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let mounted = true;
    setFailure(null);
    setLoading(true);

    (async () => {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (error || !data.user) {
          if (mounted) navigate({ to: "/auth", search: { mode: undefined } });
          return;
        }
        await workflowRpc("complete_signup_registration", {});
      } catch (error) {
        console.error(error);
        if (mounted) {
          setFailure(
            "Não foi possível concluir seu cadastro. Seus dados foram preservados; tente novamente.",
          );
          setLoading(false);
        }
        return;
      }

      if (mounted) setLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, [navigate, attempt]);

  if (failure) {
    return (
      <div className="min-h-screen bg-industrial px-6 py-24">
        <p role="alert">{failure}</p>
        <button onClick={() => setAttempt((value) => value + 1)}>Tentar novamente</button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-industrial px-6 py-24 flex items-center justify-center">
        <div className="text-center text-sm text-slate-400">Carregando autenticação...</div>
      </div>
    );
  }

  return <Outlet />;
}
