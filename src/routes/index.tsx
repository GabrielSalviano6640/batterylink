import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BatteryCharging,
  Recycle,
  Truck,
  MessagesSquare,
  ArrowRight,
  ShieldCheck,
  LineChart,
  FileCheck2,
  Boxes,
  Factory,
  MapPin,
} from "lucide-react";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";

export const Route = createFileRoute("/")({
  component: Index,
});

const ctas = [
  {
    to: "/gerador" as const,
    label: "Tenho uma bateria para destinar",
    subtitle: "Frotas, montadoras, indústrias e sistemas de energia.",
    icon: BatteryCharging,
    tag: "Geradores",
    highlight: false,
  },
  {
    to: "/recicladora" as const,
    label: "Sou reciclador ou parceiro técnico",
    subtitle: "Acesse lotes qualificados e envie propostas.",
    icon: Recycle,
    tag: "Segunda vida & Reciclagem",
    highlight: false,
  },
  {
    to: "/transportadora" as const,
    label: "Sou transportadora ou operador logístico",
    subtitle: "Ordens de coleta e transporte especializado.",
    icon: Truck,
    tag: "Logística reversa",
    highlight: false,
  },
  {
    to: "/operador" as const,
    label: "Sou operador de triagem",
    subtitle: "Diagnóstico, classificação e custódia técnica.",
    icon: Factory,
    tag: "Triagem & Rastreabilidade",
    highlight: false,
  },
  {
    to: "/contato" as const,
    label: "Falar com a equipe",
    subtitle: "Contratos, integrações e projetos institucionais.",
    icon: MessagesSquare,
    tag: "Institucional",
    highlight: true,
  },
];

const faqs = [
  {
    q: "Quem pode usar a plataforma?",
    a: "Geradores (montadoras, frotas, indústrias, seguradoras, oficinas, concessionárias, locadoras, empresas de armazenamento de energia), recicladores, parceiros de segunda vida, transportadoras habilitadas para produtos perigosos e operadores de triagem credenciados.",
  },
  {
    q: "Como funciona a rastreabilidade?",
    a: "Cada bateria, módulo, célula, coleta e lote recebe um identificador único e um QR Code. Toda alteração é registrada em histórico de auditoria protegido contra alteração por usuários comuns, com usuário, ação, data e status anterior e novo.",
  },
  {
    q: "Quais documentos são gerados?",
    a: "Ordens de coleta, MTR registrado ou anexado, laudos de diagnóstico, comprovantes de transporte e recebimento e CDF emitido ou validado pelo destinador responsável.",
  },
  {
    q: "Como é garantida a segurança dos dados?",
    a: "Controle de acesso por perfil (RBAC), criptografia de senhas, sessão segura, ocultação de dados comerciais sensíveis entre concorrentes e conformidade com a LGPD. Autenticação em dois fatores está preparada para ativação.",
  },
  {
    q: "Os documentos têm validade legal automática?",
    a: "Não. Todos os documentos regulatórios e ambientais devem ser validados por profissional habilitado antes do uso oficial junto a IBAMA, CETESB e demais órgãos competentes.",
  },
  {
    q: "Quais modelos comerciais existem?",
    a: "Gerador paga pela destinação; reciclador compra o material; plataforma compra e revende; comissão sobre operação; taxa fixa por operação; assinatura mensal; ou modelo personalizado — configurável por operação.",
  },
];

const flowSteps = [
  {
    n: "01",
    icon: BatteryCharging,
    title: "Coleta na origem",
    body: "Agendamento logístico com MTR registrado ou anexado, licenças verificadas e rastreamento por bateria ou lote.",
  },
  {
    n: "02",
    icon: Factory,
    title: "Triagem técnica",
    body: "Diagnóstico de State of Health (SoH), classificação entre segunda vida ou reciclagem química.",
  },
  {
    n: "03",
    icon: Recycle,
    title: "Destinação certificada",
    body: "Intermediação com parceiros homologados, cotação de propostas e formação de lotes.",
  },
  {
    n: "04",
    icon: FileCheck2,
    title: "Certificado & impacto",
    body: "Registro de CDF emitido ou validado pelo destinador, relatório ambiental e materiais recuperáveis estimados.",
  },
];

