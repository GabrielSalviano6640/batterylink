import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { FormShell, Field, inputCls, selectCls, textareaCls } from "@/components/form-shell";
import { IntakeSuccess } from "@/components/intake-success";
import { maskPhone, maskInput } from "@/lib/masks";
import { submitLead } from "@/lib/leads";

export const Route = createFileRoute("/contato")({
  head: () => ({
    meta: [
      { title: "Falar com a equipe — BatteryLink Brasil" },
      {
        name: "description",
        content:
          "Fale com a equipe BatteryLink Brasil sobre contratos, integrações, projetos institucionais e parcerias.",
      },
    ],
  }),
  component: ContatoPage,
});

function makeProtocol() {
  return "ATD-" + Math.random().toString(36).slice(2, 8).toUpperCase();
}

function ContatoPage() {
  const [submitted, setSubmitted] = useState<string | null>(null);

  if (submitted) {
    return (
      <FormShell
        tag="Institucional"
        title="Mensagem recebida."
        subtitle="Um especialista da nossa equipe vai te responder."
      >
        <IntakeSuccess
          protocol={submitted}
          title="Obrigado pelo contato."
          nextSteps={[
            "Um consultor vai responder por e-mail em até 1 dia útil.",
            "Se for urgente, ligue no (11) 4000-0000 em horário comercial.",
            "Para propostas institucionais, prepararemos uma reunião com o time técnico e comercial.",
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
      await submitLead("contato", form);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao enviar. Tente novamente.");
      return;
    }
    toast.success("Mensagem enviada", { description: `Protocolo ${protocol}` });
    setSubmitted(protocol);
  }

  return (
    <FormShell
      tag="Institucional"
      title="Quero falar com a equipe BatteryLink."
      subtitle="Para contratos, integrações, parcerias, imprensa ou projetos institucionais — conte pra gente o que você precisa."
    >
      <form onSubmit={onSubmit} className="grid gap-6 max-w-2xl">
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="Nome" required>
            <input name="responsavel" required className={inputCls} />
          </Field>
          <Field label="Empresa / Instituição">
            <input name="razao_social" className={inputCls} />
          </Field>
          <Field label="E-mail" required>
            <input name="email" type="email" required className={inputCls} />
          </Field>
          <Field label="Telefone">
            <input name="phone" className={inputCls} placeholder="(11) 90000-0000" inputMode="tel" onInput={maskInput(maskPhone)} />
          </Field>
          <Field label="Assunto" required>
            <select name="assunto" required className={selectCls}>
              <option value="">Selecione…</option>
              <option>Contrato de logística reversa</option>
              <option>Integração / API</option>
              <option>Parceria institucional</option>
              <option>Imprensa</option>
              <option>Outro</option>
            </select>
          </Field>
          <Field label="Perfil">
            <select name="perfil_contato" className={selectCls}>
              <option>Gerador</option>
              <option>Recicladora</option>
              <option>Transportadora</option>
              <option>Órgão público</option>
              <option>Investidor</option>
              <option>Outro</option>
            </select>
          </Field>
        </div>
        <Field label="Como podemos ajudar?" required>
          <textarea name="mensagem" required className={textareaCls} placeholder="Descreva sua necessidade" />
        </Field>

        <div className="flex flex-wrap gap-3 items-center pt-4 border-t border-white/5">
          <button
            type="submit"
            className="px-6 py-3 bg-brand text-industrial rounded-lg font-semibold hover:brightness-110 transition-all"
          >
            Enviar mensagem
          </button>
        </div>
      </form>
    </FormShell>
  );
}
