import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Truck } from "lucide-react";
import { StatusBadge } from "./gerador";
import { workflowRpc } from "@/lib/workflow";

type Collection = Tables<"collections">;

export function TransportadoraDashboard({ userId }: { userId: string }) {
  const [items, setItems] = useState<Collection[]>([]);
  const [tab, setTab] = useState<"available" | "mine">("available");

  const load = async () => {
    const { data } = await supabase.from("collections").select("*").order("created_at", { ascending: false });
    setItems(data ?? []);
  };
  useEffect(() => { void load(); }, []);

  const filtered = items.filter((c) => tab === "available" ? c.status === "ordem_criada" : c.transportadora_id === userId);

  const run = async (name: string, args: Record<string, unknown>, message: string) => {
    try {
      await workflowRpc(name, args);
      toast.success(message);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao atualizar coleta");
    }
  };

  const schedule = async (c: Collection) => {
    const value = window.prompt("Data e hora da coleta (AAAA-MM-DD HH:mm):");
    if (!value) return;
    const when = new Date(value.replace(" ", "T"));
    if (Number.isNaN(when.getTime())) return toast.error("Data inválida");
    const vehicle = window.prompt("Veículo:") ?? "";
    const plate = window.prompt("Placa:") ?? "";
    const driver = window.prompt("Motorista:") ?? "";
    await run("schedule_collection", {
      _collection_id: c.id,
      _scheduled_at: when.toISOString(),
      _vehicle: vehicle || null,
      _plate: plate || null,
      _driver: driver || null,
    }, "Coleta agendada");
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <Truck className="w-5 h-5 text-brand" />
        <p className="font-mono text-xs text-brand tracking-widest uppercase">Painel · Transportadora</p>
      </div>
      <h1 className="text-2xl font-display font-bold mb-6">Coletas</h1>

      <div className="flex gap-2 mb-4 border-b border-white/10">
        {(["available","mine"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm border-b-2 -mb-px ${tab===t?"border-brand text-brand":"border-transparent text-slate-400"}`}>
            {t === "available" ? "Disponíveis" : "Minhas coletas"}
          </button>
        ))}
      </div>

      <div className="grid gap-3">
        {filtered.length === 0 && <p className="text-sm text-slate-500">Nenhuma coleta.</p>}
        {filtered.map((c) => {
          return (
            <div key={c.id} className="p-4 border border-white/10 rounded-md">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <div className="text-xs text-slate-500 font-mono">Lote {c.lot_id.slice(0, 8)}</div>
                  <div className="text-sm mt-1"><span className="text-slate-400">Origem:</span> {c.origem_endereco}</div>
                  <div className="text-sm"><span className="text-slate-400">Destino:</span> {c.destino_endereco}</div>
                </div>
                <StatusBadge status={c.status} />
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                {c.status === "ordem_criada" && (
                  <>
                    <button
                      onClick={() => void run("respond_collection_order", {
                        _collection_id: c.id, _accept: true, _reason: "Ordem aceita pela transportadora", _carrier_organization_id: null,
                      }, "Ordem aceita")}
                      className="px-3 py-1.5 bg-brand text-industrial rounded-md text-xs font-semibold"
                    >
                      Aceitar
                    </button>
                    <button
                      onClick={() => {
                        const reason = window.prompt("Motivo da recusa:") ?? "Ordem recusada";
                        void run("respond_collection_order", {
                          _collection_id: c.id, _accept: false, _reason: reason, _carrier_organization_id: null,
                        }, "Ordem recusada");
                      }}
                      className="px-3 py-1.5 border border-danger/40 text-danger rounded-md text-xs"
                    >
                      Recusar
                    </button>
                  </>
                )}
                {c.status === "aceita" && (
                  <button onClick={() => void schedule(c)} className="px-3 py-1.5 bg-brand text-industrial rounded-md text-xs font-semibold">Agendar coleta</button>
                )}
                {c.status === "agendada" && (
                  <button onClick={() => void run("advance_collection", {
                    _collection_id: c.id, _action: "confirmar_retirada", _reason: "Material retirado na origem",
                  }, "Retirada confirmada")} className="px-3 py-1.5 bg-brand text-industrial rounded-md text-xs font-semibold">Confirmar retirada</button>
                )}
                {c.status === "retirada" && (
                  <button onClick={() => void run("advance_collection", {
                    _collection_id: c.id, _action: "iniciar_transporte", _reason: "Transporte iniciado",
                  }, "Transporte iniciado")} className="px-3 py-1.5 bg-brand text-industrial rounded-md text-xs font-semibold">Iniciar transporte</button>
                )}
                {c.status === "em_transporte" && (
                  <button onClick={() => void run("advance_collection", {
                    _collection_id: c.id, _action: "confirmar_entrega", _reason: "Entrega realizada",
                  }, "Entrega confirmada")} className="px-3 py-1.5 bg-brand text-industrial rounded-md text-xs font-semibold">Confirmar entrega</button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
