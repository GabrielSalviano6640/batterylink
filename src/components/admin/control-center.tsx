import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Activity,
  BatteryCharging,
  Building2,
  ClipboardList,
  Download,
  FileCheck2,
  FileWarning,
  Gauge,
  Package,
  Recycle,
  Settings,
  ShieldCheck,
  Siren,
  Truck,
  Users,
} from "lucide-react";
import { exportCsv } from "@/lib/export-csv";
import { workflowRpc } from "@/lib/workflow";
import { logicalDeletePrivateDocument, openPrivateDocument } from "@/lib/private-documents";
import { StatusBadge } from "@/components/dashboards/gerador";

type Summary = {
  pending_organizations: number;
  users: number;
  generators: number;
  operators: number;
  carriers: number;
  recyclers: number;
  batteries: number;
  collections: number;
  diagnostics: number;
  lots: number;
  proposals: number;
  operations: number;
  pending_documents: number;
  open_incidents: number;
  notifications: number;
  audit_events: number;
};
type Entity =
  | "organizations"
  | "users"
  | "generators"
  | "operators"
  | "carriers"
  | "recyclers"
  | "batteries"
  | "collections"
  | "diagnostics"
  | "lots"
  | "proposals"
  | "operations"
  | "documents"
  | "organization_documents"
  | "private_documents"
  | "incidents"
  | "notifications"
  | "audit"
  | "parameters";
type Row = Record<string, unknown> & { id?: string; status?: string; created_at?: string };

const emptySummary: Summary = {
  pending_organizations: 0,
  users: 0,
  generators: 0,
  operators: 0,
  carriers: 0,
  recyclers: 0,
  batteries: 0,
  collections: 0,
  diagnostics: 0,
  lots: 0,
  proposals: 0,
  operations: 0,
  pending_documents: 0,
  open_incidents: 0,
  notifications: 0,
  audit_events: 0,
};
const labels: Record<Entity, string> = {
  organizations: "Organizações",
  users: "Usuários",
  generators: "Geradores",
  operators: "Operadores",
  carriers: "Transportadoras",
  recyclers: "Recicladoras",
  batteries: "Baterias",
  collections: "Coletas",
  diagnostics: "Diagnósticos",
  lots: "Lotes",
  proposals: "Propostas",
  operations: "Operações",
  documents: "Documentos operacionais",
  organization_documents: "Documentos de organizações",
  private_documents: "Documentos privados",
  incidents: "Ocorrências",
  notifications: "Notificações",
  audit: "Auditoria",
  parameters: "Parâmetros do sistema",
};

