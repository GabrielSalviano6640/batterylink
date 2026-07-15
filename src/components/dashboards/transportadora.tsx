import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  FileWarning,
  PackageCheck,
  Route,
  Siren,
  Truck,
  Upload,
} from "lucide-react";
import { Inp, Modal, Sel, StatusBadge } from "./gerador";
import { workflowRpc } from "@/lib/workflow";

type Collection = Tables<"collections">;
type Incident = Tables<"incidents">;
type DocumentAlert = {
  id: string | null;
  type: string;
  number: string | null;
  valid_until: string | null;
  status: string;
  alert: "ausente" | "vencido" | "vence_em_breve" | "pendente" | "regular";
};
type CarrierSummary = {
  organization_id: string | null;
  available_orders: number;
  assigned_orders: number;
  pending_collections: number;
  accepted_collections: number;
  scheduled_collections: number;
  in_transit: number;
  completed_deliveries: number;
  pending_documents: number;
  open_incidents: number;
  document_alerts: DocumentAlert[];
};

const emptySummary: CarrierSummary = {
  organization_id: null,
  available_orders: 0,
  assigned_orders: 0,
  pending_collections: 0,
  accepted_collections: 0,
  scheduled_collections: 0,
  in_transit: 0,
  completed_deliveries: 0,
  pending_documents: 0,
  open_incidents: 0,
  document_alerts: [],
};

type Tab = "available" | "pending" | "agenda" | "transit" | "completed" | "documents" | "incidents";

