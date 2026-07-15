import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Check, X, Clock, FileText } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type RegistrationRequestRow = Database["public"]["Tables"]["registration_requests"]["Row"];

type RegistrationRequest = Omit<RegistrationRequestRow, "company_data"> & {
  company_data:
    | {
        razao_social?: string | null;
        cnpj_cpf?: string | null;
        tipo_organizacao?: string | null;
        cargo?: string | null;
        endereco?: string | null;
        cidade?: string | null;
        estado?: string | null;
        cep?: string | null;
        telefone?: string | null;
        email?: string | null;
      }
    | null;
};

export const Route = createFileRoute("/_authenticated/app/admin/pending-organizations")({
  component: PendingOrganizationsAdmin,
});

function PendingOrganizationsAdmin() {
  const auth = useAuth();
  const [requests, setRequests] = useState<RegistrationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const loadRequests = useCallback(async () => {
    if (auth.role !== "admin") return;
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from("registration_requests")
        .select("*, companies(*)")
        .eq("status", "pending")
        .order("created_at", { ascending: true });

      if (error) throw error;
      setRequests(data || []);
    } catch (error) {
      console.error(error);
      toast.error("Erro ao carregar solicitações.");
    } finally {
      setLoading(false);
    }
  }, [auth.role]);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  const handleApprove = async (requestId: string) => {
    setActionLoading(true);
    try {
      const request = requests.find((r) => r.id === requestId);
      if (!request) throw new Error("Solicitação não encontrada.");

      // Atualizar status do registration_request
      const { error: updateReqError } = await supabase
        .from("registration_requests")
        .update({ status: "approved" })
        .eq("id", requestId);

      if (updateReqError) throw updateReqError;

      // Atualizar status da organização
      const { error: updateCompError } = await supabase
        .from("companies")
        .update({
          status: "aprovada",
          status_aprovacao: "aprovada",
          aprovado_por: auth.user?.id,
          aprovado_em: new Date().toISOString(),
        })
        .eq("owner_id", request.user_id);

      if (updateCompError) throw updateCompError;

      // Atualizar profile do usuário
      const { error: updateProfileError } = await supabase
        .from("profiles")
        .update({ status: "approved" })
        .eq("id", request.user_id);

      if (updateProfileError) throw updateProfileError;

      // Criar user_role se não existir
      const { error: roleError } = await supabase.from("user_roles").upsert(
        {
          user_id: request.user_id,
          role: request.requested_role,
        },
        { onConflict: "user_id,role" },
      );

      if (roleError) throw roleError;

      // Criar notificação
      await supabase.from("notifications").insert({
        profile_id: request.user_id,
        titulo: "Organização aprovada",
        mensagem: "Sua organização foi aprovada e você já pode começar a usar a plataforma.",
        tipo: "approval",
        entity_type: "organization",
      });

      toast.success("Organização aprovada com sucesso.");
      setRequests(requests.filter((r) => r.id !== requestId));
      setSelectedRequest(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao aprovar.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (requestId: string) => {
    if (!rejectionReason.trim()) {
      toast.error("Informe o motivo da rejeição.");
      return;
    }

    setActionLoading(true);
    try {
      const request = requests.find((r) => r.id === requestId);
      if (!request) throw new Error("Solicitação não encontrada.");

      // Atualizar status do registration_request
      const { error: updateReqError } = await supabase
        .from("registration_requests")
        .update({ status: "rejected" })
        .eq("id", requestId);

      if (updateReqError) throw updateReqError;

      // Atualizar status da organização
      const { error: updateCompError } = await supabase
        .from("companies")
        .update({
          status: "rejeitada",
          status_aprovacao: "rejeitada",
        })
        .eq("owner_id", request.user_id);

      if (updateCompError) throw updateCompError;

      // Criar notificação
      await supabase.from("notifications").insert({
        profile_id: request.user_id,
        titulo: "Organização rejeitada",
        mensagem: `Sua solicitação foi rejeitada. Motivo: ${rejectionReason}`,
        tipo: "rejection",
        entity_type: "organization",
      });

      toast.success("Solicitação rejeitada.");
      setRequests(requests.filter((r) => r.id !== requestId));
      setSelectedRequest(null);
      setRejectionReason("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao rejeitar.");
    } finally {
      setActionLoading(false);
    }
  };

  const selectedData = selectedRequest ? requests.find((r) => r.id === selectedRequest) : null;

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-display font-bold mb-2">Organiza ções pendentes de aprovação</h1>
        <p className="text-slate-400 text-sm">Revise e aprove ou rejeite as solicitações de novas organizações.</p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Lista */}
        <div className="md:col-span-1 bg-white/5 border border-white/10 rounded-lg overflow-hidden">
          <div className="border-b border-white/10 px-4 py-3 bg-white/[0.02]">
            <p className="text-xs font-mono uppercase text-slate-400">
              {requests.length} pendente{requests.length !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="divide-y divide-white/5 max-h-96 overflow-y-auto">
            {loading ? (
              <div className="px-4 py-6 text-center text-slate-400 text-xs">Carregando...</div>
            ) : requests.length === 0 ? (
              <div className="px-4 py-6 text-center text-slate-400 text-xs">Nenhuma solicitação pendente.</div>
            ) : (
              requests.map((request) => (
                <button
                  key={request.id}
                  onClick={() => setSelectedRequest(request.id)}
                  className={`w-full text-left px-4 py-3 transition ${
                    selectedRequest === request.id ? "bg-brand/20 border-l-2 border-brand" : "hover:bg-white/5"
                  }`}
                >
                  <div className="text-sm font-semibold">{request.company_data?.razao_social || "—"}</div>
                  <div className="text-xs text-slate-400 mt-1">
                    {request.company_data?.cnpj_cpf || "—"}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    {new Date(request.created_at).toLocaleDateString("pt-BR")}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Detalhes */}
        <div className="md:col-span-2">
          {selectedData ? (
            <div className="space-y-6">
              {/* Dados da empresa */}
              <div className="bg-white/5 border border-white/10 rounded-lg p-6">
                <h2 className="text-sm font-mono uppercase tracking-widest text-brand mb-4">Dados da organização</h2>
                <div className="space-y-3 text-sm">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-slate-400">Razão social</p>
                      <p className="font-semibold">{selectedData.company_data?.razao_social || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">CNPJ/CPF</p>
                      <p className="font-semibold">{selectedData.company_data?.cnpj_cpf || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Tipo</p>
                      <p className="font-semibold">{selectedData.company_data?.tipo_organizacao || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Perfil solicitado</p>
                      <p className="font-semibold uppercase text-brand">{selectedData.requested_role}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Endereço</p>
                    <p className="font-semibold">
                      {selectedData.company_data?.endereco}, {selectedData.company_data?.cidade} —{" "}
                      {selectedData.company_data?.estado}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">E-mail</p>
                    <p className="font-semibold">{selectedData.company_data?.email || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Telefone</p>
                    <p className="font-semibold">{selectedData.company_data?.telefone || "—"}</p>
                  </div>
                </div>
              </div>

              {/* Documentos */}
              <div className="bg-white/5 border border-white/10 rounded-lg p-6">
                <div className="flex items-center gap-2 mb-4">
                  <FileText className="w-4 h-4 text-brand" />
                  <h2 className="text-sm font-mono uppercase tracking-widest text-brand">Documentos</h2>
                </div>
                <p className="text-xs text-slate-400">
                  Documentos de comprovação podem ser enviados após a aprovação inicial.
                </p>
              </div>

              {/* Ações */}
              <div className="bg-white/5 border border-white/10 rounded-lg p-6">
                <h2 className="text-sm font-mono uppercase tracking-widest text-brand mb-4">Ação</h2>

                <div className="space-y-4">
                  <div>
                    <button
                      onClick={() => handleApprove(selectedData.id)}
                      disabled={actionLoading}
                      className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition disabled:opacity-50"
                    >
                      <Check className="w-4 h-4" />
                      Aprovar organização
                    </button>
                  </div>

                  <div>
                    <p className="text-xs text-slate-300 mb-2">Ou rejeitar com motivo:</p>
                    <textarea
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="Motivo da rejeição (obrigatório)"
                      rows={3}
                      className="w-full px-3 py-2 bg-industrial border border-white/10 rounded-md text-sm mb-2"
                    />
                    <button
                      onClick={() => handleReject(selectedData.id)}
                      disabled={actionLoading || !rejectionReason.trim()}
                      className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition disabled:opacity-50"
                    >
                      <X className="w-4 h-4" />
                      Rejeitar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white/5 border border-white/10 rounded-lg p-12 text-center">
              <Clock className="w-12 h-12 text-slate-400 mx-auto mb-4 opacity-50" />
              <p className="text-slate-400 text-sm">Selecione uma solicitação para revisar.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
