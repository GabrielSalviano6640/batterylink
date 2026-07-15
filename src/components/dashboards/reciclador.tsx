import { useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  FileWarning,
  Heart,
  PackageCheck,
  Recycle,
  Send,
  Truck,
  Upload,
} from "lucide-react";
import { Inp, Modal, Sel, StatusBadge } from "./gerador";
import { uploadPrivateDocument } from "@/lib/private-documents";
import { workflowRpc } from "@/lib/workflow";

type LotView = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  chemistry: string | null;
  classification: string | null;
  city: string | null;
  state: string | null;
  status: string;
  quantity: number | null;
  weight_kg: number | null;
  capacity_kwh: number | null;
  average_soh: number | null;
  proposal_deadline: string | null;
  created_at: string;
  watched: boolean;
  authorized: boolean;
};
type ProposalView = {
  id: string;
  lot_id: string;
  status: string;
  amount: number;
  currency: string | null;
  commercial_model: string | null;
  payer_type: string | null;
  recipient_type: string | null;
  logistics_cost: number;
  platform_fee: number;
  withdrawal_days: number | null;
  valid_until: string | null;
  destination: string | null;
  conditions: string | null;
  submitted_at: string | null;
  updated_at: string;
};
type OperationView = {
  id: string;
  lot_id: string;
  proposal_id: string;
  status: string;
  actual_weight_kg: number | null;
  received_at: string | null;
  destination_method: string | null;
  destination_notes: string | null;
  destination_completed_at: string | null;
  pending_documents: number;
  updated_at: string;
};
type Summary = {
  available_lots: number;
  watched_lots: number;
  draft_proposals: number;
  sent_proposals: number;
  accepted_proposals: number;
  active_operations: number;
  received_materials: number;
  pending_documents: number;
};
type DashboardData = {
  organization_id: string | null;
  lots: LotView[];
  proposals: ProposalView[];
  operations: OperationView[];
  summary: Summary;
};
type Detail = LotView & { batteries: Array<Record<string, unknown>> };
type Tab = "market" | "watched" | "proposals" | "operations";

const emptySummary: Summary = {
  available_lots: 0,
  watched_lots: 0,
  draft_proposals: 0,
  sent_proposals: 0,
  accepted_proposals: 0,
  active_operations: 0,
  received_materials: 0,
  pending_documents: 0,
};

