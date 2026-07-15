import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: AuthenticatedRoute,
});

function AuthenticatedRoute() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (error || !data.user) {
          if (mounted) navigate({ to: "/auth" });
          return;
        }
      } catch (error) {
        console.error(error);
        if (mounted) navigate({ to: "/auth" });
        return;
      }

      if (mounted) setLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-industrial px-6 py-24 flex items-center justify-center">
        <div className="text-center text-sm text-slate-400">Carregando autenticação...</div>
      </div>
    );
  }

  return <Outlet />;
}
