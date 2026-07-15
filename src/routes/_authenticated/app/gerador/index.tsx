import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { workflowLabel } from "@/lib/workflow";
import { Plus, Filter, Download, Eye } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type Battery = Database["public"]["Tables"]["batteries"]["Row"];

export const Route = createFileRoute("/_authenticated/app/gerador/")({
  component: GeradorDashboard,
});

function GeradorDashboard() {
  const navigate = useNavigate();
  const auth = useAuth();
  const [batteries, setBatteries] = useState<Battery[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCadastradas, setTotalCadastradas] = useState(0);
  const [totalColetas, setTotalColetas] = useState(0);
  const [totalConcluidas, setTotalConcluidas] = useState(0);
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroQuimica, setFiltroQuimica] = useState("todos");
  const [page, setPage] = useState(0);
  const pageSize = 10;

  const loadDashboard = useCallback(async () => {
    if (!auth.user?.id) return;
    setLoading(true);

    try {
      // Obter organização do usuário
      const { data: company } = await supabase
        .from("companies")
        .select("id")
        .eq("owner_id", auth.user.id)
        .limit(1)
        .single();

      if (!company) {
        toast.error("Organização não encontrada.");
        setLoading(false);
        return;
      }

      // Obter total e filtrados
      const { data: allBatteries, count } = await supabase
        .from("batteries")
        .select("*", { count: "exact" })
        .eq("generator_organization_id", company.id)
        .order("created_at", { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      setBatteries(allBatteries || []);

      // KPIs
      const { data: statsData } = await supabase
        .from("batteries")
        .select("status")
        .eq("generator_organization_id", company.id);

      const stats = statsData || [];
      setTotalCadastradas(stats.length);
      setTotalColetas(stats.filter((b) => ["coleta_agendada", "em_transporte"].includes(b.status)).length);
      setTotalConcluidas(stats.filter((b) => b.status === "concluida").length);
    } catch (error) {
      console.error(error);
      toast.error("Erro ao carregar dashboard.");
    } finally {
      setLoading(false);
    }
  }, [auth.user?.id, page]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const handleDeleteBattery = async (batteryId: string) => {
    if (!confirm("Tem certeza que deseja cancelar esta bateria?")) return;
    try {
      const { error } = await supabase
        .from("batteries")
        .update({ status: "cancelada" })
        .eq("id", batteryId);

      if (error) throw error;
      toast.success("Bateria cancelada.");
      await loadDashboard();
    } catch (error) {
      toast.error("Erro ao cancelar bateria.");
    }
  };

  const statusStyles: Record<string, { bg: string; text: string; label: string }> = {
    cadastrada: { bg: "bg-blue-500/10", text: "text-blue-300", label: "Cadastrada" },
    aguardando_analise: { bg: "bg-yellow-500/10", text: "text-yellow-300", label: "Aguardando análise" },
    coleta_agendada: { bg: "bg-amber-500/10", text: "text-amber-300", label: "Coleta agendada" },
    em_transporte: { bg: "bg-orange-500/10", text: "text-orange-300", label: "Em transporte" },
    recebida_na_triagem: { bg: "bg-purple-500/10", text: "text-purple-300", label: "Triagem" },
    classificada: { bg: "bg-green-500/10", text: "text-green-300", label: "Classificada" },
    concluida: { bg: "bg-emerald-500/10", text: "text-emerald-300", label: "Concluída" },
    cancelada: { bg: "bg-red-500/10", text: "text-red-300", label: "Cancelada" },
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold mb-2">Painel do Gerador</h1>
          <p className="text-slate-400 text-sm">Acompanhe suas baterias e operações em tempo real.</p>
        </div>
        <Link
          to="/app/gerador/bateria/nova"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-brand text-industrial rounded-lg font-semibold hover:brightness-110 transition"
        >
          <Plus className="w-4 h-4" />
          Nova bateria
        </Link>
      </div>

      {/* KPIs */}
      <div className="grid md:grid-cols-4 gap-4">
        <div className="bg-white/5 border border-white/10 rounded-lg p-6">
          <p className="text-xs text-slate-400 font-mono uppercase mb-2">Total cadastradas</p>
          <p className="text-3xl font-bold">{totalCadastradas}</p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-lg p-6">
          <p className="text-xs text-slate-400 font-mono uppercase mb-2">Coletas agendadas</p>
          <p className="text-3xl font-bold text-amber-300">{totalColetas}</p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-lg p-6">
          <p className="text-xs text-slate-400 font-mono uppercase mb-2">Concluídas</p>
          <p className="text-3xl font-bold text-emerald-300">{totalConcluidas}</p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-lg p-6">
          <p className="text-xs text-slate-400 font-mono uppercase mb-2">Taxa conclusão</p>
          <p className="text-3xl font-bold text-blue-300">
            {totalCadastradas > 0 ? Math.round((totalConcluidas / totalCadastradas) * 100) : 0}%
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="inline-flex items-center gap-2 text-sm">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-slate-400">Filtrar por:</span>
        </div>
        <select
          value={filtroStatus}
          onChange={(e) => {
            setFiltroStatus(e.target.value);
            setPage(0);
          }}
          className="px-3 py-1.5 bg-industrial border border-white/10 rounded-md text-xs"
        >
          <option value="todos">Todos os status</option>
          <option value="cadastrada">Cadastrada</option>
          <option value="coleta_agendada">Coleta agendada</option>
          <option value="em_transporte">Em transporte</option>
          <option value="recebida_na_triagem">Triagem</option>
          <option value="classificada">Classificada</option>
          <option value="concluida">Concluída</option>
        </select>
        <select
          value={filtroQuimica}
          onChange={(e) => {
            setFiltroQuimica(e.target.value);
            setPage(0);
          }}
          className="px-3 py-1.5 bg-industrial border border-white/10 rounded-md text-xs"
        >
          <option value="todos">Todas as químicas</option>
          <option value="lfp">LFP</option>
          <option value="nmc">NMC</option>
          <option value="nca">NCA</option>
          <option value="lto">LTO</option>
        </select>
      </div>

      {/* Tabela */}
      <div className="bg-white/5 border border-white/10 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-white/10 bg-white/[0.02]">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-300">Código</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-300">Fabricante / Modelo</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-300">Química</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-300">SoH</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-300">Status</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-300">Data</th>
                <th className="px-4 py-3 text-center font-semibold text-slate-300">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400 text-xs">
                    Carregando...
                  </td>
                </tr>
              ) : batteries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400 text-xs">
                    Nenhuma bateria cadastrada ainda.
                  </td>
                </tr>
              ) : (
                batteries.map((battery) => {
                  const statusStyle = statusStyles[battery.status as keyof typeof statusStyles] || statusStyles.cadastrada;
                  return (
                    <tr key={battery.id} className="hover:bg-white/[0.02] transition">
                      <td className="px-4 py-3 font-mono text-xs text-brand">{battery.codigo_unico}</td>
                      <td className="px-4 py-3 text-xs">
                        <div>{battery.fabricante}</div>
                        <div className="text-slate-400">{battery.modelo}</div>
                      </td>
                      <td className="px-4 py-3 text-xs uppercase font-semibold">{battery.quimica}</td>
                      <td className="px-4 py-3 text-xs">{battery.soh_percentual ?? "—"}%</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-semibold ${statusStyle.bg} ${statusStyle.text}`}>
                          {statusStyle.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400">
                        {new Date(battery.created_at).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="px-4 py-3 flex justify-center gap-2">
                        <Link
                          to={`/app/gerador/bateria/${battery.id}`}
                          className="p-1.5 hover:bg-brand/20 rounded transition"
                          title="Ver detalhes"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                        {battery.status === "cadastrada" && (
                          <button
                            onClick={() => handleDeleteBattery(battery.id)}
                            className="p-1.5 hover:bg-red-500/20 rounded transition text-red-400 hover:text-red-300"
                            title="Cancelar"
                          >
                            ✕
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Paginação */}
        {batteries.length > 0 && (
          <div className="border-t border-white/10 px-4 py-3 flex justify-between items-center bg-white/[0.02] text-xs">
            <span className="text-slate-400">Página {page + 1}</span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(Math.max(0, page - 1))}
                disabled={page === 0}
                className="px-2 py-1 border border-white/10 rounded disabled:opacity-50 hover:border-brand transition"
              >
                Anterior
              </button>
              <button
                onClick={() => setPage(page + 1)}
                disabled={batteries.length < pageSize}
                className="px-2 py-1 border border-white/10 rounded disabled:opacity-50 hover:border-brand transition"
              >
                Próxima
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
