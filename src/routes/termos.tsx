import { createFileRoute } from "@tanstack/react-router";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";

export const Route = createFileRoute("/termos")({
  head: () => ({
    meta: [
      { title: "Termos de uso — BatteryLink Brasil" },
      {
        name: "description",
        content: "Termos e condições de uso da plataforma BatteryLink Brasil.",
      },
    ],
  }),
  component: TermosPage,
});

function TermosPage() {
  return (
    <div className="min-h-screen bg-industrial text-slate-100">
      <SiteNav />
      <main className="max-w-3xl mx-auto px-6 py-16 prose prose-invert">
        <h1 className="text-4xl font-display font-bold italic mb-6">Termos de uso</h1>
        <p className="text-slate-400 text-sm mb-8">
          Última atualização: {new Date().toLocaleDateString("pt-BR")}
        </p>

        <section className="space-y-6 text-slate-300 text-sm leading-relaxed">
          <p>
            Estes Termos regulam o uso da plataforma BatteryLink Brasil, destinada à intermediação,
            rastreabilidade, triagem, logística e destinação de baterias.
          </p>
          <h2 className="text-xl font-bold text-white pt-4">1. Aceitação</h2>
          <p>
            Ao criar cadastro, o usuário declara ter poderes para representar a empresa informada e
            concorda com estes Termos.
          </p>
          <h2 className="text-xl font-bold text-white pt-4">2. Perfis e permissões</h2>
          <p>
            Cada perfil (gerador, reciclador, transportadora, operador, administrador) acessa
            somente as informações compatíveis com sua função.
          </p>
          <h2 className="text-xl font-bold text-white pt-4">3. Responsabilidade técnica e legal</h2>
          <p>
            Documentos, laudos e certificados gerados na plataforma têm caráter operacional e devem
            ser validados por profissionais habilitados antes do uso oficial junto a órgãos
            ambientais (IBAMA, CETESB e equivalentes estaduais).
          </p>
          <h2 className="text-xl font-bold text-white pt-4">4. Uso indevido</h2>
          <p>
            É vedado tentar acessar dados de outros usuários, manipular URLs para contornar o
            controle de acesso ou fornecer informações falsas.
          </p>
          <h2 className="text-xl font-bold text-white pt-4">5. Suspensão</h2>
          <p>
            A plataforma pode suspender cadastros com documentação vencida, informações incorretas
            ou comportamento inadequado.
          </p>
          <h2 className="text-xl font-bold text-white pt-4">6. Alterações</h2>
          <p>
            Estes Termos podem ser atualizados. Alterações relevantes serão comunicadas por
            notificação interna; e-mail será utilizado somente quando a integração estiver
            configurada.
          </p>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
