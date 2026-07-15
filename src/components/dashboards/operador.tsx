import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { ShieldCheck, Package, Send } from "lucide-react";
import { Modal, StatusBadge, Inp, Sel } from "./gerador";

type Battery = Tables<"batteries">;
type Lot = Tables<"lots">;

export function OperadorDashboard({ userId }: { userId: string }) {
  const [tab, setTab] = useState<"batteries" | "lots">("batteries");
  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <ShieldCheck className="w-5 h-5 text-brand" />
        <p className="font-mono text-xs text-brand tracking-widest uppercase">Painel · Operador</p>
      </div>
      <h1 className="text-2xl font-display font-bold mb-6">Triagem & lotes</h1>

      <div className="flex gap-2 mb-4 border-b border-white/10">
        {(["batteries","lots"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm border-b-2 -mb-px ${tab===t?"border-brand text-brand":"border-transparent text-slate-400"}`}>
            {t === "batteries" ? "Baterias" : "Lotes"}
          </button>
        ))}
      </div>

      {tab === "batteries" ? <BatteriesTab userId={userId} /> : <LotsTab userId={userId} />}
    </div>
  );
}

function BatteriesTab({ userId }: { userId: string }) {
  const [items, setItems] = useState<Battery[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [q, setQ] = useState("");
  const [triage, setTriage] = useState<Battery | null>(null);

  const load = async () => {
    const { data } = await supabase.from("batteries").select("*").order("created_at", { ascending: false });
    setItems(data ?? []);
  };
  useEffect(() => { void load(); }, []);

  const filtered = items.filter((b) => (filter === "all" || b.status === filter) && (!q || b.code.toLowerCase().includes(q.toLowerCase())));

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-3">
        <input placeholder="Buscar código..." value={q} onChange={(e) => setQ(e.target.value)} className="flex-1 min-w-[180px] px-3 py-2 bg-white/5 border border-white/10 rounded-md text-sm" />
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className="px-3 py-2 bg-white/5 border border-white/10 rounded-md text-sm">
          <option value="all">Todos os status</option>
          <option value="registered">Registradas (aguardando triagem)</option>
          <option value="triaging">Em triagem</option>
          <option value="classified">Classificadas</option>
          <option value="in_lot">Em lote</option>
        </select>
      </div>
      <div className="border border-white/10 rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-xs uppercase font-mono text-slate-400">
            <tr>
              <th className="text-left px-3 py-2">Código</th>
              <th className="text-left px-3 py-2">Origem</th>
              <th className="text-left px-3 py-2">Química</th>
              <th className="text-left px-3 py-2">Estado</th>
              <th className="text-left px-3 py-2">Status</th>
              <th className="text-left px-3 py-2">Ação</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-500">Nenhuma bateria.</td></tr>
            ) : filtered.map((b) => (
              <tr key={b.id} className="border-t border-white/5 hover:bg-white/5">
                <td className="px-3 py-2 font-mono text-brand">{b.code}</td>
                <td className="px-3 py-2">{b.origem}</td>
                <td className="px-3 py-2">{b.quimica}</td>
                <td className="px-3 py-2">{b.estado}</td>
                <td className="px-3 py-2"><StatusBadge status={b.status} /></td>
                <td className="px-3 py-2">
                  <button onClick={() => setTriage(b)} className="text-brand text-xs hover:brightness-125">Triar / classificar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {triage && <TriageModal battery={triage} userId={userId} onClose={() => setTriage(null)} onSaved={() => { void load(); setTriage(null); }} />}
    </div>
  );
}

function TriageModal({ battery, userId, onClose, onSaved }: { battery: Battery; userId: string; onClose: () => void; onSaved: () => void }) {
  const [saving, setSaving] = useState(false);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const classificacao = String(fd.get("classificacao")) as "segunda_vida" | "reciclagem";
    const soh = Number(fd.get("soh") || 0);
    const notas = String(fd.get("notas") || "");
    setSaving(true);
    try {
      const { error } = await supabase.from("batteries").update({
        status: "classified",
        classificacao,
        diagnostico: { soh, notas },
      }).eq("id", battery.id);
      if (error) throw error;
      await supabase.from("battery_events").insert({
        battery_id: battery.id, actor_id: userId, event_type: "classified",
        notes: `Classificada como ${classificacao === "segunda_vida" ? "segunda vida" : "reciclagem"} (SoH ${soh}%). ${notas}`,
      });
      toast.success("Bateria classificada");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal onClose={onClose} title={`Triagem — ${battery.code}`}>
      <form onSubmit={submit} className="grid gap-3">
        <p className="text-xs text-slate-400">Origem: {battery.origem} · Química: {battery.quimica} · Estado: {battery.estado}</p>
        <div className="grid md:grid-cols-2 gap-3">
          <Sel name="classificacao" label="Destinação" required options={[{value:"segunda_vida",label:"Segunda vida"},{value:"reciclagem",label:"Reciclagem"}]} />
          <Inp name="soh" label="State of Health (%)" type="number" min={0} max={100} required />
        </div>
        <label className="grid gap-1">
          <span className="text-xs text-slate-400">Notas do diagnóstico</span>
          <textarea name="notas" rows={3} className="px-3 py-2 bg-white/5 border border-white/10 rounded-md text-sm" />
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 border border-white/10 rounded-md text-sm">Cancelar</button>
          <button type="submit" disabled={saving} className="px-4 py-2 bg-brand text-industrial rounded-md text-sm font-semibold disabled:opacity-50">
            {saving ? "Salvando..." : "Concluir triagem"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function LotsTab({ userId }: { userId: string }) {
  const [lots, setLots] = useState<Lot[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [manage, setManage] = useState<Lot | null>(null);

  const load = async () => {
    const { data } = await supabase.from("lots").select("*").order("created_at", { ascending: false });
    setLots(data ?? []);
  };
  useEffect(() => { void load(); }, []);

  return (
    <div>
      <div className="flex justify-between mb-3">
        <p className="text-sm text-slate-400">Agrupe baterias classificadas em lotes para negociação e coleta.</p>
        <button onClick={() => setShowNew(true)} className="px-4 py-2 bg-brand text-industrial rounded-md text-sm font-semibold">Novo lote</button>
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        {lots.length === 0 && <p className="text-sm text-slate-500">Nenhum lote criado.</p>}
        {lots.map((l) => (
          <div key={l.id} className="p-4 border border-white/10 rounded-md">
            <div className="flex justify-between items-start mb-2">
              <div>
                <div className="font-mono text-brand text-sm">{l.code}</div>
                <div className="font-semibold">{l.titulo}</div>
              </div>
              <StatusBadge status={l.status} />
            </div>
            <p className="text-xs text-slate-400 mb-3">{l.destino === "reciclagem" ? "Reciclagem" : "Segunda vida"} · {l.cidade}/{l.uf}</p>
            <button onClick={() => setManage(l)} className="text-brand text-xs hover:brightness-125">Gerenciar</button>
          </div>
        ))}
      </div>
      {showNew && <NewLotModal userId={userId} onClose={() => setShowNew(false)} onCreated={() => { void load(); setShowNew(false); }} />}
      {manage && <ManageLotModal lot={manage} userId={userId} onClose={() => setManage(null)} onChanged={() => void load()} />}
    </div>
  );
}

function NewLotModal({ userId, onClose, onCreated }: { userId: string; onClose: () => void; onCreated: () => void }) {
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    try {
      const { error } = await supabase.from("lots").insert({
        operador_id: userId,
        titulo: String(fd.get("titulo")),
        descricao: String(fd.get("descricao") || "") || null,
        destino: String(fd.get("destino")) as "reciclagem" | "segunda_vida",
        cidade: String(fd.get("cidade") || "") || null,
        uf: String(fd.get("uf") || "") || null,
      });
      if (error) throw error;
      toast.success("Lote criado");
      onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    }
  };
  return (
    <Modal onClose={onClose} title="Novo lote">
      <form onSubmit={submit} className="grid gap-3">
        <Inp name="titulo" label="Título" required />
        <div className="grid md:grid-cols-3 gap-3">
          <Sel name="destino" label="Destino" required options={[{value:"reciclagem",label:"Reciclagem"},{value:"segunda_vida",label:"Segunda vida"}]} />
          <Inp name="cidade" label="Cidade" />
          <Inp name="uf" label="UF" maxLength={2} />
        </div>
        <label className="grid gap-1">
          <span className="text-xs text-slate-400">Descrição</span>
          <textarea name="descricao" rows={3} className="px-3 py-2 bg-white/5 border border-white/10 rounded-md text-sm" />
        </label>
        <div className="flex justify-end gap-2"><button type="submit" className="px-4 py-2 bg-brand text-industrial rounded-md text-sm font-semibold">Criar</button></div>
      </form>
    </Modal>
  );
}

type Proposal = Tables<"proposals">;

function ManageLotModal({ lot, userId, onClose, onChanged }: { lot: Lot; userId: string; onClose: () => void; onChanged: () => void }) {
  const [available, setAvailable] = useState<Battery[]>([]);
  const [assigned, setAssigned] = useState<Battery[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);

  const load = async () => {
    const wantedClass = lot.destino;
    const [{ data: linked }, { data: props }] = await Promise.all([
      supabase.from("lot_batteries").select("battery_id").eq("lot_id", lot.id),
      supabase.from("proposals").select("*").eq("lot_id", lot.id).order("created_at", { ascending: false }),
    ]);
    const linkedIds = (linked ?? []).map((r) => r.battery_id);
    const { data: bats } = await supabase.from("batteries").select("*").eq("classificacao", wantedClass);
    setAssigned((bats ?? []).filter((b) => linkedIds.includes(b.id)));
    setAvailable((bats ?? []).filter((b) => !linkedIds.includes(b.id) && b.status === "classified"));
    setProposals(props ?? []);
  };
  useEffect(() => { void load(); }, [lot.id]);

  const addBattery = async (b: Battery) => {
    const { error } = await supabase.from("lot_batteries").insert({ lot_id: lot.id, battery_id: b.id });
    if (error) return toast.error(error.message);
    await supabase.from("batteries").update({ status: "in_lot" }).eq("id", b.id);
    await supabase.from("battery_events").insert({ battery_id: b.id, actor_id: userId, event_type: "added_to_lot", notes: `Adicionada ao lote ${lot.code}` });
    void load();
    onChanged();
  };
  const removeBattery = async (b: Battery) => {
    await supabase.from("lot_batteries").delete().eq("lot_id", lot.id).eq("battery_id", b.id);
    await supabase.from("batteries").update({ status: "classified" }).eq("id", b.id);
    void load();
    onChanged();
  };
  const publish = async () => {
    await supabase.from("lots").update({ status: "published" }).eq("id", lot.id);
    toast.success("Lote publicado para recicladores");
    onChanged(); onClose();
  };
  const unpublish = async () => {
    if (!window.confirm("Despublicar este lote? As propostas em aberto continuarão visíveis, mas o lote sai da vitrine.")) return;
    const { error } = await supabase.from("lots").update({ status: "open" }).eq("id", lot.id).eq("status", "published");
    if (error) return toast.error(error.message);
    toast.success("Lote despublicado");
    onChanged(); onClose();
  };
  const acceptProposal = async (p: Proposal) => {
    // Concurrency guard: only accept if lot is still 'published'
    const { data: locked, error: lockErr } = await supabase
      .from("lots")
      .update({ status: "awarded" })
      .eq("id", lot.id)
      .eq("status", "published")
      .select("id")
      .maybeSingle();
    if (lockErr) return toast.error(lockErr.message);
    if (!locked) {
      toast.error("Este lote já foi arrematado ou não está mais publicado.");
      onChanged(); void load();
      return;
    }
    await supabase.from("proposals").update({ status: "accepted" }).eq("id", p.id);
    await supabase.from("proposals").update({ status: "rejected" }).eq("lot_id", lot.id).neq("id", p.id).eq("status", "submitted");
    await supabase.from("collections").insert({
      lot_id: lot.id,
      origem_endereco: `${lot.cidade ?? ""}/${lot.uf ?? ""}`,
      destino_endereco: "A definir com reciclador",
      status: "available",
    });
    toast.success("Proposta aceita e coleta criada");
    onChanged(); void load();
  };

  return (
    <Modal onClose={onClose} title={`${lot.code} — ${lot.titulo}`}>
      <div className="grid gap-6 text-sm">
        <div className="flex items-center gap-2"><StatusBadge status={lot.status} /><span className="text-slate-400">{lot.destino === "reciclagem" ? "Reciclagem" : "Segunda vida"}</span></div>

        <section>
          <h3 className="text-xs uppercase font-mono text-slate-400 mb-2 flex items-center gap-1"><Package className="w-3 h-3" /> Baterias no lote ({assigned.length})</h3>
          {assigned.length === 0 && <p className="text-xs text-slate-500">Nenhuma bateria adicionada.</p>}
          <ul className="grid gap-1">
            {assigned.map((b) => (
              <li key={b.id} className="flex justify-between items-center px-3 py-2 bg-white/5 rounded">
                <span><span className="font-mono text-brand">{b.code}</span> · {b.quimica} · {b.quantidade}x</span>
                {lot.status === "open" && <button onClick={() => removeBattery(b)} className="text-danger text-xs">Remover</button>}
              </li>
            ))}
          </ul>
        </section>

        {lot.status === "open" && (
          <section>
            <h3 className="text-xs uppercase font-mono text-slate-400 mb-2">Disponíveis para adicionar ({available.length})</h3>
            <div className="max-h-52 overflow-y-auto grid gap-1">
              {available.map((b) => (
                <button key={b.id} onClick={() => addBattery(b)} className="flex justify-between items-center px-3 py-2 border border-white/10 rounded hover:bg-white/5 text-left">
                  <span><span className="font-mono text-brand">{b.code}</span> · {b.quimica} · {b.quantidade}x</span>
                  <span className="text-brand text-xs">+ Adicionar</span>
                </button>
              ))}
              {available.length === 0 && <p className="text-xs text-slate-500">Nenhuma bateria classificada compatível.</p>}
            </div>
            <button onClick={publish} disabled={assigned.length === 0} className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 bg-brand text-industrial rounded-md font-semibold disabled:opacity-50">
              <Send className="w-4 h-4" /> Publicar para recicladores
            </button>
          </section>
        )}

        {lot.status === "published" && proposals.every((p) => p.status !== "accepted") && (
          <div className="flex justify-end">
            <button onClick={unpublish} className="px-3 py-1.5 border border-white/20 rounded text-xs hover:bg-white/5">
              Despublicar e reabrir para edição
            </button>
          </div>
        )}

        {proposals.length > 0 && (
          <section>
            <h3 className="text-xs uppercase font-mono text-slate-400 mb-2">Propostas recebidas ({proposals.length})</h3>
            <ul className="grid gap-2">
              {proposals.map((p) => (
                <li key={p.id} className="p-3 border border-white/10 rounded">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-semibold">R$ {Number(p.valor_total).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>
                      {p.condicoes && <div className="text-xs text-slate-400 mt-1">{p.condicoes}</div>}
                    </div>
                    <StatusBadge status={p.status} />
                  </div>
                  {p.status === "submitted" && lot.status !== "awarded" && (
                    <button onClick={() => acceptProposal(p)} className="mt-2 text-brand text-xs">Aceitar proposta</button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </Modal>
  );
}