export function AdminControlCenter() {
  const [summary, setSummary] = useState<Summary>(emptySummary);
  const [entity, setEntity] = useState<Entity>("organizations");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  const loadSummary = useCallback(async () => {
    const value = await workflowRpc<Summary>("get_admin_dashboard_summary", {});
    setSummary({ ...emptySummary, ...(value ?? {}) });
  }, []);
  const loadRows = useCallback(async () => {
    setLoading(true);
    try {
      const value = await workflowRpc<Row[]>("admin_list_entities", {
        _entity: entity,
        _limit: 300,
      });
      setRows(value ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  }, [entity]);
  const reload = async () => {
    await Promise.all([loadSummary(), loadRows()]);
  };
  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);
  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const cards = [
    ["Organizações pendentes", summary.pending_organizations, Building2],
    ["Usuários", summary.users, Users],
    ["Geradores", summary.generators, BatteryCharging],
    ["Operadores", summary.operators, ShieldCheck],
    ["Transportadoras", summary.carriers, Truck],
    ["Recicladoras", summary.recyclers, Recycle],
    ["Baterias", summary.batteries, BatteryCharging],
    ["Coletas", summary.collections, Truck],
    ["Diagnósticos", summary.diagnostics, Gauge],
    ["Lotes", summary.lots, Package],
    ["Propostas", summary.proposals, ClipboardList],
    ["Operações", summary.operations, Activity],
    ["Docs. pendentes", summary.pending_documents, FileWarning],
    ["Ocorrências", summary.open_incidents, Siren],
    ["Notificações", summary.notifications, FileCheck2],
    ["Eventos de auditoria", summary.audit_events, ShieldCheck],
  ] as const;
  const filtered = rows.filter(
    (row) => !query || JSON.stringify(row).toLowerCase().includes(query.toLowerCase()),
  );

  const askReason = (message: string) => {
    const reason = window.prompt(message);
    return reason?.trim() || null;
  };
  const orgStatus = async (row: Row, status: string) => {
    const reason = askReason("Justificativa obrigatória:");
    if (!reason || !row.id) return;
    try {
      await workflowRpc("admin_set_organization_status", {
        _organization_id: row.id,
        _status: status,
        _reason: reason,
      });
      toast.success("Organização atualizada");
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    }
  };
  const userStatus = async (row: Row, active: boolean) => {
    const reason = askReason(
      active ? "Justificativa para reativação:" : "Justificativa para suspensão:",
    );
    if (!reason || !row.id) return;
    try {
      await workflowRpc("admin_set_user_status", {
        _profile_id: row.id,
        _active: active,
        _reason: reason,
      });
      toast.success(active ? "Conta reativada" : "Conta suspensa");
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    }
  };
  const manageRole = async (row: Row) => {
    if (!row.id) return;
    const role = window.prompt("Perfil: admin, gerador, operador, transportadora ou reciclador");
    if (!role || !["admin", "gerador", "operador", "transportadora", "reciclador"].includes(role))
      return toast.error("Perfil inválido");
    const grant = window.confirm("OK para conceder; Cancelar para remover o perfil.");
    const reason = askReason("Justificativa obrigatória:");
    if (!reason) return;
    try {
      await workflowRpc("admin_manage_role", {
        _user_id: row.id,
        _role: role,
        _grant: grant,
        _reason: reason,
      });
      toast.success("Permissões atualizadas");
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    }
  };
  const validateDocument = async (row: Row, approve: boolean) => {
    if (!row.id) return;
    const reason = askReason(approve ? "Parecer de validação:" : "Motivo da rejeição:");
    if (!reason) return;
    try {
      if (entity === "private_documents") {
        await workflowRpc("validate_private_document", {
          _document_id: row.id,
          _approve: approve,
          _notes: reason,
        });
      } else {
        await workflowRpc("admin_validate_document", {
          _document_id: row.id,
          _organization_document: entity === "organization_documents",
          _approve: approve,
          _reason: reason,
        });
      }
      toast.success("Documento analisado");
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    }
  };
  const deletePrivateDocument = async (row: Row) => {
    if (!row.id) return;
    const reason = askReason("Motivo da exclusão lógica:");
    if (!reason) return;
    try {
      await logicalDeletePrivateDocument(row.id, reason);
      toast.success("Documento removido logicamente; o histórico foi preservado");
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    }
  };
  const intervene = async (row: Row, cancel = false) => {
    if (!row.id) return;
    const status = cancel
      ? "cancelada"
      : window.prompt("Novo status da operação:", String(row.status ?? "pausada"));
    if (!status) return;
    const reason = askReason("Justificativa obrigatória — ficará no histórico:");
    if (!reason) return;
    try {
      await workflowRpc("admin_intervene_operation", {
        _operation_id: row.id,
        _new_status: status,
        _reason: reason,
      });
      toast.success(cancel ? "Operação cancelada" : "Intervenção registrada");
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    }
  };
  const correctLink = async (row: Row) => {
    if (!row.id) return;
    const defaults: Partial<Record<Entity, string>> = {
      operations: "operator_organization_id",
      collections: "carrier_organization_id",
      lots: "operator_organization_id",
      batteries: "generator_organization_id",
    };
    const field = window.prompt("Campo do vínculo organizacional:", defaults[entity] ?? "");
    if (!field) return;
    const organizationId = window.prompt("ID da organização correta:");
    if (!organizationId) return;
    const reason = askReason("Justificativa da correção:");
    if (!reason) return;
    try {
      await workflowRpc("admin_correct_link", {
        _entity: entity,
        _entity_id: row.id,
        _field: field,
        _organization_id: organizationId,
        _reason: reason,
      });
      toast.success("Vínculo corrigido e auditado");
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    }
  };
  const setParameter = async (row?: Row) => {
    const key = window.prompt("Chave do parâmetro:", String(row?.key ?? ""));
    if (!key) return;
    const raw = window.prompt("Valor JSON:", JSON.stringify(row?.value ?? null));
    if (raw === null) return;
    let value: unknown;
    try {
      value = JSON.parse(raw);
    } catch {
      return toast.error("JSON inválido");
    }
    const description = window.prompt("Descrição:", String(row?.description ?? "")) ?? "";
    const reason = askReason("Justificativa da alteração:");
    if (!reason) return;
    try {
      await workflowRpc("admin_set_parameter", {
        _key: key,
        _value: value,
        _description: description,
        _reason: reason,
      });
      toast.success("Parâmetro salvo");
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    }
  };

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-display font-bold">Centro de controle administrativo</h1>
        <p className="text-xs text-slate-500 mt-1">
          Toda intervenção exige justificativa e gera um novo evento de auditoria. O histórico
          anterior nunca é apagado.
        </p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-2 mb-6">
        {cards.map(([label, value, Icon]) => (
          <div key={label} className="p-3 border border-white/10 rounded-md bg-white/[0.025]">
            <Icon className="w-4 h-4 text-brand mb-2" />
            <div className="text-2xl font-display font-bold">{value}</div>
            <div className="text-[10px] leading-tight text-slate-400 mt-1">{label}</div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-end gap-2 mb-4">
        <label className="grid gap-1">
          <span className="text-xs text-slate-400">Módulo</span>
          <select
            value={entity}
            onChange={(e) => setEntity(e.target.value as Entity)}
            className="px-3 py-2 bg-white/5 border border-white/10 rounded-md text-sm"
          >
            {(Object.keys(labels) as Entity[]).map((key) => (
              <option key={key} value={key}>
                {labels[key]}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 flex-1 min-w-52">
          <span className="text-xs text-slate-400">Buscar</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Código, nome, status, ID..."
            className="px-3 py-2 bg-white/5 border border-white/10 rounded-md text-sm"
          />
        </label>
        {entity === "parameters" && (
          <button
            onClick={() => void setParameter()}
            className="px-3 py-2 bg-brand text-industrial rounded-md text-sm font-semibold inline-flex items-center gap-2"
          >
            <Settings className="w-4 h-4" /> Novo parâmetro
          </button>
        )}
        <button
          onClick={() => exportCsv(`${entity}.csv`, filtered)}
          className="px-3 py-2 border border-white/10 rounded-md text-sm inline-flex items-center gap-2"
        >
          <Download className="w-4 h-4" /> Exportar CSV
        </button>
      </div>
      {loading ? (
        <p className="text-sm text-slate-400">Carregando...</p>
      ) : (
        <div className="grid gap-2">
          {filtered.length === 0 && <p className="text-sm text-slate-500">Nenhum registro.</p>}
          {filtered.map((row, index) => (
            <div key={row.id ?? index} className="p-4 border border-white/10 rounded-md">
              <div className="flex flex-wrap justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold truncate">{rowTitle(row)}</div>
                  <div className="text-xs text-slate-400 mt-1">{rowSubtitle(row)}</div>
                  {row.created_at && (
                    <div className="text-[10px] text-slate-500 mt-1">
                      {new Date(row.created_at).toLocaleString("pt-BR")}
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {row.status && <StatusBadge status={String(row.status)} />}
                  {entity === "organizations" && (
                    <>
                      <button
                        onClick={() => void orgStatus(row, "aprovada")}
                        className="text-brand text-xs"
                      >
                        Aprovar
                      </button>
                      <button
                        onClick={() => void orgStatus(row, "rejeitada")}
                        className="text-danger text-xs"
                      >
                        Rejeitar
                      </button>
                      <button
                        onClick={() => void orgStatus(row, "suspensa")}
                        className="text-amber-300 text-xs"
                      >
                        Suspender
                      </button>
                    </>
                  )}
                  {entity === "users" && (
                    <>
                      <button
                        onClick={() => void userStatus(row, row.status !== "approved")}
                        className="text-amber-300 text-xs"
                      >
                        {row.status === "approved" ? "Suspender" : "Reativar"}
                      </button>
                      <button onClick={() => void manageRole(row)} className="text-brand text-xs">
                        Permissões
                      </button>
                    </>
                  )}
                  {["documents", "organization_documents", "private_documents"].includes(
                    entity,
                  ) && (
                    <>
                      <button
                        onClick={() => void validateDocument(row, true)}
                        className="text-brand text-xs"
                      >
                        Validar
                      </button>
                      <button
                        onClick={() => void validateDocument(row, false)}
                        className="text-danger text-xs"
                      >
                        Rejeitar
                      </button>
                    </>
                  )}
                  {entity === "private_documents" && (
                    <>
                      <button
                        onClick={() => row.id && void openPrivateDocument(row.id)}
                        className="text-sky-300 text-xs"
                      >
                        Abrir
                      </button>
                      <button
                        onClick={() => void deletePrivateDocument(row)}
                        className="text-danger text-xs"
                      >
                        Excluir logicamente
                      </button>
                    </>
                  )}
                  {entity === "operations" && (
                    <>
                      <button
                        onClick={() => void intervene(row)}
                        className="text-amber-300 text-xs"
                      >
                        Intervir
                      </button>
                      <button
                        onClick={() => void intervene(row, true)}
                        className="text-danger text-xs"
                      >
                        Cancelar operação
                      </button>
                    </>
                  )}
                  {["operations", "collections", "lots", "batteries"].includes(entity) && (
                    <button onClick={() => void correctLink(row)} className="text-brand text-xs">
                      Corrigir vínculo
                    </button>
                  )}
                  {entity === "parameters" && (
                    <button onClick={() => void setParameter(row)} className="text-brand text-xs">
                      Editar
                    </button>
                  )}
                </div>
              </div>
              <details className="mt-2">
                <summary className="text-xs text-slate-500 cursor-pointer">
                  Ver registro completo
                </summary>
                <pre className="mt-2 p-3 bg-industrial rounded text-[10px] text-slate-300 overflow-auto max-h-72">
                  {JSON.stringify(row, null, 2)}
                </pre>
              </details>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function rowTitle(row: Row) {
  return String(
    row.razao_social ??
      row.nome_fantasia ??
      row.full_name ??
      row.code ??
      row.codigo_lote ??
      row.codigo_coleta ??
      row.title ??
      row.titulo ??
      row.tipo_documento ??
      row.tipo ??
      row.action ??
      row.key ??
      row.id ??
      "Registro",
  );
}
function rowSubtitle(row: Row) {
  const values = [
    row.email,
    row.cnpj,
    row.quimica,
    row.classificacao,
    row.cidade && `${row.cidade}/${row.estado ?? row.uf ?? ""}`,
    row.entity_type,
    row.gravidade,
    row.description ?? row.descricao,
  ];
  return values.filter(Boolean).map(String).join(" · ") || `ID ${String(row.id ?? "—")}`;
}
