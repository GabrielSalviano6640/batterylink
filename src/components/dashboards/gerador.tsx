import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { BatteryCharging, Plus, X, QrCode, FileDown } from "lucide-react";
import { generateCertificate } from "@/lib/certificate";

type Battery = Tables<"batteries">;

const statusLabels: Record<string, string> = {
  registered: "Registrada",
  triaging: "Em triagem",
  classified: "Classificada",
  in_lot: "Em lote",
  collected: "Coletada",
  delivered: "Entregue",
  recycled: "Reciclada",
  second_life: "Segunda vida",
  rejected: "Recusada",
};

export function GeradorDashboard({ userId }: { userId: string }) {
  const [items, setItems] = useState<Battery[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [detail, setDetail] = useState<Battery | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("batteries")
      .select("*")
      .eq("owner_id", userId)
      .order("created_at", { ascending: false });
    setItems(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, [userId]);

  const filtered = items.filter(
    (b) =>
      !q ||
      b.code.toLowerCase().includes(q.toLowerCase()) ||
      (b.fabricante ?? "").toLowerCase().includes(q.toLowerCase()) ||
      (b.modelo ?? "").toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <BatteryCharging className="w-5 h-5 text-brand" />
            <p className="font-mono text-xs text-brand tracking-widest uppercase">Painel · Gerador</p>
          </div>
          <h1 className="text-2xl font-display font-bold">Minhas baterias</h1>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand text-industrial rounded-md text-sm font-semibold"
        >
          <Plus className="w-4 h-4" /> Nova bateria
        </button>
      </div>

      <input
        placeholder="Buscar por código, fabricante ou modelo..."
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="w-full mb-4 px-3 py-2 bg-white/5 border border-white/10 rounded-md text-sm"
      />

      <div className="border border-white/10 rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-xs uppercase font-mono text-slate-400">
            <tr>
              <th className="text-left px-3 py-2">Código</th>
              <th className="text-left px-3 py-2">Origem</th>
              <th className="text-left px-3 py-2">Química</th>
              <th className="text-left px-3 py-2">Qtd</th>
              <th className="text-left px-3 py-2">Status</th>
              <th className="text-left px-3 py-2">Criada</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-500">Carregando...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-500">Nenhuma bateria registrada.</td></tr>
            ) : filtered.map((b) => (
              <tr key={b.id} onClick={() => setDetail(b)} className="border-t border-white/5 hover:bg-white/5 cursor-pointer">
                <td className="px-3 py-2 font-mono text-brand">{b.code}</td>
                <td className="px-3 py-2">{b.origem}</td>
                <td className="px-3 py-2">{b.quimica}</td>
                <td className="px-3 py-2">{b.quantidade}</td>
                <td className="px-3 py-2"><StatusBadge status={b.status} /></td>
                <td className="px-3 py-2 text-slate-400">{new Date(b.created_at).toLocaleDateString("pt-BR")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && <NewBatteryModal userId={userId} onClose={() => setShowForm(false)} onCreated={() => { void load(); setShowForm(false); }} />}
      {detail && <BatteryDetailModal battery={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const color: Record<string, string> = {
    registered: "bg-slate-500/20 text-slate-300",
    triaging: "bg-brand/20 text-brand",
    classified: "bg-blue-500/20 text-blue-300",
    in_lot: "bg-indigo-500/20 text-indigo-300",
    collected: "bg-purple-500/20 text-purple-300",
    delivered: "bg-teal-500/20 text-teal-300",
    recycled: "bg-emerald-500/20 text-emerald-300",
    second_life: "bg-emerald-500/20 text-emerald-300",
    rejected: "bg-danger/20 text-danger",
  };
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-mono ${color[status] ?? "bg-white/10"}`}>
      {statusLabels[status] ?? status}
    </span>
  );
}

function NewBatteryModal({ userId, onClose, onCreated }: { userId: string; onClose: () => void; onCreated: () => void }) {
  const [saving, setSaving] = useState(false);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSaving(true);
    try {
      const payload = {
        owner_id: userId,
        origem: String(fd.get("origem")),
        fabricante: String(fd.get("fabricante") || "") || null,
        modelo: String(fd.get("modelo") || "") || null,
        quimica: String(fd.get("quimica")),
        capacidade_kwh: fd.get("capacidade") ? Number(fd.get("capacidade")) : null,
        quantidade: Number(fd.get("quantidade") || 1),
        peso_kg: fd.get("peso") ? Number(fd.get("peso")) : null,
        estado: String(fd.get("estado_bat")),
        urgencia: String(fd.get("urgencia")),
        cep: String(fd.get("cep") || "") || null,
        cidade: String(fd.get("cidade") || "") || null,
        uf: String(fd.get("uf") || "") || null,
        endereco: String(fd.get("endereco") || "") || null,
        observacoes: String(fd.get("observacoes") || "") || null,
      };
      const { data, error } = await supabase.from("batteries").insert(payload).select().single();
      if (error) throw error;
      await supabase.from("battery_events").insert({
        battery_id: data.id, actor_id: userId, event_type: "created", notes: "Bateria registrada pelo gerador",
      });
      toast.success(`Bateria ${data.code} registrada`);
      onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao registrar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal onClose={onClose} title="Nova bateria">
      <form onSubmit={submit} className="grid gap-3 text-sm">
        <div className="grid md:grid-cols-2 gap-3">
          <Sel name="origem" label="Origem" required options={["Veículo elétrico","Veículo híbrido","Frota comercial","Máquina industrial","BESS","Outro"]} />
          <Sel name="quimica" label="Química" required options={["LFP","NMC","NCA","LTO","Chumbo-ácido","Outra"]} />
          <Inp name="fabricante" label="Fabricante" />
          <Inp name="modelo" label="Modelo" />
          <Inp name="capacidade" label="Capacidade (kWh)" type="number" step="0.1" />
          <Inp name="quantidade" label="Quantidade" type="number" required defaultValue={1} min={1} />
          <Inp name="peso" label="Peso (kg)" type="number" step="0.1" />
          <Sel name="estado_bat" label="Estado" required options={["Íntegra","Fim de vida","Avariada","Sinistrada","Inchada/vazamento"]} />
          <Sel name="urgencia" label="Urgência" required options={["Baixa (30d)","Média (15d)","Alta (7d)","Emergencial"]} />
          <Inp name="cep" label="CEP" />
          <Inp name="cidade" label="Cidade" />
          <Inp name="uf" label="UF" maxLength={2} />
        </div>
        <Inp name="endereco" label="Endereço de coleta" />
        <label className="grid gap-1">
          <span className="text-xs text-slate-400">Observações</span>
          <textarea name="observacoes" rows={3} className="px-3 py-2 bg-white/5 border border-white/10 rounded-md" />
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 border border-white/10 rounded-md">Cancelar</button>
          <button type="submit" disabled={saving} className="px-4 py-2 bg-brand text-industrial rounded-md font-semibold disabled:opacity-50">
            {saving ? "Salvando..." : "Registrar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

type EventRow = Tables<"battery_events">;

function BatteryDetailModal({ battery, onClose }: { battery: Battery; onClose: () => void }) {
  const [events, setEvents] = useState<EventRow[]>([]);
  useEffect(() => {
    void supabase.from("battery_events").select("*").eq("battery_id", battery.id).order("created_at", { ascending: true }).then(({ data }) => setEvents(data ?? []));
  }, [battery.id]);

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(battery.code)}`;

  return (
    <Modal onClose={onClose} title={battery.code}>
      <div className="grid md:grid-cols-[180px_1fr] gap-6 text-sm">
        <div className="flex flex-col items-center gap-2">
          <img src={qrUrl} alt={`QR ${battery.code}`} className="rounded bg-white p-2" width={180} height={180} />
          <span className="text-xs text-slate-400 inline-flex items-center gap-1"><QrCode className="w-3 h-3" /> Rastreio</span>
        </div>
        <div className="grid gap-2">
          <Row k="Status"><StatusBadge status={battery.status} /></Row>
          <Row k="Origem">{battery.origem}</Row>
          <Row k="Química">{battery.quimica}</Row>
          <Row k="Fabricante/Modelo">{[battery.fabricante, battery.modelo].filter(Boolean).join(" / ") || "—"}</Row>
          <Row k="Capacidade">{battery.capacidade_kwh ? `${battery.capacidade_kwh} kWh` : "—"}</Row>
          <Row k="Quantidade">{battery.quantidade}</Row>
          <Row k="Peso">{battery.peso_kg ? `${battery.peso_kg} kg` : "—"}</Row>
          <Row k="Estado">{battery.estado}</Row>
          <Row k="Urgência">{battery.urgencia}</Row>
          <Row k="Local">{[battery.cidade, battery.uf].filter(Boolean).join("/") || "—"}</Row>
          {battery.classificacao && <Row k="Classificação">{battery.classificacao === "segunda_vida" ? "Segunda vida" : "Reciclagem"}</Row>}
          {battery.observacoes && <Row k="Observações">{battery.observacoes}</Row>}
          {["delivered", "recycled", "second_life"].includes(battery.status) && (
            <button
              onClick={() => void generateCertificate(battery)}
              className="mt-3 inline-flex items-center gap-1.5 self-start px-3 py-2 bg-brand text-industrial rounded-md text-xs font-semibold hover:brightness-110"
            >
              <FileDown className="w-3.5 h-3.5" /> Baixar certificado (PDF)
            </button>
          )}
        </div>
      </div>

      <div className="mt-6">
        <h3 className="text-xs uppercase font-mono text-slate-400 mb-2">Linha do tempo</h3>
        <ol className="border-l border-white/10 pl-4 space-y-3">
          {events.length === 0 && <li className="text-xs text-slate-500">Sem eventos.</li>}
          {events.map((e) => (
            <li key={e.id} className="relative">
              <span className="absolute -left-[21px] top-1 w-2 h-2 rounded-full bg-brand" />
              <div className="text-sm font-semibold">{e.event_type}</div>
              {e.notes && <div className="text-xs text-slate-400">{e.notes}</div>}
              <div className="text-[10px] text-slate-500 font-mono">{new Date(e.created_at).toLocaleString("pt-BR")}</div>
            </li>
          ))}
        </ol>
      </div>
    </Modal>
  );
}

export function Modal({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-industrial border border-white/10 rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 sticky top-0 bg-industrial z-10">
          <h2 className="font-display font-bold text-lg">{title}</h2>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return <div className="grid grid-cols-[140px_1fr] gap-2"><span className="text-slate-400 text-xs">{k}</span><span>{children}</span></div>;
}

export function Inp(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const { label, ...rest } = props;
  return (
    <label className="grid gap-1">
      <span className="text-xs text-slate-400">{label}{rest.required && " *"}</span>
      <input {...rest} className="px-3 py-2 bg-white/5 border border-white/10 rounded-md" />
    </label>
  );
}

export function Sel({ label, options, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string; options: (string | { value: string; label: string })[] }) {
  return (
    <label className="grid gap-1">
      <span className="text-xs text-slate-400">{label}{rest.required && " *"}</span>
      <select {...rest} className="px-3 py-2 bg-white/5 border border-white/10 rounded-md" defaultValue={rest.defaultValue ?? ""}>
        <option value="" disabled>Selecione...</option>
        {options.map((o) => {
          const v = typeof o === "string" ? o : o.value;
          const l = typeof o === "string" ? o : o.label;
          return <option key={v} value={v}>{l}</option>;
        })}
      </select>
    </label>
  );
}
