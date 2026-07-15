import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { Download } from "lucide-react";
import { exportCsv } from "@/lib/export-csv";

type Battery = Tables<"batteries">;
type Lot = Tables<"lots">;
type Proposal = Tables<"proposals">;

const COLORS = ["#d4ff3d", "#60a5fa", "#a78bfa", "#34d399", "#f59e0b", "#f87171", "#94a3b8"];

export function ReportsTab() {
  const [from, setFrom] = useState<string>(() => {
    const d = new Date(); d.setDate(d.getDate() - 90);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState<string>(new Date().toISOString().slice(0, 10));
  const [batteries, setBatteries] = useState<Battery[]>([]);
  const [lots, setLots] = useState<Lot[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const fromIso = new Date(from + "T00:00:00").toISOString();
    const toIso = new Date(to + "T23:59:59").toISOString();
    const [b, l, p] = await Promise.all([
      supabase.from("batteries").select("*").gte("created_at", fromIso).lte("created_at", toIso),
      supabase.from("lots").select("*").gte("created_at", fromIso).lte("created_at", toIso),
      supabase.from("proposals").select("*").gte("created_at", fromIso).lte("created_at", toIso),
    ]);
    setBatteries(b.data ?? []);
    setLots(l.data ?? []);
    setProposals(p.data ?? []);
    setLoading(false);
  };
  useEffect(() => { void load(); }, [from, to]);

  const byStatus = useMemo(() => {
    const m = new Map<string, number>();
    batteries.forEach((b) => m.set(b.status, (m.get(b.status) ?? 0) + b.quantidade));
    return Array.from(m.entries()).map(([name, value]) => ({ name, value }));
  }, [batteries]);

  const byChemistry = useMemo(() => {
    const m = new Map<string, number>();
    batteries.forEach((b) => m.set(b.quimica, (m.get(b.quimica) ?? 0) + b.quantidade));
    return Array.from(m.entries()).map(([name, value]) => ({ name, value }));
  }, [batteries]);

  const byMonth = useMemo(() => {
    const m = new Map<string, number>();
    batteries.forEach((b) => {
      const k = new Date(b.created_at).toISOString().slice(0, 7);
      m.set(k, (m.get(k) ?? 0) + b.quantidade);
    });
    return Array.from(m.entries()).sort().map(([mes, qtd]) => ({ mes, qtd }));
  }, [batteries]);

  const totals = useMemo(() => {
    const total = batteries.reduce((s, b) => s + b.quantidade, 0);
    const kwh = batteries.reduce((s, b) => s + (Number(b.capacidade_kwh) || 0) * b.quantidade, 0);
    const kg = batteries.reduce((s, b) => s + (Number(b.peso_kg) || 0) * b.quantidade, 0);
    const destinadas = batteries.filter((b) => ["delivered", "recycled", "second_life"].includes(b.status))
      .reduce((s, b) => s + b.quantidade, 0);
    // Rough CO2 avoided estimate: ~2.5 kg CO2 per kg battery recycled (informative)
    const co2 = kg * 2.5;
    return { total, kwh, kg, destinadas, co2 };
  }, [batteries]);

  return (
    <div>
      <div className="flex items-end justify-between flex-wrap gap-3 mb-4">
        <div>
          <h1 className="text-xl font-display font-bold">Relatórios & indicadores</h1>
          <p className="text-xs text-slate-500 mt-1">
            Estimativas informativas. Validação por profissional habilitado é obrigatória antes de uso oficial.
          </p>
        </div>
        <div className="flex gap-2 items-end">
          <label className="grid gap-1 text-xs">
            <span className="text-slate-400">De</span>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="px-2 py-1.5 bg-white/5 border border-white/10 rounded-md text-sm" />
          </label>
          <label className="grid gap-1 text-xs">
            <span className="text-slate-400">Até</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="px-2 py-1.5 bg-white/5 border border-white/10 rounded-md text-sm" />
          </label>
          <div className="flex gap-2">
            <button
              onClick={() => exportCsv(`baterias_${from}_${to}.csv`, batteries)}
              className="inline-flex items-center gap-1.5 px-3 py-2 border border-white/10 rounded-md text-xs hover:bg-white/5"
            >
              <Download className="w-3.5 h-3.5" /> Baterias
            </button>
            <button
              onClick={() => exportCsv(`lotes_${from}_${to}.csv`, lots)}
              className="inline-flex items-center gap-1.5 px-3 py-2 border border-white/10 rounded-md text-xs hover:bg-white/5"
            >
              <Download className="w-3.5 h-3.5" /> Lotes
            </button>
            <button
              onClick={() => exportCsv(`propostas_${from}_${to}.csv`, proposals)}
              className="inline-flex items-center gap-1.5 px-3 py-2 border border-white/10 rounded-md text-xs hover:bg-white/5"
            >
              <Download className="w-3.5 h-3.5" /> Propostas
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-slate-400">Carregando...</p>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
            <Kpi label="Baterias registradas" value={totals.total} />
            <Kpi label="Destinação final" value={totals.destinadas} accent />
            <Kpi label="Capacidade total" value={`${totals.kwh.toFixed(1)} kWh`} />
            <Kpi label="Massa total" value={`${totals.kg.toFixed(0)} kg`} />
            <Kpi label="CO₂ evitado (est.)" value={`${(totals.co2 / 1000).toFixed(1)} t`} accent />
          </div>

          <div className="grid lg:grid-cols-2 gap-4 mb-4">
            <Panel title="Baterias por status">
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={byStatus} dataKey="value" nameKey="name" outerRadius={80} label>
                    {byStatus.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155" }} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </Panel>
            <Panel title="Baterias por química">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={byChemistry}>
                  <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                  <YAxis stroke="#64748b" fontSize={11} />
                  <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155" }} />
                  <Bar dataKey="value" fill="#d4ff3d" />
                </BarChart>
              </ResponsiveContainer>
            </Panel>
          </div>

          <Panel title="Volume mensal de baterias">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={byMonth}>
                <XAxis dataKey="mes" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} />
                <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155" }} />
                <Bar dataKey="qtd" fill="#60a5fa" />
              </BarChart>
            </ResponsiveContainer>
          </Panel>
        </>
      )}
    </div>
  );
}

