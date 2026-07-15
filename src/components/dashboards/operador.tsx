import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import {
  Activity,
  AlertTriangle,
  BatteryCharging,
  ClipboardCheck,
  FileWarning,
  FlaskConical,
  Layers3,
  Package,
  PackageCheck,
  Send,
  ShieldCheck,
  Siren,
  Truck,
  Upload,
} from "lucide-react";
import { Modal, StatusBadge, Inp, Sel } from "./gerador";
import { workflowRpc } from "@/lib/workflow";

type Battery = Tables<"batteries">;
type Lot = Tables<"lots">;
type Collection = Tables<"collections">;
type Operation = Tables<"operations">;
type Incident = Tables<"incidents">;
type CarrierOption = {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  documents_ok: boolean;
};

type OperatorSummary = {
  received_requests: number;
  priority_requests: number;
  awaiting_collection: number;
  received_batteries: number;
  diagnostic_queue: number;
  technical_quarantine: number;
  forming_lots: number;
  published_lots: number;
  received_proposals: number;
  pending_documents: number;
  open_incidents: number;
};

const emptySummary: OperatorSummary = {
  received_requests: 0,
  priority_requests: 0,
  awaiting_collection: 0,
  received_batteries: 0,
  diagnostic_queue: 0,
  technical_quarantine: 0,
  forming_lots: 0,
  published_lots: 0,
  received_proposals: 0,
  pending_documents: 0,
  open_incidents: 0,
};

const refreshOperatorSummary = () => window.dispatchEvent(new Event("operator-dashboard-refresh"));

