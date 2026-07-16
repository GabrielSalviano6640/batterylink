import { Link } from "@tanstack/react-router";

export function SiteNav() {
  return (
    <nav className="border-b border-white/10 bg-industrial/80 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center gap-4">
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <div className="w-8 h-8 bg-brand rounded-sm flex items-center justify-center">
            <div className="w-4 h-4 bg-industrial rotate-45" />
          </div>
          <span className="font-display font-bold text-lg tracking-tight">
            BATTERYLINK <span className="text-brand">BRASIL</span>
          </span>
        </Link>
        <div className="hidden md:flex gap-6 text-sm font-medium text-slate-400">
          <Link to="/gerador" className="hover:text-brand transition-colors">
            Geradores
          </Link>
          <Link to="/recicladora" className="hover:text-brand transition-colors">
            Recicladoras
          </Link>
          <Link to="/transportadora" className="hover:text-brand transition-colors">
            Logística
          </Link>
          <Link to="/operador" className="hover:text-brand transition-colors">
            Triagem
          </Link>
          <Link to="/portal" className="hover:text-brand transition-colors">
            Rastreabilidade
          </Link>
        </div>
        <Link
          to="/auth"
          search={{ mode: undefined }}
          className="px-5 py-2 border border-brand/40 text-brand rounded-full text-sm hover:bg-brand/10 transition-colors"
        >
          Entrar
        </Link>
      </div>
    </nav>
  );
}
