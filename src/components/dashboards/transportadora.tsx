import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Truck } from "lucide-react";
import { StatusBadge } from "./gerador";

type Collection = Tables<"collections">;

const nextStatus: Record<string, { next: Collection["status"]; label: string } | null> = {
  available: { next: "accepted", label: "Aceitar coleta" },
  accepted: { next: "in_transit", label: "Iniciar transporte" },
  in_transit: { next: "delivered", label: "Confirmar entrega" },
  delivered: null,
  cancelled: null,
};

export function TransportadoraDashboard({ userId }: { userId: string }) {
  const [items, setItems] = useState<Collection[]>([]);
  const [tab, setTab] = useState<"available" | "mine">("available");

  const load = async () => {
    const { data } = await supabase.from("collections").select("*").order("created_at", { ascending: false });
    setItems(data ?? []);
  };
  useEffect(() => { void load(); }, []);

  const filtered = items.filter((c) => tab === "available" ? c.status === "available" : c.transportadora_id === userId);

  const advance = async (c: Collection) => {
    const step = nextStatus[c.status];
    if (!step) return;
    if (step.next === "delivered") {
      const { error } = await supabase.rpc("deliver_collection", { _collection_id: c.id });
      if (error) return toast.error(error.message);
    } else {
      const payload: Partial<Collection> = { status: step.next };
      if (c.status === "available") payload.transportadora_id = userId;
      const { error } = await supabase.from("collections").update(payload).eq("id", c.id);
      if (error) return toast.error(error.message);
    }
    toast.success(`Coleta atualizada: ${step.label}`);
    void load();
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
          const step = nextStatus[c.status];
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
              {step && (
                <button onClick={() => advance(c)} className="mt-2 px-3 py-1.5 bg-brand text-industrial rounded-md text-xs font-semibold">
                  {step.label}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
