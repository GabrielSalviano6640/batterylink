import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, setImpersonatedRole, type AppRole } from "@/hooks/use-auth";
import { SiteFooter } from "@/components/site-footer";
import { GeradorDashboard } from "@/components/dashboards/gerador";
import { OperadorDashboard } from "@/components/dashboards/operador";
import { RecicladorDashboard } from "@/components/dashboards/reciclador";
import { TransportadoraDashboard } from "@/components/dashboards/transportadora";
import { NotificationsBell } from "@/components/notifications-bell";
import {
  BatteryCharging,
  Recycle,
  Truck,
  ShieldCheck,
  ShieldAlert,
  LogOut,
  Clock,
} from "lucide-react";
import { maskCNPJ, maskPhone, maskCEP } from "@/lib/masks";

export const Route = createFileRoute("/_authenticated/app")({
  head: () => ({
    meta: [
      { title: "Painel — BatteryLink Brasil" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AppHub,
});

function AppHub() {
  const auth = useAuth();
  const navigate = useNavigate();

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  if (auth.loading) {
    return (
      <div className="min-h-screen bg-industrial flex items-center justify-center text-slate-400 text-sm">
        Carregando...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-industrial flex flex-col">
      <header className="border-b border-white/10 bg-industrial/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-brand rounded-sm flex items-center justify-center">
              <div className="w-4 h-4 bg-industrial rotate-45" />
            </div>
            <span className="font-display font-bold text-lg tracking-tight">
              BATTERYLINK <span className="text-brand">BRASIL</span>
            </span>
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-slate-400 hidden md:inline">{auth.user?.email}</span>
            {auth.user?.id && <NotificationsBell userId={auth.user.id} />}
            {auth.realRole === "admin" && (
              <Link to="/app/admin" className="text-brand hover:brightness-125">
                Admin
              </Link>
            )}
            <button
              onClick={signOut}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-white/20 rounded-md hover:bg-white/5"
            >
              <LogOut className="w-3.5 h-3.5" /> Sair
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-10">
        {!auth.role && auth.hasPendingRequest ? (
          <PendingCard />
        ) : !auth.role ? (
          auth.status === "rejected" ? <RejectedCard /> : <OnboardingForm onSubmitted={auth.refresh} />
        ) : auth.status === "pending" ? (
          <PendingCard />
        ) : auth.status === "rejected" ? (
          <RejectedCard />
        ) : (
          <RoleDashboard role={auth.role} />
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

const roleOptions: { id: AppRole; label: string; icon: typeof BatteryCharging; desc: string }[] = [
  { id: "gerador", label: "Gerador", icon: BatteryCharging, desc: "Frotas, indústrias, montadoras — origem das baterias." },
  { id: "operador", label: "Operador de triagem", icon: ShieldCheck, desc: "Diagnóstico, classificação e formação de lotes." },
  { id: "reciclador", label: "Reciclador / segunda vida", icon: Recycle, desc: "Recebe lotes e emite comprovante de destinação." },
  { id: "transportadora", label: "Transportadora", icon: Truck, desc: "Coleta e transporte especializado com MTR." },
];

const tipoOrgOptions = [
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

const UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

function OnboardingForm({ onSubmitted }: { onSubmitted: () => Promise<void> }) {
  const [selectedRoles, setSelectedRoles] = useState<AppRole[]>([]);
  const [razao, setRazao] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [tipoOrg, setTipoOrg] = useState("");
  const [cargo, setCargo] = useState("");
  const [endereco, setEndereco] = useState("");
  const [cidade, setCidade] = useState("");
  const [estado, setEstado] = useState("");
  const [cep, setCep] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  const toggle = (r: AppRole) =>
    setSelectedRoles((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedRoles.length === 0) {
      toast.error("Selecione ao menos um perfil de operação.");
      return;
    }
    setLoading(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Sessão expirada. Entre novamente.");
      const uid = user.user.id;
      await supabase.from("profiles").update({ phone, cargo }).eq("id", uid);
      await supabase
        .from("companies")
        .upsert(
          {
            owner_id: uid,
            razao_social: razao,
            cnpj,
            tipo: selectedRoles[0],
            tipo_organizacao: tipoOrg,
            cargo,
            endereco,
            cidade,
            estado,
            cep,
            status: "aguardando_aprovacao",
          },
          { onConflict: "owner_id,cnpj" }
        );
      const rows = selectedRoles.map((r) => ({
        user_id: uid,
        requested_role: r,
        company_data: { razao_social: razao, cnpj, tipo_organizacao: tipoOrg, cargo, endereco, cidade, estado, cep, phone },
      }));
      const { error } = await supabase.from("registration_requests").insert(rows);
      if (error) throw error;
      toast.success(
        selectedRoles.length > 1
          ? `${selectedRoles.length} solicitações enviadas. Aguarde a aprovação.`
          : "Solicitação enviada. Aguarde a aprovação do admin."
      );
      await onSubmitted();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao enviar solicitação.");
    } finally {
      setLoading(false);
    }
  };

  const inputCls = "px-3 py-2 bg-white/5 border border-white/10 rounded-md text-sm focus:border-brand focus:outline-none";

  return (
    <div className="max-w-2xl mx-auto">
      <p className="font-mono text-xs text-brand tracking-widest uppercase mb-2">Onboarding</p>
      <h1 className="text-3xl font-display font-bold mb-2">Solicitar acesso à plataforma</h1>
      <p className="text-sm text-slate-400 mb-8">
        Selecione um ou mais perfis de operação e envie os dados da empresa. Uma empresa pode atuar em múltiplos perfis (ex: gerador + operador). Um administrador irá revisar cada solicitação.
      </p>

      <form onSubmit={submit} className="space-y-6">
        <div>
          <p className="text-xs font-mono uppercase text-slate-400 mb-2">Perfil solicitado *</p>
          <div className="grid md:grid-cols-2 gap-3">
            {roleOptions.map((r) => {
              const Icon = r.icon;
              const active = selectedRoles.includes(r.id);
              return (
                <button
                  type="button"
                  key={r.id}
                  onClick={() => toggle(r.id)}
                  className={`text-left p-4 border rounded-md transition ${
                    active ? "border-brand bg-brand/5" : "border-white/10 hover:border-white/30"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <Icon className={`w-5 h-5 mb-2 ${active ? "text-brand" : "text-slate-400"}`} />
                    {active && <span className="text-[10px] font-mono text-brand">SELECIONADO</span>}
                  </div>
                  <div className="font-semibold text-sm">{r.label}</div>
                  <div className="text-xs text-slate-400 mt-1">{r.desc}</div>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <p className="text-xs font-mono uppercase text-slate-400 mb-2">Dados da empresa *</p>
          <div className="grid md:grid-cols-2 gap-3">
            <input required placeholder="Razão social" value={razao} onChange={(e) => setRazao(e.target.value)} className={`md:col-span-2 ${inputCls}`} />
            <input required placeholder="CNPJ" value={cnpj} onChange={(e) => setCnpj(maskCNPJ(e.target.value))} inputMode="numeric" className={inputCls} />
            <select required value={tipoOrg} onChange={(e) => setTipoOrg(e.target.value)} className={inputCls}>
              <option value="">Tipo de organização</option>
              {tipoOrgOptions.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <input required placeholder="Seu cargo" value={cargo} onChange={(e) => setCargo(e.target.value)} className={inputCls} />
            <input required placeholder="Telefone" value={phone} onChange={(e) => setPhone(maskPhone(e.target.value))} inputMode="tel" className={inputCls} />
          </div>
        </div>

        <div>
          <p className="text-xs font-mono uppercase text-slate-400 mb-2">Endereço *</p>
          <div className="grid md:grid-cols-6 gap-3">
            <input required placeholder="Endereço (logradouro, número, complemento)" value={endereco} onChange={(e) => setEndereco(e.target.value)} className={`md:col-span-6 ${inputCls}`} />
            <input required placeholder="Cidade" value={cidade} onChange={(e) => setCidade(e.target.value)} className={`md:col-span-3 ${inputCls}`} />
            <select required value={estado} onChange={(e) => setEstado(e.target.value)} className={`md:col-span-1 ${inputCls}`}>
              <option value="">UF</option>
              {UFS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
            </select>
            <input required placeholder="CEP" value={cep} onChange={(e) => setCep(maskCEP(e.target.value))} inputMode="numeric" className={`md:col-span-2 ${inputCls}`} />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || selectedRoles.length === 0}
          className="px-6 py-2.5 bg-brand text-industrial font-semibold rounded-md text-sm disabled:opacity-50"
        >
          {loading ? "Enviando..." : `Enviar solicitação${selectedRoles.length > 1 ? `s (${selectedRoles.length})` : ""}`}
        </button>
      </form>
    </div>
  );
}


function PendingCard() {
  return (
    <div className="max-w-xl mx-auto text-center py-16">
      <Clock className="w-12 h-12 text-brand mx-auto mb-4" />
      <h1 className="text-2xl font-display font-bold mb-2">Aguardando aprovação</h1>
      <p className="text-sm text-slate-400">
        Sua solicitação de acesso está em análise. Você receberá acesso ao painel do seu perfil assim que for aprovada.
      </p>
    </div>
  );
}

function RejectedCard() {
  return (
    <div className="max-w-xl mx-auto text-center py-16">
      <ShieldAlert className="w-12 h-12 text-danger mx-auto mb-4" />
      <h1 className="text-2xl font-display font-bold mb-2">Solicitação recusada</h1>
      <p className="text-sm text-slate-400">Entre em contato com o suporte para mais informações.</p>
    </div>
  );
}

function RoleDashboard({ role }: { role: AppRole }) {
  const auth = useAuth();
  const uid = auth.user?.id;
  if (!uid) return null;

  const banner = auth.realRole === "admin" && role !== "admin" ? (
    <ImpersonationBanner role={role} />
  ) : null;

  let dash: React.ReactNode;
  if (role === "gerador") dash = <GeradorDashboard userId={uid} />;
  else if (role === "operador") dash = <OperadorDashboard userId={uid} />;
  else if (role === "reciclador") dash = <RecicladorDashboard userId={uid} />;
  else if (role === "transportadora") dash = <TransportadoraDashboard userId={uid} />;
  else {
    const info = roleOptions.find((r) => r.id === role) ?? { label: role, desc: "", icon: ShieldCheck };
    const Icon = info.icon;
    dash = (
      <div>
        <div className="flex items-center gap-3 mb-2">
          <Icon className="w-6 h-6 text-brand" />
          <p className="font-mono text-xs text-brand tracking-widest uppercase">Painel · {info.label}</p>
        </div>
        <h1 className="text-3xl font-display font-bold mb-2">Bem-vindo, admin</h1>
        <p className="text-sm text-slate-400 mb-6">
          Use o link Admin no topo para aprovar solicitações e gerenciar a plataforma. Você também pode usar o seletor "Ver como…" no painel Admin para inspecionar qualquer perfil.
        </p>
      </div>
    );
  }
  return (
    <>
      {banner}
      {dash}
    </>
  );
}

function ImpersonationBanner({ role }: { role: AppRole }) {
  return (
    <div className="mb-6 p-3 rounded-md border border-brand/40 bg-brand/10 text-xs flex flex-wrap items-center justify-between gap-2">
      <span>
        <span className="font-mono uppercase text-brand">Ver como</span>{" "}
        <span className="font-semibold">{role}</span> — você é admin visualizando este painel.
      </span>
      <button
        onClick={() => { setImpersonatedRole(null); }}
        className="px-2 py-1 border border-white/20 rounded text-[11px] hover:bg-white/5"
      >
        Voltar ao Admin
      </button>
    </div>
  );
}
