import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  BatteryCharging,
  Recycle,
  Truck,
  ShieldCheck,
  ArrowRight,
  CheckCircle2,
  Clock,
  FileText,
  Leaf,
  DollarSign,
  MapPin,
  Package,
} from "lucide-react";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";

export const Route = createFileRoute("/portal")({
  head: () => ({
    meta: [
      { title: "Portal de rastreabilidade — BatteryLink Brasil" },
      {
        name: "description",
        content:
          "Painéis por perfil, linha do tempo por lote, financeiro e dashboard ambiental — a operação BatteryLink em um só lugar.",
      },
    ],
  }),
  component: PortalPage,
});

type Role = "gerador" | "operador" | "recicladora" | "transportadora" | "admin";

const roles: { id: Role; label: string; icon: typeof BatteryCharging; desc: string }[] = [
  {
    id: "gerador",
    label: "Gerador",
    icon: BatteryCharging,
    desc: "Acompanha status, baixa relatórios e certificados.",
  },
  {
    id: "operador",
    label: "Operador",
    icon: ShieldCheck,
    desc: "Análise, triagem, lotes, cotação e emissão de documentos.",
  },
  {
    id: "recicladora",
    label: "Recicladora",
    icon: Recycle,
    desc: "Lotes disponíveis, propostas e comprovantes de destinação.",
  },
  {
    id: "transportadora",
    label: "Transportadora",
    icon: Truck,
    desc: "Ordens de coleta, status em campo e comprovantes.",
  },
  {
    id: "admin",
    label: "Admin",
    icon: ShieldCheck,
    desc: "Usuários, permissões, contratos e ocorrências.",
  },
];