function Index() {
  return (
    <div className="min-h-screen bg-industrial text-slate-100">
      <SiteNav />

      {/* Hero */}
      <header className="relative overflow-hidden border-b border-white/5">
        <div className="absolute inset-0 blueprint-grid opacity-60 pointer-events-none" />
        <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full bg-brand/10 blur-3xl pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-6 pt-20 pb-16">
          <div className="max-w-3xl">
            <span className="text-brand font-mono font-medium tracking-widest text-xs uppercase mb-6 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-brand animate-pulse" />
              Economia Circular & Logística Reversa
            </span>
            <h1 className="text-5xl md:text-7xl font-display font-bold leading-[1.02] mb-6 text-balance">
              Gestão, rastreabilidade e{" "}
              <span className="text-white/40 italic">destinação inteligente</span> para baterias.
            </h1>
            <p className="text-lg md:text-xl text-slate-400 leading-relaxed mb-10 max-w-2xl">
              Conectamos geradores, operadores logísticos, centros de triagem, parceiros de segunda
              vida e recicladores em uma única plataforma segura e rastreável.
            </p>
          </div>

          {/* CTAs */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {ctas.map((cta) => {
              const Icon = cta.icon;
              return (
                <Link
                  key={cta.to}
                  to={cta.to}
                  className={
                    cta.highlight
                      ? "group p-6 bg-brand text-industrial rounded-xl text-left hover:brightness-110 transition-all flex flex-col"
                      : "group p-6 bg-panel border border-white/5 rounded-xl text-left hover:border-brand/50 hover:bg-panel/70 transition-all flex flex-col"
                  }
                >
                  <div
                    className={
                      cta.highlight
                        ? "w-11 h-11 bg-industrial/10 rounded-lg flex items-center justify-center mb-5"
                        : "w-11 h-11 bg-brand/10 rounded-lg flex items-center justify-center mb-5 group-hover:bg-brand/20"
                    }
                  >
                    <Icon
                      className={cta.highlight ? "w-5 h-5 text-industrial" : "w-5 h-5 text-brand"}
                    />
                  </div>
                  <p
                    className={
                      cta.highlight
                        ? "text-[10px] font-mono uppercase tracking-widest text-industrial/70 mb-2"
                        : "text-[10px] font-mono uppercase tracking-widest text-brand mb-2"
                    }
                  >
                    {cta.tag}
                  </p>
                  <h3 className="text-base font-bold mb-2 leading-snug">{cta.label}</h3>
                  <p
                    className={
                      cta.highlight ? "text-sm text-industrial/80" : "text-sm text-slate-400"
                    }
                  >
                    {cta.subtitle}
                  </p>
                  <div className="mt-auto pt-4 flex items-center text-xs font-mono uppercase tracking-widest gap-2 opacity-80 group-hover:opacity-100">
                    Acessar formulário <ArrowRight className="w-3 h-3" />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </header>

      {/* Problema × Solução */}
      <section className="max-w-7xl mx-auto px-6 py-24 grid md:grid-cols-2 gap-10 border-b border-white/5">
        <div>
          <span className="text-brand font-mono text-xs uppercase tracking-widest">O problema</span>
          <h2 className="text-3xl md:text-4xl font-display font-bold mt-2 italic mb-6">
            O mercado ainda opera baterias em planilhas soltas.
          </h2>
          <ul className="space-y-3 text-slate-400 text-sm leading-relaxed">
            <li>• Custódia fragmentada entre gerador, transporte, triagem e reciclagem.</li>
            <li>• Documentação regulatória dispersa e sem rastro auditável.</li>
            <li>• Falta de padronização técnica (química, SoH, formato, classificação).</li>
            <li>• Risco operacional elevado no transporte de Classe 9 sem controle central.</li>
            <li>• Perda de valor econômico em materiais que poderiam ir para segunda vida.</li>
          </ul>
        </div>
        <div>
          <span className="text-brand font-mono text-xs uppercase tracking-widest">A solução</span>
          <h2 className="text-3xl md:text-4xl font-display font-bold mt-2 italic mb-6">
            Uma plataforma única, com papéis, permissões e histórico.
          </h2>
          <ul className="space-y-3 text-slate-300 text-sm leading-relaxed">
            <li>• Cinco perfis (gerador, reciclador, transportadora, operador, admin) com RBAC.</li>
            <li>• Identificador único e QR Code por bateria, módulo, célula, coleta e lote.</li>
            <li>• Fluxo de status ponta a ponta, do cadastro ao certificado de destinação.</li>
            <li>• Propostas, contratos e financeiro configuráveis por operação.</li>
            <li>
              • Histórico de auditoria protegido contra alteração por usuários comuns. Desenvolvida
              para apoiar operações em conformidade com a PNRS e a LGPD.
            </li>
          </ul>
        </div>
      </section>

      {/* Benefícios */}
      <section className="max-w-7xl mx-auto px-6 py-24 border-b border-white/5">
        <div className="max-w-2xl mb-12">
          <span className="text-brand font-mono text-xs uppercase tracking-widest">Benefícios</span>
          <h2 className="text-3xl md:text-4xl font-display font-bold mt-2 italic">
            Ambiental, econômico e regulatório — no mesmo painel.
          </h2>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          {[
            {
              tag: "Ambiental",
              title: "Economia circular mensurável",
              body: "Materiais recuperáveis estimados (Li, Co, Ni, Cu), emissões evitadas e índice de reaproveitamento por operação.",
            },
            {
              tag: "Econômico",
              title: "Valor no fim da vida útil",
              body: "Baterias qualificadas viram lotes negociáveis: segunda vida, módulos, células ou massa negra.",
            },
            {
              tag: "Regulatório",
              title: "Rastro auditável",
              body: "Cadeia de custódia com carimbo de usuário, ação, data e status para atender IBAMA, CETESB e PNRS.",
            },
          ].map((b) => (
            <div key={b.title} className="p-6 rounded-xl border border-white/5 bg-panel/50">
              <p className="text-[10px] font-mono uppercase tracking-widest text-brand mb-3">
                {b.tag}
              </p>
              <h3 className="font-bold mb-2">{b.title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{b.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Segurança & conformidade */}
      <section className="max-w-7xl mx-auto px-6 py-24 border-b border-white/5">
        <div className="grid md:grid-cols-2 gap-10">
          <div>
            <span className="text-brand font-mono text-xs uppercase tracking-widest">
              Segurança & Conformidade
            </span>
            <h2 className="text-3xl md:text-4xl font-display font-bold mt-2 italic mb-6">
              LGPD, RBAC e histórico de auditoria protegido.
            </h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              Cada usuário enxerga apenas o que sua função permite. Dados comerciais sensíveis nunca
              circulam entre concorrentes. Toda ação técnica ou comercial deixa um histórico de
              auditoria protegido contra alteração por usuários comuns.
            </p>
          </div>
          <ul className="space-y-3 text-sm text-slate-300">
            {[
              "Controle de acesso por perfil (RBAC) com aprovação manual de cadastro.",
              "Criptografia de senhas, sessão segura e proteção de rotas.",
              "Ocultação de dados pessoais e comerciais antes da aprovação da operação.",
              "Log de auditoria com usuário, ação, IP, data, status anterior e novo.",
              "Preparado para autenticação em dois fatores e assinatura eletrônica.",
              "Desenvolvida para apoiar operações em conformidade com a PNRS e a LGPD.",
            ].map((s) => (
              <li key={s} className="flex gap-3">
                <span className="text-brand font-mono">›</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Fluxo operacional */}
      <section className="max-w-7xl mx-auto px-6 py-24">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-14">
          <div>
            <span className="text-brand font-mono text-xs uppercase tracking-widest">
              Standard Operating Procedure
            </span>
            <h2 className="text-3xl md:text-4xl font-display font-bold mt-2 italic">
              Um fluxo, quatro papéis, zero perda de custódia.
            </h2>
          </div>
          <p className="max-w-md text-slate-400 text-sm">
            Cada bateria e cada lote têm linha do tempo auditável, do gerador até o certificado
            final de destinação — com integração pronta para MTR e PNRS.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {flowSteps.map((s) => {
            const Icon = s.icon;
            return (
              <div
                key={s.n}
                className="p-6 rounded-xl border border-white/5 bg-panel/60 hover:border-brand/30 transition-colors"
              >
                <div className="flex items-center justify-between mb-6">
                  <span className="font-display text-3xl text-white/20 select-none">{s.n}</span>
                  <div className="w-10 h-10 rounded-lg bg-brand/10 flex items-center justify-center">
                    <Icon className="w-4 h-4 text-brand" />
                  </div>
                </div>
                <h3 className="font-bold mb-2">{s.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{s.body}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Preview do sistema interno */}
      <section className="max-w-7xl mx-auto px-6 pb-24">
        <div className="bg-panel/40 border border-white/10 rounded-3xl overflow-hidden">
          <div className="grid grid-cols-12">
            <div className="col-span-3 border-r border-white/5 p-6 space-y-3 hidden lg:block">
              <div className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest pb-4">
                Sistema Interno
              </div>
              {[
                "Dashboard",
                "Lotes ativos",
                "Coletas",
                "Propostas",
                "Certificados",
                "Financeiro",
                "Compliance",
              ].map((label, i) => (
                <div
                  key={label}
                  className={
                    i === 1
                      ? "flex items-center gap-3 px-3 py-2 rounded-md bg-brand/10 text-brand text-sm font-medium"
                      : "flex items-center gap-3 px-3 py-2 rounded-md text-slate-400 text-sm hover:bg-white/5"
                  }
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-current" />
                  {label}
                </div>
              ))}
            </div>

            <div className="col-span-12 lg:col-span-9 p-8">
              <div className="flex flex-wrap justify-between items-end mb-10 gap-4">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-widest text-brand">
                    Rastreabilidade por lote
                  </span>
                  <h2 className="text-2xl font-display font-bold mt-1 italic">Lote #BR-9942</h2>
                  <p className="text-slate-400 text-sm">
                    Status: Em análise de triagem (diagnóstico de células)
                  </p>
                </div>
                <div className="flex gap-6">
                  <div className="text-right">
                    <div className="text-brand font-display font-bold text-2xl tracking-tighter">
                      84.2%
                    </div>
                    <div className="text-[10px] text-slate-500 uppercase font-mono tracking-widest">
                      SoH estimada
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-white font-display font-bold text-2xl tracking-tighter">
                      420 kWh
                    </div>
                    <div className="text-[10px] text-slate-500 uppercase font-mono tracking-widest">
                      Capacidade
                    </div>
                  </div>
                </div>
              </div>

              <div className="relative pb-4">
                <div className="absolute left-4 top-2 bottom-2 w-px bg-white/10" />
                <div className="space-y-6">
                  {[
                    {
                      date: "12 Out — 14:20",
                      title: "Coleta realizada · Logística Alfa",
                      body: "Material coletado na Unidade G04 (SJC/SP). MTR anexo, lacres conferidos.",
                      active: true,
                    },
                    {
                      date: "13 Out — 09:00",
                      title: "Recebimento em hub de triagem",
                      body: "Aguardando diagnóstico técnico para classificação Segunda Vida vs Reciclagem.",
                      active: false,
                    },
                    {
                      date: "Previsto 15 Out",
                      title: "Cotação para recicladoras homologadas",
                      body: "Envio de RFQ automatizado com dados de química, massa e SoH.",
                      active: false,
                    },
                  ].map((e, i) => (
                    <div
                      key={i}
                      className={e.active ? "relative pl-12" : "relative pl-12 opacity-60"}
                    >
                      <div
                        className={
                          e.active
                            ? "absolute left-3 top-2 w-2 h-2 rounded-full bg-brand ring-4 ring-brand/20"
                            : "absolute left-3 top-2 w-2 h-2 rounded-full bg-slate-500"
                        }
                      />
                      <p
                        className={
                          e.active
                            ? "text-xs text-brand font-mono mb-1"
                            : "text-xs text-slate-500 font-mono mb-1"
                        }
                      >
                        {e.date}
                      </p>
                      <h4 className="font-bold">{e.title}</h4>
                      <p className="text-sm text-slate-400">{e.body}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-white/5 pt-8 mt-4">
                {[
                  {
                    label: "Lítio potencialmente recuperável",
                    value: "Indisponível",
                    accent: false,
                  },
                  {
                    label: "Cobalto potencialmente recuperável",
                    value: "Indisponível",
                    accent: false,
                  },
                  {
                    label: "CO₂ potencialmente evitado",
                    value: "Metodologia necessária",
                    accent: true,
                  },
                ].map((m) => (
                  <div key={m.label} className="p-4 bg-white/5 rounded-lg">
                    <div className="text-slate-500 text-[10px] uppercase font-mono tracking-widest mb-1">
                      {m.label}
                    </div>
                    <div
                      className={
                        m.accent
                          ? "text-2xl font-display font-bold text-brand"
                          : "text-2xl font-display font-bold"
                      }
                    >
                      {m.value}
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-slate-500 mt-3">
                Estimativas para fins gerenciais, sujeitas à validação técnica.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Módulos plataforma */}
      <section className="max-w-7xl mx-auto px-6 pb-24">
        <div className="max-w-2xl mb-12">
          <span className="text-brand font-mono text-xs uppercase tracking-widest">
            Plataforma modular
          </span>
          <h2 className="text-3xl md:text-4xl font-display font-bold mt-2 italic">
            Muito mais que um cadastro. É a infraestrutura do mercado.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            {
              icon: ShieldCheck,
              title: "Painéis por perfil",
              body: "Geradores, operador, recicladoras, transportadoras e admin — cada um com permissões dedicadas.",
            },
            {
              icon: Boxes,
              title: "Lotes & propostas",
              body: "Formação de lotes, RFQ para recicladoras, cotação, aceite e emissão de documentos.",
            },
            {
              icon: MapPin,
              title: "Ordens de coleta",
              body: "Transportadoras aceitam ordens, atualizam status em campo e anexam comprovantes de entrega.",
            },
            {
              icon: LineChart,
              title: "Dashboard ambiental",
              body: "Volume processado, materiais nobres recuperáveis, CO₂ evitado e relatórios por cliente.",
            },
            {
              icon: FileCheck2,
              title: "Financeiro flexível",
              body: "Três modelos comerciais: gerador paga, plataforma compra ou modelo neutro (intermediação).",
            },
            {
              icon: ShieldCheck,
              title: "Compliance & admin",
              body: "Contratos, licenças ambientais, ocorrências e auditoria de custódia em uma única área.",
            },
          ].map((m) => {
            const Icon = m.icon;
            return (
              <div
                key={m.title}
                className="p-6 rounded-xl border border-white/5 bg-panel/50 hover:border-brand/30 transition-colors"
              >
                <div className="w-10 h-10 rounded-lg bg-brand/10 flex items-center justify-center mb-5">
                  <Icon className="w-4 h-4 text-brand" />
                </div>
                <h3 className="font-bold mb-2">{m.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{m.body}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-4xl mx-auto px-6 pb-24">
        <div className="mb-10">
          <span className="text-brand font-mono text-xs uppercase tracking-widest">FAQ</span>
          <h2 className="text-3xl md:text-4xl font-display font-bold mt-2 italic">
            Perguntas frequentes.
          </h2>
        </div>
        <div className="divide-y divide-white/5 border-y border-white/5">
          {faqs.map((f) => (
            <details key={f.q} className="group py-5">
              <summary className="flex justify-between items-center cursor-pointer list-none">
                <span className="font-medium pr-4">{f.q}</span>
                <span className="text-brand font-mono text-xl group-open:rotate-45 transition-transform">
                  +
                </span>
              </summary>
              <p className="text-sm text-slate-400 leading-relaxed mt-3">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* CTA final */}
      <section className="max-w-7xl mx-auto px-6 pb-8">
        <div className="rounded-3xl border border-brand/20 bg-gradient-to-br from-panel to-industrial p-10 md:p-14 relative overflow-hidden">
          <div className="absolute inset-0 blueprint-grid opacity-40 pointer-events-none" />
          <div className="relative max-w-2xl">
            <h2 className="text-3xl md:text-4xl font-display font-bold mb-4">
              Pronto para dar destinação correta às suas baterias?
            </h2>
            <p className="text-slate-400 mb-8">
              Registre uma bateria em minutos ou fale com nossa equipe para desenhar um contrato de
              logística reversa sob medida.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                to="/gerador"
                className="px-6 py-3 bg-brand text-industrial rounded-lg font-semibold hover:brightness-110 transition-all inline-flex items-center gap-2"
              >
                Registrar bateria <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/contato"
                className="px-6 py-3 border border-white/20 rounded-lg font-semibold hover:bg-white/5 transition-all"
              >
                Falar com a equipe
              </Link>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
