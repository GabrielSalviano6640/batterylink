# Relatório de implementação — Fases 17 a 21

Data da validação: 15/07/2026  
Fuso padrão: `America/Sao_Paulo`

## Situação do MVP

As Fases 17 a 21 foram implementadas no código e a migração `20260716120000_phase17_21_security_quality_demo.sql` foi aplicada ao Supabase. O MVP ainda não deve ser declarado concluído: o cenário ponta a ponta com cinco usuários reais em uma instância isolada e a validação manual em dispositivos móveis permanecem pendentes.

## Tabelas operacionais

O banco ativo contém as seguintes tabelas protegidas por RLS:

- `profiles`, `user_roles`, `companies`, `registration_requests`, `org_members`;
- `batteries`, `battery_events`, `battery_files`, `battery_status_transitions`;
- `collections`, `sorting_diagnostics`, `lots`, `lot_batteries`, `lot_status_transitions`, `lot_watchlist`;
- `proposals`, `operations`, `documents`, `private_documents`, `organization_documents`;
- `status_history`, `audit_log`, `notifications`, `incidents`;
- `environmental_factors`, `system_parameters`, `leads`.

A Fase 17 acrescentou `operator_organization_id` à bateria e os campos `is_demo`, suspensão e fuso horário necessários ao isolamento e à revogação de acesso.

## RLS e segurança aplicados

- 17 políticas restritivas transversais exigem conta ativa e contexto demonstrativo compatível.
- Gerador acessa baterias próprias e operações das quais participa.
- Operador recebe apenas dados sanitizados na fila e passa a ver os detalhes após assumir a responsabilidade pela bateria.
- Transportadora acessa somente coletas atribuídas ao usuário ou à sua organização.
- Recicladora acessa lotes publicados se sua organização estiver aprovada e lê somente propostas próprias.
- Administrador depende de papel aprovado, conta não suspensa e ações administrativas auditadas.
- Usuário ou organização suspensa perde autorização no banco, inclusive nas funções RPC que dependem de `has_role`.
- Os buckets `battery-files`, `workflow-documents` e `private-documents` estão privados.
- O acesso a arquivo operacional depende de `can_access_workflow_document`; documentos privados dependem de `can_access_private_document`.
- `audit_log` permanece append-only para usuários comuns.
- O cliente web aceita apenas `VITE_SUPABASE_PUBLISHABLE_KEY`; a chave de service role permanece restrita ao módulo `.server.ts`.
- CNPJ/CPF corporativo possui índice único por dígitos normalizados; UF possui restrição no banco.

## Rotas e UX

- `/`: landing page com CTAs funcionais, conteúdo ilustrativo identificado e classificações técnicas diferenciadas.
- `/auth`: entrada e cadastro, com labels, preenchimento automático e validações obrigatórias.
- `/app`: painel por perfil com menu lateral, breadcrumbs, faixa demo e carregamento skeleton.
- `/app/admin`: administração protegida.
- `/portal` e `/rastreio/$token`: rastreabilidade autenticada e consulta pública sanitizada.
- `/gerador`, `/operador`, `/transportadora`, `/recicladora`: captação institucional por perfil.
- `/termos`, `/privacidade`, `/contato`: conteúdo institucional e formulário persistente.

Foram acrescentados máscaras e validadores de CPF, CNPJ, CEP e telefone, validação de UF, formatação BRL, datas brasileiras, fuso configurável, paginação e ordenação no painel do gerador, empty states, foco de teclado e confirmações para ações críticas alteradas nesta fase.

## Funcionalidades concluídas

- Suspensão efetiva de usuário e organização no banco.
- Custódia explícita do operador e fila de entrada sanitizada.
- Restrição da transportadora a ordens atribuídas.
- Isolamento de propostas concorrentes.
- Leitura de operações pelo gerador envolvido.
- Storage privado com autorização por entidade.
- Auditoria adicional em empresas, papéis, coletas, diagnósticos, lotes, propostas, operações, documentos e ocorrências.
- Separação lógica de dados demo e produção com `is_demo`.
- Landing sem números apresentados como resultados reais e sem promessas jurídicas absolutas.
- Seed demonstrativo opcional, separado e bloqueado fora de ambiente local/teste.
- Testes estáticos de aceitação e testes SQL de contrato do banco.

## Funcionalidades e integrações pendentes

- Integração de e-mail: **Integração pendente**. As notificações internas funcionam; nenhum envio é simulado.
- Emissão oficial de MTR/CDF: exige integração homologada com o sistema ambiental competente.
- Pagamento bancário: estrutura financeira preparada, sem processamento real nesta fase.
- Indicadores ambientais: dependem de fatores, metodologia e fonte configurados pelo administrador.
- MFA e assinatura eletrônica: não ativados.
- Teste ponta a ponta com cinco sessões reais: pendente de uma instância isolada de homologação.
- Teste manual em aparelhos móveis e navegadores: pendente de homologação visual.

## Contas demonstrativas

Nenhuma conta demo foi inserida em produção. O arquivo `supabase/seed.demo.sql` prepara, apenas para desenvolvimento:

- `gerador.demo@batterylink.local`;
- `operador.demo@batterylink.local`;
- `transportadora.demo@batterylink.local`;
- `reciclador.demo@batterylink.local`;
- `admin.demo@batterylink.local`.

Todas as contas e organizações do seed recebem `is_demo = true`. A senha local está documentada no próprio seed. A faixa “Ambiente demonstrativo — os dados apresentados não representam operações reais.” aparece para perfis demo.

## Testes executados

- `npm run test:acceptance`: 7 testes aprovados.
- `npm run build`: build cliente, SSR e Nitro aprovado.
- ESLint nos arquivos alterados: zero erros; quatro avisos de dependência de hooks, sem falha de build.
- Migração completa executada primeiro com `ROLLBACK`: aprovada.
- Migração aplicada em transação e registrada em `schema_migrations`: aprovada.
- Teste SQL `supabase/tests/phase20_acceptance.sql`: aprovado.
- Verificação do banco: zero tabelas sensíveis sem RLS, 17 políticas restritivas, buckets privados, nenhuma conta/demo em produção.

O roteiro manual completo está em `docs/ROTEIRO_TESTE_MVP.md`.

## Riscos técnicos

- O schema mantém nomes legados e nomes normalizados em algumas tabelas; novas mudanças devem evitar ampliar essa duplicidade.
- A escolha automática da organização usa a primeira associação ativa quando o usuário participa de várias organizações; uma futura versão deve exigir seleção explícita de organização na sessão.
- O bundle administrativo e a landing apresentam aviso de tamanho de chunk; recomenda-se divisão por importação dinâmica antes de maior escala.
- Sem uma instância isolada com cinco usuários autenticados não é seguro executar o cenário de 28 passos contra dados de produção.
- Baterias antigas sem `operator_organization_id` aparecem apenas na fila sanitizada até que um operador aprovado assuma a responsabilidade.

