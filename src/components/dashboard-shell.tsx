import { Link } from "@tanstack/react-router";
import { ChevronRight, CircleHelp, LayoutDashboard, Radar, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";

const roleLabels: Record<string, string> = {
  gerador: "Gerador",
  operador: "Operador de triagem",
  transportadora: "Transportadora",
  reciclador: "Recicladora",
  admin: "Administração",
};

export function DemoEnvironmentBanner() {
  return (
    <div
      className="mb-5 rounded-md border border-amber-300/40 bg-amber-300/10 px-4 py-3 text-sm text-amber-100"
      role="status"
    >
      <strong>Ambiente demonstrativo</strong> — os dados apresentados não representam operações
      reais.
    </div>
  );
}

export function DashboardShell({
  role,
  isDemo,
  children,
}: {
  role: string;
  isDemo: boolean;
  children: ReactNode;
}) {
  const label = roleLabels[role] ?? role;
  const items = [
    { href: "#painel-inicio", label: "Visão geral", icon: LayoutDashboard },
    { href: "#painel-conteudo", label: "Operação", icon: ShieldCheck },
  ];

  return (
    <div id="painel-inicio" className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="lg:sticky lg:top-24 lg:self-start" aria-label="Menu lateral do painel">
        <div className="rounded-xl border border-white/10 bg-white/[0.025] p-3">
          <p className="mb-3 px-2 text-[10px] font-mono uppercase tracking-widest text-slate-500">
            {label}
          </p>
          <nav className="flex gap-2 overflow-x-auto lg:flex-col">
            {items.map(({ href, label: itemLabel, icon: Icon }) => (
              <a
                key={href}
                href={href}
                className="inline-flex min-w-max items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-300 hover:bg-white/5 hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                <Icon className="h-4 w-4" /> {itemLabel}
              </a>
            ))}
            <Link
              to="/portal"
              className="inline-flex min-w-max items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-300 hover:bg-white/5 hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <Radar className="h-4 w-4" /> Rastreabilidade
            </Link>
            <Link
              to="/contato"
              className="inline-flex min-w-max items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-300 hover:bg-white/5 hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <CircleHelp className="h-4 w-4" /> Suporte
            </Link>
          </nav>
        </div>
      </aside>
      <div className="min-w-0">
        <nav
          aria-label="Breadcrumb"
          className="mb-4 flex items-center gap-1 text-xs text-slate-500"
        >
          <Link to="/" className="hover:text-brand">
            Início
          </Link>
          <ChevronRight className="h-3 w-3" />
          <span>Painel</span>
          <ChevronRight className="h-3 w-3" />
          <span className="text-slate-300">{label}</span>
        </nav>
        {isDemo && <DemoEnvironmentBanner />}
        <div id="painel-conteudo">{children}</div>
      </div>
    </div>
  );
}
