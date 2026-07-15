import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { FormShell, Field, inputCls, selectCls, textareaCls } from "@/components/form-shell";
import { IntakeSuccess } from "@/components/intake-success";
import { maskCPFOrCNPJ, maskPhone, maskCEP, maskInput } from "@/lib/masks";
import { submitLead } from "@/lib/leads";

export const Route = createFileRoute("/gerador")({
  head: () => ({
    meta: [
      { title: "Registrar bateria para destinação — BatteryLink Brasil" },
      {
        name: "description",
        content:
          "Envie os dados da sua bateria de veículo elétrico, frota ou sistema de armazenamento para triagem e destinação correta.",
      },
    ],
  }),
  component: GeradorPage,
});

function makeProtocol() {
  return "GER-" + Math.random().toString(36).slice(2, 8).toUpperCase();
}

function GeradorPage() {
  const [submitted, setSubmitted] = useState<string | null>(null);

  if (submitted) {
    return (
      <FormShell
        tag="Geradores"
        title="Recebemos os dados da sua bateria."
        subtitle="Nossa equipe técnica iniciará a análise de triagem."
      >
        <IntakeSuccess
          protocol={submitted}
          title="Registro concluído."
          nextSteps={[
            "Um analista revisará as informações e fotos em até 2 dias úteis.",
            "Enviaremos por e-mail o pré-diagnóstico com classificação sugerida (segunda vida ou reciclagem).",
            "Após aprovação, agendamos a coleta com uma transportadora homologada.",
            "Ao final do processo você receberá o Certificado de Destinação Final (CDF) e o relatório ambiental.",
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
      await submitLead("gerador", form);
      toast.success("Registro enviado", { description: `Protocolo ${protocol}` });
      setSubmitted(protocol);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao enviar. Tente novamente.");
    }
  }

  return (
    <FormShell
      tag="Geradores"
      title="Tenho uma bateria para destinar."
      subtitle="Preencha os dados abaixo para iniciar o processo de rastreabilidade e destinação. Todos os campos com * são obrigatórios."
    >
      <form onSubmit={onSubmit} className="grid gap-8">
        <section className="grid gap-4">
          <h2 className="text-sm font-mono font-bold text-brand uppercase tracking-widest">
            Dados da empresa
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            <Field label="Razão social / Nome" required>
              <input required className={inputCls} name="razao_social" placeholder="Ex: Frota Alfa Ltda." />
            </Field>
            <Field label="CNPJ / CPF" required>
              <input required className={inputCls} name="documento" placeholder="00.000.000/0000-00" inputMode="numeric" onInput={maskInput(maskCPFOrCNPJ)} />
            </Field>
            <Field label="Responsável" required>
              <input required className={inputCls} name="responsavel" placeholder="Nome completo" />
            </Field>
            <Field label="Cargo">
              <input className={inputCls} placeholder="Ex: Gerente de manutenção" />
            </Field>
            <Field label="E-mail" required>
              <input type="email" required className={inputCls} name="email" placeholder="voce@empresa.com" />
            </Field>
            <Field label="Telefone / WhatsApp" required>
              <input required className={inputCls} name="phone" placeholder="(11) 90000-0000" inputMode="tel" onInput={maskInput(maskPhone)} />
            </Field>
          </div>
        </section>

        <section className="grid gap-4">
          <h2 className="text-sm font-mono font-bold text-brand uppercase tracking-widest">
            Especificações da bateria
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            <Field label="Tipo de origem" required>
              <select required className={selectCls}>
                <option value="">Selecione…</option>
                <option>Veículo elétrico (EV)</option>
                <option>Veículo híbrido</option>
                <option>Frota comercial</option>
                <option>Máquina industrial</option>
                <option>Armazenamento estacionário (BESS)</option>
                <option>Outro</option>
              </select>
            </Field>
            <Field label="Fabricante / Modelo">
              <input className={inputCls} placeholder="Ex: CATL LFP 60 kWh" />
            </Field>
            <Field label="Química da bateria" required>
              <select required className={selectCls}>
                <option value="">Selecione…</option>
                <option>LFP (Fosfato de Ferro-Lítio)</option>
                <option>NMC (Níquel-Manganês-Cobalto)</option>
                <option>NCA (Níquel-Cobalto-Alumínio)</option>
                <option>LTO (Titanato de Lítio)</option>
                <option>Chumbo-ácido</option>
                <option>Não sei informar</option>
              </select>
            </Field>
            <Field label="Capacidade (kWh)" hint="Se souber">
              <input type="number" step="0.1" className={inputCls} placeholder="Ex: 60" />
            </Field>
            <Field label="Quantidade de unidades" required>
              <input type="number" required min={1} defaultValue={1} className={inputCls} />
            </Field>
            <Field label="Peso total aproximado (kg)">
              <input type="number" className={inputCls} placeholder="Ex: 480" />
            </Field>
            <Field label="Estado aparente" required>
              <select required className={selectCls}>
                <option value="">Selecione…</option>
                <option>Íntegra / operacional</option>
                <option>Fim de vida útil</option>
                <option>Avariada</option>
                <option>Sinistrada (incêndio / colisão)</option>
                <option>Inchada / com vazamento</option>
              </select>
            </Field>
            <Field label="Urgência" required>
              <select required className={selectCls}>
                <option>Baixa — próximos 30 dias</option>
                <option>Média — próximos 15 dias</option>
                <option>Alta — próximos 7 dias</option>
                <option>Emergencial — risco iminente</option>
              </select>
            </Field>
          </div>
          <Field label="Fotos da bateria" hint="Aceita múltiplos arquivos">
            <input type="file" multiple accept="image/*" className={inputCls + " py-2"} />
          </Field>
          <Field label="Documentos (nota fiscal, MTR, laudo)" hint="PDF, imagens">
            <input type="file" multiple className={inputCls + " py-2"} />
          </Field>
        </section>

        <section className="grid gap-4">
          <h2 className="text-sm font-mono font-bold text-brand uppercase tracking-widest">
            Localização & logística
          </h2>
          <div className="grid md:grid-cols-3 gap-4">
            <Field label="CEP de origem" required>
              <input required className={inputCls} name="cep" placeholder="00000-000" inputMode="numeric" onInput={maskInput(maskCEP)} />
            </Field>
            <Field label="Cidade" required>
              <input required name="cidade" className={inputCls} />
            </Field>
            <Field label="UF" required>
              <input required name="estado" maxLength={2} className={inputCls + " uppercase"} placeholder="SP" />
            </Field>
          </div>
          <Field label="Endereço de coleta">
            <input className={inputCls} placeholder="Rua, nº, complemento" />
          </Field>
          <Field label="Observações operacionais">
            <textarea
              className={textareaCls}
              placeholder="Restrições de acesso, horário, necessidade de empilhadeira, etc."
            />
          </Field>
        </section>

        <div className="flex flex-wrap gap-3 items-center pt-4 border-t border-white/5">
          <button
            type="submit"
            className="px-6 py-3 bg-brand text-industrial rounded-lg font-semibold hover:brightness-110 transition-all"
          >
            Enviar dados para triagem
          </button>
          <p className="text-xs text-slate-500 max-w-md">
            Ao enviar, você concorda em compartilhar as informações com nossa equipe técnica para
            análise. Nenhum documento oficial é emitido sem validação por profissional habilitado.
          </p>
        </div>
      </form>
    </FormShell>
  );
}
