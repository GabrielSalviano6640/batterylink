import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Recycle, CheckCircle2 } from "lucide-react";
import { Modal, StatusBadge, Inp } from "./gerador";
import { workflowRpc } from "@/lib/workflow";

type Lot = Tables<"lots">;
type Proposal = Tables<"proposals">;
type Battery = Tables<"batteries">;
type Operation = Tables<"operations">;

export function RecicladorDashboard({ userId }: { userId: string }) {
  const [lots, setLots] = useState<Lot[]>([]);
  const [myProposals, setMyProposals] = useState<Proposal[]>([]);
  const [operations, setOperations] = useState<Operation[]>([]);
  const [propose, setPropose] = useState<Lot | null>(null);
  const [tab, setTab] = useState<"available" | "won">("available");

  const load = async () => {
    const [{ data: l }, { data: p }, { data: op }] = await Promise.all([
      supabase.from("lots").select("*").in("status", ["publicado","recebendo_propostas","em_analise","proposta_aceita","contratado","em_transporte","entregue","documentacao_pendente","concluido"]).order("created_at", { ascending: false }),
      supabase.from("proposals").select("*").eq("reciclador_id", userId).order("created_at", { ascending: false }),
      supabase.from("operations").select("*").order("created_at", { ascending: false }),
    ]);
    setLots(l ?? []);
    setMyProposals(p ?? []);
    setOperations(op ?? []);
  };
  useEffect(() => { void load(); }, [userId]);

  const proposalFor = (lotId: string) => myProposals.find((p) => p.lot_id === lotId);
  const wonLotIds = new Set(myProposals.filter((p) => p.status === "aceita").map((p) => p.lot_id));
  const availableLots = lots.filter((l) => ["publicado","recebendo_propostas"].includes(l.status) || (["em_analise","proposta_aceita"].includes(l.status) && !wonLotIds.has(l.id)));
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
              {isWon && (
                <DestinationActions
                  operation={operations.find((operation) => operation.lot_id === l.id) ?? null}
                  userId={userId}
                  onChanged={() => void load()}
                />
              )}
              {p && (
                <div className="mt-3 text-xs flex items-center gap-2">
                  <span className="text-slate-400">Sua proposta:</span>
                  <span className="font-semibold">R$ {Number(p.valor_total).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                  <StatusBadge status={p.status} />
                </div>
              )}
              {!p && ["publicado","recebendo_propostas"].includes(l.status) && (
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
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DestinationActions({
  operation,
  userId,
  onChanged,
}: {
  operation: Operation | null;
  userId: string;
  onChanged: () => void;
}) {
  const [uploading, setUploading] = useState(false);

  if (!operation) {
    return <p className="mt-3 text-xs text-slate-500">Aguardando criação da operação.</p>;
  }

  const confirmReceipt = async () => {
    try {
      await workflowRpc("confirm_destination_receipt", {
        _operation_id: operation.id,
        _reason: "Material conferido e recebido pela recicladora",
      });
      toast.success("Recebimento confirmado");
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao confirmar recebimento");
    }
  };

  const uploadDocument = async (file: File) => {
    setUploading(true);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
      const path = `${userId}/${operation.id}/${crypto.randomUUID()}-${safeName}`;
      const { error } = await supabase.storage.from("workflow-documents").upload(path, file, {
        upsert: false,
      });
      if (error) throw error;
      await workflowRpc("register_operation_document", {
        _operation_id: operation.id,
        _document_type: "comprovante_entrega",
        _storage_path: path,
        _document_number: null,
        _issuer: "Recicladora",
      });
      toast.success("Comprovante anexado e enviado para validação");
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao anexar comprovante");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="mt-3 p-3 border border-white/10 rounded-md text-xs">
      <div className="flex items-center justify-between gap-2">
        <span className="text-slate-400">Operação</span>
        <StatusBadge status={operation.status} />
      </div>
      <div className="flex flex-wrap gap-2 mt-3">
        {["criada", "em_transporte", "aguardando_recebimento"].includes(operation.status) && (
          <button onClick={() => void confirmReceipt()} className="inline-flex items-center gap-1 text-brand">
            <CheckCircle2 className="w-3 h-3" /> Confirmar recebimento
          </button>
        )}
        {["recebida", "documentacao_pendente"].includes(operation.status) && (
          <label className="cursor-pointer text-brand">
            {uploading ? "Enviando..." : "Anexar comprovante"}
            <input
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              disabled={uploading}
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void uploadDocument(file);
              }}
            />
          </label>
        )}
      </div>
    </div>
  );
}


function ProposeModal({ lot, userId, onClose, onSent }: { lot: Lot; userId: string; onClose: () => void; onSent: () => void }) {
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    try {
      await workflowRpc("submit_lot_proposal", {
        _lot_id: lot.id,
        _amount: Number(fd.get("valor")),
        _conditions: String(fd.get("condicoes") || "") || null,
        _commercial_model: String(fd.get("modelo") || "compra_lote"),
        _withdrawal_days: fd.get("prazo") ? Number(fd.get("prazo")) : null,
        _valid_until: null,
        _destination: lot.destino,
        _organization_id: null,
      });
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
        <Inp name="prazo" label="Prazo para retirada (dias)" type="number" min={1} />
        <Inp name="modelo" label="Modelo comercial" defaultValue="compra_lote" />
        <label className="grid gap-1">
          <span className="text-xs text-slate-400">Condições (prazo, forma de pagamento, retirada)</span>
          <textarea name="condicoes" rows={4} className="px-3 py-2 bg-white/5 border border-white/10 rounded-md text-sm" />
        </label>
        <div className="flex justify-end"><button type="submit" className="px-4 py-2 bg-brand text-industrial rounded-md text-sm font-semibold">Enviar</button></div>
      </form>
    </Modal>
  );
}