export function RecicladorDashboard({ userId }: { userId: string }) {
  const [data, setData] = useState<DashboardData>({
    organization_id: null,
    lots: [],
    proposals: [],
    operations: [],
    summary: emptySummary,
  });
  const [tab, setTab] = useState<Tab>("market");
  const [detailLot, setDetailLot] = useState<LotView | null>(null);
  const [proposalLot, setProposalLot] = useState<LotView | null>(null);
  const [editingProposal, setEditingProposal] = useState<ProposalView | null>(null);
  const [operationAction, setOperationAction] = useState<{
    type: "receipt" | "divergence" | "document" | "destination";
    operation: OperationView;
  } | null>(null);
  const [filters, setFilters] = useState({
    chemistry: "",
    classification: "",
    location: "",
    minWeight: "",
    maxWeight: "",
    deadlineDays: "",
  });

  const load = async () => {
    try {
      const [result, commercialRows] = await Promise.all([
        workflowRpc<DashboardData>("get_recycler_dashboard_data", {}),
        supabase
          .from("proposals")
          .select("id,payer_type,recipient_type,logistics_cost,platform_fee"),
      ]);
      if (result) {
        const commercial = new Map((commercialRows.data ?? []).map((row) => [row.id, row]));
        setData({
          ...result,
          proposals: result.proposals.map((proposal) => ({
            ...proposal,
            payer_type: commercial.get(proposal.id)?.payer_type ?? null,
            recipient_type: commercial.get(proposal.id)?.recipient_type ?? null,
            logistics_cost: Number(commercial.get(proposal.id)?.logistics_cost ?? 0),
            platform_fee: Number(commercial.get(proposal.id)?.platform_fee ?? 0),
          })),
          summary: { ...emptySummary, ...result.summary },
        });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao carregar painel");
    }
  };
  useEffect(() => {
    void load();
  }, []);

  const proposalsByLot = useMemo(
    () => new Map(data.proposals.map((p) => [p.lot_id, p])),
    [data.proposals],
  );
  const marketplace = useMemo(
    () =>
      data.lots.filter((lot) => {
        if (!["publicado", "recebendo_propostas"].includes(lot.status)) return false;
        if (filters.chemistry && lot.chemistry !== filters.chemistry) return false;
        if (filters.classification && lot.classification !== filters.classification) return false;
        if (
          filters.location &&
          !`${lot.city ?? ""} ${lot.state ?? ""}`
            .toLowerCase()
            .includes(filters.location.toLowerCase())
        )
          return false;
        if (filters.minWeight && Number(lot.weight_kg ?? 0) < Number(filters.minWeight))
          return false;
        if (filters.maxWeight && Number(lot.weight_kg ?? 0) > Number(filters.maxWeight))
          return false;
        if (filters.deadlineDays && lot.proposal_deadline) {
          const days = (new Date(lot.proposal_deadline).getTime() - Date.now()) / 86400000;
          if (days > Number(filters.deadlineDays)) return false;
        }
        return true;
      }),
    [data.lots, filters],
  );
  const chemistries = Array.from(
    new Set(data.lots.map((l) => l.chemistry).filter(Boolean)),
  ) as string[];
  const classifications = Array.from(
    new Set(data.lots.map((l) => l.classification).filter(Boolean)),
  ) as string[];

  const toggleWatch = async (lot: LotView) => {
    try {
      await workflowRpc("toggle_lot_watch", { _lot_id: lot.id });
      toast.success(lot.watched ? "Lote removido dos acompanhados" : "Lote acompanhado");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao acompanhar lote");
    }
  };
  const cancelProposal = async (proposal: ProposalView) => {
    const reason = window.prompt("Justificativa para cancelar a proposta:");
    if (!reason) return;
    try {
      await workflowRpc("cancel_recycler_proposal", { _proposal_id: proposal.id, _reason: reason });
      toast.success("Proposta cancelada");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao cancelar");
    }
  };

  const cards = [
    ["Lotes disponíveis", data.summary.available_lots, ClipboardList],
    ["Acompanhados", data.summary.watched_lots, Heart],
    ["Rascunhos", data.summary.draft_proposals, FileWarning],
    ["Propostas enviadas", data.summary.sent_proposals, Send],
    ["Propostas aceitas", data.summary.accepted_proposals, CheckCircle2],
    ["Operações em andamento", data.summary.active_operations, Truck],
    ["Materiais recebidos", data.summary.received_materials, PackageCheck],
    ["Documentos pendentes", data.summary.pending_documents, AlertTriangle],
  ] as const;

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <Recycle className="w-5 h-5 text-brand" />
        <p className="font-mono text-xs text-brand tracking-widest uppercase">
          Painel · Recicladora
        </p>
      </div>
      <h1 className="text-2xl font-display font-bold mb-5">Marketplace & destinação</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-2 mb-6">
        {cards.map(([label, value, Icon]) => (
          <div key={label} className="p-3 border border-white/10 rounded-md bg-white/[0.025]">
            <Icon className="w-4 h-4 text-brand mb-2" />
            <div className="text-2xl font-display font-bold">{value}</div>
            <div className="text-[11px] leading-tight text-slate-400 mt-1">{label}</div>
          </div>
        ))}
      </div>
      <div className="flex gap-1 border-b border-white/10 mb-4 overflow-x-auto">
        {(["market", "watched", "proposals", "operations"] as Tab[]).map((item) => (
          <button
            key={item}
            onClick={() => setTab(item)}
            className={`px-4 py-2 text-sm border-b-2 -mb-px whitespace-nowrap ${tab === item ? "border-brand text-brand" : "border-transparent text-slate-400"}`}
          >
            {item === "market"
              ? "Lotes disponíveis"
              : item === "watched"
                ? "Acompanhados"
                : item === "proposals"
                  ? "Minhas propostas"
                  : "Operações"}
          </button>
        ))}
      </div>

      {tab === "market" && (
        <>
          <div className="grid md:grid-cols-3 xl:grid-cols-6 gap-2 mb-4">
            <Sel
              name="chemistry"
              label="Química"
              value={filters.chemistry}
              onChange={(e) => setFilters({ ...filters, chemistry: e.target.value })}
              options={[
                { value: "", label: "Todas" },
                ...chemistries.map((v) => ({ value: v, label: v })),
              ]}
            />
            <Sel
              name="classification"
              label="Classificação"
              value={filters.classification}
              onChange={(e) => setFilters({ ...filters, classification: e.target.value })}
              options={[
                { value: "", label: "Todas" },
                ...classifications.map((v) => ({ value: v, label: v.replaceAll("_", " ") })),
              ]}
            />
            <Inp
              name="location"
              label="Localização"
              value={filters.location}
              onChange={(e) => setFilters({ ...filters, location: e.target.value })}
              placeholder="Cidade ou UF"
            />
            <Inp
              name="minWeight"
              label="Peso mínimo (kg)"
              type="number"
              value={filters.minWeight}
              onChange={(e) => setFilters({ ...filters, minWeight: e.target.value })}
            />
            <Inp
              name="maxWeight"
              label="Peso máximo (kg)"
              type="number"
              value={filters.maxWeight}
              onChange={(e) => setFilters({ ...filters, maxWeight: e.target.value })}
            />
            <Inp
              name="deadlineDays"
              label="Prazo em até (dias)"
              type="number"
              value={filters.deadlineDays}
              onChange={(e) => setFilters({ ...filters, deadlineDays: e.target.value })}
            />
          </div>
          <LotGrid
            lots={marketplace}
            proposalsByLot={proposalsByLot}
            onDetails={setDetailLot}
            onWatch={(l) => void toggleWatch(l)}
            onPropose={(lot, proposal) => {
              setProposalLot(lot);
              setEditingProposal(proposal ?? null);
            }}
          />
        </>
      )}
      {tab === "watched" && (
        <LotGrid
          lots={data.lots.filter((l) => l.watched)}
          proposalsByLot={proposalsByLot}
          onDetails={setDetailLot}
          onWatch={(l) => void toggleWatch(l)}
          onPropose={(lot, proposal) => {
            setProposalLot(lot);
            setEditingProposal(proposal ?? null);
          }}
        />
      )}
      {tab === "proposals" && (
        <ProposalsPanel
          proposals={data.proposals}
          lots={data.lots}
          onEdit={(proposal) => {
            setProposalLot(data.lots.find((l) => l.id === proposal.lot_id) ?? null);
            setEditingProposal(proposal);
          }}
          onCancel={(p) => void cancelProposal(p)}
        />
      )}
      {tab === "operations" && (
        <OperationsPanel
          operations={data.operations}
          lots={data.lots}
          onAction={(type, operation) => setOperationAction({ type, operation })}
        />
      )}

      {detailLot && <LotDetailsModal lot={detailLot} onClose={() => setDetailLot(null)} />}
      {proposalLot && (
        <ProposalModal
          lot={proposalLot}
          proposal={editingProposal}
          onClose={() => {
            setProposalLot(null);
            setEditingProposal(null);
          }}
          onSaved={() => {
            setProposalLot(null);
            setEditingProposal(null);
            void load();
          }}
        />
      )}
      {operationAction?.type === "receipt" && (
        <ReceiptModal
          operation={operationAction.operation}
          onClose={() => setOperationAction(null)}
          onSaved={() => {
            setOperationAction(null);
            void load();
          }}
        />
      )}
      {operationAction?.type === "divergence" && (
        <DivergenceModal
          operation={operationAction.operation}
          onClose={() => setOperationAction(null)}
          onSaved={() => {
            setOperationAction(null);
            void load();
          }}
        />
      )}
      {operationAction?.type === "document" && (
        <OperationDocumentModal
          operation={operationAction.operation}
          onClose={() => setOperationAction(null)}
          onSaved={() => {
            setOperationAction(null);
            void load();
          }}
        />
      )}
      {operationAction?.type === "destination" && (
        <DestinationModal
          operation={operationAction.operation}
          onClose={() => setOperationAction(null)}
          onSaved={() => {
            setOperationAction(null);
            void load();
          }}
        />
      )}
    </div>
  );
}

