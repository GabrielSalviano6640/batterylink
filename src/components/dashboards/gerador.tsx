import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import {
  ArrowLeft,
  BatteryCharging,
  CalendarClock,
  CheckCircle2,
  FileDown,
  FileText,
  FileWarning,
  ImageIcon,
  Leaf,
  Microscope,
  Paperclip,
  Plus,
  QrCode,
  Scale,
  Search,
  ShieldCheck,
  Truck,
  Upload,
  X,
} from "lucide-react";
import { generateCertificate } from "@/lib/certificate";
import { batteryStatusLabels, transitionBattery, workflowLabel, workflowRpc } from "@/lib/workflow";
import { openWorkflowDocument, uploadPrivateDocument } from "@/lib/private-documents";

type Battery = Tables<"batteries">;
type BatteryFile = Tables<"battery_files">;

type GeneratorSummary = {
  total_batteries: number;
  open_requests: number;
  scheduled_collections: number;
  in_triage: number;
  completed_operations: number;
  pending_documents: number;
  estimated_mass_kg: number;
  estimated_capacity_kwh: number;
};

type EnvironmentalIndicators = {
  disclaimer: string;
  available: boolean;
  unavailable_message: string;
  mass_processed_kg: number;
  second_life_kg: number;
  recycling_kg: number;
  lithium_recoverable_kg: number | null;
  nickel_recoverable_kg: number | null;
  cobalt_recoverable_kg: number | null;
  copper_recoverable_kg: number | null;
  avoided_emissions_kgco2e: number | null;
  methodologies: Array<{ methodology: string; source: string; version: string }>;
};

type DocumentTimeline = {
  id: string;
  type: string;
  number: string | null;
  issuer_system: string | null;
  status: string;
  responsible_validated: boolean;
  legal_notice: string | null;
  created_at: string;
  validated_at: string | null;
};

type GeneratorContext = {
  collections: Array<{
    id: string;
    code: string | null;
    kind: "triagem" | "destinacao";
    status: string;
    requested_at: string | null;
    scheduled_at: string | null;
    collected_at: string | null;
    delivered_at: string | null;
    origin: string | null;
    destination: string | null;
    vehicle: string | null;
    plate: string | null;
    driver: string | null;
  }>;
  diagnostic: null | {
    date: string;
    voltage: number | null;
    capacity_kwh: number | null;
    soh: number | null;
    temperature: number | null;
    structural_integrity: string | null;
    risk: string | null;
    classification: string;
    recommendation: string | null;
    notes: string | null;
    validation_status: string;
  };
  destination: null | {
    lot_code: string;
    lot_status: string;
    destination_type: string;
    city: string | null;
    state: string | null;
    operation_status: string | null;
    defined_at: string | null;
  };
  documents: Array<{
    id: string;
    type: string;
    number: string | null;
    status: string | null;
    issued_at: string | null;
    valid_until: string | null;
    validated_at: string | null;
    created_at: string;
    storage_path: string | null;
  }>;
  privacy: { commercial_data_hidden: boolean; message: string };
};

const openRequestStatuses = new Set([
  "cadastrada",
  "aguardando_analise",
  "informacoes_solicitadas",
  "aprovada_para_coleta",
]);
const triageStatuses = new Set(["recebida_na_triagem", "em_diagnostico"]);

