import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { FormShell, Field, inputCls, selectCls, textareaCls } from "@/components/form-shell";
import { IntakeSuccess } from "@/components/intake-success";
import { maskCNPJ, maskPhone, maskInput } from "@/lib/masks";
import { submitLead } from "@/lib/leads";

export const Route = createFileRoute("/operador")({
  head: () => ({
    meta: [
      { title: "Credenciar operador de triagem e rastreabilidade — BatteryLink Brasil" },
      {
        name: "description",
        content:
          "Credencie sua equipe técnica para diagnóstico, classificação e rastreabilidade de baterias.",
      },
    ],
  }),
  component: OperadorPage,
});

function makeProtocol() {
  return "OPR-" + Math.random().toString(36).slice(2, 8).toUpperCase();
}

function OperadorPage() {
  const [submitted, setSubmitted] = useState<string | null>(null);

  if (submitted) {
    return (
      <FormShell
        tag="Triagem & Rastreabilidade"
        title="Credenciamento recebido."
        subtitle="Vamos validar suas credenciais técnicas."
      >
        <IntakeSuccess
          protocol={submitted}
          title="Cadastro em análise."
          nextSteps={[
            "Validaremos qualificações técnicas e experiência com baterias de lítio.",
            "Alinharemos os tipos de operação (diagnóstico, classificação, gestão de lotes).",
            "Após aprovação, sua equipe receberá operações atribuídas no portal.",
            "Você poderá registrar diagnósticos, criar lotes e emitir laudos.",
          ]}
        />
      </FormShell>
    );
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const protocol = makeProtocol();
    try {
      await submitLead("operador", form);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao enviar. Tente novamente.");
      return;
    }
    toast.success("Credenciamento enviado", { description: `Protocolo ${protocol}` });
    setSubmitted(protocol);
  }

  return (
    <FormShell
      tag="Triagem & Rastreabilidade"
      title="Sou operador de triagem."
      subtitle="Cadastre sua operação técnica para realizar diagnóstico, classificação e gestão de custódia de baterias."
    >
      <form onSubmit={onSubmit} className="grid gap-8">
        <section className="grid gap-4">
          <h2 className="text-sm font-mono font-bold text-brand uppercase tracking-widest">
            Dados da operação
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            <Field label="Razão social" required>
              <input name="razao_social" required className={inputCls} />
            </Field>
            <Field label="CNPJ" required>
              <input
                name="documento"
                required
                className={inputCls}
                placeholder="00.000.000/0000-00"
                inputMode="numeric"
                onInput={maskInput(maskCNPJ)}
              />
            </Field>
            <Field label="Responsável técnico" required>
              <input name="responsavel" required className={inputCls} />
            </Field>
            <Field label="Registro profissional (CREA/CRQ)">
              <input className={inputCls} />
            </Field>
            <Field label="E-mail" required>
              <input name="email" type="email" required className={inputCls} />
            </Field>
            <Field label="Telefone" required>
              <input
                name="phone"
                required
                className={inputCls}
                placeholder="(11) 90000-0000"
                inputMode="tel"
                onInput={maskInput(maskPhone)}
              />
            </Field>
          </div>
        </section>

        <section className="grid gap-4">
          <h2 className="text-sm font-mono font-bold text-brand uppercase tracking-widest">
            Capacidades técnicas
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            <Field label="Escopo principal" required>
              <select required className={selectCls}>
                <option value="">Selecione…</option>
                <option>Diagnóstico e SoH (estado de saúde)</option>
                <option>Classificação e formação de lotes</option>
                <option>Desmontagem e triagem de módulos</option>
                <option>Repack para segunda vida</option>
                <option>Rastreabilidade e custódia</option>
              </select>
            </Field>
            <Field label="Químicas atendidas" required>
              <select required className={selectCls}>
                <option value="">Selecione…</option>
                <option>LFP</option>
                <option>NMC / NCA</option>
                <option>LTO</option>
                <option>Todas as químicas de lítio</option>
              </select>
            </Field>
            <Field label="Capacidade mensal (unidades/lotes)">
              <input type="number" className={inputCls} placeholder="Ex: 50" />
            </Field>
            <Field label="Equipamentos disponíveis">
              <input
                className={inputCls}
                placeholder="Ex: cicladores, câmara térmica, BMS analyzer"
              />
            </Field>
          </div>
        </section>

        <section className="grid gap-4">
          <h2 className="text-sm font-mono font-bold text-brand uppercase tracking-widest">
            Documentação
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            <Field label="Licença de operação">
              <input type="file" className={inputCls + " py-2"} />
            </Field>
            <Field label="Certificações (ISO, NR-10, etc.)">
              <input type="file" multiple className={inputCls + " py-2"} />
            </Field>
          </div>
          <Field label="Observações">
            <textarea
              className={textareaCls}
              placeholder="Metodologias, softwares utilizados, parcerias técnicas."
            />
          </Field>
        </section>

        <div className="flex flex-wrap gap-3 items-center pt-4 border-t border-white/5">
          <button
            type="submit"
            className="px-6 py-3 bg-brand text-industrial rounded-lg font-semibold hover:brightness-110 transition-all"
          >
            Enviar credenciamento
          </button>
          <p className="text-xs text-slate-500 max-w-md">
            Documentos serão validados por profissional habilitado antes da liberação.
          </p>
        </div>
      </form>
    </FormShell>
  );
}