function LotGrid({
  lots,
  proposalsByLot,
  onDetails,
  onWatch,
  onPropose,
}: {
  lots: LotView[];
  proposalsByLot: Map<string, ProposalView>;
  onDetails: (lot: LotView) => void;
  onWatch: (lot: LotView) => void;
  onPropose: (lot: LotView, proposal?: ProposalView) => void;
}) {
  return (
    <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
      {lots.length === 0 && <p className="text-sm text-slate-500">Nenhum lote encontrado.</p>}
      {lots.map((lot) => {
        const proposal = proposalsByLot.get(lot.id);
        return (
          <div key={lot.id} className="p-4 border border-white/10 rounded-md">
            <div className="flex justify-between gap-3">
              <div>
                <div className="font-mono text-brand text-sm">{lot.code}</div>
                <div className="font-semibold">{lot.title}</div>
              </div>
              <StatusBadge status={lot.status} />
            </div>
            <div className="text-xs text-slate-400 mt-2">
              {lot.chemistry ?? "Química n/i"} ·{" "}
              {(lot.classification ?? "classificação n/i").replaceAll("_", " ")}
            </div>
            <div className="text-xs text-slate-400">
              {lot.city ?? "—"}/{lot.state ?? "—"} ·{" "}
              {Number(lot.weight_kg ?? 0).toLocaleString("pt-BR")} kg · {lot.quantity ?? 0}{" "}
              bateria(s)
            </div>
            {lot.proposal_deadline && (
              <div className="text-[11px] text-amber-300 mt-1">
                Propostas até {new Date(lot.proposal_deadline).toLocaleString("pt-BR")}
              </div>
            )}
            <div className="flex flex-wrap gap-3 mt-3">
              <button onClick={() => onDetails(lot)} className="text-brand text-xs">
                Detalhes técnicos
              </button>
              <button onClick={() => onWatch(lot)} className="text-xs text-slate-300">
                {lot.watched ? "Deixar de acompanhar" : "Acompanhar"}
              </button>
              {(!proposal || ["rascunho", "enviada"].includes(proposal.status)) &&
                ["publicado", "recebendo_propostas"].includes(lot.status) && (
                  <button onClick={() => onPropose(lot, proposal)} className="text-brand text-xs">
                    {proposal ? "Editar proposta" : "Criar proposta"}
                  </button>
                )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ProposalsPanel({
  proposals,
  lots,
  onEdit,
  onCancel,
}: {
  proposals: ProposalView[];
  lots: LotView[];
  onEdit: (proposal: ProposalView) => void;
  onCancel: (proposal: ProposalView) => void;
}) {
  return (
    <div className="grid gap-2">
      {proposals.length === 0 && <p className="text-sm text-slate-500">Nenhuma proposta.</p>}
      {proposals.map((p) => (
        <div
          key={p.id}
          className="p-4 border border-white/10 rounded-md flex flex-wrap justify-between gap-3"
        >
          <div>
            <div className="font-mono text-brand text-xs">
              {lots.find((l) => l.id === p.lot_id)?.code ?? p.lot_id.slice(0, 8)}
            </div>
            <div className="font-semibold">
              R$ {Number(p.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-slate-400">
              {commercialModelLabel(p.commercial_model)} · retirada em {p.withdrawal_days ?? "—"}{" "}
              dias
            </div>
            <div className="text-xs text-slate-400 mt-1">
              Paga: {partyLabel(p.payer_type)} · Recebe: {partyLabel(p.recipient_type)}
            </div>
            <div className="text-xs text-slate-500">
              Logística: {currency(p.logistics_cost)} · Taxa da plataforma:{" "}
              {currency(p.platform_fee)}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={p.status} />
            {["rascunho", "enviada"].includes(p.status) && (
              <>
                <button onClick={() => onEdit(p)} className="text-brand text-xs">
                  Editar
                </button>
                <button onClick={() => onCancel(p)} className="text-danger text-xs">
                  Cancelar
                </button>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function OperationsPanel({
  operations,
  lots,
  onAction,
}: {
  operations: OperationView[];
  lots: LotView[];
  onAction: (
    type: "receipt" | "divergence" | "document" | "destination",
    operation: OperationView,
  ) => void;
}) {
  return (
    <div className="grid gap-3">
      {operations.length === 0 && <p className="text-sm text-slate-500">Nenhuma operação.</p>}
      {operations.map((op) => (
        <div key={op.id} className="p-4 border border-white/10 rounded-md">
          <div className="flex justify-between gap-3">
            <div>
              <div className="font-mono text-brand text-xs">
                OP-{op.id.slice(0, 8).toUpperCase()} · {lots.find((l) => l.id === op.lot_id)?.code}
              </div>
              {op.actual_weight_kg && (
                <div className="text-xs text-slate-400 mt-1">
                  Peso recebido: {Number(op.actual_weight_kg).toLocaleString("pt-BR")} kg
                </div>
              )}
              {op.destination_method && (
                <div className="text-xs text-slate-400">
                  Destinação: {op.destination_method.replaceAll("_", " ")}
                </div>
              )}
              <div className="text-xs text-slate-500">
                {op.pending_documents} documento(s) pendente(s)
              </div>
            </div>
            <StatusBadge status={op.status} />
          </div>
          <div className="flex flex-wrap gap-3 mt-3">
            {!op.received_at &&
              ["criada", "em_transporte", "aguardando_recebimento"].includes(op.status) && (
                <button onClick={() => onAction("receipt", op)} className="text-brand text-xs">
                  Confirmar recebimento
                </button>
              )}
            <button onClick={() => onAction("divergence", op)} className="text-amber-300 text-xs">
              Informar divergência
            </button>
            <button onClick={() => onAction("document", op)} className="text-brand text-xs">
              Anexar documento
            </button>
            {op.received_at && !op.destination_completed_at && (
              <button onClick={() => onAction("destination", op)} className="text-brand text-xs">
                Concluir destinação
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function LotDetailsModal({ lot, onClose }: { lot: LotView; onClose: () => void }) {
  const [detail, setDetail] = useState<Detail | null>(null);
  useEffect(() => {
    void workflowRpc<Detail>("get_recycler_lot_details", { _lot_id: lot.id })
      .then(setDetail)
      .catch((err) => toast.error(err instanceof Error ? err.message : "Erro"));
  }, [lot.id]);
  return (
    <Modal onClose={onClose} title={`Detalhes técnicos — ${lot.code}`}>
      {!detail ? (
        <p className="text-sm text-slate-400">Carregando...</p>
      ) : (
        <div className="grid gap-4 text-sm">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Info label="Química" value={detail.chemistry} />
            <Info label="Classificação" value={detail.classification?.replaceAll("_", " ")} />
            <Info
              label="Peso"
              value={`${Number(detail.weight_kg ?? 0).toLocaleString("pt-BR")} kg`}
            />
            <Info
              label="Capacidade"
              value={`${Number(detail.capacity_kwh ?? 0).toLocaleString("pt-BR")} kWh`}
            />
            <Info label="SOH médio" value={`${detail.average_soh ?? "—"}%`} />
            <Info label="Quantidade" value={detail.quantity} />
            <Info label="Localização" value={`${detail.city ?? "—"}/${detail.state ?? "—"}`} />
            <Info
              label="Acesso"
              value={detail.authorized ? "Detalhes liberados" : "Dados agregados"}
            />
          </div>
          <p className="text-xs text-slate-400">{detail.description}</p>
          {detail.authorized ? (
            <div>
              <h3 className="text-xs uppercase font-mono text-slate-400 mb-2">
                Baterias autorizadas
              </h3>
              <pre className="p-3 bg-white/5 rounded text-xs overflow-auto max-h-72">
                {JSON.stringify(detail.batteries, null, 2)}
              </pre>
            </div>
          ) : (
            <p className="text-xs text-amber-300">
              Identificadores, fabricantes e números de série serão liberados somente após a
              proposta ser aceita.
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}
function Info({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="p-2 bg-white/5 rounded">
      <div className="text-[10px] uppercase text-slate-500">{label}</div>
      <div className="text-xs mt-1">{String(value ?? "—")}</div>
    </div>
  );
}

function ProposalModal({
  lot,
  proposal,
  onClose,
  onSaved,
}: {
  lot: LotView;
  proposal: ProposalView | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const send = submitter?.dataset.action !== "draft";
    const fd = new FormData(e.currentTarget);
    setSaving(true);
    try {
      await workflowRpc("save_recycler_proposal", {
        _lot_id: lot.id,
        _proposal_id: proposal?.id ?? null,
        _amount: Number(fd.get("amount")),
        _conditions: String(fd.get("conditions") || "") || null,
        _commercial_model: String(fd.get("model")),
        _withdrawal_days: Number(fd.get("days")) || null,
        _valid_until: String(fd.get("validUntil") || "")
          ? new Date(String(fd.get("validUntil"))).toISOString()
          : null,
        _destination: String(fd.get("destination")),
        _submit: send,
        _payer_type: String(fd.get("payer")),
        _recipient_type: String(fd.get("recipient")),
        _logistics_cost: Number(fd.get("logisticsCost")) || 0,
        _platform_fee: Number(fd.get("platformFee")) || 0,
      });
      toast.success(send ? "Proposta enviada" : "Rascunho salvo");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro na proposta");
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal onClose={onClose} title={`${proposal ? "Editar" : "Nova"} proposta — ${lot.code}`}>
      <form className="grid gap-3" onSubmit={(e) => void submit(e)}>
        <Inp
          name="amount"
          label="Valor proposto (R$)"
          type="number"
          step="0.01"
          min="0.01"
          defaultValue={proposal?.amount}
          required
        />
        <Inp
          name="days"
          label="Prazo para retirada (dias)"
          type="number"
          min="1"
          defaultValue={proposal?.withdrawal_days ?? undefined}
        />
        <Inp
          name="validUntil"
          label="Validade da proposta"
          type="datetime-local"
          defaultValue={proposal?.valid_until?.slice(0, 16)}
        />
        <Sel
          name="model"
          label="Modelo comercial"
          defaultValue={proposal?.commercial_model ?? "recicladora_compra_lote"}
          required
          options={[
            { value: "gerador_paga_destinacao", label: "Gerador paga pela destinação" },
            { value: "recicladora_compra_lote", label: "Recicladora compra o lote" },
            { value: "intermediacao_neutra", label: "Intermediação neutra" },
          ]}
        />
        <div className="grid md:grid-cols-2 gap-3">
          <Sel
            name="payer"
            label="Quem paga"
            defaultValue={proposal?.payer_type ?? "recicladora"}
            options={commercialPartyOptions}
          />
          <Sel
            name="recipient"
            label="Quem recebe"
            defaultValue={proposal?.recipient_type ?? "gerador"}
            options={commercialPartyOptions}
          />
          <Inp
            name="logisticsCost"
            label="Custos logísticos (R$)"
            type="number"
            min="0"
            step="0.01"
            defaultValue={proposal?.logistics_cost ?? 0}
          />
          <Inp
            name="platformFee"
            label="Taxa da plataforma (R$)"
            type="number"
            min="0"
            step="0.01"
            defaultValue={proposal?.platform_fee ?? 0}
          />
        </div>
        <Inp
          name="destination"
          label="Destinação proposta"
          defaultValue={proposal?.destination ?? lot.classification ?? "reciclagem"}
          required
        />
        <label className="grid gap-1">
          <span className="text-xs text-slate-400">Condições</span>
          <textarea
            name="conditions"
            rows={4}
            defaultValue={proposal?.conditions ?? ""}
            className="px-3 py-2 bg-white/5 border border-white/10 rounded-md text-sm"
          />
        </label>
        <p className="text-[10px] text-slate-500">
          Esta etapa registra apenas os termos acordados. Nenhum pagamento bancário é processado
          pela plataforma.
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="submit"
            data-action="draft"
            disabled={saving}
            className="px-4 py-2 border border-white/10 rounded-md text-sm"
          >
            Salvar rascunho
          </button>
          <button
            type="submit"
            data-action="send"
            disabled={saving}
            className="px-4 py-2 bg-brand text-industrial rounded-md text-sm font-semibold"
          >
            Enviar proposta
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ReceiptModal({
  operation,
  onClose,
  onSaved,
}: {
  operation: OperationView;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSaving(true);
    try {
      await workflowRpc("confirm_recycler_receipt", {
        _operation_id: operation.id,
        _actual_weight_kg: Number(fd.get("weight")),
        _notes: String(fd.get("notes") || "") || null,
      });
      toast.success("Recebimento e peso registrados");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal onClose={onClose} title="Confirmar recebimento">
      <form onSubmit={submit} className="grid gap-3">
        <Inp
          name="weight"
          label="Peso efetivamente recebido (kg)"
          type="number"
          step="0.01"
          min="0.01"
          required
        />
        <Inp name="notes" label="Observações da conferência" />
        <button
          disabled={saving}
          className="px-4 py-2 bg-brand text-industrial rounded-md text-sm font-semibold"
        >
          Confirmar
        </button>
      </form>
    </Modal>
  );
}
function DivergenceModal({
  operation,
  onClose,
  onSaved,
}: {
  operation: OperationView;
  onClose: () => void;
  onSaved: () => void;
}) {
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    try {
      await workflowRpc("register_recycler_divergence", {
        _operation_id: operation.id,
        _type: String(fd.get("type")),
        _severity: String(fd.get("severity")),
        _description: String(fd.get("description")),
      });
      toast.success("Divergência registrada");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    }
  };
  return (
    <Modal onClose={onClose} title="Informar divergência">
      <form onSubmit={submit} className="grid gap-3">
        <Sel
          name="type"
          label="Tipo"
          required
          options={[
            { value: "peso", label: "Peso" },
            { value: "quantidade", label: "Quantidade" },
            { value: "avaria", label: "Avaria" },
            { value: "documentacao", label: "Documentação" },
            { value: "outro", label: "Outro" },
          ]}
        />
        <Sel
          name="severity"
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
            name="description"
            required
            rows={4}
            className="px-3 py-2 bg-white/5 border border-white/10 rounded-md text-sm"
          />
        </label>
        <button className="px-4 py-2 bg-brand text-industrial rounded-md text-sm font-semibold">
          Registrar
        </button>
      </form>
    </Modal>
  );
}
function OperationDocumentModal({
  operation,
  onClose,
  onSaved,
}: {
  operation: OperationView;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const file = fd.get("file");
    if (!(file instanceof File) || !file.size) return;
    setSaving(true);
    try {
      const type = String(fd.get("type"));
      const uploaded = await uploadPrivateDocument("operation", operation.id, type, file);
      if (type === "cdf") {
        await workflowRpc("register_regulatory_document_metadata", {
          _private_document_id: uploaded.id,
          _number: String(fd.get("number") || "") || null,
          _issuer_system: String(fd.get("issuer") || "") || null,
          _status: String(fd.get("status")),
          _collection_id: null,
          _operation_id: operation.id,
          _responsible_validated: fd.get("responsibleValidated") === "on",
          _notes: null,
        });
      }
      toast.success("Documento anexado");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro no anexo");
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal onClose={onClose} title="Anexar documento">
      <form onSubmit={submit} className="grid gap-3">
        <Sel
          name="type"
          label="Tipo"
          required
          options={[
            { value: "comprovante_entrega", label: "Comprovante de entrega" },
            { value: "certificado_destinacao", label: "Certificado de destinação" },
            { value: "laudo_triagem", label: "Laudo" },
            { value: "cdf", label: "CDF" },
            { value: "outro", label: "Outro" },
          ]}
        />
        <Inp name="number" label="Número" />
        <Inp name="issuer" label="Órgão ou sistema emissor" />
        <Sel
          name="status"
          label="Status"
          defaultValue="anexado"
          options={[
            { value: "anexado", label: "Anexado" },
            { value: "em_validacao", label: "Em validação" },
            { value: "validado", label: "Validado" },
          ]}
        />
        <label className="flex items-center gap-2 text-xs text-slate-300">
          <input name="responsibleValidated" type="checkbox" /> Responsável pelo documento validado
        </label>
        <input
          name="file"
          type="file"
          required
          accept=".pdf,image/*"
          className="px-3 py-2 bg-white/5 border border-white/10 rounded-md text-sm"
        />
        <p className="text-[10px] text-slate-500">
          MTR: documento registrado ou anexado à operação. A emissão oficial deve ocorrer no sistema
          ambiental competente. CDF: certificado emitido ou validado pelo destinador responsável,
          conforme o sistema ambiental aplicável.
        </p>
        <button
          disabled={saving}
          className="px-4 py-2 bg-brand text-industrial rounded-md text-sm font-semibold inline-flex items-center justify-center gap-2"
        >
          <Upload className="w-4 h-4" /> Anexar
        </button>
      </form>
    </Modal>
  );
}

const commercialPartyOptions = [
  { value: "gerador", label: "Gerador" },
  { value: "recicladora", label: "Recicladora" },
  { value: "operador", label: "Operador" },
  { value: "plataforma", label: "Plataforma" },
  { value: "a_definir", label: "A definir" },
];
function commercialModelLabel(value: string | null) {
  return (
    (
      {
        gerador_paga_destinacao: "Gerador paga pela destinação",
        recicladora_compra_lote: "Recicladora compra o lote",
        intermediacao_neutra: "Intermediação neutra",
      } as Record<string, string>
    )[value ?? ""] ?? "Modelo não informado"
  );
}
function partyLabel(value: string | null) {
  return (
    (
      {
        gerador: "Gerador",
        recicladora: "Recicladora",
        operador: "Operador",
        plataforma: "Plataforma",
        a_definir: "A definir",
      } as Record<string, string>
    )[value ?? ""] ?? "A definir"
  );
}
function currency(value: number) {
  return Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function DestinationModal({
  operation,
  onClose,
  onSaved,
}: {
  operation: OperationView;
  onClose: () => void;
  onSaved: () => void;
}) {
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    try {
      await workflowRpc("complete_recycler_destination", {
        _operation_id: operation.id,
        _method: String(fd.get("method")),
        _notes: String(fd.get("notes") || ""),
      });
      toast.success("Destinação concluída e enviada para validação");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    }
  };
  return (
    <Modal onClose={onClose} title="Concluir destinação">
      <form onSubmit={submit} className="grid gap-3">
        <Sel
          name="method"
          label="Forma de destinação"
          required
          options={[
            { value: "segunda_vida", label: "Segunda vida" },
            { value: "reutilizacao_componentes", label: "Reutilização de componentes" },
            { value: "reciclagem_mecanica", label: "Reciclagem mecânica" },
            { value: "reciclagem_quimica", label: "Reciclagem química" },
            { value: "descarte_controlado", label: "Descarte controlado" },
          ]}
        />
        <label className="grid gap-1">
          <span className="text-xs text-slate-400">Descrição técnica</span>
          <textarea
            name="notes"
            required
            rows={4}
            className="px-3 py-2 bg-white/5 border border-white/10 rounded-md text-sm"
          />
        </label>
        <button className="px-4 py-2 bg-brand text-industrial rounded-md text-sm font-semibold">
          Concluir destinação
        </button>
      </form>
    </Modal>
  );
}
