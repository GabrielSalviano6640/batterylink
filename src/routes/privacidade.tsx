import { createFileRoute } from "@tanstack/react-router";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";

export const Route = createFileRoute("/privacidade")({
  head: () => ({
    meta: [
      { title: "Política de privacidade — BatteryLink Brasil" },
      {
        name: "description",
        content:
          "Como a BatteryLink Brasil trata dados pessoais e corporativos e apoia controles relacionados à LGPD.",
      },
    ],
  }),
  component: PrivacidadePage,
});

function PrivacidadePage() {
  return (
    <div className="min-h-screen bg-industrial text-slate-100">
      <SiteNav />
      <main className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-4xl font-display font-bold italic mb-6">Política de privacidade</h1>
        <p className="text-slate-400 text-sm mb-8">
          Última atualização: {new Date().toLocaleDateString("pt-BR")}
        </p>

        <section className="space-y-6 text-slate-300 text-sm leading-relaxed">
          <p>
            Esta Política descreve como a BatteryLink Brasil coleta, utiliza e protege dados
            pessoais e corporativos. A plataforma foi desenvolvida para apoiar controles
            relacionados à Lei nº 13.709/2018 (LGPD).
          </p>

          <h2 className="text-xl font-bold text-white pt-4">1. Dados coletados</h2>
          <p>
            Dados de identificação (nome, CPF/CNPJ, contato), dados operacionais (baterias, coletas,
            propostas), documentos regulatórios e logs de auditoria.
          </p>

          <h2 className="text-xl font-bold text-white pt-4">2. Finalidade</h2>
          <p>
            Executar a intermediação entre geradores, operadores logísticos, triagem e recicladores;
            garantir rastreabilidade; cumprir obrigações legais e ambientais.
          </p>

          <h2 className="text-xl font-bold text-white pt-4">3. Compartilhamento</h2>
          <p>
            Dados são compartilhados apenas entre as partes envolvidas em cada operação e conforme o
            perfil de acesso. Informações comerciais sensíveis não são expostas a concorrentes.
          </p>

          <h2 className="text-xl font-bold text-white pt-4">4. Segurança</h2>
          <p>
            Utilizamos autenticação segura, criptografia de senhas, controle de acesso por perfil,
            registro de auditoria e preparação para autenticação em dois fatores.
          </p>

          <h2 className="text-xl font-bold text-white pt-4">5. Direitos do titular</h2>
          <p>
            O titular pode solicitar acesso, correção, portabilidade, anonimização ou exclusão dos
            dados, respeitadas as obrigações legais de retenção.
          </p>

          <h2 className="text-xl font-bold text-white pt-4">6. Contato do encarregado (DPO)</h2>
          <p>
            Solicitações relacionadas à LGPD podem ser enviadas pelo formulário de contato da
            plataforma.
          </p>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