export function TransportadoraDashboard({ userId }: { userId: string }) {
  const [items, setItems] = useState<Collection[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [summary, setSummary] = useState<CarrierSummary>(emptySummary);
  const [tab, setTab] = useState<Tab>("available");
  const [scheduleItem, setScheduleItem] = useState<Collection | null>(null);
  const [documentItem, setDocumentItem] = useState<Collection | null>(null);
  const [incidentItem, setIncidentItem] = useState<Collection | null>(null);
  const [showOrgDocument, setShowOrgDocument] = useState(false);

  const load = async () => {
    const [{ data }, { data: incidentRows }, summaryRow] = await Promise.all([
      supabase.from("collections").select("*").order("created_at", { ascending: false }),
      supabase.from("incidents").select("*").order("created_at", { ascending: false }),
      workflowRpc<CarrierSummary>("get_carrier_dashboard_summary", {}).catch(() => emptySummary),
    ]);
    setItems(data ?? []);
    setIncidents(incidentRows ?? []);
    setSummary({ ...emptySummary, ...(summaryRow ?? {}) });
  };
  useEffect(() => {
    void load();
  }, []);

  const isMine = (c: Collection) =>
    c.transportadora_id === userId ||
    (!!summary.organization_id && c.carrier_organization_id === summary.organization_id);
  const filtered = items.filter((c) => {
    if (tab === "available")
      return c.status === "ordem_criada" && (c.carrier_organization_id === null || isMine(c));
    if (tab === "pending") return isMine(c) && ["ordem_criada", "aceita"].includes(c.status);
    if (tab === "agenda") return isMine(c) && c.status === "agendada";
    if (tab === "transit") return isMine(c) && ["retirada", "em_transporte"].includes(c.status);
    if (tab === "completed")
      return isMine(c) && ["entregue_triagem", "entregue_destinador"].includes(c.status);
    return false;
  });

  const run = async (name: string, args: Record<string, unknown>, message: string) => {
    try {
      await workflowRpc(name, args);
      toast.success(message);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao atualizar coleta");
    }
  };

  const refuse = (c: Collection) => {
    const reason = window.prompt("Motivo obrigatório da recusa:");
    if (!reason?.trim()) return toast.error("Informe o motivo da recusa");
    void run(
      "respond_collection_order",
      { _collection_id: c.id, _accept: false, _reason: reason, _carrier_organization_id: null },
      "Ordem recusada",
    );
  };

  const cards = [
    ["Ordens disponíveis", summary.available_orders + summary.assigned_orders, ClipboardList],
    ["Coletas pendentes", summary.pending_collections, AlertTriangle],
    ["Coletas aceitas", summary.accepted_collections, CheckCircle2],
    ["Agenda", summary.scheduled_collections, CalendarClock],
    ["Em andamento", summary.in_transit, Route],
    ["Entregas concluídas", summary.completed_deliveries, PackageCheck],
    ["Documentos pendentes", summary.pending_documents, FileWarning],
    ["Ocorrências", summary.open_incidents, Siren],
  ] as const;
  const tabLabels: Record<Tab, string> = {
    available: "Ordens",
    pending: "Pendentes",
    agenda: "Agenda",
    transit: "Em andamento",
    completed: "Concluídas",
    documents: "Documentos",
    incidents: "Ocorrências",
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <Truck className="w-5 h-5 text-brand" />
        <p className="font-mono text-xs text-brand tracking-widest uppercase">
          Painel · Transportadora
        </p>
      </div>
      <h1 className="text-2xl font-display font-bold mb-5">Coletas & transportes</h1>

      {summary.document_alerts.length > 0 && (
        <div className="mb-4 p-3 border border-amber-400/30 bg-amber-400/5 rounded-md">
          <div className="flex items-center gap-2 text-amber-300 text-sm font-semibold">
            <FileWarning className="w-4 h-4" /> Há documentos ausentes, vencidos ou próximos do
            vencimento.
          </div>
          <button onClick={() => setTab("documents")} className="text-xs text-brand mt-1">
            Revisar documentos
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-2 mb-6">
        {cards.map(([label, value, Icon]) => (
          <div key={label} className="p-3 border border-white/10 rounded-md bg-white/[0.025]">
            <Icon className="w-4 h-4 text-brand mb-2" />
            <div className="text-2xl font-display font-bold">{value}</div>
            <div className="text-[11px] leading-tight text-slate-400 mt-1">{label}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-1 mb-4 border-b border-white/10 overflow-x-auto">
        {(Object.keys(tabLabels) as Tab[]).map((key) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-3 py-2 whitespace-nowrap text-sm border-b-2 -mb-px ${tab === key ? "border-brand text-brand" : "border-transparent text-slate-400"}`}
          >
            {tabLabels[key]}
          </button>
        ))}
      </div>

      {tab === "documents" ? (
        <DocumentsPanel
          alerts={summary.document_alerts}
          onUpload={() => setShowOrgDocument(true)}
        />
      ) : tab === "incidents" ? (
        <IncidentsPanel
          incidents={incidents}
          collections={items.filter(isMine)}
          onNew={(c) => setIncidentItem(c)}
        />
      ) : (
        <div className="grid gap-3">
          {filtered.length === 0 && (
            <p className="text-sm text-slate-500">Nenhuma coleta nesta etapa.</p>
          )}
          {filtered.map((c) => (
            <CollectionCard
              key={c.id}
              collection={c}
              onAccept={() =>
                void run(
                  "respond_collection_order",
                  {
                    _collection_id: c.id,
                    _accept: true,
                    _reason: "Ordem aceita pela transportadora",
                    _carrier_organization_id: null,
                  },
                  "Ordem aceita",
                )
              }
              onRefuse={() => refuse(c)}
              onSchedule={() => setScheduleItem(c)}
              onArrival={() =>
                void run(
                  "confirm_collection_arrival",
                  { _collection_id: c.id, _notes: "Veículo chegou ao endereço de coleta" },
                  "Chegada confirmada",
                )
              }
              onPickup={() =>
                void run(
                  "advance_collection",
                  {
                    _collection_id: c.id,
                    _action: "confirmar_retirada",
                    _reason: "Material retirado na origem",
                  },
                  "Retirada confirmada",
                )
              }
              onTransit={() =>
                void run(
                  "advance_collection",
                  {
                    _collection_id: c.id,
                    _action: "iniciar_transporte",
                    _reason: "Transporte iniciado",
                  },
                  "Transporte iniciado",
                )
              }
              onDelivery={() =>
                void run(
                  "advance_collection",
                  {
                    _collection_id: c.id,
                    _action: "confirmar_entrega",
                    _reason: "Entrega realizada e conferida",
                  },
                  "Entrega confirmada",
                )
              }
              onDocument={() => setDocumentItem(c)}
              onIncident={() => setIncidentItem(c)}
            />
          ))}
        </div>
      )}

      {scheduleItem && (
        <ScheduleModal
          collection={scheduleItem}
          onClose={() => setScheduleItem(null)}
          onSaved={() => {
            setScheduleItem(null);
            void load();
          }}
        />
      )}
      {documentItem && (
        <CollectionDocumentModal
          collection={documentItem}
          userId={userId}
          onClose={() => setDocumentItem(null)}
          onSaved={() => {
            setDocumentItem(null);
            void load();
          }}
        />
      )}
      {incidentItem && (
        <CarrierIncidentModal
          collection={incidentItem}
          onClose={() => setIncidentItem(null)}
          onSaved={() => {
            setIncidentItem(null);
            void load();
          }}
        />
      )}
      {showOrgDocument && (
        <OrganizationDocumentModal
          userId={userId}
          onClose={() => setShowOrgDocument(false)}
          onSaved={() => {
            setShowOrgDocument(false);
            void load();
          }}
        />
      )}
    </div>
  );
}

function CollectionCard({
  collection: c,
  onAccept,
  onRefuse,
  onSchedule,
  onArrival,
  onPickup,
  onTransit,
  onDelivery,
  onDocument,
  onIncident,
}: {
  collection: Collection;
  onAccept: () => void;
  onRefuse: () => void;
  onSchedule: () => void;
  onArrival: () => void;
  onPickup: () => void;
  onTransit: () => void;
  onDelivery: () => void;
  onDocument: () => void;
  onIncident: () => void;
}) {
  return (
    <div className="p-4 border border-white/10 rounded-md">
      <div className="flex justify-between items-start gap-3 mb-2">
        <div>
          <div className="text-xs text-brand font-mono">
            {c.codigo_coleta ?? `COL-${c.id.slice(0, 8).toUpperCase()}`}
          </div>
          <div className="text-sm mt-1">
            <span className="text-slate-400">Origem:</span> {c.origem_endereco}
          </div>
          <div className="text-sm">
            <span className="text-slate-400">Destino:</span> {c.destino_endereco}
          </div>
          {c.scheduled_at && (
            <div className="text-xs text-slate-400 mt-1">
              Agendada: {new Date(c.scheduled_at).toLocaleString("pt-BR")}
            </div>
          )}
          {c.motorista && (
            <div className="text-xs text-slate-400">
              {c.motorista} · {c.veiculo} · {c.placa}
            </div>
          )}
        </div>
        <StatusBadge status={c.status} />
      </div>
      <div className="flex flex-wrap gap-2 mt-3">
        {c.status === "ordem_criada" && (
          <>
            <button
              onClick={onAccept}
              className="px-3 py-1.5 bg-brand text-industrial rounded-md text-xs font-semibold"
            >
              Aceitar
            </button>
            <button
              onClick={onRefuse}
              className="px-3 py-1.5 border border-danger/40 text-danger rounded-md text-xs"
            >
              Recusar
            </button>
          </>
        )}
        {c.status === "aceita" && (
          <button
            onClick={onSchedule}
            className="px-3 py-1.5 bg-brand text-industrial rounded-md text-xs font-semibold"
          >
            Agendar coleta
          </button>
        )}
        {c.status === "agendada" && !c.arrival_at && (
          <button
            onClick={onArrival}
            className="px-3 py-1.5 bg-brand text-industrial rounded-md text-xs font-semibold"
          >
            Confirmar chegada
          </button>
        )}
        {c.status === "agendada" && c.arrival_at && (
          <button
            onClick={onPickup}
            className="px-3 py-1.5 bg-brand text-industrial rounded-md text-xs font-semibold"
          >
            Confirmar retirada
          </button>
        )}
        {c.status === "retirada" && (
          <button
            onClick={onTransit}
            className="px-3 py-1.5 bg-brand text-industrial rounded-md text-xs font-semibold"
          >
            Iniciar transporte
          </button>
        )}
        {c.status === "em_transporte" && (
          <button
            onClick={onDelivery}
            className="px-3 py-1.5 bg-brand text-industrial rounded-md text-xs font-semibold"
          >
            Confirmar entrega
          </button>
        )}
        {c.status !== "ordem_criada" && (
          <button
            onClick={onDocument}
            className="px-3 py-1.5 border border-white/10 rounded-md text-xs inline-flex items-center gap-1"
          >
            <Upload className="w-3 h-3" /> Anexar documento
          </button>
        )}
        {c.status !== "ordem_criada" && (
          <button
            onClick={onIncident}
            className="px-3 py-1.5 border border-amber-400/30 text-amber-300 rounded-md text-xs"
          >
            Registrar ocorrência
          </button>
        )}
      </div>
    </div>
  );
}

function ScheduleModal({
  collection,
  onClose,
  onSaved,
}: {
  collection: Collection;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSaving(true);
    try {
      const when = new Date(String(fd.get("data")));
      if (Number.isNaN(when.getTime())) throw new Error("Data inválida");
      await workflowRpc("schedule_collection", {
        _collection_id: collection.id,
        _scheduled_at: when.toISOString(),
        _vehicle: String(fd.get("veiculo")),
        _plate: String(fd.get("placa")),
        _driver: String(fd.get("motorista")),
      });
      toast.success("Coleta agendada");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao agendar");
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal onClose={onClose} title="Agendar coleta">
      <form onSubmit={submit} className="grid gap-3">
        <Inp name="data" label="Data e hora" type="datetime-local" required />
        <Inp name="motorista" label="Motorista" required />
        <Inp name="veiculo" label="Veículo" required />
        <Inp name="placa" label="Placa" required />
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-white/10 rounded-md text-sm"
          >
            Cancelar
          </button>
          <button
            disabled={saving}
            className="px-4 py-2 bg-brand text-industrial rounded-md text-sm font-semibold disabled:opacity-50"
          >
            {saving ? "Salvando..." : "Agendar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

async function uploadWorkflowFile(userId: string, scope: string, file: File) {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
  const path = `${userId}/${scope}/${Date.now()}-${safeName}`;
  const { error } = await supabase.storage.from("workflow-documents").upload(path, file);
  if (error) throw error;
  return path;
}

function CollectionDocumentModal({
  collection,
  userId,
  onClose,
  onSaved,
}: {
  collection: Collection;
  userId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const file = fd.get("arquivo");
    if (!(file instanceof File) || !file.size) return;
    setSaving(true);
    try {
      const path = await uploadWorkflowFile(userId, `collections/${collection.id}`, file);
      await workflowRpc("register_collection_document", {
        _collection_id: collection.id,
        _document_type: String(fd.get("tipo")),
        _storage_path: path,
        _document_number: String(fd.get("numero") || "") || null,
        _notes: String(fd.get("observacoes") || "") || null,
      });
      toast.success("Documento anexado");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro no anexo");
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal onClose={onClose} title="Anexar documento da coleta">
      <form onSubmit={submit} className="grid gap-3">
        <Sel
          name="tipo"
          label="Tipo"
          required
          options={[
            { value: "comprovante_coleta", label: "Comprovante de coleta" },
            { value: "comprovante_entrega", label: "Comprovante de entrega" },
            { value: "documento_transporte", label: "Documento de transporte" },
            { value: "mtr", label: "MTR" },
            { value: "outro", label: "Outro" },
          ]}
        />
        <Inp name="numero" label="Número (opcional)" />
        <input
          name="arquivo"
          type="file"
          required
          accept=".pdf,image/*"
          className="px-3 py-2 bg-white/5 border border-white/10 rounded-md text-sm"
        />
        <Inp name="observacoes" label="Observações" />
        <button
          disabled={saving}
          className="px-4 py-2 bg-brand text-industrial rounded-md text-sm font-semibold disabled:opacity-50"
        >
          {saving ? "Enviando..." : "Anexar"}
        </button>
      </form>
    </Modal>
  );
}

function DocumentsPanel({ alerts, onUpload }: { alerts: DocumentAlert[]; onUpload: () => void }) {
  const labels: Record<string, string> = {
    licenca_ambiental: "Licença ambiental",
    documento_transporte: "Documento de transporte",
    seguro_carga: "Seguro da carga",
    certificado_veiculo: "Certificado do veículo",
  };
  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <p className="text-sm text-slate-400">Documentos obrigatórios da transportadora.</p>
        <button
          onClick={onUpload}
          className="px-4 py-2 bg-brand text-industrial rounded-md text-sm font-semibold"
        >
          Anexar documento
        </button>
      </div>
      <div className="grid md:grid-cols-2 gap-2">
        {alerts.length === 0 ? (
          <div className="p-4 border border-brand/30 rounded-md text-sm text-brand">
            Documentação regular.
          </div>
        ) : (
          alerts.map((a) => (
            <div key={a.type} className="p-4 border border-amber-400/20 rounded-md">
              <div className="flex justify-between gap-2">
                <span className="font-semibold">{labels[a.type] ?? a.type}</span>
                <span className="text-xs text-amber-300">{a.alert.replaceAll("_", " ")}</span>
              </div>
              <div className="text-xs text-slate-400 mt-1">
                Status: {a.status}
                {a.valid_until
                  ? ` · Validade: ${new Date(`${a.valid_until}T12:00:00`).toLocaleDateString("pt-BR")}`
                  : ""}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function OrganizationDocumentModal({
  userId,
  onClose,
  onSaved,
}: {
  userId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const file = fd.get("arquivo");
    if (!(file instanceof File) || !file.size) return;
    setSaving(true);
    try {
      const path = await uploadWorkflowFile(userId, "carrier-documents", file);
      await workflowRpc("register_carrier_organization_document", {
        _document_type: String(fd.get("tipo")),
        _storage_path: path,
        _document_number: String(fd.get("numero") || "") || null,
        _valid_until: String(fd.get("validade") || "") || null,
        _notes: null,
      });
      toast.success("Documento enviado para validação");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro no documento");
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal onClose={onClose} title="Documento da transportadora">
      <form onSubmit={submit} className="grid gap-3">
        <Sel
          name="tipo"
          label="Tipo"
          required
          options={[
            { value: "licenca_ambiental", label: "Licença ambiental" },
            { value: "documento_transporte", label: "Documento de transporte" },
            { value: "seguro_carga", label: "Seguro da carga" },
            { value: "certificado_veiculo", label: "Certificado do veículo" },
          ]}
        />
        <Inp name="numero" label="Número" />
        <Inp name="validade" label="Validade" type="date" />
        <input
          name="arquivo"
          type="file"
          required
          accept=".pdf,image/*"
          className="px-3 py-2 bg-white/5 border border-white/10 rounded-md text-sm"
        />
        <button
          disabled={saving}
          className="px-4 py-2 bg-brand text-industrial rounded-md text-sm font-semibold disabled:opacity-50"
        >
          {saving ? "Enviando..." : "Enviar"}
        </button>
      </form>
    </Modal>
  );
}

function IncidentsPanel({
  incidents,
  collections,
  onNew,
}: {
  incidents: Incident[];
  collections: Collection[];
  onNew: (collection: Collection) => void;
}) {
  return (
    <div>
      <p className="text-sm text-slate-400 mb-3">
        Registre a ocorrência a partir de uma coleta abaixo.
      </p>
      <div className="flex flex-wrap gap-2 mb-4">
        {collections
          .filter((c) => !["ordem_criada", "recusada"].includes(c.status))
          .map((c) => (
            <button
              key={c.id}
              onClick={() => onNew(c)}
              className="px-3 py-1.5 border border-white/10 rounded-md text-xs"
            >
              + {c.codigo_coleta ?? c.id.slice(0, 8)}
            </button>
          ))}
      </div>
      <div className="grid gap-2">
        {incidents.length === 0 && (
          <p className="text-sm text-slate-500">Nenhuma ocorrência registrada.</p>
        )}
        {incidents.map((i) => (
          <div key={i.id} className="p-4 border border-white/10 rounded-md">
            <div className="flex justify-between">
              <span className="font-semibold">{i.tipo.replaceAll("_", " ")}</span>
              <StatusBadge status={i.status} />
            </div>
            <p className="text-xs text-slate-400 mt-1">{i.descricao}</p>
            <div className="text-[11px] text-slate-500 mt-2">
              Gravidade: {i.gravidade} · {new Date(i.created_at).toLocaleString("pt-BR")}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CarrierIncidentModal({
  collection,
  onClose,
  onSaved,
}: {
  collection: Collection;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSaving(true);
    try {
      await workflowRpc("register_operational_incident", {
        _type: String(fd.get("tipo")),
        _severity: String(fd.get("gravidade")),
        _description: String(fd.get("descricao")),
        _battery_id: null,
        _collection_id: collection.id,
        _operation_id: null,
      });
      toast.success("Ocorrência registrada");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro na ocorrência");
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal onClose={onClose} title="Registrar ocorrência">
      <form onSubmit={submit} className="grid gap-3">
        <Inp name="tipo" label="Tipo" placeholder="Ex.: atraso, avaria, acidente" required />
        <Sel
          name="gravidade"
          label="Gravidade"
          required
          options={[
            { value: "baixa", label: "Baixa" },
            { value: "media", label: "Média" },
            { value: "alta", label: "Alta" },
            { value: "critica", label: "Crítica" },
          ]}
        />
        <label className="grid gap-1">
          <span className="text-xs text-slate-400">Descrição</span>
          <textarea
            name="descricao"
            required
            rows={4}
            className="px-3 py-2 bg-white/5 border border-white/10 rounded-md text-sm"
          />
        </label>
        <button
          disabled={saving}
          className="px-4 py-2 bg-brand text-industrial rounded-md text-sm font-semibold disabled:opacity-50"
        >
          {saving ? "Salvando..." : "Registrar"}
        </button>
      </form>
    </Modal>
  );
}
