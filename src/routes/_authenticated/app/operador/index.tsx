import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { workflowLabel } from "@/lib/workflow";
import { Filter, Download, Eye, MoreVertical, Plus, Check, SkipForward } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type Battery = Database["public"]["Tables"]["batteries"]["Row"];
type BatteryStatus = Database["public"]["Enums"]["battery_status"];
type BatteryWithProposal = Battery;

export const Route = createFileRoute("/_authenticated/app/operador/")({
  component: OperadorDashboard,
});

function OperadorDashboard() {
  const auth = useAuth();
  const [batteries, setBatteries] = useState<BatteryWithProposal[]>([]);
  const [filtroStatus, setFiltroStatus] = useState<BatteryStatus | "">("recebida_na_triagem");
  const [filtroQuimica, setFiltroQuimica] = useState<string>("");
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedBattery, setSelectedBattery] = useState<BatteryWithProposal | null>(null);
  const [showTriageModal, setShowTriageModal] = useState(false);

  const statusOptions = [
    { value: "recebida_na_triagem", label: "Em triagem", color: "bg-amber-500/20 text-amber-300" },
    { value: "em_lote", label: "Lote formado", color: "bg-blue-500/20 text-blue-300" },
    {
      value: "classificada",
      label: "Diagnóstico concluído",
      color: "bg-cyan-500/20 text-cyan-300",
    },
    {
      value: "em_negociacao",
      label: "Proposta enviada",
      color: "bg-purple-500/20 text-purple-300",
    },
  ];

  const chemistryOptions = [
    { value: "lfp", label: "LFP" },
    { value: "nmc", label: "NMC" },
    { value: "nca", label: "NCA" },
    { value: "lto", label: "LTO" },
    { value: "lmo", label: "LMO" },
    { value: "chumbo-acido", label: "Chumbo-ácido" },
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
          .eq("tipo", "operador")
          .limit(1)
          .single();

        if (!company?.id) {
          toast.error("Operador não vinculado a nenhuma organização.");
          return;
        }

        let query = supabase
          .from("batteries")
          .select("*")
          .eq("operator_organization_id", company.id);

        if (filtroStatus) query = query.eq("status", filtroStatus);
        if (filtroQuimica) query = query.eq("quimica", filtroQuimica);

        const from = page * 10;
        const to = from + 10 - 1;

        const { data, error } = await query
          .range(from, to)
          .order("created_at", { ascending: false });

        if (error) throw error;
        setBatteries(data || []);
      } catch (error) {
        console.error(error);
        toast.error("Erro ao carregar baterias.");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [auth?.user?.id, filtroStatus, filtroQuimica, page]);

  const handleAdvanceStatus = async (battery: BatteryWithProposal, newStatus: BatteryStatus) => {
    try {
      const { error } = await supabase
        .from("batteries")
        .update({ status: newStatus })
        .eq("id", battery.id);

      if (error) throw error;

      // Log event
      await supabase.from("battery_events").insert({
        battery_id: battery.id,
        event_type: newStatus,
        notes: `Status atualizado por operador para: ${workflowLabel(newStatus)}`,
      });

      toast.success("Status atualizado com sucesso!");
      setBatteries(batteries.map((b) => (b.id === battery.id ? { ...b, status: newStatus } : b)));
      setSelectedBattery(null);
    } catch (error) {
      console.error(error);
      toast.error("Erro ao atualizar status.");
    }
  };

  const handleSkipDiagnostic = async (battery: BatteryWithProposal) => {
    try {
      const { error } = await supabase
        .from("batteries")
        .update({ status: "em_negociacao" })
        .eq("id", battery.id);

      if (error) throw error;

      toast.success("Diagnostico pulado. Baterias enviadas para proposta.");
      setBatteries(
        batteries.map((b) => (b.id === battery.id ? { ...b, status: "em_negociacao" } : b)),
      );
      setSelectedBattery(null);
    } catch (error) {
      console.error(error);
      toast.error("Erro ao pular diagnóstico.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold">Triagem de Baterias</h1>
          <p className="text-sm text-slate-400 mt-1">Processe e forme lotes para reciclagem</p>
        </div>
        <button className="inline-flex items-center gap-2 px-4 py-2 bg-brand hover:bg-brand/90 rounded-lg text-white font-semibold transition">
          <Plus className="w-4 h-4" />
          Importar lote
        </button>
      </div>

      {/* KPIs */}
      <div className="grid md:grid-cols-4 gap-4">
        {[
          {
            label: "Em triagem",
            count: batteries.filter((b) => b.status === "recebida_na_triagem").length,
          },
          {
            label: "Lotes formados",
            count: batteries.filter((b) => b.status === "em_lote").length,
          },
          {
            label: "Diagnóstico",
            count: batteries.filter((b) => b.status === "classificada").length,
          },
          {
            label: "Propostas",
            count: batteries.filter((b) => b.status === "em_negociacao").length,
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
            setFiltroStatus(e.target.value as BatteryStatus | "");
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

        <select
          value={filtroQuimica}
          onChange={(e) => {
            setFiltroQuimica(e.target.value);
            setPage(0);
          }}
          className="px-3 py-1.5 bg-white/10 border border-white/20 rounded text-sm hover:bg-white/20 transition focus:outline-none focus:border-brand"
        >
          <option value="">Todas as químicas</option>
          {chemistryOptions.map((opt) => (
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
                  <th className="px-4 py-3 text-left font-semibold">Código</th>
                  <th className="px-4 py-3 text-left font-semibold">Fabricante</th>
                  <th className="px-4 py-3 text-left font-semibold">Química</th>
                  <th className="px-4 py-3 text-left font-semibold">SoH%</th>
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
                ) : batteries.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                      Nenhuma bateria para triagem.
                    </td>
                  </tr>
                ) : (
                  batteries.map((battery) => (
                    <tr
                      key={battery.id}
                      className="border-b border-white/5 hover:bg-white/[0.03] transition cursor-pointer"
                      onClick={() => setSelectedBattery(battery)}
                    >
                      <td className="px-4 py-3 text-brand font-mono">{battery.code}</td>
                      <td className="px-4 py-3">{battery.fabricante}</td>
                      <td className="px-4 py-3 text-xs">
                        <span className="px-2 py-1 bg-blue-500/20 text-blue-300 rounded">
                          {battery.quimica.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3">{battery.soh_percentual ?? "—"}%</td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-1 rounded text-xs font-semibold ${
                            statusOptions.find((s) => s.value === battery.status)?.color ||
                            "bg-slate-500/20 text-slate-300"
                          }`}
                        >
                          {workflowLabel(battery.status)}
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
              Página {page + 1} • {batteries.length} bateria(s)
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
                disabled={batteries.length < 10}
                className="px-3 py-1 bg-white/10 rounded text-xs font-semibold hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                Próxima
              </button>
            </div>
          </div>
        </div>

        {/* Detail panel */}
        <div className="bg-white/5 border border-white/10 rounded-lg p-6 h-fit">
          {selectedBattery ? (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold mb-2">
                  {selectedBattery.fabricante} {selectedBattery.modelo}
                </h3>
                <p className="text-xs text-slate-400">{selectedBattery.code}</p>
              </div>

              <div className="space-y-2 text-sm">
                <div>
                  <p className="text-xs text-slate-400">Status atual</p>
                  <p className="font-semibold">{workflowLabel(selectedBattery.status)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">SoH</p>
                  <p className="font-semibold">{selectedBattery.soh_percentual ?? "—"}%</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Capacidade</p>
                  <p className="font-semibold">{selectedBattery.capacidade_kwh ?? "—"} kWh</p>
                </div>
              </div>

              <div className="bg-white/[0.02] rounded p-3 border border-white/5">
                <p className="text-xs text-slate-400 mb-2">Riscos</p>
                <div className="flex flex-wrap gap-1">
                  {selectedBattery.possui_risco_termico && (
                    <span className="px-1.5 py-0.5 bg-red-600/20 text-red-400 rounded text-xs">
                      Risco térmico
                    </span>
                  )}
                  {selectedBattery.possui_avaria && (
                    <span className="px-1.5 py-0.5 bg-orange-500/20 text-orange-300 rounded text-xs">
                      Avaria
                    </span>
                  )}
                  {!selectedBattery.possui_risco_termico && !selectedBattery.possui_avaria && (
                    <span className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-300 rounded text-xs">
                      Segura
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                {selectedBattery.status === "recebida_na_triagem" && (
                  <>
                    <button
                      onClick={() => handleAdvanceStatus(selectedBattery, "classificada")}
                      className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 bg-brand hover:bg-brand/90 rounded font-semibold text-sm transition"
                    >
                      <Check className="w-4 h-4" />
                      Concluir triagem
                    </button>
                    <button
                      onClick={() => handleSkipDiagnostic(selectedBattery)}
                      className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 border border-white/20 hover:bg-white/10 rounded font-semibold text-sm transition"
                    >
                      <SkipForward className="w-4 h-4" />
                      Pular diagnóstico
                    </button>
                  </>
                )}
                {selectedBattery.status === "classificada" && (
                  <button
                    onClick={() => handleAdvanceStatus(selectedBattery, "em_negociacao")}
                    className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 bg-brand hover:bg-brand/90 rounded font-semibold text-sm transition"
                  >
                    <Check className="w-4 h-4" />
                    Enviar para proposta
                  </button>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-400">Selecione uma bateria para ver detalhes</p>
          )}
        </div>
      </div>
    </div>
  );
}
