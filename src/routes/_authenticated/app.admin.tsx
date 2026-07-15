import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, setImpersonatedRole, getImpersonatedRole, type AppRole } from "@/hooks/use-auth";
import { SiteFooter } from "@/components/site-footer";
import { NotificationsBell } from "@/components/notifications-bell";
import { CheckCircle2, XCircle, ArrowLeft, Eye } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { ReportsTab, AuditTab } from "@/components/admin/reports";
import { AdminControlCenter } from "@/components/admin/control-center";

export const Route = createFileRoute("/_authenticated/app/admin")({
  head: () => ({
    meta: [
      { title: "Admin — BatteryLink Brasil" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

type Tab = "control" | "requests" | "leads" | "users" | "companies" | "operations" | "finance" | "reports" | "audit";

function AdminPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("control");

  useEffect(() => {
    if (!auth.loading && auth.realRole !== "admin") {
      toast.error("Acesso restrito a administradores");
      navigate({ to: "/app" });
    }
  }, [auth.loading, auth.realRole, navigate]);

  const tabs: { id: Tab; label: string }[] = [
    { id: "control", label: "Controle geral" },
    { id: "requests", label: "Aprovações" },
    { id: "leads", label: "Leads" },
    { id: "users", label: "Usuários" },
    { id: "companies", label: "Empresas" },
    { id: "operations", label: "Operacional" },
    { id: "finance", label: "Financeiro" },
    { id: "reports", label: "Relatórios" },
    { id: "audit", label: "Auditoria" },
  ];

  return (
    <div className="min-h-screen bg-industrial flex flex-col">
      <header className="border-b border-white/10 bg-industrial/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link to="/app" className="flex items-center gap-2 text-sm text-slate-400 hover:text-brand">
            <ArrowLeft className="w-4 h-4" /> Painel
          </Link>
          <span className="font-display font-bold tracking-tight">Admin</span>
          <div className="flex items-center gap-3">
            <ImpersonateSelector />
            {auth.user?.id && <NotificationsBell userId={auth.user.id} />}
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-10">
        <div className="flex gap-2 overflow-x-auto pb-1 mb-6 border-b border-white/10">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 text-sm rounded-t-md -mb-px border-b-2 ${
                tab === t.id ? "border-brand text-brand" : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "control" && <AdminControlCenter />}
        {tab === "requests" && <RequestsTab />}
        {tab === "leads" && <LeadsTab />}
        {tab === "users" && <UsersTab />}
        {tab === "companies" && <CompaniesTab />}
        {tab === "operations" && <OperationsTab />}
        {tab === "finance" && <FinanceTab />}
        {tab === "reports" && <ReportsTab />}
        {tab === "audit" && <AuditTab />}
      </main>
      <SiteFooter />
    </div>
  );
}

function ImpersonateSelector() {
  const navigate = useNavigate();
  const [role, setRole] = useState<AppRole | "">((getImpersonatedRole() as AppRole) || "");
  const onChange = (v: string) => {
    const r = (v || null) as AppRole | null;
    setRole((r ?? "") as AppRole | "");
    setImpersonatedRole(r);
    if (r) navigate({ to: "/app" });
  };
  return (
    <label className="flex items-center gap-1.5 text-xs text-slate-400">
      <Eye className="w-3.5 h-3.5" />
      <select
        value={role}
        onChange={(e) => onChange(e.target.value)}
        className="bg-white/5 border border-white/10 rounded-md px-2 py-1 text-xs"
        title="Ver painel como outro perfil (não altera o banco)"
      >
        <option value="">Ver como…</option>
        <option value="gerador">Gerador</option>
        <option value="operador">Operador</option>
        <option value="reciclador">Reciclador</option>
        <option value="transportadora">Transportadora</option>
      </select>
    </label>
  );
}

interface RequestRow {
  id: string;
  user_id: string;
  requested_role: string;
  status: string;
  created_at: string;
  company_data: Record<string, unknown>;
  admin_notes?: string | null;
}

function RequestsTab() {
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"pending" | "all">("pending");

  const load = async () => {
    setLoading(true);
    let q = supabase.from("registration_requests").select("*").order("created_at", { ascending: false });
    if (filter === "pending") q = q.eq("status", "pending");
    const { data, error } = await q;
    if (error) toast.error(error.message);
    else setRequests((data as RequestRow[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const review = async (id: string, approve: boolean) => {
    const notes = approve ? undefined : window.prompt("Motivo da recusa (opcional):") ?? undefined;
    const { error } = await supabase.rpc("approve_registration", { _request_id: id, _approve: approve, _notes: notes });
    if (error) toast.error(error.message);
    else {
      toast.success(approve ? "Aprovado" : "Recusado");
      await load();
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-display font-bold">Solicitações de acesso</h1>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as "pending" | "all")}
          className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-md text-sm"
        >
          <option value="pending">Pendentes</option>
          <option value="all">Todas</option>
        </select>
      </div>

      {loading ? (
        <p className="text-sm text-slate-400">Carregando...</p>
      ) : requests.length === 0 ? (
        <p className="text-sm text-slate-400">Nenhuma solicitação.</p>
      ) : (
        <div className="space-y-3">
          {requests.map((r) => {
            const data = r.company_data as Record<string, string>;
            return (
              <div key={r.id} className="p-5 bg-white/5 border border-white/10 rounded-md">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-xs font-mono uppercase text-brand tracking-wider">
                      {r.requested_role} · {r.status}
                    </div>
                    <div className="font-semibold mt-1">{data?.razao_social ?? "—"}</div>
                    <div className="text-xs text-slate-400 mt-1">
                      CNPJ {data?.cnpj ?? "—"} · {data?.cidade ?? "—"}/{data?.estado ?? "—"} · Tel {data?.phone ?? "—"}
                    </div>
                    <div className="text-xs text-slate-500 mt-2">Criado em {new Date(r.created_at).toLocaleString("pt-BR")}</div>
                    {r.admin_notes && <div className="text-xs text-slate-400 mt-2 italic">Nota: {r.admin_notes}</div>}
                  </div>
                  {r.status === "pending" && (
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => review(r.id, true)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand text-industrial rounded-md text-xs font-semibold hover:brightness-110"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Aprovar
                      </button>
                      <button
                        onClick={() => review(r.id, false)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-white/20 rounded-md text-xs hover:bg-white/5"
                      >
                        <XCircle className="w-3.5 h-3.5" /> Recusar
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

type Profile = Tables<"profiles">;
type UserRole = Tables<"user_roles">;

function UsersTab() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    void (async () => {
      const [{ data: p }, { data: r }] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("user_roles").select("*"),
      ]);
      setProfiles(p ?? []);
      setRoles(r ?? []);
    })();
  }, []);

  const rolesByUser = useMemo(() => {
    const map = new Map<string, string[]>();
    roles.forEach((r) => {
      const arr = map.get(r.user_id) ?? [];
      arr.push(r.role);
      map.set(r.user_id, arr);
    });
    return map;
  }, [roles]);

  const filtered = profiles.filter(
    (p) => !q || (p.email ?? "").toLowerCase().includes(q.toLowerCase()) || (p.full_name ?? "").toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-display font-bold">Usuários ({profiles.length})</h1>
        <input placeholder="Buscar..." value={q} onChange={(e) => setQ(e.target.value)} className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-md text-sm" />
      </div>
      <div className="border border-white/10 rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-xs uppercase font-mono text-slate-400">
            <tr>
              <th className="text-left px-3 py-2">Nome</th>
              <th className="text-left px-3 py-2">Email</th>
              <th className="text-left px-3 py-2">Status</th>
              <th className="text-left px-3 py-2">Perfis</th>
              <th className="text-left px-3 py-2">Criado</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} className="border-t border-white/5">
                <td className="px-3 py-2">{p.full_name ?? "—"}</td>
                <td className="px-3 py-2 text-slate-300">{p.email ?? "—"}</td>
                <td className="px-3 py-2 text-xs">{p.status}</td>
                <td className="px-3 py-2 text-xs font-mono text-brand">{(rolesByUser.get(p.id) ?? []).join(", ") || "—"}</td>
                <td className="px-3 py-2 text-xs text-slate-500">{new Date(p.created_at).toLocaleDateString("pt-BR")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

type Company = Tables<"companies">;

function CompaniesTab() {
  const [items, setItems] = useState<Company[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    void supabase.from("companies").select("*").order("created_at", { ascending: false }).then(({ data }) => setItems(data ?? []));
  }, []);

  const filtered = items.filter(
    (c) => !q || c.razao_social.toLowerCase().includes(q.toLowerCase()) || (c.cnpj ?? "").includes(q)
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-display font-bold">Empresas ({items.length})</h1>
        <input placeholder="Buscar por razão ou CNPJ..." value={q} onChange={(e) => setQ(e.target.value)} className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-md text-sm" />
      </div>
      <div className="border border-white/10 rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-xs uppercase font-mono text-slate-400">
            <tr>
              <th className="text-left px-3 py-2">Razão social</th>
              <th className="text-left px-3 py-2">CNPJ</th>
              <th className="text-left px-3 py-2">Tipo</th>
              <th className="text-left px-3 py-2">Cidade/UF</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id} className="border-t border-white/5">
                <td className="px-3 py-2 font-semibold">{c.razao_social}</td>
                <td className="px-3 py-2 font-mono text-xs">{c.cnpj ?? "—"}</td>
                <td className="px-3 py-2 text-xs text-brand">{c.tipo}</td>
                <td className="px-3 py-2 text-slate-400">{[c.cidade, c.estado].filter(Boolean).join("/") || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function OperationsTab() {
  const [counts, setCounts] = useState<{ batteries: number; lots: number; collections: number; delivered: number; recycled: number }>({
    batteries: 0, lots: 0, collections: 0, delivered: 0, recycled: 0,
  });
  const [recent, setRecent] = useState<Tables<"batteries">[]>([]);

  useEffect(() => {
    void (async () => {
      const [b, l, c, del, rec, rb] = await Promise.all([
        supabase.from("batteries").select("id", { count: "exact", head: true }),
        supabase.from("lots").select("id", { count: "exact", head: true }),
        supabase.from("collections").select("id", { count: "exact", head: true }),
        supabase.from("batteries").select("id", { count: "exact", head: true }).in("status", ["recebida_pelo_destinador", "documentacao_pendente", "concluida"]),
        supabase.from("batteries").select("id", { count: "exact", head: true }).eq("status", "concluida"),
        supabase.from("batteries").select("*").order("created_at", { ascending: false }).limit(10),
      ]);
      setCounts({
        batteries: b.count ?? 0, lots: l.count ?? 0, collections: c.count ?? 0,
        delivered: del.count ?? 0, recycled: rec.count ?? 0,
      });
      setRecent(rb.data ?? []);
    })();
  }, []);

  return (
    <div>
      <h1 className="text-xl font-display font-bold mb-4">Panorama operacional</h1>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <Kpi label="Baterias" value={counts.batteries} />
        <Kpi label="Lotes" value={counts.lots} />
        <Kpi label="Coletas" value={counts.collections} />
        <Kpi label="Entregues" value={counts.delivered} />
        <Kpi label="Destinação final" value={counts.recycled} accent />
      </div>
      <h2 className="text-sm font-mono uppercase text-slate-400 mb-2">Baterias recentes</h2>
      <div className="border border-white/10 rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-xs uppercase font-mono text-slate-400">
            <tr>
              <th className="text-left px-3 py-2">Código</th>
              <th className="text-left px-3 py-2">Química</th>
              <th className="text-left px-3 py-2">Qtd</th>
              <th className="text-left px-3 py-2">Status</th>
              <th className="text-left px-3 py-2">Criada</th>
            </tr>
          </thead>
          <tbody>
            {recent.map((b) => (
              <tr key={b.id} className="border-t border-white/5">
                <td className="px-3 py-2 font-mono text-brand">{b.code}</td>
                <td className="px-3 py-2">{b.quimica}</td>
                <td className="px-3 py-2">{b.quantidade}</td>
                <td className="px-3 py-2 text-xs">{b.status}</td>
                <td className="px-3 py-2 text-xs text-slate-500">{new Date(b.created_at).toLocaleDateString("pt-BR")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

type Proposal = Tables<"proposals">;
type Lot = Tables<"lots">;

function FinanceTab() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [lots, setLots] = useState<Lot[]>([]);

  useEffect(() => {
    void (async () => {
      const [p, l] = await Promise.all([
        supabase.from("proposals").select("*").order("created_at", { ascending: false }),
        supabase.from("lots").select("*"),
      ]);
      setProposals(p.data ?? []);
      setLots(l.data ?? []);
    })();
  }, []);

  const lotById = useMemo(() => new Map(lots.map((l) => [l.id, l])), [lots]);
  const totals = useMemo(() => {
    const accepted = proposals.filter((p) => p.status === "aceita");
    const pending = proposals.filter((p) => ["enviada", "em_analise"].includes(p.status));
    const sum = (arr: Proposal[]) => arr.reduce((s, p) => s + Number(p.valor_total || 0), 0);
    return {
      acceptedCount: accepted.length,
      acceptedTotal: sum(accepted),
      pendingCount: pending.length,
      pendingTotal: sum(pending),
      total: sum(proposals),
    };
  }, [proposals]);

  const fmt = (n: number) => `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

  return (
    <div>
      <h1 className="text-xl font-display font-bold mb-4">Financeiro</h1>
      <p className="text-xs text-slate-500 mb-4">
        Valores derivados das propostas de reciclagem / segunda vida (visão informativa; a nota fiscal oficial deve ser emitida à parte).
      </p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Kpi label="Propostas aceitas" value={totals.acceptedCount} />
        <Kpi label="Valor aceito" value={fmt(totals.acceptedTotal)} accent />
        <Kpi label="Em negociação" value={totals.pendingCount} />
        <Kpi label="Valor em negociação" value={fmt(totals.pendingTotal)} />
      </div>
      <div className="border border-white/10 rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-xs uppercase font-mono text-slate-400">
            <tr>
              <th className="text-left px-3 py-2">Lote</th>
              <th className="text-left px-3 py-2">Status</th>
              <th className="text-left px-3 py-2">Valor</th>
              <th className="text-left px-3 py-2">Data</th>
            </tr>
          </thead>
          <tbody>
            {proposals.length === 0 && (
              <tr><td colSpan={4} className="px-3 py-6 text-center text-slate-500">Nenhuma proposta registrada.</td></tr>
            )}
            {proposals.map((p) => (
              <tr key={p.id} className="border-t border-white/5">
                <td className="px-3 py-2 font-mono text-brand">{lotById.get(p.lot_id)?.code ?? "—"}</td>
                <td className="px-3 py-2 text-xs">{p.status}</td>
                <td className="px-3 py-2 tabular-nums">{fmt(Number(p.valor_total || 0))}</td>
                <td className="px-3 py-2 text-xs text-slate-500">{new Date(p.created_at).toLocaleDateString("pt-BR")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Kpi({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="p-4 rounded-md bg-white/5 border border-white/10">
      <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500 mb-1">{label}</div>
      <div className={accent ? "text-2xl font-display font-bold text-brand tabular-nums" : "text-2xl font-display font-bold tabular-nums"}>
        {value}
      </div>
    </div>
  );
}

type Lead = Tables<"leads">;

function LeadsTab() {
  const [items, setItems] = useState<Lead[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [source, setSource] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    let q = supabase.from("leads").select("*").order("created_at", { ascending: false });
    if (filter !== "all") q = q.eq("status", filter);
    if (source !== "all") q = q.eq("source", source);
    const { data, error } = await q;
    if (error) toast.error(error.message);
    else setItems(data ?? []);
    setLoading(false);
  };
  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [filter, source]);

  const setStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("leads").update({ status, reviewed_at: new Date().toISOString() }).eq("id", id);
    if (error) toast.error(error.message);
    else void load();
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h1 className="text-xl font-display font-bold">Leads públicos ({items.length})</h1>
        <div className="flex gap-2">
          <select value={source} onChange={(e) => setSource(e.target.value)} className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-md text-sm">
            <option value="all">Todas as origens</option>
            <option value="gerador">Gerador</option>
            <option value="recicladora">Recicladora</option>
            <option value="transportadora">Transportadora</option>
            <option value="operador">Operador</option>
            <option value="contato">Contato</option>
          </select>
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-md text-sm">
            <option value="all">Todos</option>
            <option value="new">Novos</option>
            <option value="contacted">Contatados</option>
            <option value="converted">Convertidos</option>
            <option value="discarded">Descartados</option>
          </select>
        </div>
      </div>
      {loading ? (
        <p className="text-sm text-slate-400">Carregando...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-400">Nenhum lead.</p>
      ) : (
        <div className="space-y-3">
          {items.map((l) => (
            <div key={l.id} className="p-4 bg-white/5 border border-white/10 rounded-md">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-[10px] font-mono uppercase text-brand tracking-widest">{l.source} · {l.status}</div>
                  <div className="font-semibold mt-1">{l.razao_social ?? l.responsavel ?? l.email ?? "—"}</div>
                  <div className="text-xs text-slate-400 mt-1 truncate">
                    {[l.documento, l.email, l.phone, l.cidade && `${l.cidade}/${l.estado ?? ""}`].filter(Boolean).join(" · ")}
                  </div>
                  <details className="mt-2">
                    <summary className="text-xs text-slate-500 cursor-pointer">Ver payload</summary>
                    <pre className="mt-2 p-2 bg-industrial rounded text-[10px] text-slate-300 overflow-x-auto max-w-full">{JSON.stringify(l.payload, null, 2)}</pre>
                  </details>
                  <div className="text-[10px] text-slate-500 mt-2">Criado em {new Date(l.created_at).toLocaleString("pt-BR")}</div>
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  {l.status === "new" && (
                    <button onClick={() => setStatus(l.id, "contacted")} className="px-2 py-1 border border-white/20 rounded text-[11px] hover:bg-white/5">Marcar contatado</button>
                  )}
                  {l.status !== "converted" && (
                    <button onClick={() => setStatus(l.id, "converted")} className="px-2 py-1 border border-white/20 rounded text-[11px] hover:bg-white/5">Convertido</button>
                  )}
                  {l.status !== "discarded" && (
                    <button onClick={() => setStatus(l.id, "discarded")} className="px-2 py-1 border border-white/20 rounded text-[11px] hover:bg-white/5">Descartar</button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
