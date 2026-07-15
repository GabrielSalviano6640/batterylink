import { supabase } from "@/integrations/supabase/client";

export const batteryStatusLabels: Record<string, string> = {
  rascunho: "Rascunho",
  cadastrada: "Cadastrada",
  aguardando_analise: "Aguardando análise",
  informacoes_solicitadas: "Informações solicitadas",
  aprovada_para_coleta: "Aprovada para coleta",
  coleta_agendada: "Coleta agendada",
  em_transporte: "Em transporte",
  recebida_na_triagem: "Recebida na triagem",
  em_diagnostico: "Em diagnóstico",
  classificada: "Classificada",
  em_lote: "Em lote",
  em_negociacao: "Em negociação",
  destinacao_definida: "Destinação definida",
  enviada_ao_destinador: "Enviada ao destinador",
  recebida_pelo_destinador: "Recebida pelo destinador",
  documentacao_pendente: "Documentação pendente",
  concluida: "Concluída",
  em_quarentena: "Em quarentena",
  cancelada: "Cancelada",
};

export const lotStatusLabels: Record<string, string> = {
  rascunho: "Rascunho",
  em_formacao: "Em formação",
  pronto_para_publicacao: "Pronto para publicação",
  publicado: "Publicado",
  recebendo_propostas: "Recebendo propostas",
  em_analise: "Em análise",
  proposta_aceita: "Proposta aceita",
  contratado: "Contratado",
  em_transporte: "Em transporte",
  entregue: "Entregue",
  documentacao_pendente: "Documentação pendente",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

export const collectionStatusLabels: Record<string, string> = {
  ordem_criada: "Ordem criada",
  aceita: "Aceita",
  recusada: "Recusada",
  agendada: "Agendada",
  retirada: "Retirada",
  em_transporte: "Em transporte",
  entregue_triagem: "Entregue à triagem",
  entregue_destinador: "Entregue ao destinador",
  cancelada: "Cancelada",
};

export const proposalStatusLabels: Record<string, string> = {
  rascunho: "Rascunho",
  enviada: "Enviada",
  em_analise: "Em análise",
  aceita: "Aceita",
  recusada: "Recusada",
  cancelada: "Cancelada",
  expirada: "Expirada",
};

export function workflowLabel(status: string) {
  return (
    batteryStatusLabels[status] ??
    lotStatusLabels[status] ??
    collectionStatusLabels[status] ??
    proposalStatusLabels[status] ??
    status.replaceAll("_", " ")
  );
}

type RpcResult<T = unknown> = { data: T | null; error: { message: string } | null };

export async function workflowRpc<T = unknown>(
  name: string,
  args: Record<string, unknown>,
): Promise<T | null> {
  const { data, error } = (await (supabase.rpc as unknown as (
    fn: string,
    params: Record<string, unknown>,
  ) => Promise<RpcResult<T>>)(name, args)) as RpcResult<T>;
  if (error) throw new Error(error.message);
  return data;
}

export function transitionBattery(id: string, status: string, reason?: string) {
  return workflowRpc("transition_battery_status", {
    _battery_id: id,
    _new_status: status,
    _reason: reason ?? null,
    _organization_id: null,
  });
}

export function transitionLot(id: string, status: string, reason?: string) {
  return workflowRpc("transition_lot_status", {
    _lot_id: id,
    _new_status: status,
    _reason: reason ?? null,
    _organization_id: null,
  });
}