type AuditRow = Tables<"audit_log">;

export function AuditTab() {
  const [items, setItems] = useState<AuditRow[]>([]);
  const [entity, setEntity] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    let q = supabase.from("audit_log").select("*").order("created_at", { ascending: false }).limit(200);
    if (entity) q = q.eq("entity_type", entity);
    const { data } = await q;
    setItems(data ?? []);
    setLoading(false);
  };
  useEffect(() => { void load(); }, [entity]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h1 className="text-xl font-display font-bold">Log de auditoria</h1>
        <div className="flex gap-2 items-end">
          <select value={entity} onChange={(e) => setEntity(e.target.value)} className="px-2 py-1.5 bg-white/5 border border-white/10 rounded-md text-sm">
            <option value="">Todas entidades</option>
            <option value="batteries">Baterias</option>
            <option value="lots">Lotes</option>
            <option value="proposals">Propostas</option>
            <option value="collections">Coletas</option>
          </select>
          <button
            onClick={() => exportCsv(`auditoria.csv`, items)}
            className="inline-flex items-center gap-1.5 px-3 py-2 border border-white/10 rounded-md text-xs hover:bg-white/5"
          >
            <Download className="w-3.5 h-3.5" /> Exportar
          </button>
        </div>
      </div>
      <p className="text-xs text-slate-500 mb-3">Registros imutáveis. Não podem ser editados ou apagados.</p>
      {loading ? (
        <p className="text-sm text-slate-400">Carregando...</p>
      ) : (
        <div className="border border-white/10 rounded-md overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-xs uppercase font-mono text-slate-400">
              <tr>
                <th className="text-left px-3 py-2">Quando</th>
                <th className="text-left px-3 py-2">Entidade</th>
                <th className="text-left px-3 py-2">Ação</th>
                <th className="text-left px-3 py-2">Detalhes</th>
                <th className="text-left px-3 py-2">Ator</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-500">Sem registros.</td></tr>}
              {items.map((a) => (
                <tr key={a.id} className="border-t border-white/5">
                  <td className="px-3 py-2 text-xs text-slate-400">{new Date(a.created_at).toLocaleString("pt-BR")}</td>
                  <td className="px-3 py-2 text-xs font-mono text-brand">{a.entity_type}</td>
                  <td className="px-3 py-2 text-xs">{a.action}</td>
                  <td className="px-3 py-2 text-xs text-slate-300 font-mono truncate max-w-xs">{JSON.stringify(a.payload)}</td>
                  <td className="px-3 py-2 text-[10px] text-slate-500 font-mono">{a.actor_id?.slice(0, 8) ?? "sistema"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="p-4 bg-white/5 border border-white/10 rounded-md">
      <h3 className="text-xs font-mono uppercase text-slate-400 mb-3">{title}</h3>
      {children}
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
