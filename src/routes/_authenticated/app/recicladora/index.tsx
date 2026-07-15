import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { workflowLabel } from "@/lib/workflow";
import { Filter, Download, Eye, TrendingUp, DollarSign, Plus, CheckCircle, XCircle } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type Proposal = Database["public"]["Tables"]["battery_proposals"]["Row"];
type ProposalWithLot = Proposal & {
  lotes?: { id: string; codigo: string; quantidade_baterias: number; valor_total: number }[];
};

export const Route = createFileRoute("/_authenticated/app/recicladora/")({
  component: RecicladorgDashboard,
});

function RecicladorgDashboard() {
  const auth = useAuth();
  const [proposals, setProposals] = useState<ProposalWithLot[]>([]);
  const [filtroStatus, setFiltroStatus] = useState<string>("enviada");
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedProposal, setSelectedProposal] = useState<ProposalWithLot | null>(null);

  const statusOptions = [
    { value: "enviada", label: "Enviada", color: "bg-blue-500/20 text-blue-300" },
    { value: "aceita", label: "Aceita", color: "bg-emerald-500/20 text-emerald-300" },
    { value: "rejeitada", label: "Rejeitada", color: "bg-red-500/20 text-red-300" },
    { value: "operacao_em_andamento", label: "Em operação", color: "bg-amber-500/20 text-amber-300" },
    { value: "operacao_concluida", label: "Concluída", color: "bg-cyan-500/20 text-cyan-300" },
  ];

  useEffect(() => {
    const load = async () => {
      if (!auth?.user?.id) return;
      setLoading(true);

      try {
        // Find recycler's organization
        const { data: profile } = await supabase
          .from("profiles")
          .select("recicladora_organization_id")
          .eq("id", auth.user.id)
          .limit(1)
          .single();

        if (!profile?.recicladora_organization_id) {
          toast.error("Recicladora não vinculada a nenhuma organização.");
          return;
        }

        // Fetch proposals with lots
        let query = supabase
          .from("battery_proposals")
          .select("*, lotes(id, codigo, quantidade_baterias, valor_total)")
          .eq("recicladora_organization_id", profile.recicladora_organization_id);

        if (filtroStatus) query = query.eq("status", filtroStatus);

        const from = page * 10;
        const to = from + 10 - 1;

        const { data, error } = await query.range(from, to).order("created_at", { ascending: false });

        if (error) throw error;
        setProposals(data || []);
      } catch (error) {
        console.error(error);
        toast.error("Erro ao carregar propostas.");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [auth?.user?.id, filtroStatus, page]);

  const handleProposalStatusUpdate = async (proposal: ProposalWithLot, newStatus: string) => {
    try {
      const { error } = await supabase
        .from("battery_proposals")
        .update({ status: newStatus })
        .eq("id", proposal.id);

      if (error) throw error;

      // Create notification
      await supabase.from("notifications").insert({
        user_id: proposal.operador_user_id,
        tipo: "proposta_atualizada",
        mensagem: `Proposta #${proposal.id.slice(0, 8)} foi ${workflowLabel(newStatus)}`,
        lida: false,
      });

      toast.success(`Proposta marcada como ${workflowLabel(newStatus)}`);
      setProposals(
        proposals.map((p) => (p.id === proposal.id ? { ...p, status: newStatus } : p))
      );
      setSelectedProposal(null);
    } catch (error) {
      console.error(error);
      toast.error("Erro ao atualizar proposta.");
    }
  };

  const totalValue = proposals.reduce((sum, p) => sum + (p.valor_proposto || 0), 0);
  const acceptedValue = proposals
    .filter((p) => p.status === "aceita")
    .reduce((sum, p) => sum + (p.valor_proposto || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold">Propostas de reciclagem</h1>
          <p className="text-sm text-slate-400 mt-1">Analise e confirme operações de reciclagem</p>
        </div>
        <button className="inline-flex items-center gap-2 px-4 py-2 bg-brand hover:bg-brand/90 rounded-lg text-white font-semibold transition">
          <Plus className="w-4 h-4" />
          Enviar proposta
        </button>
      </div>

      {/* KPIs */}
      <div className="grid md:grid-cols-4 gap-4">
        {[
          { label: "Propostas ativas", count: proposals.filter((p) => p.status === "enviada").length, icon: TrendingUp },
          { label: "Aceitas", count: proposals.filter((p) => p.status === "aceita").length, icon: CheckCircle },
          { label: "Rejeitadas", count: proposals.filter((p) => p.status === "rejeitada").length, icon: XCircle },
          { label: "Em operação", count: proposals.filter((p) => p.status === "operacao_em_andamento").length, icon: TrendingUp },
        ].map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div
              key={kpi.label}
              className="bg-white/5 border border-white/10 rounded-lg p-4"
            >
              <div className="flex items-center gap-3">
                <Icon className="w-5 h-5 text-brand flex-shrink-0" />
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wide">{kpi.label}</p>
                  <p className="text-2xl font-bold text-brand">{kpi.count}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Financial summary */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white/5 border border-white/10 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <DollarSign className="w-5 h-5 text-amber-500 flex-shrink-0" />
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wide">Valor total em propostas</p>
              <p className="text-2xl font-bold text-amber-400">
                R$ {totalValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <DollarSign className="w-5 h-5 text-emerald-500 flex-shrink-0" />
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wide">Valor em propostas aceitas</p>
              <p className="text-2xl font-bold text-emerald-400">
                R$ {acceptedValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>
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
            setFiltroStatus(e.target.value);
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
                  <th className="px-4 py-3 text-left font-semibold">Lote</th>
                  <th className="px-4 py-3 text-left font-semibold">Baterias</th>
                  <th className="px-4 py-3 text-left font-semibold">Valor proposto</th>
                  <th className="px-4 py-3 text-left font-semibold">Status</th>
                  <th className="px-4 py-3 text-right font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                      Carregando...
                    </td>
                  </tr>
                ) : proposals.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                      Nenhuma proposta disponível.
                    </td>
                  </tr>
                ) : (
                  proposals.map((proposal) => (
                    <tr
                      key={proposal.id}
                      className="border-b border-white/5 hover:bg-white/[0.03] transition cursor-pointer"
                      onClick={() => setSelectedProposal(proposal)}
                    >
                      <td className="px-4 py-3 text-brand font-mono">
                        {proposal.proposta_id ? proposal.proposta_id.slice(0, 12) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 bg-blue-500/20 text-blue-300 rounded text-xs font-semibold">
                          {proposal.lotes?.[0]?.quantidade_baterias || 0}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold">
                        R$ {(proposal.valor_proposto || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          statusOptions.find((s) => s.value === proposal.status)?.color || "bg-slate-500/20 text-slate-300"
                        }`}>
                          {workflowLabel(proposal.status)}
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
              Página {page + 1} • {proposals.length} proposta(s)
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
                disabled={proposals.length < 10}
                className="px-3 py-1 bg-white/10 rounded text-xs font-semibold hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                Próxima
              </button>
            </div>
          </div>
        </div>

        {/* Detail panel */}
        <div className="bg-white/5 border border-white/10 rounded-lg p-6 h-fit">
          {selectedProposal ? (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold mb-1">Proposta</h3>
                <p className="text-xs text-slate-400 font-mono">{selectedProposal.proposta_id}</p>
              </div>

              <div className="space-y-2 text-sm">
                <div>
                  <p className="text-xs text-slate-400">Status</p>
                  <p className="font-semibold">{workflowLabel(selectedProposal.status)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Valor proposto</p>
                  <p className="font-semibold text-lg">
                    R$ {(selectedProposal.valor_proposto || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </p>
                </div>
                {selectedProposal.lotes && selectedProposal.lotes[0] && (
                  <>
                    <div>
                      <p className="text-xs text-slate-400">Quantidade de baterias</p>
                      <p className="font-semibold">{selectedProposal.lotes[0].quantidade_baterias}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Valor total do lote</p>
                      <p className="font-semibold">
                        R$ {(selectedProposal.lotes[0].valor_total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </>
                )}
              </div>

              {selectedProposal.observacoes && (
                <div className="bg-white/[0.02] rounded p-3 border border-white/5">
                  <p className="text-xs text-slate-400 mb-2">Observações</p>
                  <p className="text-xs text-slate-300">{selectedProposal.observacoes}</p>
                </div>
              )}

              <div className="space-y-2">
                {selectedProposal.status === "enviada" && (
                  <>
                    <button
                      onClick={() => handleProposalStatusUpdate(selectedProposal, "aceita")}
                      className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 bg-emerald-600/70 hover:bg-emerald-600 rounded font-semibold text-sm transition"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Aceitar proposta
                    </button>
                    <button
                      onClick={() => handleProposalStatusUpdate(selectedProposal, "rejeitada")}
                      className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 border border-red-500/30 text-red-400 hover:bg-red-500/10 rounded font-semibold text-sm transition"
                    >
                      <XCircle className="w-4 h-4" />
                      Rejeitar
                    </button>
                  </>
                )}
                {selectedProposal.status === "aceita" && (
                  <button
                    onClick={() => handleProposalStatusUpdate(selectedProposal, "operacao_em_andamento")}
                    className="w-full px-3 py-2 bg-amber-600/70 hover:bg-amber-600 rounded font-semibold text-sm transition"
                  >
                    Iniciar operação
                  </button>
                )}
                {selectedProposal.status === "operacao_em_andamento" && (
                  <button
                    onClick={() => handleProposalStatusUpdate(selectedProposal, "operacao_concluida")}
                    className="w-full px-3 py-2 bg-cyan-600/70 hover:bg-cyan-600 rounded font-semibold text-sm transition"
                  >
                    Concluir operação
                  </button>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-400">Selecione uma proposta para ver detalhes</p>
          )}
        </div>
      </div>
    </div>
  );
}
