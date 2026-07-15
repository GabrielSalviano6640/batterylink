# BatteryLink Brasil — Auditoria do Projeto Atual

## Visão geral
O projeto já contém uma arquitetura de banco e RLS bastante avançada. A aplicação possui tabelas, políticas e rotas alinhadas com o MVP operacional, mas a experiência de cadastro e alguns fluxos ainda precisam ser refinados para fechar a fase 1.

## Estrutura de banco existente
As migrações atuais já criam ou sincronizam as seguintes entidades principais:

- `profiles`
- `companies` (organizações)
- `org_members`
- `user_roles`
- `organization_documents`
- `batteries`
- `battery_files`
- `collections`
- `sorting_diagnostics`
- `lots`
- `lot_batteries`
- `proposals`
- `operations`
- `documents`
- `private_documents`
- `status_history`
- `audit_log`
- `notifications`
- `incidents`
- `environmental_factors`

Além disso, há suporte ao fluxo de rastreabilidade com:

- `tracking_token` e `qr_code_data` em `batteries`, `collections` e `lots`
- funções SQL `get_public_trace` e `get_authorized_trace`
- bucket privado de storage `private-documents`

## Políticas RLS aplicadas
O projeto já implementa regras essenciais de segurança no banco, incluindo:

- funções auxiliares `is_user_active`, `has_role`, `is_org_member`, `can_manage_org`
- políticas restritivas em entidades sensíveis para `authenticated`
- separação de contexto demo com `is_demo`
- regras de leitura/atualização específicas para operadores, transportadoras e lotes
- autorização de documentos privados por entidade e organização

## Rotas implementadas
Rotas operacionais e institucionais já presentes no código:

- `/` (landing)
- `/auth`
- `/contato`
- `/termos`
- `/privacidade`
- `/portal`
- `/reset-password`
- `/rastreio/$token`
- `/gerador`
- `/operador`
- `/transportadora`
- `/recicladora`
- `/_authenticated/app`
- `/_authenticated/app/admin`

## Funcionalidades concluídas

- Auth básico com Supabase Auth
- proteção de rota autenticada em `/_authenticated`
- fluxo de cadastro + onboarding
- registro de organizações e solicitações a partir do app
- rastreabilidade pública e autorizada
- bucket privado de storage e políticas de documentos
- seed demonstrativo separado em `supabase/seed.demo.sql`
- testes de aceitação automatizados em `tests/acceptance.test.mjs`

## Funcionalidades pendentes ou que precisam de refinamento

- cadastro de usuário ainda não captura todos os campos completos do MVP em uma só etapa
- fluxo de confirmação de e-mail pode não persistir completamente os dados quando não há sessão ativa
- aprovação administrativa e bloqueio de operações sensíveis dependem de um fluxo de review ainda com pouca visibilidade no frontend
- painéis operacionais e dashboards precisam ser validados no browser com dados reais
- integração de e-mail ainda não está implementada e deve ser marcada como "integração pendente" se não estiver configurada
- Google OAuth deve ser ativado apenas quando houver configuração explícita

## Integrações externas necessárias

- Supabase (projeto e credenciais)
- Storage privado no Supabase
- E-mail transacional/external notifications (se for ativado depois)
- Google OAuth apenas se corretamente configurado no painel Supabase/Lovable

## Contas demonstrativas

- Seed de demo presente em `supabase/seed.demo.sql`
- `is_demo = true` está aplicado às contas demo
- contas demo criadas para gerador, operador, transportadora, recicladora e admin

## Roteiro de teste inicial

1. Verificar variáveis de ambiente Supabase em `.env` ou no painel Lovable
2. Executar `npm install`
3. Executar `npm run dev`
4. Acessar `/auth` e testar cadastro de novo usuário
5. Confirmar aprovação do fluxo por conta pendente
6. Acessar `/rastreio/{token}` para verificar trace pública
7. Executar `node --test tests/acceptance.test.mjs`

## Riscos técnicos encontrados

- fluxo de cadastro com confirmação de e-mail e persistência de dados adicionais pode exigir um endpoint server-side adicional
- o frontend atual depende de `supabase.auth.signUp` e `supabase.auth.signInWithPassword` sem um `service_role` exposto
- se o Supabase exigir confirmação por e-mail, a criação de `profiles`/`companies` pode precisar de um passo extra ou servidor intermediário
- algumas tabelas estão modeladas com aliases antigos (`companies`, `org_members`) e vistas/trigger de sincronização, o que exige atenção ao usar alias canônicos

## Alterações aplicadas nesta etapa

- Atualização de `src/routes/auth.tsx` para capturar campos de cadastro mais completos e preparar os dados de organização/registro no momento do signup.
- Relatório de auditoria criado como arquivo `PROJECT_AUDIT.md`.

---

Este relatório resume o estado atual do projeto e orienta a próxima fase: completar o fluxo de cadastro aprovado, fechar a aprovação administrativa e validar os painéis com dados reais.
