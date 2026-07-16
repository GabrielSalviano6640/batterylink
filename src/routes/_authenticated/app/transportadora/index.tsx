import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { workflowLabel } from "@/lib/workflow";
import { Filter, Download, Eye, MapPin, Calendar, Phone, Plus } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type Collection = Database["public"]["Tables"]["collections"]["Row"];
type CollectionStatus = Database["public"]["Enums"]["collection_status"];
type CollectionWithBatteries = Collection & {
  batteries?: { id: string; code: string; quantidade: number } | null;
};

export const Route = createFileRoute("/_authenticated/app/transportadora/")({
  component: TransportadoraDashboard,
});

function TransportadoraDashboard() {
  const auth = useAuth();
  const [collections, setCollections] = useState<CollectionWithBatteries[]>([]);
  const [filtroStatus, setFiltroStatus] = useState<CollectionStatus | "">("agendada");
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedCollection, setSelectedCollection] = useState<CollectionWithBatteries | null>(
    null,
  );

  const statusOptions = [
    { value: "agendada", label: "Agendada", color: "bg-blue-500/20 text-blue-300" },
    { value: "retirada", label: "Retirada", color: "bg-indigo-500/20 text-indigo-300" },
    { value: "em_transporte", label: "Em transporte", color: "bg-amber-500/20 text-amber-300" },
    { value: "entregue_triagem", label: "Entregue", color: "bg-emerald-500/20 text-emerald-300" },
    { value: "cancelada", label: "Cancelada", color: "bg-red-500/20 text-red-300" },
  ];

  useEffect(() => {
    const load = async () => {
      if (!auth?.user?.id) return;
      setLoading(true);

      try {
        const { data: company } = await supabase
          .from("companies")
          .select("id")
          .eq("owner_id", auth.user.id)
          .eq("tipo", "transportadora")
          .limit(1)
          .single();

        if (!company?.id) {
          toast.error("Transportadora não vinculada a nenhuma organização.");
          return;
        }

        let query = supabase
          .from("collections")
          .select("*, batteries(id, code, quantidade)")
          .eq("carrier_organization_id", company.id);

        if (filtroStatus) query = query.eq("status", filtroStatus);

        const from = page * 10;
        const to = from + 10 - 1;

        const { data, error } = await query
          .range(from, to)
          .order("data_coleta", { ascending: true });

        if (error) throw error;
        setCollections((data || []) as CollectionWithBatteries[]);
      } catch (error) {
        console.error(error);
        toast.error("Erro ao carregar coletas.");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [auth?.user?.id, filtroStatus, page]);

  const handleStatusUpdate = async (
    collection: CollectionWithBatteries,
    newStatus: CollectionStatus,
  ) => {
    try {
      const { error } = await supabase
        .from("collections")
        .update({ status: newStatus })
        .eq("id", collection.id);

      if (error) throw error;

      toast.success(`Coleta marcada como ${workflowLabel(newStatus)}`);
      setCollections(
        collections.map((c) => (c.id === collection.id ? { ...c, status: newStatus } : c)),
      );
      setSelectedCollection(null);
    } catch (error) {
      console.error(error);
      toast.error("Erro ao atualizar status da coleta.");
    }
  };

  const getNextStatus = (currentStatus: CollectionStatus): CollectionStatus | undefined => {
    const flow: Partial<Record<CollectionStatus, CollectionStatus>> = {
      agendada: "retirada",
      retirada: "em_transporte",
      em_transporte: "entregue_triagem",
    };
    return flow[currentStatus];
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold">Coletas programadas</h1>
          <p className="text-sm text-slate-400 mt-1">Gerencie entregas e rastreamento</p>
        </div>
        <button className="inline-flex items-center gap-2 px-4 py-2 bg-brand hover:bg-brand/90 rounded-lg text-white font-semibold transition">
          <Plus className="w-4 h-4" />
          Nova coleta
        </button>
      </div>

      {/* KPIs */}
      <div className="grid md:grid-cols-4 gap-4">
        {[
          { label: "Agendadas", count: collections.filter((c) => c.status === "agendada").length },
          {
            label: "Em transporte",
            count: collections.filter((c) => c.status === "em_transporte").length,
          },
          {
            label: "Entregues",
            count: collections.filter((c) => c.status === "entregue_triagem").length,
          },
          {
            label: "Canceladas",
            count: collections.filter((c) => c.status === "cancelada").length,
          },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="bg-white/5 border border-white/10 rounded-lg p-4 text-center"
          >
            <p className="text-xs text-slate-400 mb-1 uppercase tracking-wide">{kpi.label}</p>
            <p className="text-3xl font-bold text-brand">{kpi.count}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="inline-flex items-center gap-2 text-slate-400 text-sm">
          <Filter className="w-4 h-4" />
          Filtros:
        </div>
        <select
          value={filtroStatus}
          onChange={(e) => {
            setFiltroStatus(e.target.value as CollectionStatus | "");
            setPage(0);
          }}
          className="px-3 py-1.5 bg-white/10 border border-white/20 rounded text-sm hover:bg-white/20 transition focus:outline-none focus:border-brand"
        >
          <option value="">Todos os status</option>
          {statusOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <button className="inline-flex items-center gap-2 px-3 py-1.5 border border-white/20 rounded text-sm hover:bg-white/5 transition">
          <Download className="w-4 h-4" />
          Exportar
        </button>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Table */}
        <div className="lg:col-span-2 bg-white/5 border border-white/10 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.02]">
                  <th className="px-4 py-3 text-left font-semibold">Cidade</th>
                  <th className="px-4 py-3 text-left font-semibold">Data</th>
                  <th className="px-4 py-3 text-left font-semibold">Baterias</th>
                  <th className="px-4 py-3 text-left font-semibold">Contato</th>
                  <th className="px-4 py-3 text-left font-semibold">Status</th>
                  <th className="px-4 py-3 text-right font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                      Carregando...
                    </td>
                  </tr>
                ) : collections.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                      Nenhuma coleta disponível.
                    </td>
                  </tr>
                ) : (
                  collections.map((collection) => (
                    <tr
                      key={collection.id}
                      className="border-b border-white/5 hover:bg-white/[0.03] transition cursor-pointer"
                      onClick={() => setSelectedCollection(collection)}
                    >
                      <td className="px-4 py-3">{collection.origem_endereco}</td>
                      <td className="px-4 py-3 text-xs font-mono">
                        {new Date(
                          collection.data_coleta ??
                            collection.data_agendada ??
                            collection.scheduled_at ??
                            collection.created_at,
                        ).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 bg-blue-500/20 text-blue-300 rounded text-xs font-semibold">
                          {collection.batteries ? 1 : 0} bateria(s)
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {collection.motorista || collection.placa || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-1 rounded text-xs font-semibold ${
                            statusOptions.find((s) => s.value === collection.status)?.color ||
                            "bg-slate-500/20 text-slate-300"
                          }`}
                        >
                          {workflowLabel(collection.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button className="inline-flex items-center gap-2 px-2 py-1 hover:bg-white/10 rounded transition text-brand">
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-white/10 bg-white/[0.02]">
            <span className="text-xs text-slate-400">
              Página {page + 1} • {collections.length} coleta(s)
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(Math.max(0, page - 1))}
                disabled={page === 0}
                className="px-3 py-1 bg-white/10 rounded text-xs font-semibold hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                Anterior
              </button>
              <button
                onClick={() => setPage(page + 1)}
                disabled={collections.length < 10}
                className="px-3 py-1 bg-white/10 rounded text-xs font-semibold hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                Próxima
              </button>
            </div>
          </div>
        </div>

        {/* Detail panel */}
        <div className="bg-white/5 border border-white/10 rounded-lg p-6 h-fit">
          {selectedCollection ? (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-brand" />
                  {selectedCollection.origem_endereco}
                </h3>
                <p className="text-xs text-slate-400">
                  Destino: {selectedCollection.destino_endereco}
                </p>
              </div>

              <div className="space-y-2 text-sm">
                <div>
                  <p className="text-xs text-slate-400">Status</p>
                  <p className="font-semibold">{workflowLabel(selectedCollection.status)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <div>
                    <p className="text-xs text-slate-400">Data marcada</p>
                    <p className="font-semibold">
                      {new Date(
                        selectedCollection.data_coleta ??
                          selectedCollection.data_agendada ??
                          selectedCollection.scheduled_at ??
                          selectedCollection.created_at,
                      ).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                </div>
                {(selectedCollection.motorista || selectedCollection.placa) && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-slate-400" />
                    <div>
                      <p className="text-xs text-slate-400">Motorista / placa</p>
                      <p className="font-semibold">
                        {[selectedCollection.motorista, selectedCollection.placa]
                          .filter(Boolean)
                          .join(" • ")}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {selectedCollection.batteries && (
                <div className="bg-white/[0.02] rounded p-3 border border-white/5">
                  <p className="text-xs text-slate-400 mb-2">Bateria</p>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    <div className="text-xs text-slate-300">
                      {selectedCollection.batteries.code}
                      <span className="text-slate-500 ml-1">
                        ({selectedCollection.batteries.quantidade}x)
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {!["entregue_triagem", "entregue_destinador", "cancelada"].includes(
                selectedCollection.status,
              ) && (
                <button
                  onClick={() => {
                    const nextStatus = getNextStatus(selectedCollection.status);
                    if (nextStatus) handleStatusUpdate(selectedCollection, nextStatus);
                  }}
                  className="w-full px-3 py-2 bg-brand hover:bg-brand/90 rounded font-semibold text-sm transition"
                >
                  {selectedCollection.status === "agendada"
                    ? "Iniciar transporte"
                    : "Marcar como entregue"}
                </button>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-400">Selecione uma coleta para ver detalhes</p>
          )}
        </div>
      </div>
    </div>
  );
}
