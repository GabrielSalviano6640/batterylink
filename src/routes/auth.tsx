import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import {
  maskPhone,
  maskCEP,
  maskCPFOrCNPJ,
  onlyDigits,
  isValidCEP,
  isValidCPFOrCNPJ,
  isValidPhone,
  isValidUF,
  BRAZILIAN_UFS,
} from "@/lib/masks";
import { translateAuthError } from "@/lib/auth-errors";
import type { AppRole } from "@/hooks/use-auth";

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
  const [companyName, setCompanyName] = useState("");
  const [cnpjCpf, setCnpjCpf] = useState("");
  const [cargo, setCargo] = useState("");
  const [organizationType, setOrganizationType] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [stateValue, setStateValue] = useState("");
  const [cep, setCep] = useState("");
  const [requestedRole, setRequestedRole] = useState<AppRole>("gerador");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptPriv, setAcceptPriv] = useState(false);
  const [acceptLgpd, setAcceptLgpd] = useState(false);
  const [loading, setLoading] = useState(false);

  const roleOptions: { id: AppRole; label: string; desc: string }[] = [
    {
      id: "gerador",
      label: "Gerador",
      desc: "Cadastre baterias e solicite coleta de forma rastreada.",
    },
    {
      id: "operador",
      label: "Operador de triagem",
      desc: "Registre diagnósticos, classificações e lotes.",
    },
    {
      id: "transportadora",
      label: "Transportadora",
      desc: "Gerencie coletas e entregas em trânsito.",
    },
    {
      id: "reciclador",
      label: "Recicladora / segunda vida",
      desc: "Envie propostas e registre destinações técnicas.",
    },
  ];

  const organizationOptions = [
    "Indústria / Montadora",
    "Frota / Locadora",
    "Distribuidora / Varejo",
    "Cooperativa / Coletor",
    "Operador de triagem",
    "Recicladora",
    "Segunda vida / Reuso",
    "Transportadora especializada",
    "Órgão público",
    "Outro",
  ];

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
        if (!fullName.trim()) {
          throw new Error("Informe o nome completo.");
        }
        if (!isValidPhone(phone)) {
          throw new Error("Informe um telefone válido com DDD.");
        }
        if (!companyName.trim()) {
          throw new Error("Informe o nome da empresa.");
        }
        if (!isValidCPFOrCNPJ(cnpjCpf)) {
          throw new Error("Informe um CPF ou CNPJ válido.");
        }
        if (!cargo.trim()) {
          throw new Error("Informe seu cargo na empresa.");
        }
        if (!organizationType.trim()) {
          throw new Error("Informe o tipo de organização.");
        }
        if (!address.trim()) {
          throw new Error("Informe o endereço.");
        }
        if (!city.trim()) {
          throw new Error("Informe a cidade.");
        }
        if (!isValidUF(stateValue)) {
          throw new Error("Informe uma UF válida.");
        }
        if (!isValidCEP(cep)) {
          throw new Error("Informe um CEP válido com oito dígitos.");
        }

        const cleanedCnpjCpf = onlyDigits(cnpjCpf);
        const cleanedCep = onlyDigits(cep);
        const now = new Date().toISOString();

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin + "/auth?mode=signin",
            data: {
              full_name: fullName,
              phone,
              company_name: companyName,
              cnpj_cpf: cleanedCnpjCpf,
              requested_role: requestedRole,
              tipo_organizacao: organizationType,
              cargo,
              endereco: address,
              cidade: city,
              estado: stateValue,
              cep: cleanedCep,
            },
          },
        });

        if (error) throw error;

        const uid = data.user?.id ?? data.session?.user?.id;
        if (uid && data.session?.user) {
          await supabase.from("profiles").upsert(
            {
              id: uid,
              full_name: fullName,
              phone,
              cargo,
              status: "pending",
              aceite_termos_at: now,
              aceite_privacidade_at: now,
              aceite_consentimento_at: now,
              timezone: "America/Sao_Paulo",
            },
            { onConflict: "id" },
          );

          await supabase.from("companies").upsert(
            {
              owner_id: uid,
              razao_social: companyName,
              cnpj_cpf: cleanedCnpjCpf,
              tipo_organizacao: organizationType,
              email,
              telefone: phone,
              cep: cleanedCep,
              endereco: address,
              cidade: city,
              estado: stateValue,
              tipo: requestedRole,
              status: "aguardando_aprovacao",
              status_aprovacao: "aguardando_aprovacao",
              is_demo: false,
            },
            { onConflict: "owner_id,cnpj" },
          );

          await supabase.from("registration_requests").insert({
            user_id: uid,
            requested_role: requestedRole,
            company_data: {
              razao_social: companyName,
              cnpj_cpf: cleanedCnpjCpf,
              tipo_organizacao: organizationType,
              cargo,
              endereco: address,
              cidade: city,
              estado: stateValue,
              cep: cleanedCep,
              telefone: phone,
            },
            status: "pending",
          });
        }

        if (data.session?.user) {
          toast.success("Conta criada. Acesso pendente de aprovação.");
          navigate({ to: "/app" });
        } else {
          toast.success("Conta criada. Verifique seu e-mail para ativar o acesso antes de entrar.");
          navigate({ to: "/auth", search: { mode: undefined } });
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Bem-vindo de volta.");
        navigate({ to: "/app" });
      }
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
        <div className="w-full max-w-2xl bg-white/5 border border-white/10 rounded-lg p-8">
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

          <form onSubmit={handleEmail} className="space-y-4">
            {mode === "signup" && (
              <div className="grid gap-4">
                <div>
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
                </div>
                <div>
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
                </div>
                <div>
                  <label htmlFor="auth-company" className="block text-xs text-slate-300">
                    Nome da empresa
                  </label>
                  <input
                    id="auth-company"
                    required
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="w-full px-3 py-2 bg-industrial border border-white/10 rounded-md text-sm"
                  />
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <label className="block text-xs text-slate-300">
                    CNPJ ou CPF
                    <input
                      id="auth-cnpj"
                      required
                      type="text"
                      inputMode="numeric"
                      value={cnpjCpf}
                      onChange={(e) => setCnpjCpf(maskCPFOrCNPJ(e.target.value))}
                      className="mt-2 w-full px-3 py-2 bg-industrial border border-white/10 rounded-md text-sm"
                    />
                  </label>
                  <label className="block text-xs text-slate-300">
                    Cargo
                    <input
                      id="auth-role"
                      required
                      type="text"
                      value={cargo}
                      onChange={(e) => setCargo(e.target.value)}
                      className="mt-2 w-full px-3 py-2 bg-industrial border border-white/10 rounded-md text-sm"
                    />
                  </label>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <label className="block text-xs text-slate-300">
                    Tipo de organização
                    <select
                      required
                      value={organizationType}
                      onChange={(e) => setOrganizationType(e.target.value)}
                      className="mt-2 w-full px-3 py-2 bg-industrial border border-white/10 rounded-md text-sm"
                    >
                      <option value="">Selecione</option>
                      {organizationOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-xs text-slate-300">
                    Perfil solicitado
                    <select
                      required
                      value={requestedRole}
                      onChange={(e) => setRequestedRole(e.target.value as AppRole)}
                      className="mt-2 w-full px-3 py-2 bg-industrial border border-white/10 rounded-md text-sm"
                    >
                      {roleOptions.map((role) => (
                        <option key={role.id} value={role.id}>
                          {role.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div>
                  <label htmlFor="auth-address" className="block text-xs text-slate-300">
                    Endereço
                  </label>
                  <input
                    id="auth-address"
                    required
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full px-3 py-2 bg-industrial border border-white/10 rounded-md text-sm"
                  />
                </div>
                <div className="grid md:grid-cols-3 gap-4">
                  <label className="block text-xs text-slate-300">
                    Cidade
                    <input
                      required
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="mt-2 w-full px-3 py-2 bg-industrial border border-white/10 rounded-md text-sm"
                    />
                  </label>
                  <label className="block text-xs text-slate-300">
                    Estado (UF)
                    <select
                      required
                      value={stateValue}
                      onChange={(e) => setStateValue(e.target.value)}
                      className="mt-2 w-full px-3 py-2 bg-industrial border border-white/10 rounded-md text-sm"
                    >
                      <option value="">UF</option>
                      {BRAZILIAN_UFS.map((uf) => (
                        <option key={uf} value={uf}>
                          {uf}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-xs text-slate-300">
                    CEP
                    <input
                      required
                      type="text"
                      inputMode="numeric"
                      value={cep}
                      onChange={(e) => setCep(maskCEP(e.target.value))}
                      className="mt-2 w-full px-3 py-2 bg-industrial border border-white/10 rounded-md text-sm"
                    />
                  </label>
                </div>
              </div>
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
