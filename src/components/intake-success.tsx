import { CheckCircle2 } from "lucide-react";
import { Link } from "@tanstack/react-router";

interface IntakeSuccessProps {
  protocol: string;
  title: string;
  nextSteps: string[];
}

export function IntakeSuccess({ protocol, title, nextSteps }: IntakeSuccessProps) {
  return (
    <div className="max-w-2xl mx-auto text-center py-16">
      <div className="w-16 h-16 rounded-full bg-brand/10 ring-4 ring-brand/20 flex items-center justify-center mx-auto mb-6">
        <CheckCircle2 className="w-8 h-8 text-brand" />
      </div>
      <h1 className="text-3xl md:text-4xl font-display font-bold mb-3">{title}</h1>
      <p className="text-slate-400 mb-2">
        Registro criado com sucesso. Guarde seu protocolo de acompanhamento:
      </p>
      <div className="inline-block font-mono text-brand text-lg tracking-widest bg-panel border border-brand/30 rounded-lg px-6 py-3 mb-10">
        {protocol}
      </div>

      <div className="text-left bg-panel border border-white/10 rounded-2xl p-6 space-y-4 mb-8">
        <p className="text-xs font-mono uppercase tracking-widest text-brand">Próximos passos</p>
        <ol className="space-y-3">
          {nextSteps.map((step, i) => (
            <li key={i} className="flex gap-3 text-sm text-slate-300">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-brand/10 text-brand font-mono text-xs flex items-center justify-center">
                {i + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="flex justify-center gap-3">
        <Link
          to="/"
          className="px-5 py-2.5 border border-white/20 rounded-lg text-sm hover:bg-white/5 transition-colors"
        >
          Voltar ao início
        </Link>
        <Link
          to="/portal"
          className="px-5 py-2.5 bg-brand text-industrial rounded-lg text-sm font-semibold hover:brightness-110 transition-all"
        >
          Acompanhar no portal
        </Link>
      </div>
    </div>
  );
}
