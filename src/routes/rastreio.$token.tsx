import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Clock3, LockKeyhole, QrCode, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { workflowLabel, workflowRpc } from "@/lib/workflow";
import { SiteFooter } from "@/components/site-footer";

type PublicTrace = {
  code: string;
  category: "battery" | "collection" | "lot";
  status: string;
  dates: Record<string, string>;
  destination_status: string;
  query_valid_until: string;
  authorized?: boolean;
  details?: Record<string, unknown> | null;
  related?: Record<string, unknown> | null;
};

export const Route = createFileRoute("/rastreio/$token")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Rastreabilidade — BatteryLink Brasil" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: TracePage,
});

const categoryLabels = { battery: "Bateria", collection: "Coleta", lot: "Lote" };
const dateLabels: Record<string, string> = {
  registered_at: "Cadastro",
  created_at: "Criação",
  requested_at: "Solicitação",
  scheduled_at: "Agendamento",
  collected_at: "Retirada",
  delivered_at: "Entrega",
  proposals_open_at: "Abertura das propostas",
  proposals_close_at: "Encerramento das propostas",
  updated_at: "Última atualização",
};

function TracePage() {
  const { token } = Route.useParams();
  const [trace, setTrace] = useState<PublicTrace | null>(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const { data } = await supabase.auth.getSession();
        setAuthenticated(Boolean(data.session));
        const result = data.session
          ? await workflowRpc<PublicTrace>("get_authorized_trace", { _token: token })
          : await workflowRpc<PublicTrace>("get_public_trace", { _token: token });
        setTrace(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Consulta indisponível");
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  return (
    <div className="min-h-screen bg-industrial flex flex-col">
      <header className="border-b border-white/10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="font-display font-bold tracking-tight">
            Battery<span className="text-brand">Link</span>
          </Link>
          <span className="inline-flex items-center gap-2 text-xs text-slate-400">
            <ShieldCheck className="w-4 h-4 text-brand" /> Consulta protegida
          </span>
        </div>
      </header>

      <main className="flex-1 w-full max-w-5xl mx-auto px-6 py-12">
        {loading ? (
          <p className="text-sm text-slate-400">Consultando rastreabilidade...</p>
        ) : error || !trace ? (
          <div className="max-w-xl p-6 border border-danger/30 rounded-md">
            <h1 className="text-xl font-display font-bold">Código não localizado</h1>
            <p className="text-sm text-slate-400 mt-2">
              {error || "A consulta não retornou dados."}
            </p>
          </div>
        ) : (
          <div className="grid gap-5">
            <div className="flex flex-wrap justify-between items-start gap-4">
              <div>
                <p className="font-mono text-xs text-brand tracking-widest uppercase inline-flex items-center gap-2">
                  <QrCode className="w-4 h-4" /> Rastreabilidade pública
                </p>
                <h1 className="text-3xl font-display font-bold mt-2">{trace.code}</h1>
                <p className="text-sm text-slate-400 mt-1">{categoryLabels[trace.category]}</p>
              </div>
              <div className="px-3 py-2 border border-brand/30 rounded-md text-brand text-sm">
                {workflowLabel(trace.status)}
              </div>
            </div>

            <section className="grid md:grid-cols-2 gap-3">
              <div className="p-5 border border-white/10 rounded-md bg-white/[0.025]">
                <h2 className="text-xs uppercase font-mono text-slate-400 mb-3">Situação geral</h2>
                <div className="text-lg font-semibold">
                  {workflowLabel(trace.destination_status)}
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  A consulta pública não contém nomes, endereços, contatos, documentos, valores ou
                  informações comerciais.
                </p>
              </div>
              <div className="p-5 border border-white/10 rounded-md bg-white/[0.025]">
                <h2 className="text-xs uppercase font-mono text-slate-400 mb-3">
                  Datas principais
                </h2>
                <div className="grid gap-2">
                  {Object.entries(trace.dates ?? {}).map(([key, value]) => (
                    <div key={key} className="flex justify-between gap-3 text-sm">
                      <span className="text-slate-400">
                        {dateLabels[key] ?? key.replaceAll("_", " ")}
                      </span>
                      <span>{new Date(value).toLocaleString("pt-BR")}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <div className="inline-flex items-center gap-2 text-xs text-slate-500">
              <Clock3 className="w-4 h-4" /> Consulta válida até{" "}
              {new Date(trace.query_valid_until).toLocaleString("pt-BR")}
            </div>

            {trace.authorized && trace.details ? (
              <section className="p-5 border border-brand/20 rounded-md">
                <div className="flex items-center gap-2 mb-4">
                  <ShieldCheck className="w-4 h-4 text-brand" />
                  <h2 className="font-semibold">Detalhes completos autorizados</h2>
                </div>
                <div className="grid lg:grid-cols-2 gap-3">
                  <DataPanel title="Entidade" value={trace.details} />
                  {trace.related && (
                    <DataPanel title="Relações e histórico" value={trace.related} />
                  )}
                </div>
              </section>
            ) : authenticated ? (
              <div className="p-4 border border-amber-400/20 rounded-md text-sm text-amber-300 inline-flex items-center gap-2">
                <LockKeyhole className="w-4 h-4" /> Sua conta não está vinculada a este item.
                Somente os dados públicos foram liberados.
              </div>
            ) : (
              <div className="p-4 border border-white/10 rounded-md flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm text-slate-400 inline-flex items-center gap-2">
                  <LockKeyhole className="w-4 h-4" /> Participantes autorizados podem visualizar os
                  detalhes completos.
                </div>
                <Link
                  to="/auth"
                  search={{ mode: undefined }}
                  className="px-4 py-2 bg-brand text-industrial rounded-md text-sm font-semibold"
                >
                  Entrar
                </Link>
              </div>
            )}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

function DataPanel({ title, value }: { title: string; value: Record<string, unknown> }) {
  return (
    <div className="p-4 bg-white/[0.025] border border-white/10 rounded-md min-w-0">
      <h3 className="text-xs uppercase font-mono text-slate-400 mb-3">{title}</h3>
      <pre className="text-xs text-slate-300 overflow-auto max-h-96 whitespace-pre-wrap break-all">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}
