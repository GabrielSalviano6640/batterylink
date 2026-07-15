import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { FormShell, Field, inputCls, selectCls, textareaCls } from "@/components/form-shell";
import { IntakeSuccess } from "@/components/intake-success";
import { maskCNPJ, maskPhone, maskInput } from "@/lib/masks";
import { submitLead } from "@/lib/leads";

export const Route = createFileRoute("/transportadora")({
  head: () => ({
    meta: [
      { title: "Credenciar transportadora ou operador logístico — BatteryLink Brasil" },
      {
        name: "description",
        content:
          "Credencie sua frota para transporte especializado de baterias de lítio e produtos perigosos (Classe 9).",
      },
    ],
  }),
  component: TransportadoraPage,
});

function makeProtocol() {
  return "LOG-" + Math.random().toString(36).slice(2, 8).toUpperCase();
}

function TransportadoraPage() {
  const [submitted, setSubmitted] = useState<string | null>(null);

  if (submitted) {
    return (
      <FormShell
        tag="Logística reversa"
        title="Cadastro logístico recebido."
        subtitle="Vamos validar suas licenças e habilitações para produtos perigosos."
      >
        <IntakeSuccess
          protocol={submitted}
          title="Cadastro em análise."
          nextSteps={[
            "Verificaremos AATIPP, MOPP e apólice de seguro para transporte de Classe 9.",
            "Alinharemos regiões atendidas e modais disponíveis (rodoviário refrigerado, caçamba, etc.).",
            "Após aprovação, seu perfil recebe ordens de coleta compatíveis com sua base.",
            "No portal você aceita ordens, atualiza status em campo e anexa comprovantes de entrega.",
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
      await submitLead("transportadora", form);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao enviar. Tente novamente.");
      return;
    }
    toast.success("Cadastro enviado", { description: `Protocolo ${protocol}` });
    setSubmitted(protocol);
  }

  return (
    <FormShell
      tag="Logística reversa"
      title="Sou transportadora ou operador logístico."
      subtitle="Cadastre sua operação para receber ordens de coleta e transporte especializado de baterias de lítio."
    >
      <form onSubmit={onSubmit} className="grid gap-8">
        <section className="grid gap-4">
          <h2 className="text-sm font-mono font-bold text-brand uppercase tracking-widest">
            Dados da transportadora
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
            <Field label="Responsável operacional" required>
              <input name="responsavel" required className={inputCls} />
            </Field>
            <Field label="Telefone 24h" required>
              <input
                name="phone"
                required
                className={inputCls}
                placeholder="(11) 90000-0000"
                inputMode="tel"
                onInput={maskInput(maskPhone)}
              />
            </Field>
            <Field label="E-mail" required>
              <input name="email" type="email" required className={inputCls} />
            </Field>
            <Field label="ANTT / RNTRC" required>
              <input required className={inputCls} />
            </Field>
          </div>
        </section>

        <section className="grid gap-4">
          <h2 className="text-sm font-mono font-bold text-brand uppercase tracking-widest">
            Capacidade & cobertura
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            <Field label="Modais oferecidos" required>
              <select required className={selectCls}>
                <option value="">Selecione…</option>
                <option>Rodoviário — carga fracionada</option>
                <option>Rodoviário — carga dedicada</option>
                <option>Rodoviário — carreta / cavalo mecânico</option>
                <option>Multimodal</option>
              </select>
            </Field>
            <Field label="Estados atendidos" required>
              <input required className={inputCls} placeholder="Ex: SP, RJ, MG, PR" />
            </Field>
            <Field label="Capacidade mensal (t)">
              <input type="number" className={inputCls} placeholder="Ex: 40" />
            </Field>
            <Field label="Container / embalagem própria">
              <select className={selectCls}>
                <option>Sim — bombonas UN homologadas</option>
                <option>Sim — container Classe 9</option>
                <option>Não — utilizamos embalagem do gerador</option>
              </select>
            </Field>
          </div>
        </section>

        <section className="grid gap-4">
          <h2 className="text-sm font-mono font-bold text-brand uppercase tracking-widest">
            Licenças & habilitações
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            <Field label="AATIPP (produtos perigosos)" required>
              <input type="file" required className={inputCls + " py-2"} />
            </Field>
            <Field label="Cópia de MOPP dos motoristas" required>
              <input type="file" required multiple className={inputCls + " py-2"} />
            </Field>
            <Field label="Apólice de seguro de responsabilidade civil" required>
              <input type="file" required className={inputCls + " py-2"} />
            </Field>
            <Field label="Vencimento AATIPP" required>
              <input type="date" required className={inputCls} />
            </Field>
          </div>
          <Field label="Observações">
            <textarea
              className={textareaCls}
              placeholder="Diferenciais, base operacional, atendimento emergencial 24/7, etc."
            />
          </Field>
        </section>

        <div className="flex flex-wrap gap-3 items-center pt-4 border-t border-white/5">
          <button
            type="submit"
            className="px-6 py-3 bg-brand text-industrial rounded-lg font-semibold hover:brightness-110 transition-all"
          >
            Enviar cadastro
          </button>
          <p className="text-xs text-slate-500 max-w-md">
            Documentos serão auditados por profissional habilitado antes da liberação.
          </p>
        </div>
      </form>
    </FormShell>
  );
}