export function OperadorDashboard({ userId }: { userId: string }) {
  const [tab, setTab] = useState<"batteries" | "lots" | "operations" | "incidents">("batteries");
  const [summary, setSummary] = useState<OperatorSummary>(emptySummary);

  useEffect(() => {
    const loadSummary = async () => {
      try {
        const data = await workflowRpc<OperatorSummary>("get_operator_dashboard_summary", {});
        setSummary({ ...emptySummary, ...(data ?? {}) });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao carregar indicadores");
      }
    };
    const listener = () => void loadSummary();
    void loadSummary();
    window.addEventListener("operator-dashboard-refresh", listener);
    return () => window.removeEventListener("operator-dashboard-refresh", listener);
  }, []);

  const cards = [
    ["Solicitações recebidas", summary.received_requests, ClipboardCheck],
    ["Prioridades e urgências", summary.priority_requests, AlertTriangle],
    ["Aguardando coleta", summary.awaiting_collection, Truck],
    ["Baterias recebidas", summary.received_batteries, PackageCheck],
    ["Fila de diagnóstico", summary.diagnostic_queue, FlaskConical],
    ["Quarentena técnica", summary.technical_quarantine, Siren],
    ["Lotes em formação", summary.forming_lots, Layers3],
    ["Lotes publicados", summary.published_lots, Package],
    ["Propostas recebidas", summary.received_proposals, Send],
    ["Documentos pendentes", summary.pending_documents, FileWarning],
    ["Ocorrências abertas", summary.open_incidents, Activity],
  ] as const;
  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <ShieldCheck className="w-5 h-5 text-brand" />
        <p className="font-mono text-xs text-brand tracking-widest uppercase">Painel · Operador</p>
      </div>
      <h1 className="text-2xl font-display font-bold mb-5">Triagem & lotes</h1>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2 mb-6">
        {cards.map(([label, value, Icon]) => (
          <div key={label} className="p-3 border border-white/10 rounded-md bg-white/[0.025]">
            <Icon className="w-4 h-4 text-brand mb-2" />
            <div className="text-2xl font-display font-bold">{value}</div>
            <div className="text-[11px] leading-tight text-slate-400 mt-1">{label}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-2 mb-4 border-b border-white/10">
        {(["batteries", "lots", "operations", "incidents"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm border-b-2 -mb-px ${tab === t ? "border-brand text-brand" : "border-transparent text-slate-400"}`}
          >
            {t === "batteries"
              ? "Baterias"
              : t === "lots"
                ? "Lotes"
                : t === "operations"
                  ? "Operações"
                  : "Ocorrências"}
          </button>
        ))}
      </div>

      {tab === "batteries" ? (
        <BatteriesTab userId={userId} />
      ) : tab === "lots" ? (
        <LotsTab userId={userId} />
      ) : tab === "operations" ? (
        <OperationsTab />
      ) : (
        <IncidentsTab />
      )}
    </div>
  );
}

function BatteriesTab({ userId }: { userId: string }) {
  const [items, setItems] = useState<Battery[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [q, setQ] = useState("");
  const [triage, setTriage] = useState<Battery | null>(null);
  const [collectBattery, setCollectBattery] = useState<Battery | null>(null);
  const [carriers, setCarriers] = useState<CarrierOption[]>([]);

  const load = async () => {
    const [{ data }, { data: collectionRows }, carrierRows] = await Promise.all([
      supabase.from("batteries").select("*").order("created_at", { ascending: false }),
      supabase.from("collections").select("*").order("created_at", { ascending: false }),
      workflowRpc<CarrierOption[]>("list_eligible_carriers", {}).catch(() => []),
    ]);
    setItems(data ?? []);
    setCollections(collectionRows ?? []);
    setCarriers(carrierRows ?? []);
  };
  useEffect(() => {
    void load();
  }, []);

  const filtered = items
    .filter(
      (b) =>
        (filter === "all" || b.status === filter) &&
        (!q || b.code.toLowerCase().includes(q.toLowerCase())),
    )
    .sort(
      (a, b) =>
        Number(
          Boolean(b.possui_risco_termico || b.possui_vazamento || /alta|emerg/i.test(b.urgencia)),
        ) -
        Number(
          Boolean(a.possui_risco_termico || a.possui_vazamento || /alta|emerg/i.test(a.urgencia)),
        ),
    );

  const flagRisk = async (battery: Battery) => {
    const riskType = window.prompt("Tipo do risco: termico, vazamento ou avaria", "termico");
    if (!riskType || !["termico", "vazamento", "avaria"].includes(riskType))
      return toast.error("Tipo de risco inválido");
    const notes = window.prompt("Descreva o risco identificado:");
    if (!notes) return;
    try {
      await workflowRpc("flag_battery_risk", {
        _battery_id: battery.id,
        _risk_type: riskType,
        _notes: notes,
        _quarantine: true,
      });
      toast.success("Risco registrado e bateria direcionada à quarentena");
      await load();
      refreshOperatorSummary();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao registrar risco");
    }
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-3">
        <input
          placeholder="Buscar código..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="flex-1 min-w-[180px] px-3 py-2 bg-white/5 border border-white/10 rounded-md text-sm"
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="px-3 py-2 bg-white/5 border border-white/10 rounded-md text-sm"
        >
          <option value="all">Todos os status</option>
          <option value="aguardando_analise">Aguardando análise</option>
          <option value="aprovada_para_coleta">Aprovadas para coleta</option>
          <option value="recebida_na_triagem">Recebidas na triagem</option>
          <option value="em_diagnostico">Em diagnóstico</option>
          <option value="classificada">Classificadas</option>
          <option value="em_lote">Em lote</option>
        </select>
      </div>
      <div className="border border-white/10 rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-xs uppercase font-mono text-slate-400">
            <tr>
              <th className="text-left px-3 py-2">Código</th>
              <th className="text-left px-3 py-2">Origem</th>
              <th className="text-left px-3 py-2">Química</th>
              <th className="text-left px-3 py-2">Estado</th>
              <th className="text-left px-3 py-2">Status</th>
              <th className="text-left px-3 py-2">Ação</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-slate-500">
                  Nenhuma bateria.
                </td>
              </tr>
            ) : (
              filtered.map((b) => (
                <tr key={b.id} className="border-t border-white/5 hover:bg-white/5">
                  <td className="px-3 py-2 font-mono text-brand">{b.code}</td>
                  <td className="px-3 py-2">{b.origem}</td>
                  <td className="px-3 py-2">{b.quimica}</td>
                  <td className="px-3 py-2">{b.estado}</td>
                  <td className="px-3 py-2">
                    <StatusBadge status={b.status} />
                    {(b.possui_risco_termico ||
                      b.possui_vazamento ||
                      /alta|emerg/i.test(b.urgencia)) && (
                      <div className="text-[10px] text-amber-300 mt-1">
                        Prioridade: {b.urgencia}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-2">
                      <BatteryAction
                        battery={b}
                        collections={collections}
                        onTriage={() => setTriage(b)}
                        onCreateCollection={() => setCollectBattery(b)}
                        onChanged={() => void load()}
                      />
                      {!["concluida", "cancelada", "em_quarentena"].includes(b.status) && (
                        <button onClick={() => void flagRisk(b)} className="text-amber-300 text-xs">
                          Indicar risco
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {triage && (
        <TriageModal
          battery={triage}
          userId={userId}
          onClose={() => setTriage(null)}
          onSaved={() => {
            void load();
            setTriage(null);
          }}
        />
      )}
      {collectBattery && (
        <CreateCollectionModal
          battery={collectBattery}
          carriers={carriers}
          onClose={() => setCollectBattery(null)}
          onSaved={() => {
            void load();
            refreshOperatorSummary();
            setCollectBattery(null);
          }}
        />
      )}
    </div>
  );
}

function BatteryAction({
  battery,
  collections,
  onTriage,
  onCreateCollection,
  onChanged,
}: {
  battery: Battery;
  collections: Collection[];
  onTriage: () => void;
  onCreateCollection: () => void;
  onChanged: () => void;
}) {
  const run = async (fn: () => Promise<unknown>, success: string) => {
    try {
      await fn();
      toast.success(success);
      onChanged();
      refreshOperatorSummary();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro no fluxo");
    }
  };

  if (battery.status === "aguardando_analise") {
    return (
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() =>
            void run(
              () =>
                workflowRpc("review_battery_request", {
                  _battery_id: battery.id,
                  _decision: "aceitar",
                  _reason: "Solicitação aprovada para coleta",
                  _organization_id: null,
                }),
              "Bateria aprovada para coleta",
            )
          }
          className="text-brand text-xs"
        >
          Aprovar
        </button>
        <button
          onClick={() => {
            const reason = window.prompt("Quais informações o gerador deve complementar?");
            if (!reason) return;
            void run(
              () =>
                workflowRpc("review_battery_request", {
                  _battery_id: battery.id,
                  _decision: "solicitar_informacoes",
                  _reason: reason,
                  _organization_id: null,
                }),
              "Informações solicitadas",
            );
          }}
          className="text-amber-300 text-xs"
        >
          Solicitar dados
        </button>
      </div>
    );
  }

  if (battery.status === "aprovada_para_coleta") {
    return (
      <button onClick={onCreateCollection} className="text-brand text-xs">
        Criar coleta
      </button>
    );
  }

  if (battery.status === "em_transporte") {
    const delivered = collections.find(
      (c) => c.battery_id === battery.id && c.status === "entregue_triagem",
    );
    if (delivered) {
      return (
        <button
          onClick={() =>
            void run(
              () =>
                workflowRpc("confirm_triage_receipt", {
                  _collection_id: delivered.id,
                  _reason: "Material conferido e recebido no centro de triagem",
                  _organization_id: null,
                }),
              "Recebimento confirmado",
            )
          }
          className="text-brand text-xs"
        >
          Confirmar recebimento
        </button>
      );
    }
  }

  if (battery.status === "recebida_na_triagem") {
    return (
      <button
        onClick={() =>
          void run(
            () =>
              workflowRpc("start_battery_diagnostic", {
                _battery_id: battery.id,
                _organization_id: null,
              }),
            "Diagnóstico iniciado",
          )
        }
        className="text-brand text-xs"
      >
        Iniciar diagnóstico
      </button>
    );
  }

  if (battery.status === "em_diagnostico") {
    return (
      <button onClick={onTriage} className="text-brand text-xs">
        Registrar diagnóstico
      </button>
    );
  }

  if (["classificada", "em_quarentena"].includes(battery.status)) {
    return (
      <button
        onClick={() =>
          void run(
            () =>
              workflowRpc("complete_technical_stage", {
                _battery_id: battery.id,
                _notes: "Etapa técnica revisada e concluída",
              }),
            "Etapa técnica concluída",
          )
        }
        className="text-brand text-xs"
      >
        Concluir etapa técnica
      </button>
    );
  }

  return <span className="text-xs text-slate-500">Aguardando próxima etapa</span>;
}

function CreateCollectionModal({
  battery,
  carriers,
  onClose,
  onSaved,
}: {
  battery: Battery;
  carriers: CarrierOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSaving(true);
    try {
      await workflowRpc("create_collection_order", {
        _battery_id: battery.id,
        _origin: String(fd.get("origem")),
        _destination: String(fd.get("destino")),
        _operator_organization_id: null,
        _carrier_organization_id: String(fd.get("carrier")),
      });
      toast.success("Coleta criada e transportadora notificada");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao criar coleta");
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal onClose={onClose} title={`Criar coleta — ${battery.code}`}>
      <form onSubmit={submit} className="grid gap-3">
        <Inp
          name="origem"
          label="Endereço de coleta"
          defaultValue={battery.endereco ?? `${battery.cidade ?? ""}/${battery.uf ?? ""}`}
          required
        />
        <Inp name="destino" label="Destino" defaultValue="Centro de triagem BatteryLink" required />
        <Sel
          name="carrier"
          label="Transportadora"
          required
          options={carriers.map((c) => ({
            value: c.id,
            label: `${c.name}${c.city ? ` · ${c.city}/${c.state ?? ""}` : ""}${c.documents_ok ? "" : " · documentos pendentes"}`,
          }))}
        />
        {carriers.length === 0 && (
          <p className="text-xs text-amber-300">Nenhuma transportadora aprovada está disponível.</p>
        )}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-white/10 rounded-md text-sm"
          >
            Cancelar
          </button>
          <button
            disabled={saving || carriers.length === 0}
            className="px-4 py-2 bg-brand text-industrial rounded-md text-sm font-semibold disabled:opacity-50"
          >
            {saving ? "Criando..." : "Criar ordem"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function TriageModal({
  battery,
  userId,
  onClose,
  onSaved,
}: {
  battery: Battery;
  userId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const classificacao = String(fd.get("classificacao"));
    const soh = Number(fd.get("soh") || 0);
    const notas = String(fd.get("notas") || "");
    const report = fd.get("laudo");
    setSaving(true);
    try {
      await workflowRpc("record_battery_diagnostic", {
        _battery_id: battery.id,
        _classification: classificacao,
        _soh: soh,
        _voltage: fd.get("tensao") ? Number(fd.get("tensao")) : null,
        _capacity: fd.get("capacidade") ? Number(fd.get("capacidade")) : null,
        _temperature: fd.get("temperatura") ? Number(fd.get("temperatura")) : null,
        _integrity: String(fd.get("integridade") || "") || null,
        _risk: String(fd.get("risco") || "") || null,
        _recommendation: String(fd.get("recomendacao") || "") || null,
        _notes: notas || null,
        _organization_id: null,
      });
      if (report instanceof File && report.size > 0) {
        const safeName = report.name.replace(/[^a-zA-Z0-9._-]/g, "-");
        const path = `${userId}/technical/${battery.id}/${Date.now()}-${safeName}`;
        const { error } = await supabase.storage.from("workflow-documents").upload(path, report);
        if (error) throw error;
        await workflowRpc("register_technical_report", {
          _battery_id: battery.id,
          _storage_path: path,
          _number: null,
          _notes: notas || null,
        });
      }
      toast.success("Bateria classificada");
      refreshOperatorSummary();
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal onClose={onClose} title={`Triagem — ${battery.code}`}>
      <form onSubmit={submit} className="grid gap-3">
        <p className="text-xs text-slate-400">
          Origem: {battery.origem} · Química: {battery.quimica} · Estado: {battery.estado}
        </p>
        <div className="grid md:grid-cols-2 gap-3">
          <Sel
            name="classificacao"
            label="Classificação"
            required
            options={[
              { value: "segunda_vida", label: "Segunda vida" },
              { value: "reutilizacao_componentes", label: "Reutilização de componentes" },
              { value: "reciclagem_mecanica", label: "Reciclagem mecânica" },
              { value: "reciclagem_quimica", label: "Reciclagem química" },
              { value: "quarentena_tecnica", label: "Quarentena técnica" },
              { value: "descarte_controlado", label: "Descarte controlado" },
            ]}
          />
          <Inp name="soh" label="State of Health (%)" type="number" min={0} max={100} required />
          <Inp name="tensao" label="Tensão medida (V)" type="number" step="0.01" />
          <Inp name="capacidade" label="Capacidade medida (kWh)" type="number" step="0.01" />
          <Inp name="temperatura" label="Temperatura (°C)" type="number" step="0.1" />
          <Inp name="integridade" label="Integridade estrutural" />
          <Inp name="risco" label="Risco identificado" />
          <Inp name="recomendacao" label="Recomendação de destino" />
        </div>
        <label className="grid gap-1">
          <span className="text-xs text-slate-400">Notas do diagnóstico</span>
          <textarea
            name="notas"
            rows={3}
            className="px-3 py-2 bg-white/5 border border-white/10 rounded-md text-sm"
          />
        </label>
        <label className="grid gap-1">
          <span className="text-xs text-slate-400">Laudo técnico (opcional)</span>
          <input
            name="laudo"
            type="file"
            accept=".pdf,image/*"
            className="px-3 py-2 bg-white/5 border border-white/10 rounded-md text-sm"
          />
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-white/10 rounded-md text-sm"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-brand text-industrial rounded-md text-sm font-semibold disabled:opacity-50"
          >
            {saving ? "Salvando..." : "Concluir triagem"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function LotsTab({ userId }: { userId: string }) {
  const [lots, setLots] = useState<Lot[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [manage, setManage] = useState<Lot | null>(null);

  const load = async () => {
    const { data } = await supabase
      .from("lots")
      .select("*")
      .order("created_at", { ascending: false });
    setLots(data ?? []);
  };
  useEffect(() => {
    void load();
  }, []);

  return (
    <div>
      <div className="flex justify-between mb-3">
        <p className="text-sm text-slate-400">
          Agrupe baterias classificadas em lotes para negociação e coleta.
        </p>
        <button
          onClick={() => setShowNew(true)}
          className="px-4 py-2 bg-brand text-industrial rounded-md text-sm font-semibold"
        >
          Novo lote
        </button>
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        {lots.length === 0 && <p className="text-sm text-slate-500">Nenhum lote criado.</p>}
        {lots.map((l) => (
          <div key={l.id} className="p-4 border border-white/10 rounded-md">
            <div className="flex justify-between items-start mb-2">
              <div>
                <div className="font-mono text-brand text-sm">{l.code}</div>
                <div className="font-semibold">{l.titulo}</div>
              </div>
              <StatusBadge status={l.status} />
            </div>
            <p className="text-xs text-slate-400 mb-3">
              {l.destino === "reciclagem" ? "Reciclagem" : "Segunda vida"} · {l.cidade}/{l.uf}
            </p>
            <button
              onClick={() => setManage(l)}
              className="text-brand text-xs hover:brightness-125"
            >
              Gerenciar
            </button>
          </div>
        ))}
      </div>
      {showNew && (
        <NewLotModal
          userId={userId}
          onClose={() => setShowNew(false)}
          onCreated={() => {
            void load();
            setShowNew(false);
          }}
        />
      )}
      {manage && (
        <ManageLotModal
          lot={manage}
          userId={userId}
          onClose={() => setManage(null)}
          onChanged={() => void load()}
        />
      )}
    </div>
  );
}

function NewLotModal({
  userId,
  onClose,
  onCreated,
}: {
  userId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    try {
      const { error } = await supabase.from("lots").insert({
        operador_id: userId,
        titulo: String(fd.get("titulo")),
        descricao: String(fd.get("descricao") || "") || null,
        destino: String(fd.get("destino")) as "reciclagem" | "segunda_vida",
        cidade: String(fd.get("cidade") || "") || null,
        uf: String(fd.get("uf") || "") || null,
        status: "rascunho",
      });
      if (error) throw error;
      toast.success("Lote criado");
      onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    }
  };
  return (
    <Modal onClose={onClose} title="Novo lote">
      <form onSubmit={submit} className="grid gap-3">
        <Inp name="titulo" label="Título" required />
        <div className="grid md:grid-cols-3 gap-3">
          <Sel
            name="destino"
            label="Destino"
            required
            options={[
              { value: "reciclagem", label: "Reciclagem" },
              { value: "segunda_vida", label: "Segunda vida" },
            ]}
          />
          <Inp name="cidade" label="Cidade" />
          <Inp name="uf" label="UF" maxLength={2} />
        </div>
        <label className="grid gap-1">
          <span className="text-xs text-slate-400">Descrição</span>
          <textarea
            name="descricao"
            rows={3}
            className="px-3 py-2 bg-white/5 border border-white/10 rounded-md text-sm"
          />
        </label>
        <div className="flex justify-end gap-2">
          <button
            type="submit"
            className="px-4 py-2 bg-brand text-industrial rounded-md text-sm font-semibold"
          >
            Criar
          </button>
        </div>
      </form>
    </Modal>
  );
}

type Proposal = Tables<"proposals">;

function ManageLotModal({
  lot,
  userId,
  onClose,
  onChanged,
}: {
  lot: Lot;
  userId: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [available, setAvailable] = useState<Battery[]>([]);
  const [assigned, setAssigned] = useState<Battery[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);

  const load = async () => {
    const [{ data: linked }, { data: props }] = await Promise.all([
      supabase.from("lot_batteries").select("battery_id").eq("lot_id", lot.id),
      supabase
        .from("proposals")
        .select("*")
        .eq("lot_id", lot.id)
        .order("created_at", { ascending: false }),
    ]);
    const linkedIds = (linked ?? []).map((r) => r.battery_id);
    const { data: bats } = await supabase.from("batteries").select("*");
    const compatible = (bats ?? []).filter((b) =>
      lot.destino === "segunda_vida"
        ? b.classificacao === "segunda_vida"
        : b.classificacao !== "segunda_vida" && b.classificacao !== null,
    );
    setAssigned(compatible.filter((b) => linkedIds.includes(b.id)));
    setAvailable(
      compatible.filter((b) => !linkedIds.includes(b.id) && b.status === "classificada"),
    );
    setProposals(props ?? []);
  };
  useEffect(() => {
    void load();
  }, [lot.id]);

  const addBattery = async (b: Battery) => {
    try {
      await workflowRpc("add_battery_to_lot", {
        _lot_id: lot.id,
        _battery_id: b.id,
        _organization_id: null,
      });
    } catch (err) {
      return toast.error(err instanceof Error ? err.message : "Erro ao adicionar");
    }
    void load();
    onChanged();
  };
  const removeBattery = async (b: Battery) => {
    try {
      await workflowRpc("remove_battery_from_lot", {
        _lot_id: lot.id,
        _battery_id: b.id,
        _organization_id: null,
      });
    } catch (err) {
      return toast.error(err instanceof Error ? err.message : "Erro ao remover");
    }
    void load();
    onChanged();
  };
  const publish = async () => {
    try {
      await workflowRpc("publish_lot", { _lot_id: lot.id, _organization_id: null });
      toast.success("Lote publicado para recicladoras habilitadas");
    } catch (err) {
      return toast.error(err instanceof Error ? err.message : "Erro ao publicar");
    }
    onChanged();
    onClose();
  };
  const acceptProposal = async (p: Proposal) => {
    try {
      await workflowRpc("accept_lot_proposal", { _proposal_id: p.id, _organization_id: null });
      toast.success("Proposta aceita, operação e transporte criados");
    } catch (err) {
      return toast.error(err instanceof Error ? err.message : "Erro ao aceitar proposta");
    }
    onChanged();
    void load();
    refreshOperatorSummary();
  };
  const forwardProposal = async (p: Proposal) => {
    const notes = window.prompt(
      "Parecer para aprovação:",
      "Proposta analisada pelo operador e recomendada para aprovação",
    );
    if (!notes) return;
    try {
      await workflowRpc("forward_proposal_for_approval", { _proposal_id: p.id, _notes: notes });
      toast.success("Proposta encaminhada para aprovação");
      onChanged();
      await load();
      refreshOperatorSummary();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao encaminhar proposta");
    }
  };

  return (
    <Modal onClose={onClose} title={`${lot.code} — ${lot.titulo}`}>
      <div className="grid gap-6 text-sm">
        <div className="flex items-center gap-2">
          <StatusBadge status={lot.status} />
          <span className="text-slate-400">
            {lot.destino === "reciclagem" ? "Reciclagem" : "Segunda vida"}
          </span>
        </div>

        <section>
          <h3 className="text-xs uppercase font-mono text-slate-400 mb-2 flex items-center gap-1">
            <Package className="w-3 h-3" /> Baterias no lote ({assigned.length})
          </h3>
          {assigned.length === 0 && (
            <p className="text-xs text-slate-500">Nenhuma bateria adicionada.</p>
          )}
          <ul className="grid gap-1">
            {assigned.map((b) => (
              <li
                key={b.id}
                className="flex justify-between items-center px-3 py-2 bg-white/5 rounded"
              >
                <span>
                  <span className="font-mono text-brand">{b.code}</span> · {b.quimica} ·{" "}
                  {b.quantidade}x
                </span>
                {["rascunho", "em_formacao", "pronto_para_publicacao"].includes(lot.status) && (
                  <button onClick={() => removeBattery(b)} className="text-danger text-xs">
                    Remover
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>

        {["rascunho", "em_formacao"].includes(lot.status) && (
          <section>
            <h3 className="text-xs uppercase font-mono text-slate-400 mb-2">
              Disponíveis para adicionar ({available.length})
            </h3>
            <div className="max-h-52 overflow-y-auto grid gap-1">
              {available.map((b) => (
                <button
                  key={b.id}
                  onClick={() => addBattery(b)}
                  className="flex justify-between items-center px-3 py-2 border border-white/10 rounded hover:bg-white/5 text-left"
                >
                  <span>
                    <span className="font-mono text-brand">{b.code}</span> · {b.quimica} ·{" "}
                    {b.quantidade}x
                  </span>
                  <span className="text-brand text-xs">+ Adicionar</span>
                </button>
              ))}
              {available.length === 0 && (
                <p className="text-xs text-slate-500">Nenhuma bateria classificada compatível.</p>
              )}
            </div>
            <button
              onClick={publish}
              disabled={assigned.length === 0}
              className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 bg-brand text-industrial rounded-md font-semibold disabled:opacity-50"
            >
              <Send className="w-4 h-4" /> Publicar para recicladores
            </button>
          </section>
        )}

        {proposals.length > 0 && (
          <section>
            <h3 className="text-xs uppercase font-mono text-slate-400 mb-2">
              Propostas recebidas ({proposals.length})
            </h3>
            <ul className="grid gap-2">
              {proposals.map((p) => (
                <li key={p.id} className="p-3 border border-white/10 rounded">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-semibold">
                        R${" "}
                        {Number(p.valor_total).toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                        })}
                      </div>
                      {p.condicoes && (
                        <div className="text-xs text-slate-400 mt-1">{p.condicoes}</div>
                      )}
                    </div>
                    <StatusBadge status={p.status} />
                  </div>
                  <div className="flex gap-3 mt-2">
                    {p.status === "enviada" &&
                      !["proposta_aceita", "contratado"].includes(lot.status) && (
                        <button
                          onClick={() => void forwardProposal(p)}
                          className="text-brand text-xs"
                        >
                          Encaminhar para aprovação
                        </button>
                      )}
                    {p.status === "em_analise" && lot.status === "em_analise" && (
                      <button onClick={() => void acceptProposal(p)} className="text-brand text-xs">
                        Aprovar proposta
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </Modal>
  );
}

function OperationsTab() {
  const [operations, setOperations] = useState<Operation[]>([]);
  const [documentCounts, setDocumentCounts] = useState<Record<string, number>>({});

  const load = async () => {
    const [{ data: rows }, { data: docs }] = await Promise.all([
      supabase.from("operations").select("*").order("created_at", { ascending: false }),
      supabase.from("documents").select("operation_id").not("operation_id", "is", null),
    ]);
    setOperations(rows ?? []);
    const counts: Record<string, number> = {};
    (docs ?? []).forEach((d) => {
      if (d.operation_id) counts[d.operation_id] = (counts[d.operation_id] ?? 0) + 1;
    });
    setDocumentCounts(counts);
  };

  useEffect(() => {
    void load();
  }, []);

  const complete = async (operation: Operation) => {
    const notes = window.prompt("Observação da validação final:") ?? "Documentação validada";
    try {
      await workflowRpc("validate_and_complete_operation", {
        _operation_id: operation.id,
        _notes: notes,
      });
      toast.success("Documentação validada e operação concluída");
      await load();
      refreshOperatorSummary();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao concluir operação");
    }
  };

  return (
    <div className="grid gap-3">
      {operations.length === 0 && (
        <p className="text-sm text-slate-500">Nenhuma operação criada.</p>
      )}
      {operations.map((operation) => (
        <div key={operation.id} className="p-4 border border-white/10 rounded-md">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="font-mono text-xs text-brand">
                OP-{operation.id.slice(0, 8).toUpperCase()}
              </div>
              <div className="text-sm text-slate-400 mt-1">Lote {operation.lot_id.slice(0, 8)}</div>
              <div className="text-xs text-slate-500 mt-1">
                {documentCounts[operation.id] ?? 0} documento(s) anexado(s)
              </div>
            </div>
            <div className="flex items-center gap-3">
              <StatusBadge status={operation.status} />
              {operation.status === "documentacao_pendente" && (
                <button
                  onClick={() => void complete(operation)}
                  className="px-3 py-1.5 bg-brand text-industrial rounded-md text-xs font-semibold"
                >
                  Validar e concluir
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function IncidentsTab() {
  const [items, setItems] = useState<Incident[]>([]);
  const [batteries, setBatteries] = useState<Battery[]>([]);
  const [showNew, setShowNew] = useState(false);
  const load = async () => {
    const [{ data: incidents }, { data: batteryRows }] = await Promise.all([
      supabase.from("incidents").select("*").order("created_at", { ascending: false }),
      supabase.from("batteries").select("*").order("created_at", { ascending: false }),
    ]);
    setItems(incidents ?? []);
    setBatteries(batteryRows ?? []);
  };
  useEffect(() => {
    void load();
  }, []);
  const batteryCode = (id: string | null) => batteries.find((b) => b.id === id)?.code;
  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <p className="text-sm text-slate-400">Ocorrências técnicas e operacionais do processo.</p>
        <button
          onClick={() => setShowNew(true)}
          className="px-4 py-2 bg-brand text-industrial rounded-md text-sm font-semibold"
        >
          Registrar ocorrência
        </button>
      </div>
      <div className="grid gap-2">
        {items.length === 0 && (
          <p className="text-sm text-slate-500">Nenhuma ocorrência registrada.</p>
        )}
        {items.map((item) => (
          <div key={item.id} className="p-4 border border-white/10 rounded-md">
            <div className="flex justify-between gap-3">
              <div>
                <div className="font-semibold">{item.tipo.replaceAll("_", " ")}</div>
                <div className="text-xs text-slate-400 mt-1">{item.descricao}</div>
              </div>
              <StatusBadge status={item.status} />
            </div>
            <div className="text-[11px] text-slate-500 mt-2">
              Gravidade: {item.gravidade}
              {batteryCode(item.battery_id)
                ? ` · Bateria ${batteryCode(item.battery_id)}`
                : ""} · {new Date(item.created_at).toLocaleString("pt-BR")}
            </div>
          </div>
        ))}
      </div>
      {showNew && (
        <OperatorIncidentModal
          batteries={batteries}
          onClose={() => setShowNew(false)}
          onSaved={() => {
            setShowNew(false);
            void load();
            refreshOperatorSummary();
          }}
        />
      )}
    </div>
  );
}

function OperatorIncidentModal({
  batteries,
  onClose,
  onSaved,
}: {
  batteries: Battery[];
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
        _battery_id: String(fd.get("battery") || "") || null,
        _collection_id: null,
        _operation_id: null,
      });
      toast.success("Ocorrência registrada");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao registrar ocorrência");
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal onClose={onClose} title="Registrar ocorrência operacional">
      <form onSubmit={submit} className="grid gap-3">
        <Inp name="tipo" label="Tipo" placeholder="Ex.: avaria, divergência, segurança" required />
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
        <Sel
          name="battery"
          label="Bateria vinculada (opcional)"
          options={[
            { value: "", label: "Sem vínculo específico" },
            ...batteries.map((b) => ({ value: b.id, label: b.code })),
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
            {saving ? "Salvando..." : "Registrar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
