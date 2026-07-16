import { createFileRoute, useParams, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { workflowLabel } from "@/lib/workflow";
import { ArrowLeft, Download, QrCode, Copy, CheckCircle } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type Battery = Database["public"]["Tables"]["batteries"]["Row"];
type BatteryEvent = Database["public"]["Tables"]["battery_events"]["Row"];

export const Route = createFileRoute("/_authenticated/app/gerador/bateria/$batteryId")({
  component: DetalheBateria,
});

function DetalheBateria() {
  const navigate = useNavigate();
  const params = Route.useParams();
  const auth = useAuth();
  const [battery, setBattery] = useState<Battery | null>(null);
  const [events, setEvents] = useState<BatteryEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!params.batteryId) return;
      setLoading(true);

      try {
        const { data: batteryData, error: batteryError } = await supabase
          .from("batteries")
          .select("*")
          .eq("id", params.batteryId)
          .limit(1)
          .single();

        if (batteryError) throw batteryError;
        setBattery(batteryData);

        const { data: eventsData } = await supabase
          .from("battery_events")
          .select("*")
          .eq("battery_id", params.batteryId)
          .order("created_at", { ascending: false });

        setEvents(eventsData || []);
      } catch (error) {
        console.error(error);
        toast.error("Erro ao carregar detalhes da bateria.");
        navigate({ to: "/app/gerador" });
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [params.batteryId, navigate]);

  const handleCopyCode = () => {
    if (battery?.code) {
      navigator.clipboard.writeText(battery.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) {
    return <div className="max-w-4xl mx-auto py-8 text-center text-slate-400">Carregando...</div>;
  }

  if (!battery) {
    return (
      <div className="max-w-4xl mx-auto py-8 text-center text-slate-400">
        Bateria não encontrada.
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <button
          onClick={() => navigate({ to: "/app/gerador" })}
          className="inline-flex items-center gap-2 text-brand hover:brightness-125 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </button>
        <button className="inline-flex items-center gap-2 px-4 py-2 border border-white/20 rounded-lg hover:bg-white/5 transition text-sm">
          <Download className="w-4 h-4" />
          Exportar
        </button>
      </div>

      {/* Card principal */}
      <div className="bg-white/5 border border-white/10 rounded-lg overflow-hidden">
        <div className="bg-gradient-to-r from-brand/10 to-transparent p-6 border-b border-white/10">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h1 className="text-2xl font-display font-bold mb-2">
                {battery.fabricante} {battery.modelo}
              </h1>
              <div className="flex flex-wrap gap-3">
                <div className="inline-flex items-center px-2 py-1 bg-blue-500/20 text-blue-300 rounded text-xs font-semibold">
                  {battery.quimica.toUpperCase()}
                </div>
                <div className="inline-flex items-center px-2 py-1 bg-brand/20 text-brand rounded text-xs font-semibold">
                  {workflowLabel(battery.status)}
                </div>
                {battery.urgencia === "critica" && (
                  <div className="inline-flex items-center px-2 py-1 bg-red-500/20 text-red-300 rounded text-xs font-semibold">
                    ⚠ Crítica
                  </div>
                )}
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-400 font-mono">Código único</p>
              <button
                onClick={handleCopyCode}
                className="mt-1 inline-flex items-center gap-1 px-2 py-1 bg-white/10 hover:bg-white/20 rounded transition text-sm font-mono text-brand"
              >
                {battery.code}
                {copied ? <CheckCircle className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* QR Code */}
          <div className="flex items-center gap-4 p-4 bg-white/[0.02] rounded-lg border border-white/5">
            <QrCode className="w-8 h-8 text-brand flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-slate-400 mb-1">Rastreabilidade</p>
              <p className="text-sm font-mono break-all text-brand">{battery.qr_code_data}</p>
            </div>
            <a
              href={battery.qr_code_data ?? undefined}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 bg-brand/20 text-brand rounded text-xs font-semibold hover:bg-brand/30 transition whitespace-nowrap"
            >
              Visualizar
            </a>
          </div>

          {/* Dados técnicos */}
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h2 className="text-xs font-mono uppercase text-slate-400 mb-4">Especificações</h2>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-xs text-slate-400">Capacidade</p>
                  <p className="font-semibold">{battery.capacidade_kwh ?? "—"} kWh</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Tensão</p>
                  <p className="font-semibold">{battery.tensao ?? "—"} V</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Quantidade</p>
                  <p className="font-semibold">{battery.quantidade} unidade(s)</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Peso</p>
                  <p className="font-semibold">{battery.peso_kg ?? "—"} kg</p>
                </div>
              </div>
            </div>

            <div>
              <h2 className="text-xs font-mono uppercase text-slate-400 mb-4">Estado e riscos</h2>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-xs text-slate-400">SoH (State of Health)</p>
                  <p className="font-semibold">{battery.soh_percentual ?? "—"}%</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Estado aparente</p>
                  <p className="font-semibold capitalize">{battery.estado}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-slate-400">Riscos detectados</p>
                  <div className="flex flex-wrap gap-1">
                    {battery.possui_vazamento && (
                      <span className="px-2 py-1 bg-red-500/20 text-red-300 rounded text-xs">
                        Vazamento
                      </span>
                    )}
                    {battery.possui_avaria && (
                      <span className="px-2 py-1 bg-orange-500/20 text-orange-300 rounded text-xs">
                        Avaria
                      </span>
                    )}
                    {battery.possui_risco_termico && (
                      <span className="px-2 py-1 bg-red-600/20 text-red-400 rounded text-xs">
                        Risco térmico
                      </span>
                    )}
                    {!battery.possui_vazamento &&
                      !battery.possui_avaria &&
                      !battery.possui_risco_termico && (
                        <span className="px-2 py-1 bg-emerald-500/20 text-emerald-300 rounded text-xs">
                          Sem riscos
                        </span>
                      )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Localização */}
          <div className="p-4 bg-white/[0.02] rounded-lg border border-white/5">
            <h2 className="text-xs font-mono uppercase text-slate-400 mb-3">Localização</h2>
            <p className="text-sm">
              {battery.endereco}, {battery.cidade} — {battery.uf}
            </p>
            <p className="text-xs text-slate-400 mt-1">CEP: {battery.cep}</p>
          </div>

          {/* Observações */}
          {battery.observacoes && (
            <div className="p-4 bg-white/[0.02] rounded-lg border border-white/5">
              <h2 className="text-xs font-mono uppercase text-slate-400 mb-3">Observações</h2>
              <p className="text-sm text-slate-300">{battery.observacoes}</p>
            </div>
          )}
        </div>
      </div>

      {/* Histórico de eventos */}
      <div className="bg-white/5 border border-white/10 rounded-lg p-6">
        <h2 className="text-sm font-mono uppercase tracking-widest text-brand mb-4">
          Linha do tempo
        </h2>
        <div className="space-y-3">
          {events.length === 0 ? (
            <p className="text-sm text-slate-400">Nenhum evento registrado ainda.</p>
          ) : (
            events.map((event) => (
              <div key={event.id} className="flex gap-4 pb-4 border-b border-white/5 last:border-0">
                <div className="w-2 h-2 rounded-full bg-brand mt-2 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{workflowLabel(event.event_type)}</p>
                  {event.notes && <p className="text-xs text-slate-400 mt-1">{event.notes}</p>}
                  <p className="text-xs text-slate-500 mt-2">
                    {new Date(event.created_at).toLocaleString("pt-BR")}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
