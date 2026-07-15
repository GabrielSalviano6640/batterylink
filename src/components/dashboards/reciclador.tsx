import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Recycle, CheckCircle2 } from "lucide-react";
import { Modal, StatusBadge, Inp } from "./gerador";

type Lot = Tables<"lots">;
type Proposal = Tables<"proposals">;
type Battery = Tables<"batteries">;

export function RecicladorDashboard({ userId }: { userId: string }) {
  const [lots, setLots] = useState<Lot[]>([]);
  const [myProposals, setMyProposals] = useState<Proposal[]>([]);
  const [propose, setPropose] = useState<Lot | null>(null);
  const [tab, setTab] = useState<"available" | "won">("available");

  const load = async () => {
    const [{ data: l }, { data: p }] = await Promise.all([
      supabase.from("lots").select("*").in("status", ["published","negotiating","awarded","shipped","closed"]).order("created_at", { ascending: false }),
      supabase.from("proposals").select("*").eq("reciclador_id", userId).order("created_at", { ascending: false }),
    ]);
    setLots(l ?? []);
    setMyProposals(p ?? []);
  };
  useEffect(() => { void load(); }, [userId]);

  const proposalFor = (lotId: string) => myProposals.find((p) => p.lot_id === lotId);
  const wonLotIds = new Set(myProposals.filter((p) => p.status === "accepted").map((p) => p.lot_id));
  const availableLots = lots.filter((l) => ["published","negotiating"].includes(l.status) || (l.status === "awarded" && !wonLotIds.has(l.id)));
  const wonLots = lots.filter((l) => wonLotIds.has(l.id));

  const shown = tab === "available" ? availableLots : wonLots;

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <Recycle className="w-5 h-5 text-brand" />
        <p className="font-mono text-xs text-brand tracking-widest uppercase">Painel · Reciclador</p>
      </div>
      <h1 className="text-2xl font-display font-bold mb-4">Lotes</h1>

      <div className="flex gap-2 mb-4 border-b border-white/10">
        {(["available","won"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm border-b-2 -mb-px ${tab===t?"border-brand text-brand":"border-transparent text-slate-400"}`}>
            {t === "available" ? "Disponíveis" : `Lotes ganhos (${wonLots.length})`}
          </button>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        {shown.length === 0 && <p className="text-sm text-slate-500">{tab === "available" ? "Nenhum lote publicado no momento." : "Você ainda não venceu propostas."}</p>}
        {shown.map((l) => {
          const p = proposalFor(l.id);
          const isWon = wonLotIds.has(l.id);
          return (
            <div key={l.id} className="p-4 border border-white/10 rounded-md">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <div className="font-mono text-brand text-sm">{l.code}</div>
                  <div className="font-semibold">{l.titulo}</div>
                </div>
                <StatusBadge status={l.status} />
              </div>
              <p className="text-xs text-slate-400 mb-2">{l.destino === "reciclagem" ? "Reciclagem" : "Segunda vida"} · {l.cidade}/{l.uf}</p>
              {l.descricao && <p className="text-xs text-slate-400 mb-3">{l.descricao}</p>}
              <LotBatteries lotId={l.id} lotDestino={l.destino} isWon={isWon} onChanged={() => void load()} />
              {p && (
                <div className="mt-3 text-xs flex items-center gap-2">
                  <span className="text-slate-400">Sua proposta:</span>
                  <span className="font-semibold">R$ {Number(p.valor_total).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                  <StatusBadge status={p.status} />
                </div>
              )}
              {!p && l.status === "published" && (
                <button onClick={() => setPropose(l)} className="mt-3 text-brand text-xs hover:brightness-125">Enviar proposta</button>
              )}
            </div>
          );
        })}
      </div>

      {propose && <ProposeModal lot={propose} userId={userId} onClose={() => setPropose(null)} onSent={() => { void load(); setPropose(null); }} />}
    </div>
  );
}

function LotBatteries({ lotId, lotDestino, isWon, onChanged }: { lotId: string; lotDestino: Lot["destino"]; isWon: boolean; onChanged: () => void }) {
  const [bats, setBats] = useState<Battery[]>([]);
  const load = async () => {
    const { data: link } = await supabase.from("lot_batteries").select("battery_id").eq("lot_id", lotId);
    const ids = (link ?? []).map((r) => r.battery_id);
    if (ids.length === 0) return setBats([]);
    const { data } = await supabase.from("batteries").select("*").in("id", ids);
    setBats(data ?? []);
  };
  useEffect(() => { void load(); }, [lotId]);

  const totalKwh = bats.reduce((s, b) => s + (Number(b.capacidade_kwh) || 0) * b.quantidade, 0);
  const totalKg = bats.reduce((s, b) => s + (Number(b.peso_kg) || 0) * b.quantidade, 0);

  const finalize = async (b: Battery) => {
    const final = lotDestino === "reciclagem" ? "recycled" : "second_life";
    const { error } = await supabase.rpc("finalize_battery", { _battery_id: b.id, _final: final });
    if (error) return toast.error(error.message);
    toast.success(`${b.code} finalizada`);
    await load();
    onChanged();
  };

  return (
    <div className="text-xs text-slate-400">
      <div>{bats.length} bateria(s) · {totalKwh > 0 ? `${totalKwh.toFixed(1)} kWh` : "kWh n/i"} · {totalKg > 0 ? `${totalKg.toFixed(0)} kg` : "peso n/i"}</div>
      {isWon && bats.length > 0 && (
        <ul className="mt-2 grid gap-1">
          {bats.map((b) => (
            <li key={b.id} className="flex justify-between items-center px-2 py-1 bg-white/5 rounded">
              <span className="font-mono text-brand">{b.code}</span>
              <span className="flex items-center gap-2">
                <StatusBadge status={b.status} />
                {b.status === "delivered" && (
                  <button onClick={() => finalize(b)} className="inline-flex items-center gap-1 text-brand hover:brightness-125">
                    <CheckCircle2 className="w-3 h-3" /> Finalizar
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}


function ProposeModal({ lot, userId, onClose, onSent }: { lot: Lot; userId: string; onClose: () => void; onSent: () => void }) {
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    try {
      const { error } = await supabase.from("proposals").insert({
        lot_id: lot.id, reciclador_id: userId,
        valor_total: Number(fd.get("valor")),
        condicoes: String(fd.get("condicoes") || "") || null,
      });
      if (error) throw error;
      toast.success("Proposta enviada");
      onSent();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    }
  };
  return (
    <Modal onClose={onClose} title={`Proposta — ${lot.code}`}>
      <form onSubmit={submit} className="grid gap-3">
        <Inp name="valor" label="Valor total (R$)" type="number" step="0.01" required />
        <label className="grid gap-1">
          <span className="text-xs text-slate-400">Condições (prazo, forma de pagamento, retirada)</span>
          <textarea name="condicoes" rows={4} className="px-3 py-2 bg-white/5 border border-white/10 rounded-md text-sm" />
        </label>
        <div className="flex justify-end"><button type="submit" className="px-4 py-2 bg-brand text-industrial rounded-md text-sm font-semibold">Enviar</button></div>
      </form>
    </Modal>
  );
}
