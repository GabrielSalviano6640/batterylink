import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { FormShell, Field, inputCls, selectCls, textareaCls } from "@/components/form-shell";
import { IntakeSuccess } from "@/components/intake-success";
import { maskCNPJ, maskPhone, maskInput } from "@/lib/masks";
import { submitLead } from "@/lib/leads";

export const Route = createFileRoute("/recicladora")({
  head: () => ({
    meta: [
      { title: "Credenciar recicladora ou parceira de segunda vida — BatteryLink Brasil" },
      {
        name: "description",
        content:
          "Credencie sua planta de reciclagem ou operação de segunda vida para receber lotes de baterias qualificadas.",
      },
    ],
  }),
  component: RecicladoraPage,
});

function makeProtocol() {
  return "REC-" + Math.random().toString(36).slice(2, 8).toUpperCase();
}

function RecicladoraPage() {
  const [submitted, setSubmitted] = useState<string | null>(null);

  if (submitted) {
    return (
      <FormShell
        tag="Recicladoras & Parceiros técnicos"
        title="Credenciamento recebido."
        subtitle="Nossa equipe fará a validação técnica e regulatória."
      >
        <IntakeSuccess
          protocol={submitted}
          title="Estamos analisando seu credenciamento."
          nextSteps={[
            "Verificaremos as licenças ambientais (CETESB, IBAMA, alvarás locais) em até 5 dias úteis.",
            "Um consultor entrará em contato para alinhar químicas aceitas e capacidade mensal.",
            "Após aprovação, seu perfil ficará ativo no portal para receber RFQs de lotes.",
            "Você poderá enviar propostas, aceitar materiais e anexar comprovantes de destinação.",
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
      await submitLead("recicladora", form);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao enviar. Tente novamente.");
      return;
    }
    toast.success("Credenciamento enviado", { description: `Protocolo ${protocol}` });
    setSubmitted(protocol);
  }

  return (
    <FormShell
      tag="Recicladoras & Parceiros técnicos"
      title="Sou recicladora ou parceira técnica."
      subtitle="Credencie sua planta para acessar lotes qualificados de baterias EV, frotas e sistemas de armazenamento."
    >
      <form onSubmit={onSubmit} className="grid gap-8">
        <section className="grid gap-4">
          <h2 className="text-sm font-mono font-bold text-brand uppercase tracking-widest">
            Dados da empresa
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
            <Field label="E-mail comercial" required>
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
            Perfil operacional
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            <Field label="Modalidade" required>
              <select required className={selectCls}>
                <option value="">Selecione…</option>
                <option>Reciclagem química (hidrometalurgia)</option>
                <option>Reciclagem pirometalúrgica</option>
                <option>Reciclagem mecânica / black mass</option>
                <option>Segunda vida (repack / BESS)</option>
                <option>Diagnóstico e triagem</option>
              </select>
            </Field>
            <Field label="Capacidade instalada (t/mês)">
              <input type="number" className={inputCls} placeholder="Ex: 30" />
            </Field>
            <Field label="Químicas aceitas" required hint="Selecione a principal">
              <select required className={selectCls}>
                <option value="">Selecione…</option>
                <option>LFP</option>
                <option>NMC / NCA</option>
                <option>LTO</option>
                <option>Chumbo-ácido</option>
                <option>Todas as químicas de lítio</option>
              </select>
            </Field>
            <Field label="Raio geográfico de atuação">
              <select className={selectCls}>
                <option>Estadual</option>
                <option>Regional (Sul / Sudeste / etc.)</option>
                <option>Nacional</option>
              </select>
            </Field>
          </div>
        </section>

        <section className="grid gap-4">
          <h2 className="text-sm font-mono font-bold text-brand uppercase tracking-widest">
            Licenças & documentação
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            <Field label="Licença de operação (LO)" required>
              <input type="file" required className={inputCls + " py-2"} />
            </Field>
            <Field label="Cadastro Técnico Federal (CTF/IBAMA)">
              <input type="file" className={inputCls + " py-2"} />
            </Field>
            <Field label="Certificações (ISO 14001, 45001, etc.)">
              <input type="file" multiple className={inputCls + " py-2"} />
            </Field>
            <Field label="Vencimento da LO" required>
              <input type="date" required className={inputCls} />
            </Field>
          </div>
          <Field label="Observações">
            <textarea
              className={textareaCls}
              placeholder="Diferenciais técnicos, tecnologias proprietárias, parceiros de destinação."
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
            A validação regulatória final é feita por profissional habilitado.
          </p>
        </div>
      </form>
    </FormShell>
  );
}
