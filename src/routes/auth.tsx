import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { maskPhone } from "@/lib/masks";
import { translateAuthError } from "@/lib/auth-errors";

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>) => ({
    mode: search.mode === "signup" ? ("signup" as const) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Entrar — BatteryLink Brasil" },
      { name: "description", content: "Acesso à plataforma BatteryLink Brasil." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [mode, setMode] = useState<"signin" | "signup">(
    search.mode === "signup" ? "signup" : "signin",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptPriv, setAcceptPriv] = useState(false);
  const [acceptLgpd, setAcceptLgpd] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/app" });
    });
  }, [navigate]);

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        if (!acceptTerms || !acceptPriv || !acceptLgpd) {
          throw new Error(
            "É necessário aceitar os Termos, a Política de Privacidade e o tratamento de dados.",
          );
        }
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin + "/app",
            data: { full_name: fullName },
          },
        });
        if (error) throw error;
        // grava telefone e aceites no profile assim que a sessão existir
        const uid = data.user?.id;
        if (uid) {
          const now = new Date().toISOString();
          await supabase
            .from("profiles")
            .update({
              phone,
              full_name: fullName,
              aceite_termos_at: now,
              aceite_privacidade_at: now,
              aceite_consentimento_at: now,
            })
            .eq("id", uid);
        }
        toast.success("Conta criada. Complete o cadastro da empresa para solicitar acesso.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Bem-vindo de volta.");
      }
      navigate({ to: "/app" });
    } catch (err) {
      toast.error(translateAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + "/app",
    });
    if (result.error) toast.error("Falha ao entrar com Google.");
  };

  return (
    <div className="min-h-screen bg-industrial flex flex-col">
      <SiteNav />
      <main className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-md bg-white/5 border border-white/10 rounded-lg p-8">
          <p className="font-mono text-xs text-brand tracking-widest uppercase mb-2">
            {mode === "signin" ? "Entrar" : "Criar conta"}
          </p>
          <h1 className="text-2xl font-display font-bold mb-6">
            {mode === "signin" ? "Acessar plataforma" : "Solicitar acesso"}
          </h1>

          <button
            onClick={handleGoogle}
            className="w-full mb-4 px-4 py-2.5 rounded-md bg-white text-slate-900 font-medium text-sm hover:bg-slate-100 transition"
          >
            Continuar com Google
          </button>

          <div className="flex items-center gap-3 my-4 text-xs text-slate-500">
            <div className="flex-1 h-px bg-white/10" /> ou{" "}
            <div className="flex-1 h-px bg-white/10" />
          </div>

          <form onSubmit={handleEmail} className="space-y-3">
            {mode === "signup" && (
              <>
                <label htmlFor="auth-name" className="block text-xs text-slate-300">
                  Nome completo
                </label>
                <input
                  id="auth-name"
                  required
                  type="text"
                  autoComplete="name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3 py-2 bg-industrial border border-white/10 rounded-md text-sm"
                />
                <label htmlFor="auth-phone" className="block text-xs text-slate-300">
                  Telefone
                </label>
                <input
                  id="auth-phone"
                  required
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={(e) => setPhone(maskPhone(e.target.value))}
                  className="w-full px-3 py-2 bg-industrial border border-white/10 rounded-md text-sm"
                />
              </>
            )}
            <label htmlFor="auth-email" className="block text-xs text-slate-300">
              E-mail corporativo
            </label>
            <input
              id="auth-email"
              required
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 bg-industrial border border-white/10 rounded-md text-sm"
            />
            <label htmlFor="auth-password" className="block text-xs text-slate-300">
              Senha
            </label>
            <input
              id="auth-password"
              required
              type="password"
              minLength={8}
              placeholder="Mínimo de 8 caracteres"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 bg-industrial border border-white/10 rounded-md text-sm"
            />

            {mode === "signup" && (
              <div className="space-y-2 pt-2 text-xs text-slate-300">
                <label className="flex gap-2 items-start cursor-pointer">
                  <input
                    aria-label="Aceitar Termos de Uso"
                    type="checkbox"
                    checked={acceptTerms}
                    onChange={(e) => setAcceptTerms(e.target.checked)}
                    className="mt-0.5 accent-brand"
                  />
                  <span>
                    Li e aceito os{" "}
                    <Link to="/termos" className="text-brand hover:underline">
                      Termos de Uso
                    </Link>
                    .
                  </span>
                </label>
                <label className="flex gap-2 items-start cursor-pointer">
                  <input
                    aria-label="Aceitar Política de Privacidade"
                    type="checkbox"
                    checked={acceptPriv}
                    onChange={(e) => setAcceptPriv(e.target.checked)}
                    className="mt-0.5 accent-brand"
                  />
                  <span>
                    Li e aceito a{" "}
                    <Link to="/privacidade" className="text-brand hover:underline">
                      Política de Privacidade
                    </Link>
                    .
                  </span>
                </label>
                <label className="flex gap-2 items-start cursor-pointer">
                  <input
                    aria-label="Autorizar tratamento de dados"
                    type="checkbox"
                    checked={acceptLgpd}
                    onChange={(e) => setAcceptLgpd(e.target.checked)}
                    className="mt-0.5 accent-brand"
                  />
                  <span>
                    Autorizo o tratamento dos meus dados conforme a LGPD para finalidades
                    operacionais da plataforma.
                  </span>
                </label>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full px-4 py-2.5 rounded-md bg-brand text-industrial font-semibold text-sm hover:brightness-110 transition disabled:opacity-50"
            >
              {loading ? "..." : mode === "signin" ? "Entrar" : "Criar conta"}
            </button>
          </form>

          <div className="mt-6 flex items-center justify-between text-xs text-slate-400">
            <button
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              className="hover:text-brand transition"
            >
              {mode === "signin" ? "Criar nova conta" : "Já tenho conta"}
            </button>
            <Link to="/reset-password" className="hover:text-brand transition">
              Esqueci a senha
            </Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
