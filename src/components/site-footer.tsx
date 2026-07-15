import { Link } from "@tanstack/react-router";

export function SiteFooter() {
  return (
    <footer className="border-t border-white/10 py-12 mt-24">
      <div className="max-w-7xl mx-auto px-6 space-y-8">
        <div className="rounded-lg border border-brand/20 bg-brand/5 p-5">
          <p className="text-[10px] font-mono uppercase tracking-widest text-brand mb-2">
            Aviso Legal e Técnico
          </p>
          <p className="text-xs text-slate-300 leading-relaxed">
            Todos os documentos, manifestos de transporte (MTR), laudos de diagnóstico e
            certificados de destinação final (CDF) gerados na plataforma são pré-emitidos e
            devem ser obrigatoriamente validados por profissionais habilitados (engenheiros
            ambientais, químicos ou responsáveis técnicos credenciados) antes de uso oficial
            para fins de licenciamento e reporte às autoridades competentes (IBAMA, CETESB e
            órgãos estaduais). A plataforma opera em conformidade com a PNRS (Lei 12.305/10).
          </p>
        </div>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="text-slate-500 text-sm">
            © {new Date().getFullYear()} BatteryLink Brasil. Circular Intelligence for Energy.
          </div>
          <div className="flex gap-6 text-xs font-mono uppercase tracking-widest text-slate-500">
            <Link to="/termos" className="hover:text-brand">Termos</Link>
            <Link to="/privacidade" className="hover:text-brand">Privacidade</Link>
            <Link to="/contato" className="hover:text-brand">Contato</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
