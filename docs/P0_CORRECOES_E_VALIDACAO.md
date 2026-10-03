# Correções prioritárias P0 — 03/10/2026

Estado: implementadas nesta branch, em revisão; não aplicadas nem homologadas no Supabase real.
Base auditada: `5e2138892a0c4ca80f21d87e4bbdc2b0dd6290d9`.

## Mudanças

| Bloqueio | Correção | Limite |
|---|---|---|
| Usuário podia atualizar status/suspensão/demo do próprio perfil | Migration revoga INSERT/UPDATE genéricos em profiles; permite apenas colunas cadastrais, mantendo RLS e RPCs administrativas | Não equivale a uma auditoria completa de todas as permissões de empresas e membros |
| Rotas filhas não apareciam | /app e /app/admin renderizam Outlet; /app mantém o hub; páginas exigem perfil compatível e estado aprovado | Testes de componentes com autenticação e roteador simulados, sem navegador real |
| Dashboards duplicados ignoravam as regras de workflow | As quatro rotas reutilizam os componentes canônicos já integrados às RPCs | Demais regras de negócio ainda precisam do E2E com cinco perfis |
| Aprovação duplicada fazia cinco escritas independentes | /app/admin/pending-organizations reutiliza RequestsTab e approve_registration | A RPC existente ainda precisa vincular decisões a uma organização exata para proprietários com várias empresas (P1) |
| Cadastro empresarial dependia de sessão imediata no signup | Metadados e aceites são capturados no signup; complete_signup_registration conclui perfil/empresa/solicitação em transação autenticada após confirmação | OAuth e contas antigas sem metadados/aceites completos continuam no onboarding manual; entrega de e-mail não foi testada |
| Nova página de bateria tinha upload incompatível com RLS | Usa reserva/finalização de documentos privados; guarda o rascunho em memória para repetir uploads sem duplicar bateria; envia para análise por RPC | Reabrir/recarregar a página não recupera esse estado de memória; usar o painel para continuar um rascunho já salvo |

Nenhuma função de cadastro atribui user_roles ou aprova o perfil. A conclusão usa somente auth.uid(), serializa chamadas por usuário e não recria solicitações existentes, inclusive rejeitadas.

## Verificação

- `npm run typecheck`: aprovado.
- `npm run build`: aprovado (cliente e servidor).
- `npm run test:acceptance`: 9 verificações estáticas; não são E2E.
- `npm run test:database`: 5 testes comportamentais executando PostgreSQL embarcado (PGlite), incluindo proibição de autoaprovação/alteração de suspensão/demo, confirmação de e-mail, idempotência, rollback e aprovação administrativa autorizada.
- `npm run test:routes`: 11 verificações de renderização e acesso com dependências simuladas.
- Workflow de CI adicionado para executar essas verificações em PRs e na main; execução remota ainda depende do GitHub Actions.

Os testes de banco usam uma fixture de contrato com migrations iniciais e a nova migration real. Não reproduzem todas as 21 migrations anteriores nem a infraestrutura Supabase Auth/Storage. O arquivo tests/fixtures/p0-database.sql nunca deve ser aplicado a produção.

## Implantação e homologação

1. Revisar o PR e aplicar a migration `20261003190000_p0_profile_and_signup.sql` em homologação antes de disponibilizar o frontend. Sem essa função, a área autenticada exibirá erro recuperável na conclusão do cadastro.
2. Verificar as permissões efetivas de profiles e o funcionamento das RPCs administrativas com credenciais reais de homologação.
3. Testar signup com confirmação obrigatória, clique no e-mail em outro navegador, login e presença de uma única solicitação pendente.
4. Executar aprovação, cadastro com foto, análise, coleta, triagem, lote, proposta, destinação e isolamento entre empresas com cinco perfis.
5. Testar falha de upload e recuperação pelo painel, rejeição e suspensão. Só então decidir aplicação em produção.

## Pendências preservadas

- Homologação E2E em Supabase isolado, replay completo de migrations e testes móveis.
- Aprovação por organização exata e revisão das permissões administrativas de companies/org_members.
- Configuração/entrega de e-mail e OAuth; métricas em tempo real; dados reais e integrações externas.
- Atualização integral dos documentos históricos após homologação. O MVP continua sem declaração de prontidão operacional.