export function GeradorDashboard({ userId }: { userId: string }) {
  const [items, setItems] = useState<Battery[]>([]);
  const [summary, setSummary] = useState<GeneratorSummary | null>(null);
  const [environmental, setEnvironmental] = useState<EnvironmentalIndicators | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [chemistryFilter, setChemistryFilter] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sort, setSort] = useState<"newest" | "oldest" | "code">("newest");
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [detail, setDetail] = useState<Battery | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("batteries")
      .select("*")
      .eq("owner_id", userId)
      .order("created_at", { ascending: false });
    setItems(data ?? []);
    try {
      const [summaryData, environmentalData] = await Promise.all([
        workflowRpc<GeneratorSummary>("get_generator_dashboard_summary", {}),
        workflowRpc<EnvironmentalIndicators>("get_environmental_indicators", {
          _from: null,
          _to: null,
        }),
      ]);
      setSummary(summaryData);
      setEnvironmental(environmentalData);
    } catch {
      setSummary(null);
      setEnvironmental(null);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const chemistries = useMemo(
    () => Array.from(new Set(items.map((b) => b.quimica))).sort(),
    [items],
  );
  const statuses = useMemo(() => Array.from(new Set(items.map((b) => b.status))), [items]);
  const filtered = useMemo(
    () =>
      items.filter((b) => {
        const term = q.trim().toLowerCase();
        const created = new Date(b.created_at);
        return (
          (!term || b.code.toLowerCase().includes(term)) &&
          (statusFilter === "all" || b.status === statusFilter) &&
          (chemistryFilter === "all" || b.quimica === chemistryFilter) &&
          (!from || created >= new Date(`${from}T00:00:00`)) &&
          (!to || created <= new Date(`${to}T23:59:59`))
        );
      }),
    [items, q, statusFilter, chemistryFilter, from, to],
  );
  const pageSize = 10;
  const ordered = useMemo(
    () =>
      [...filtered].sort((a, b) => {
        if (sort === "code") return a.code.localeCompare(b.code, "pt-BR");
        const difference = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        return sort === "oldest" ? difference : -difference;
      }),
    [filtered, sort],
  );
  const pageCount = Math.max(1, Math.ceil(ordered.length / pageSize));
  const paginated = ordered.slice((page - 1) * pageSize, page * pageSize);
  useEffect(() => setPage(1), [q, statusFilter, chemistryFilter, from, to, sort]);

  const indicators = useMemo(
    () => ({
      total: summary?.total_batteries ?? items.length,
      open: summary?.open_requests ?? items.filter((b) => openRequestStatuses.has(b.status)).length,
      scheduled:
        summary?.scheduled_collections ??
        items.filter((b) => b.status === "coleta_agendada").length,
      triage: summary?.in_triage ?? items.filter((b) => triageStatuses.has(b.status)).length,
      completed:
        summary?.completed_operations ?? items.filter((b) => b.status === "concluida").length,
      pendingDocuments:
        summary?.pending_documents ??
        items.filter((b) => b.status === "documentacao_pendente").length,
    }),
    [items, summary],
  );

  if (detail) {
    return (
      <BatteryDetailPage
        battery={detail}
        onBack={() => setDetail(null)}
        onChanged={() => void load()}
      />
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <BatteryCharging className="w-5 h-5 text-brand" />
            <p className="font-mono text-xs text-brand tracking-widest uppercase">
              Painel · Gerador
            </p>
          </div>
          <h1 className="text-2xl font-display font-bold">Visão geral</h1>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand text-industrial rounded-md text-sm font-semibold"
        >
          <Plus className="w-4 h-4" /> Nova bateria
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mb-6">
        <KpiCard
          label="Baterias cadastradas"
          value={indicators.total}
          icon={<BatteryCharging className="w-4 h-4" />}
        />
        <KpiCard
          label="Solicitações abertas"
          value={indicators.open}
          icon={<FileWarning className="w-4 h-4" />}
        />
        <KpiCard
          label="Coletas agendadas"
          value={indicators.scheduled}
          icon={<CalendarClock className="w-4 h-4" />}
        />
        <KpiCard
          label="Em triagem"
          value={indicators.triage}
          icon={<Microscope className="w-4 h-4" />}
        />
        <KpiCard
          label="Operações concluídas"
          value={indicators.completed}
          icon={<CheckCircle2 className="w-4 h-4" />}
          accent
        />
        <KpiCard
          label="Documentos pendentes"
          value={indicators.pendingDocuments}
          icon={<FileText className="w-4 h-4" />}
        />
      </div>

      <section className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Leaf className="w-4 h-4 text-brand" />
          <h2 className="text-sm font-semibold">Indicadores ambientais</h2>
          <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-300">
            Estimativas
          </span>
        </div>
        {!environmental?.available ? (
          <div className="p-4 border border-amber-400/20 rounded-md text-sm text-amber-300">
            {environmental?.unavailable_message ??
              "Indicador indisponível — metodologia não configurada."}
          </div>
        ) : (
          <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-3">
            {[
              ["Massa processada", environmental.mass_processed_kg, "kg"],
              ["Segunda vida", environmental.second_life_kg, "kg"],
              ["Enviado à reciclagem", environmental.recycling_kg, "kg"],
              ["Lítio recuperável", environmental.lithium_recoverable_kg, "kg"],
              ["Níquel recuperável", environmental.nickel_recoverable_kg, "kg"],
              ["Cobalto recuperável", environmental.cobalt_recoverable_kg, "kg"],
              ["Cobre recuperável", environmental.copper_recoverable_kg, "kg"],
              ["Emissões evitadas", environmental.avoided_emissions_kgco2e, "kg CO₂e"],
            ].map(([label, value, unit]) => (
              <EstimateCard
                key={String(label)}
                label={String(label)}
                value={
                  value === null
                    ? "Indicador indisponível"
                    : `${Number(value).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} ${unit}`
                }
                icon={<Scale className="w-4 h-4" />}
              />
            ))}
          </div>
        )}
        <p className="text-[10px] text-slate-500 mt-2">
          Estimativas para fins gerenciais, sujeitas à validação técnica.
        </p>
      </section>

      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="font-display font-bold text-lg">Baterias</h2>
        <span className="text-xs text-slate-500">{filtered.length} resultado(s)</span>
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-6 gap-2 mb-4">
        <label className="relative lg:col-span-2">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
          <input
            placeholder="Filtrar pelo código..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-white/5 border border-white/10 rounded-md text-sm"
          />
        </label>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 bg-white/5 border border-white/10 rounded-md text-sm"
        >
          <option value="all">Todos os status</option>
          {statuses.map((status) => (
            <option key={status} value={status}>
              {workflowLabel(status)}
            </option>
          ))}
        </select>
        <select
          value={chemistryFilter}
          onChange={(e) => setChemistryFilter(e.target.value)}
          className="px-3 py-2 bg-white/5 border border-white/10 rounded-md text-sm"
        >
          <option value="all">Todas as químicas</option>
          {chemistries.map((chemistry) => (
            <option key={chemistry} value={chemistry}>
              {chemistry}
            </option>
          ))}
        </select>
        <div className="grid grid-cols-2 gap-2">
          <input
            aria-label="Período inicial"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="min-w-0 px-2 py-2 bg-white/5 border border-white/10 rounded-md text-xs"
          />
          <input
            aria-label="Período final"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="min-w-0 px-2 py-2 bg-white/5 border border-white/10 rounded-md text-xs"
          />
        </div>
        <select
          aria-label="Ordenar baterias"
          value={sort}
          onChange={(e) => setSort(e.target.value as typeof sort)}
          className="px-3 py-2 bg-white/5 border border-white/10 rounded-md text-sm"
        >
          <option value="newest">Mais recentes</option>
          <option value="oldest">Mais antigas</option>
          <option value="code">Código A–Z</option>
        </select>
      </div>

      <div className="border border-white/10 rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-xs uppercase font-mono text-slate-400">
            <tr>
              <th className="text-left px-3 py-2">Código</th>
              <th className="text-left px-3 py-2">Origem</th>
              <th className="text-left px-3 py-2">Química</th>
              <th className="text-left px-3 py-2">Qtd</th>
              <th className="text-left px-3 py-2">Status</th>
              <th className="text-left px-3 py-2">Criada</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-slate-500">
                  Carregando...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-slate-500">
                  Nenhuma bateria registrada.
                </td>
              </tr>
            ) : (
              paginated.map((b) => (
                <tr
                  key={b.id}
                  onClick={() => setDetail(b)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") setDetail(b);
                  }}
                  tabIndex={0}
                  aria-label={`Abrir detalhes da bateria ${b.code}`}
                  className="border-t border-white/5 hover:bg-white/5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand"
                >
                  <td className="px-3 py-2 font-mono text-brand">{b.code}</td>
                  <td className="px-3 py-2">{b.origem}</td>
                  <td className="px-3 py-2">{b.quimica}</td>
                  <td className="px-3 py-2">{b.quantidade}</td>
                  <td className="px-3 py-2">
                    <StatusBadge status={b.status} />
                  </td>
                  <td className="px-3 py-2 text-slate-400">
                    {new Date(b.created_at).toLocaleDateString("pt-BR")}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {ordered.length > 0 && (
        <nav
          aria-label="Paginação de baterias"
          className="mt-3 flex items-center justify-between gap-3 text-sm"
        >
          <span className="text-slate-500">
            Página {page} de {pageCount}
          </span>
          <div className="flex gap-2">
            <button
              disabled={page === 1}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              className="rounded-md border border-white/10 px-3 py-1.5 disabled:opacity-40"
            >
              Anterior
            </button>
            <button
              disabled={page === pageCount}
              onClick={() => setPage((value) => Math.min(pageCount, value + 1))}
              className="rounded-md border border-white/10 px-3 py-1.5 disabled:opacity-40"
            >
              Próxima
            </button>
          </div>
        </nav>
      )}

      {showForm && (
        <NewBatteryModal
          userId={userId}
          onClose={() => setShowForm(false)}
          onCreated={() => {
            void load();
            setShowForm(false);
          }}
        />
      )}
    </div>
  );
}

function KpiCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div className="p-3 rounded-md bg-white/5 border border-white/10">
      <div
        className={`flex items-center gap-1.5 text-[10px] uppercase font-mono mb-2 ${accent ? "text-brand" : "text-slate-500"}`}
      >
        {icon}
        {label}
      </div>
      <div className={`text-2xl font-display font-bold ${accent ? "text-brand" : ""}`}>{value}</div>
    </div>
  );
}

function EstimateCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="p-3 rounded-md border border-brand/15 bg-brand/5">
      <div className="flex items-center gap-1.5 text-xs text-brand mb-1">
        {icon}
        {label}
      </div>
      <div className="font-display font-bold text-lg">{value}</div>
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const color: Record<string, string> = {
    cadastrada: "bg-slate-500/20 text-slate-300",
    aguardando_analise: "bg-amber-500/20 text-amber-300",
    informacoes_solicitadas: "bg-orange-500/20 text-orange-300",
    aprovada_para_coleta: "bg-brand/20 text-brand",
    coleta_agendada: "bg-cyan-500/20 text-cyan-300",
    em_transporte: "bg-purple-500/20 text-purple-300",
    recebida_na_triagem: "bg-teal-500/20 text-teal-300",
    em_diagnostico: "bg-yellow-500/20 text-yellow-300",
    classificada: "bg-blue-500/20 text-blue-300",
    em_lote: "bg-indigo-500/20 text-indigo-300",
    em_negociacao: "bg-violet-500/20 text-violet-300",
    destinacao_definida: "bg-sky-500/20 text-sky-300",
    enviada_ao_destinador: "bg-purple-500/20 text-purple-300",
    recebida_pelo_destinador: "bg-teal-500/20 text-teal-300",
    documentacao_pendente: "bg-amber-500/20 text-amber-300",
    concluida: "bg-emerald-500/20 text-emerald-300",
    em_quarentena: "bg-red-500/20 text-red-300",
    cancelada: "bg-danger/20 text-danger",
    publicado: "bg-brand/20 text-brand",
    recebendo_propostas: "bg-violet-500/20 text-violet-300",
    proposta_aceita: "bg-sky-500/20 text-sky-300",
    contratado: "bg-cyan-500/20 text-cyan-300",
    entregue: "bg-teal-500/20 text-teal-300",
    concluido: "bg-emerald-500/20 text-emerald-300",
    aceita: "bg-brand/20 text-brand",
    recusada: "bg-danger/20 text-danger",
    agendada: "bg-cyan-500/20 text-cyan-300",
    retirada: "bg-purple-500/20 text-purple-300",
    entregue_triagem: "bg-teal-500/20 text-teal-300",
    entregue_destinador: "bg-teal-500/20 text-teal-300",
    enviada: "bg-violet-500/20 text-violet-300",
  };
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-xs font-mono ${color[status] ?? "bg-white/10"}`}
    >
      {workflowLabel(status)}
    </span>
  );
}

function NewBatteryModal({
  userId,
  onClose,
  onCreated,
}: {
  userId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [saving, setSaving] = useState(false);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSaving(true);
    try {
      const payload = {
        owner_id: userId,
        origem: String(fd.get("origem")),
        fabricante: String(fd.get("fabricante") || "") || null,
        modelo: String(fd.get("modelo") || "") || null,
        quimica: String(fd.get("quimica")),
        capacidade_kwh: fd.get("capacidade") ? Number(fd.get("capacidade")) : null,
        quantidade: Number(fd.get("quantidade") || 1),
        peso_kg: fd.get("peso") ? Number(fd.get("peso")) : null,
        estado: String(fd.get("estado_bat")),
        urgencia: String(fd.get("urgencia")),
        cep: String(fd.get("cep") || "") || null,
        cidade: String(fd.get("cidade") || "") || null,
        uf: String(fd.get("uf") || "") || null,
        endereco: String(fd.get("endereco") || "") || null,
        observacoes: String(fd.get("observacoes") || "") || null,
        status: "cadastrada",
      };
      const { data, error } = await supabase.from("batteries").insert(payload).select().single();
      if (error) throw error;
      await transitionBattery(
        data.id,
        "aguardando_analise",
        "Cadastro enviado para análise do operador",
      );
      toast.success(`Bateria ${data.code} registrada`);
      onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao registrar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal onClose={onClose} title="Nova bateria">
      <form onSubmit={submit} className="grid gap-3 text-sm">
        <div className="grid md:grid-cols-2 gap-3">
          <Sel
            name="origem"
            label="Origem"
            required
            options={[
              "Veículo elétrico",
              "Veículo híbrido",
              "Frota comercial",
              "Máquina industrial",
              "BESS",
              "Outro",
            ]}
          />
          <Sel
            name="quimica"
            label="Química"
            required
            options={["LFP", "NMC", "NCA", "LTO", "Chumbo-ácido", "Outra"]}
          />
          <Inp name="fabricante" label="Fabricante" />
          <Inp name="modelo" label="Modelo" />
          <Inp name="capacidade" label="Capacidade (kWh)" type="number" step="0.1" />
          <Inp
            name="quantidade"
            label="Quantidade"
            type="number"
            required
            defaultValue={1}
            min={1}
          />
          <Inp name="peso" label="Peso (kg)" type="number" step="0.1" />
          <Sel
            name="estado_bat"
            label="Estado"
            required
            options={["Íntegra", "Fim de vida", "Avariada", "Sinistrada", "Inchada/vazamento"]}
          />
          <Sel
            name="urgencia"
            label="Urgência"
            required
            options={["Baixa (30d)", "Média (15d)", "Alta (7d)", "Emergencial"]}
          />
          <Inp name="cep" label="CEP" />
          <Inp name="cidade" label="Cidade" />
          <Inp name="uf" label="UF" maxLength={2} />
        </div>
        <Inp name="endereco" label="Endereço de coleta" />
        <label className="grid gap-1">
          <span className="text-xs text-slate-400">Observações</span>
          <textarea
            name="observacoes"
            rows={3}
            className="px-3 py-2 bg-white/5 border border-white/10 rounded-md"
          />
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-white/10 rounded-md"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-brand text-industrial rounded-md font-semibold disabled:opacity-50"
          >
            {saving ? "Salvando..." : "Registrar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

type EventRow = Tables<"battery_events">;
type DisplayFile = BatteryFile & { signedUrl?: string };

function BatteryDetailPage({
  battery,
  onBack,
  onChanged,
}: {
  battery: Battery;
  onBack: () => void;
  onChanged: () => void;
}) {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [files, setFiles] = useState<DisplayFile[]>([]);
  const [context, setContext] = useState<GeneratorContext | null>(null);
  const [documentTimeline, setDocumentTimeline] = useState<DocumentTimeline[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const loadDetail = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: eventRows }, { data: fileRows }, detailContext, timelineDocuments] =
        await Promise.all([
          supabase
            .from("battery_events")
            .select("*")
            .eq("battery_id", battery.id)
            .order("created_at", { ascending: true }),
          supabase
            .from("battery_files")
            .select("*")
            .eq("battery_id", battery.id)
            .order("created_at", { ascending: false }),
          workflowRpc<GeneratorContext>("get_generator_battery_context", {
            _battery_id: battery.id,
          }),
          workflowRpc<DocumentTimeline[]>("get_battery_document_timeline", {
            _battery_id: battery.id,
          }),
        ]);
      const rows = fileRows ?? [];
      const withUrls = await Promise.all(
        rows.map(async (file) => {
          if (!file.tipo.startsWith("foto")) return file;
          const { data } = await supabase.storage
            .from(file.bucket_id ?? "battery-files")
            .createSignedUrl(file.storage_path, 3600);
          return { ...file, signedUrl: data?.signedUrl };
        }),
      );
      setEvents(eventRows ?? []);
      setFiles(withUrls);
      setContext(detailContext);
      setDocumentTimeline(timelineDocuments ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao carregar detalhes");
    } finally {
      setLoading(false);
    }
  }, [battery.id]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(battery.qr_code_data ?? battery.code)}`;

  const resubmit = async () => {
    const note =
      window.prompt("Informe o que foi atualizado para o operador:") ??
      "Informações atualizadas pelo gerador";
    try {
      await transitionBattery(battery.id, "aguardando_analise", note);
      toast.success("Bateria reenviada para análise");
      onChanged();
      onBack();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao reenviar");
    }
  };

  const uploadFile = async (file: File) => {
    setUploading(true);
    try {
      await uploadPrivateDocument(
        "battery",
        battery.id,
        file.type.startsWith("image/") ? "foto" : "arquivo",
        file,
      );
      toast.success("Arquivo anexado");
      await loadDetail();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao anexar arquivo");
    } finally {
      setUploading(false);
    }
  };

  const openPrivateFile = async (bucket: string, path: string | null) => {
    if (!path) return;
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 300);
    if (error || !data?.signedUrl) return toast.error(error?.message ?? "Arquivo indisponível");
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const diagnostic = context?.diagnostic;
  const destination = context?.destination;
  const collections = context?.collections ?? [];
  const documents = context?.documents ?? [];

  return (
    <div>
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-white mb-4"
      >
        <ArrowLeft className="w-4 h-4" /> Voltar para o painel
      </button>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <p className="font-mono text-xs text-brand tracking-widest uppercase">
            Detalhes da bateria
          </p>
          <h1 className="text-2xl font-display font-bold mt-1">{battery.code}</h1>
        </div>
        <StatusBadge status={battery.status} />
      </div>

      <div className="grid lg:grid-cols-[220px_1fr] gap-4 mb-4">
        <section className="p-4 border border-white/10 rounded-md bg-white/5 flex flex-col items-center gap-2">
          <img
            src={qrUrl}
            alt={`QR ${battery.code}`}
            className="rounded bg-white p-2"
            width={180}
            height={180}
          />
          <span className="text-xs text-slate-400 inline-flex items-center gap-1">
            <QrCode className="w-3 h-3" /> Rastreio individual
          </span>
        </section>
        <section className="p-4 border border-white/10 rounded-md bg-white/5">
          <h2 className="text-xs uppercase font-mono text-slate-400 mb-3">Dados cadastrados</h2>
          <div className="grid md:grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <Row k="Origem">{battery.origem}</Row>
            <Row k="Química">{battery.quimica}</Row>
            <Row k="Fabricante/Modelo">
              {[battery.fabricante, battery.modelo].filter(Boolean).join(" / ") || "—"}
            </Row>
            <Row k="Número de série">{battery.numero_serie ?? "—"}</Row>
            <Row k="Capacidade">
              {battery.capacidade_kwh ? `${battery.capacidade_kwh} kWh` : "—"}
            </Row>
            <Row k="Quantidade">{battery.quantidade}</Row>
            <Row k="Peso">{battery.peso_kg ? `${battery.peso_kg} kg` : "—"}</Row>
            <Row k="Estado">{battery.estado}</Row>
            <Row k="Urgência">{battery.urgencia}</Row>
            <Row k="Local">{[battery.cidade, battery.uf].filter(Boolean).join("/") || "—"}</Row>
          </div>
          {battery.observacoes && (
            <p className="text-xs text-slate-400 mt-3">{battery.observacoes}</p>
          )}
          <div className="flex flex-wrap gap-2 mt-4">
            {battery.status === "informacoes_solicitadas" && (
              <button
                onClick={() => void resubmit()}
                className="px-3 py-2 bg-brand text-industrial rounded-md text-xs font-semibold"
              >
                Reenviar informações
              </button>
            )}
            {battery.status === "concluida" && (
              <button
                onClick={() => void generateCertificate(battery)}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-brand text-industrial rounded-md text-xs font-semibold"
              >
                <FileDown className="w-3.5 h-3.5" /> Certificado PDF
              </button>
            )}
          </div>
        </section>
      </div>

      {loading && (
        <div className="p-4 border border-white/10 rounded-md text-sm text-slate-400 mb-4">
          Carregando informações operacionais...
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-4 mb-4">
        <section className="p-4 border border-white/10 rounded-md">
          <h2 className="flex items-center gap-2 font-semibold mb-3">
            <Truck className="w-4 h-4 text-brand" /> Informações da coleta
          </h2>
          {!loading && collections.length === 0 && (
            <p className="text-xs text-slate-500">A coleta ainda não foi criada.</p>
          )}
          <div className="grid gap-3">
            {collections.map((collection) => (
              <div key={collection.id} className="p-3 rounded bg-white/5 text-xs grid gap-1.5">
                <div className="flex justify-between gap-2">
                  <span className="font-mono text-brand">
                    {collection.code ?? "Ordem de coleta"}
                  </span>
                  <StatusBadge status={collection.status} />
                </div>
                <div className="text-slate-400">
                  {collection.kind === "triagem"
                    ? "Coleta para triagem"
                    : "Envio ao destinador autorizado"}
                </div>
                {collection.scheduled_at && (
                  <div>Agendada: {new Date(collection.scheduled_at).toLocaleString("pt-BR")}</div>
                )}
                {collection.collected_at && (
                  <div>Retirada: {new Date(collection.collected_at).toLocaleString("pt-BR")}</div>
                )}
                {collection.delivered_at && (
                  <div>Entrega: {new Date(collection.delivered_at).toLocaleString("pt-BR")}</div>
                )}
                {collection.origin && <div>Origem: {collection.origin}</div>}
                {collection.destination && <div>Destino: {collection.destination}</div>}
                {(collection.vehicle || collection.plate) && (
                  <div>
                    Veículo: {[collection.vehicle, collection.plate].filter(Boolean).join(" · ")}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="p-4 border border-white/10 rounded-md">
          <h2 className="flex items-center gap-2 font-semibold mb-3">
            <Microscope className="w-4 h-4 text-brand" /> Diagnóstico liberado
          </h2>
          {!loading && !diagnostic && (
            <p className="text-xs text-slate-500">
              O diagnóstico aparecerá após validação técnica.
            </p>
          )}
          {diagnostic && (
            <div className="grid md:grid-cols-2 gap-2 text-sm">
              <Row k="Classificação">{workflowLabel(diagnostic.classification)}</Row>
              <Row k="SOH">{diagnostic.soh !== null ? `${diagnostic.soh}%` : "—"}</Row>
              <Row k="Tensão">{diagnostic.voltage !== null ? `${diagnostic.voltage} V` : "—"}</Row>
              <Row k="Capacidade medida">
                {diagnostic.capacity_kwh !== null ? `${diagnostic.capacity_kwh} kWh` : "—"}
              </Row>
              <Row k="Temperatura">
                {diagnostic.temperature !== null ? `${diagnostic.temperature} °C` : "—"}
              </Row>
              <Row k="Integridade">{diagnostic.structural_integrity ?? "—"}</Row>
              <Row k="Risco identificado">{diagnostic.risk ?? "Não informado"}</Row>
              <Row k="Recomendação">{diagnostic.recommendation ?? "—"}</Row>
            </div>
          )}
        </section>
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mb-4">
        <section className="p-4 border border-white/10 rounded-md">
          <h2 className="flex items-center gap-2 font-semibold mb-3">
            <ShieldCheck className="w-4 h-4 text-brand" /> Destino definido
          </h2>
          {!loading && !destination && (
            <p className="text-xs text-slate-500">
              A destinação ainda não foi autorizada no processo.
            </p>
          )}
          {destination && (
            <div className="grid gap-2 text-sm">
              <Row k="Destino">
                {destination.destination_type === "segunda_vida" ? "Segunda vida" : "Reciclagem"}
              </Row>
              <Row k="Lote">{destination.lot_code}</Row>
              <Row k="Local">
                {[destination.city, destination.state].filter(Boolean).join("/") ||
                  "Destinador autorizado"}
              </Row>
              <Row k="Operação">
                {destination.operation_status
                  ? workflowLabel(destination.operation_status)
                  : "Em preparação"}
              </Row>
            </div>
          )}
          <div className="mt-3 p-2 rounded bg-slate-500/10 text-[10px] text-slate-400">
            Informações comerciais, propostas, valores e identidade de recicladoras permanecem
            protegidos neste painel.
          </div>
        </section>

        <section className="p-4 border border-white/10 rounded-md">
          <h2 className="flex items-center gap-2 font-semibold mb-3">
            <FileText className="w-4 h-4 text-brand" /> Documentos finais
          </h2>
          {!loading && documents.length === 0 && (
            <p className="text-xs text-slate-500">
              Documentos serão liberados na etapa de documentação final.
            </p>
          )}
          <div className="grid gap-2">
            {documents.map((document) => (
              <button
                key={document.id}
                disabled={!document.storage_path}
                onClick={() => void openWorkflowDocument(document.id)}
                className="flex items-center justify-between gap-3 p-2 rounded bg-white/5 text-left text-xs disabled:opacity-50"
              >
                <span>
                  <span className="text-brand">{workflowLabel(document.type)}</span>
                  {document.number ? ` · ${document.number}` : ""}
                </span>
                <StatusBadge status={document.status ?? "pendente"} />
              </button>
            ))}
          </div>
        </section>
      </div>

      <section className="p-4 border border-white/10 rounded-md mb-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 className="flex items-center gap-2 font-semibold">
            <Paperclip className="w-4 h-4 text-brand" /> Fotos e arquivos
          </h2>
          <label className="inline-flex items-center gap-1.5 px-3 py-2 border border-white/10 rounded-md text-xs cursor-pointer hover:bg-white/5">
            <Upload className="w-3.5 h-3.5" /> {uploading ? "Enviando..." : "Anexar"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf,text/csv,.doc,.docx,.xls,.xlsx"
              className="hidden"
              disabled={uploading}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void uploadFile(file);
                event.currentTarget.value = "";
              }}
            />
          </label>
        </div>
        {files.length === 0 ? (
          <p className="text-xs text-slate-500">Nenhuma foto ou arquivo anexado.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {files.map((file) => (
              <button
                key={file.id}
                onClick={() =>
                  void openPrivateFile(file.bucket_id ?? "battery-files", file.storage_path)
                }
                className="overflow-hidden rounded border border-white/10 bg-white/5 text-left"
              >
                {file.tipo.startsWith("foto") && file.signedUrl ? (
                  <img
                    src={file.signedUrl}
                    alt={file.nome_arquivo}
                    className="w-full h-28 object-cover"
                  />
                ) : (
                  <div className="h-28 grid place-items-center">
                    <FileText className="w-8 h-8 text-slate-500" />
                  </div>
                )}
                <div className="p-2 text-[10px] truncate flex items-center gap-1">
                  {file.tipo.startsWith("foto") ? (
                    <ImageIcon className="w-3 h-3" />
                  ) : (
                    <Paperclip className="w-3 h-3" />
                  )}
                  {file.nome_arquivo}
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="p-4 border border-white/10 rounded-md">
        <h2 className="text-xs uppercase font-mono text-slate-400 mb-3">Linha do tempo completa</h2>
        <ol className="border-l border-white/10 pl-4 space-y-3">
          {events.length === 0 && <li className="text-xs text-slate-500">Sem eventos.</li>}
          {events.map((event) => (
            <li key={event.id} className="relative">
              <span className="absolute -left-[21px] top-1 w-2 h-2 rounded-full bg-brand" />
              <div className="text-sm font-semibold">
                {batteryStatusLabels[event.event_type] ?? workflowLabel(event.event_type)}
              </div>
              {event.notes && <div className="text-xs text-slate-400">{event.notes}</div>}
              <div className="text-[10px] text-slate-500 font-mono">
                {new Date(event.created_at).toLocaleString("pt-BR")}
              </div>
            </li>
          ))}
          {documentTimeline.map((document) => (
            <li key={`document-${document.id}`} className="relative">
              <span className="absolute -left-[21px] top-1 w-2 h-2 rounded-full bg-sky-400" />
              <button
                onClick={() => void openWorkflowDocument(document.id)}
                className="text-sm font-semibold text-left hover:text-brand"
              >
                Documento {workflowLabel(document.type)}
                {document.number ? ` · ${document.number}` : ""}
              </button>
              <div className="text-xs text-slate-400">
                Status: {workflowLabel(document.status)}
                {document.issuer_system ? ` · ${document.issuer_system}` : ""}
              </div>
              {document.legal_notice && (
                <div className="text-[10px] text-slate-500 mt-1">{document.legal_notice}</div>
              )}
              <div className="text-[10px] text-slate-500 font-mono">
                {new Date(document.created_at).toLocaleString("pt-BR")}
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

export function Modal({
  children,
  onClose,
  title,
}: {
  children: React.ReactNode;
  onClose: () => void;
  title: string;
}) {
  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-industrial border border-white/10 rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 sticky top-0 bg-industrial z-10">
          <h2 className="font-display font-bold text-lg">{title}</h2>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-2">
      <span className="text-slate-400 text-xs">{k}</span>
      <span>{children}</span>
    </div>
  );
}

export function Inp(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const { label, ...rest } = props;
  return (
    <label className="grid gap-1">
      <span className="text-xs text-slate-400">
        {label}
        {rest.required && " *"}
      </span>
      <input {...rest} className="px-3 py-2 bg-white/5 border border-white/10 rounded-md" />
    </label>
  );
}

export function Sel({
  label,
  options,
  ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  options: (string | { value: string; label: string })[];
}) {
  return (
    <label className="grid gap-1">
      <span className="text-xs text-slate-400">
        {label}
        {rest.required && " *"}
      </span>
      <select
        {...rest}
        className="px-3 py-2 bg-white/5 border border-white/10 rounded-md"
        defaultValue={rest.defaultValue ?? ""}
      >
        <option value="" disabled>
          Selecione...
        </option>
        {options.map((o) => {
          const v = typeof o === "string" ? o : o.value;
          const l = typeof o === "string" ? o : o.label;
          return (
            <option key={v} value={v}>
              {l}
            </option>
          );
        })}
      </select>
    </label>
  );
}