function PortalPage() {
  const [role, setRole] = useState<Role>("operador");

  return (
    <div className="min-h-screen bg-industrial text-slate-100">
      <SiteNav />
      <div className="border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-baseline justify-between flex-wrap gap-4 mb-6">
            <div>
              <span className="text-brand font-mono text-xs uppercase tracking-widest">
                MVP Preview · Portal
              </span>
              <h1 className="text-3xl md:text-4xl font-display font-bold mt-2 italic">
                Rastreabilidade viva, painéis por perfil.
              </h1>
            </div>
            <div className="text-xs text-slate-500 font-mono">
              Dados exibidos são demonstrativos.
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1">
            {roles.map((r) => {
              const Icon = r.icon;
              const active = r.id === role;
              return (
                <button
                  key={r.id}
                  onClick={() => setRole(r.id)}
                  className={
                    active
                      ? "flex items-center gap-2 px-4 py-2.5 rounded-lg bg-brand text-industrial font-semibold text-sm whitespace-nowrap"
                      : "flex items-center gap-2 px-4 py-2.5 rounded-lg bg-panel border border-white/10 text-slate-300 hover:border-brand/40 text-sm whitespace-nowrap"
                  }
                >
                  <Icon className="w-4 h-4" />
                  {r.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-6 py-10">
        {role === "gerador" && <GeradorPanel />}
        {role === "operador" && <OperadorPanel />}
        {role === "recicladora" && <RecicladoraPanel />}
        {role === "transportadora" && <TransportadoraPanel />}
        {role === "admin" && <AdminPanel />}
      </main>

      <SiteFooter />
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
  accent,
  Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
  Icon: typeof BatteryCharging;
}) {
  return (
    <div className="p-5 rounded-xl bg-panel border border-white/5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
          {label}
        </span>
        <div className="w-8 h-8 rounded-lg bg-brand/10 flex items-center justify-center">
          <Icon className="w-4 h-4 text-brand" />
        </div>
      </div>
      <div
        className={
          accent
            ? "text-2xl font-display font-bold text-brand tabular-nums"
            : "text-2xl font-display font-bold tabular-nums"
        }
      >
        {value}
      </div>
      {hint && <div className="text-xs text-slate-500 mt-1">{hint}</div>}
    </div>
  );
}

function GeradorPanel() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Kpi label="Baterias registradas" value="18" Icon={BatteryCharging} />
        <Kpi label="Em processamento" value="7" Icon={Clock} />
        <Kpi label="Destinação concluída" value="11" Icon={CheckCircle2} accent />
        <Kpi label="Certificados emitidos" value="11" Icon={FileText} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 p-6 rounded-2xl bg-panel border border-white/5">
          <h3 className="font-bold mb-4">Minhas baterias</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] font-mono uppercase tracking-widest text-slate-500 text-left">
                <th className="pb-3 font-medium">Protocolo</th>
                <th className="pb-3 font-medium">Química</th>
                <th className="pb-3 font-medium">kWh</th>
                <th className="pb-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {[
                { p: "GER-8842", q: "LFP", k: "60", s: "Coletado", tone: "brand" },
                { p: "GER-8791", q: "NMC", k: "82", s: "Triagem", tone: "yellow" },
                { p: "GER-8720", q: "LFP", k: "24", s: "Certificado emitido", tone: "green" },
                { p: "GER-8651", q: "LTO", k: "12", s: "Aguardando coleta", tone: "gray" },
              ].map((r) => (
                <tr key={r.p} className="text-slate-300">
                  <td className="py-3 font-mono text-xs">{r.p}</td>
                  <td className="py-3">{r.q}</td>
                  <td className="py-3 tabular-nums">{r.k}</td>
                  <td className="py-3">
                    <span
                      className={
                        r.tone === "brand"
                          ? "text-brand text-xs font-medium"
                          : r.tone === "green"
                            ? "text-emerald-400 text-xs font-medium"
                            : r.tone === "yellow"
                              ? "text-amber-400 text-xs font-medium"
                              : "text-slate-500 text-xs font-medium"
                      }
                    >
                      ● {r.s}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="p-6 rounded-2xl bg-panel border border-white/5">
          <h3 className="font-bold mb-4">Relatórios disponíveis</h3>
          <div className="space-y-3">
            {[
              "Certificado CDF · Lote BR-9812",
              "Relatório ambiental Q2/2026",
              "Manifesto MTR · Lote BR-9720",
            ].map((r) => (
              <button
                key={r}
                className="w-full flex items-center justify-between p-3 rounded-lg bg-industrial border border-white/5 hover:border-brand/40 text-left text-sm"
              >
                <span className="flex items-center gap-2 text-slate-300">
                  <FileText className="w-4 h-4 text-brand" /> {r}
                </span>
                <ArrowRight className="w-4 h-4 text-slate-500" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function OperadorPanel() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Kpi label="Solicitações abertas" value="34" Icon={Package} />
        <Kpi label="Em triagem" value="12" Icon={Clock} />
        <Kpi label="Cotando RFQ" value="8" Icon={DollarSign} />
        <Kpi label="Certificados este mês" value="27" Icon={FileText} accent />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="p-6 rounded-2xl bg-panel border border-white/5">
          <h3 className="font-bold mb-2">Fila de triagem</h3>
          <p className="text-xs text-slate-500 mb-4">Classificar segunda vida vs reciclagem.</p>
          <div className="space-y-3">
            {[
              { id: "GER-8791", ch: "NMC", soh: 78 },
              { id: "GER-8788", ch: "LFP", soh: 42 },
              { id: "GER-8782", ch: "NMC", soh: 91 },
            ].map((b) => (
              <div key={b.id} className="p-3 rounded-lg bg-industrial border border-white/5">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="font-mono text-xs">{b.id}</span>
                  <span className="text-xs text-slate-400">{b.ch}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-brand" style={{ width: `${b.soh}%` }} />
                  </div>
                  <span className="text-xs font-mono text-brand w-10 text-right">{b.soh}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-6 rounded-2xl bg-panel border border-white/5">
          <h3 className="font-bold mb-2">Lotes montados</h3>
          <p className="text-xs text-slate-500 mb-4">Aguardando propostas.</p>
          <div className="space-y-2">
            {[
              { id: "BR-9942", weight: "480 kg", qtd: 6 },
              { id: "BR-9941", weight: "1.2 t", qtd: 14 },
              { id: "BR-9938", weight: "320 kg", qtd: 4 },
            ].map((l) => (
              <div
                key={l.id}
                className="flex items-center justify-between p-3 rounded-lg bg-industrial border border-white/5"
              >
                <span className="font-mono text-xs text-brand">{l.id}</span>
                <span className="text-xs text-slate-400">
                  {l.qtd} un · {l.weight}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="p-6 rounded-2xl bg-panel border border-white/5">
          <h3 className="font-bold mb-2">Financeiro</h3>
          <p className="text-xs text-slate-500 mb-4">Três modelos comerciais ativos.</p>
          {[
            { m: "Gerador paga", v: "R$ 18.240", n: "12 contratos" },
            { m: "Plataforma compra", v: "R$ 42.900", n: "5 contratos" },
            { m: "Modelo neutro", v: "R$ 7.100", n: "8 contratos" },
          ].map((f) => (
            <div
              key={f.m}
              className="flex justify-between items-baseline py-2 border-b border-white/5 last:border-0"
            >
              <div>
                <p className="text-sm">{f.m}</p>
                <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
                  {f.n}
                </p>
              </div>
              <p className="font-display font-bold text-brand tabular-nums">{f.v}</p>
            </div>
          ))}
        </div>
      </div>

      <EnvironmentalDashboard />
    </div>
  );
}

function RecicladoraPanel() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Kpi label="Lotes disponíveis" value="14" Icon={Package} />
        <Kpi label="Propostas ativas" value="6" Icon={DollarSign} />
        <Kpi label="Aceitos este mês" value="9" Icon={CheckCircle2} accent />
        <Kpi label="CDFs enviados" value="9" Icon={FileText} />
      </div>

      <div className="p-6 rounded-2xl bg-panel border border-white/5">
        <h3 className="font-bold mb-4">Lotes abertos para proposta</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] font-mono uppercase tracking-widest text-slate-500 text-left">
              <th className="pb-3">Lote</th>
              <th className="pb-3">Química</th>
              <th className="pb-3">Massa</th>
              <th className="pb-3">Origem</th>
              <th className="pb-3 text-right">Ação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {[
              { id: "BR-9942", q: "NMC", m: "480 kg", o: "SJC/SP" },
              { id: "BR-9941", q: "LFP", m: "1.2 t", o: "Betim/MG" },
              { id: "BR-9938", q: "NMC", m: "320 kg", o: "Curitiba/PR" },
            ].map((r) => (
              <tr key={r.id} className="text-slate-300">
                <td className="py-3 font-mono text-xs text-brand">{r.id}</td>
                <td className="py-3">{r.q}</td>
                <td className="py-3 tabular-nums">{r.m}</td>
                <td className="py-3">{r.o}</td>
                <td className="py-3 text-right">
                  <button className="px-3 py-1.5 rounded-md bg-brand text-industrial text-xs font-semibold hover:brightness-110">
                    Enviar proposta
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TransportadoraPanel() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Kpi label="Ordens abertas" value="7" Icon={Truck} />
        <Kpi label="Em rota" value="3" Icon={MapPin} />
        <Kpi label="Concluídas / mês" value="22" Icon={CheckCircle2} accent />
        <Kpi label="Comprovantes anexos" value="22" Icon={FileText} />
      </div>

      <div className="p-6 rounded-2xl bg-panel border border-white/5">
        <h3 className="font-bold mb-4">Ordens de coleta</h3>
        <div className="space-y-3">
          {[
            { id: "OC-3391", from: "SJC/SP", to: "Sorocaba/SP", w: "480 kg", s: "Aceitar" },
            { id: "OC-3388", from: "Betim/MG", to: "Contagem/MG", w: "1.2 t", s: "Em rota" },
            { id: "OC-3380", from: "Curitiba/PR", to: "Joinville/SC", w: "320 kg", s: "Entregue" },
          ].map((o) => (
            <div
              key={o.id}
              className="flex items-center justify-between p-4 rounded-lg bg-industrial border border-white/5"
            >
              <div>
                <p className="font-mono text-xs text-brand mb-1">{o.id}</p>
                <p className="text-sm">
                  {o.from} → {o.to} <span className="text-slate-500">· {o.w}</span>
                </p>
              </div>
              <button
                className={
                  o.s === "Aceitar"
                    ? "px-3 py-1.5 rounded-md bg-brand text-industrial text-xs font-semibold"
                    : o.s === "Em rota"
                      ? "px-3 py-1.5 rounded-md border border-amber-400/40 text-amber-400 text-xs font-semibold"
                      : "px-3 py-1.5 rounded-md border border-emerald-400/40 text-emerald-400 text-xs font-semibold"
                }
              >
                {o.s}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AdminPanel() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Kpi label="Usuários ativos" value="146" Icon={ShieldCheck} />
        <Kpi label="Contratos vigentes" value="38" Icon={FileText} />
        <Kpi label="Ocorrências abertas" value="4" Icon={Clock} />
        <Kpi label="Compliance OK" value="94%" Icon={CheckCircle2} accent />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="p-6 rounded-2xl bg-panel border border-white/5">
          <h3 className="font-bold mb-4">Gestão de usuários & permissões</h3>
          <div className="space-y-2">
            {[
              { u: "Maria Silva", r: "Operador", p: "Total" },
              { u: "Recicladora Verde", r: "Recicladora", p: "Restrito" },
              { u: "Logística Alfa", r: "Transportadora", p: "Restrito" },
              { u: "Frota Beta", r: "Gerador", p: "Somente leitura" },
            ].map((u) => (
              <div
                key={u.u}
                className="flex items-center justify-between p-3 rounded-lg bg-industrial border border-white/5"
              >
                <div>
                  <p className="text-sm">{u.u}</p>
                  <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
                    {u.r}
                  </p>
                </div>
                <span className="text-xs text-brand">{u.p}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="p-6 rounded-2xl bg-panel border border-white/5">
          <h3 className="font-bold mb-4">Ocorrências recentes</h3>
          <div className="space-y-3">
            {[
              { t: "Divergência de MTR · Lote BR-9812", s: "Média" },
              { t: "Vencimento LO parceiro Recicla+", s: "Alta" },
              { t: "Coleta reagendada · OC-3388", s: "Baixa" },
              { t: "Contrato para renovação · Frota Beta", s: "Baixa" },
            ].map((o) => (
              <div
                key={o.t}
                className="flex items-center justify-between p-3 rounded-lg bg-industrial border border-white/5"
              >
                <p className="text-sm">{o.t}</p>
                <span
                  className={
                    o.s === "Alta"
                      ? "text-xs text-red-400"
                      : o.s === "Média"
                        ? "text-xs text-amber-400"
                        : "text-xs text-slate-400"
                  }
                >
                  {o.s}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function EnvironmentalDashboard() {
  return (
    <div className="p-6 rounded-2xl bg-panel border border-white/5">
      <div className="flex items-baseline justify-between mb-6 flex-wrap gap-3">
        <div>
          <span className="text-[10px] font-mono uppercase tracking-widest text-brand">
            Dashboard ambiental
          </span>
          <h3 className="text-xl font-display font-bold italic">Impacto acumulado</h3>
        </div>
        <span className="text-xs text-slate-500">Período: últimos 90 dias</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Kpi label="Volume processado" value="Indicador indisponível" Icon={Package} />
        <Kpi label="Lítio recuperável" value="Indicador indisponível" Icon={Leaf} />
        <Kpi label="Cobalto recuperável" value="Indicador indisponível" Icon={Leaf} />
        <Kpi label="CO₂ potencialmente evitado" value="Metodologia necessária" Icon={Leaf} accent />
      </div>
      <p className="text-[10px] text-slate-500 mt-3">
        Estimativas para fins gerenciais, sujeitas à validação técnica. Indicadores dependem de
        metodologia configurada.
      </p>
    </div>
  );
}
