import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Recuperar senha — BatteryLink Brasil" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPage,
});

function ResetPage() {
  const navigate = useNavigate();
  const [isRecovery, setIsRecovery] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash;
    if (hash.includes("type=recovery")) setIsRecovery(true);
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setIsRecovery(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const sendReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + "/reset-password",
    });
    setLoading(false);
    if (error) toast.error(error.message);
    else toast.success("Se o e-mail existir, enviamos um link.");
  };

  const updatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Senha atualizada.");
      navigate({ to: "/app" });
    }
  };

  return (
    <div className="min-h-screen bg-industrial flex flex-col">
      <SiteNav />
      <main className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-md bg-white/5 border border-white/10 rounded-lg p-8">
          <h1 className="text-2xl font-display font-bold mb-6">
            {isRecovery ? "Definir nova senha" : "Recuperar senha"}
          </h1>
          {isRecovery ? (
            <form onSubmit={updatePassword} className="space-y-3">
              <input
                required
                type="password"
                minLength={8}
                placeholder="Nova senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 bg-industrial border border-white/10 rounded-md text-sm"
              />
              <button
                disabled={loading}
                className="w-full px-4 py-2.5 rounded-md bg-brand text-industrial font-semibold text-sm disabled:opacity-50"
              >
                Atualizar senha
              </button>
            </form>
          ) : (
            <form onSubmit={sendReset} className="space-y-3">
              <input
                required
                type="email"
                placeholder="E-mail"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 bg-industrial border border-white/10 rounded-md text-sm"
              />
              <button
                disabled={loading}
                className="w-full px-4 py-2.5 rounded-md bg-brand text-industrial font-semibold text-sm disabled:opacity-50"
              >
                Enviar link de recuperação
              </button>
            </form>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
