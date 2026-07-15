# Roteiro de Implementação — Fases 1 a 21 (MVP Operacional)

## Resumo executivo

A BatteryLink Brasil dispõe de uma **arquitetura de banco avançada** com RLS, tabelas canônicas e políticas de segurança. O código frontend está em etapa de **sincronização** com a especificação MVP. Este documento estrutura o caminho crítico de implementação até a conclusão do MVP.

---

## Fases completadas ou em andamento

### ✅ Fase 1 — Autenticação (85% completa)
- ✅ Cadastro por e-mail e senha
- ✅ Login e logout
- ✅ Recuperação de senha
- ✅ Proteção de rotas
- ✅ Confirmação de e-mail (estrutura)
- ✅ Mensagens de erro em português
- ✅ Prevenção de contas duplicadas (via UNIQUE constraint no banco)
- 🔄 Capturas de **dados completos no cadastro** (atualizado)

### ✅ Fases 2–3 — Estrutura multiempresa e banco de dados (95% completa)
- ✅ Tabelas: `profiles`, `companies`, `org_members`, `organization_documents`, `batteries`, `battery_files`, `collections`, `sorting_diagnostics`, `lots`, `lot_batteries`, `proposals`, `operations`, `documents`, `status_history`, `audit_log`, `notifications`, `incidents`
- ✅ Chaves estrangeiras, índices e triggers de sincronização
- ✅ RLS aplicado a entidades sensíveis
- ✅ Funções auxiliares: `is_user_active`, `has_role`, `is_org_member`, `can_manage_org`

### ✅ Fases 4–5 — Fluxo operacional e status (estrutura pronta)
- ✅ Máquina de estados no banco (enums `battery_status`, `lot_status`, `collection_status`, etc.)
- ✅ Histórico de mudanças em `status_history`
- 🔄 Frontend precisa implementar atualização de status com confirmação visual

### ✅ Fases 11–12 — Rastreabilidade e storage (95% completa)
- ✅ QR Code automático para baterias, coletas e lotes
- ✅ Funções públicas/autorizadas: `get_public_trace`, `get_authorized_trace`
- ✅ Rota `/rastreio/$token` implementada
- ✅ Bucket privado `private-documents` com RLS
- 🔄 Frontend: QR display e geração visual pendente

### ✅ Fases 17–21 — Segurança, qualidade e seed (90% completa)
- ✅ RLS em todas as tabelas sensíveis
- ✅ Política de contexto demo com `is_demo`
- ✅ Seed separado em `supabase/seed.demo.sql`
- ✅ Testes de aceitação em `tests/acceptance.test.mjs` (todos passando)
- 🔄 Mensagens "Integração pendente" para e-mail (estrutura pronta)

---

## Fases pendentes (implementação crítica)

### 🔴 Fase 6 — Dashboard do Gerador
**Status:** Não iniciada  
**Escopo:**
- Dashboard com KPIs: total de baterias, coletas agendadas, operações concluídas
- Lista de baterias com status em tempo real
- Filtros por código, status, química, período
- Botão "Cadastrar bateria" → formulário completo
- Detalhes, fotos, diagnóstico liberado, documentos finais
- Indicadores ambientais (estimados)

**Entrada:** Painel operacional da [GeradorDashboard](src/components/dashboards/gerador)  
**Saída:** Queries ao `batteries` com `company_id`, aggregações, paginação

**Dependências:**
- Fase 6a: Formulário de cadastro de bateria
- Fase 6b: Componentes de status, abas, linha do tempo
- Fase 6c: Upload de fotos e arquivos

---

### 🔴 Fase 6a — Cadastro de bateria (Gerador)
**Status:** Não iniciada  
**Escopo:**
- Formulário com campos: origem, fabricante, modelo, série, química, capacidade, tensão, quantidade, peso, SoH, estado, risco, urgência, CEP, cidade, UF, endereço
- Upload de foto e laudo (opcional)
- Validação do formulário
- POST ao `batteries` com `generator_organization_id`
- Geração automática de `codigo_unico` e `tracking_token` (triggers SQL)
- Toast de sucesso com QR Code ou link de rastreio

**Entrada:** [/src/routes/_authenticated/app/gerador/cadastro.tsx] (novo arquivo)  
**Saída:** Linha inserida em `batteries`, `tracking_token` gerado

---

### 🔴 Fase 7 — Dashboard do Operador
**Status:** Não iniciada  
**Escopo:**
- Solicitations recebidas (batteries com status `aguardando_analise`)
- Fila de diagnóstico
- Formação de lotes
- Lotes publicados
- Propostas recebidas
- Funções: aceitar solicitação, solicitar informações, registrar diagnóstico, classificar, criar lote

**Entrada:** [OperadorDashboard](src/components/dashboards/operador)  
**Saída:** Queries ao `batteries`, `collections`, `lots`, `sorting_diagnostics`

---

### 🔴 Fase 8 — Dashboard da Transportadora
**Status:** Não iniciada  
**Escopo:**
- Ordens disponíveis / atribuídas
- Coletas pendentes, aceitas, em andamento
- Agenda com motorista, placa, rota
- Documentos vencidos (alertas)
- Funções: aceitar/recusar, agendar, confirmar retirada/entrega, registrar ocorrência

**Entrada:** [TransportadoraDashboard](src/components/dashboards/transportadora)  
**Saída:** Queries ao `collections` com `carrier_organization_id`

---

### 🔴 Fase 9 — Dashboard da Recicladora
**Status:** Não iniciada  
**Escopo:**
- Lotes disponíveis (status `publicado`)
- Filtros por química, localização, prazo
- Envio de propostas
- Propostas aceitas / operações em andamento
- Recebimento e confirmação
- Funções: visualizar detalhes, enviar/editar proposta, confirmar recebimento

**Entrada:** [RecicladorDashboard](src/components/dashboards/reciclador)  
**Saída:** Queries ao `lots`, `proposals`, `operations`

---

### 🔴 Fase 10 — Painel Administrativo
**Status:** Não iniciada (estrutura já existe em `src/routes/_authenticated/app/admin`)  
**Escopo:**
- Organizações pendentes (aguardando aprovação)
- Usuários, geradores, operadores, transportadoras, recicladoras
- Aprovação/rejeição de organizações
- Validação de documentos
- Suspensão de contas
- Auditoria visual
- Exportação de relatórios CSV

**Entrada:** [src/routes/_authenticated/app.admin.tsx](src/routes/_authenticated/app.admin.tsx)  
**Saída:** Interface de revisão com UPDATE em `companies`, `organization_documents`

---

### 🔴 Fase 13 — Avisos legais e MTR/CDF
**Status:** Não iniciada  
**Escopo:**
- Ajustes de linguagem na landing: remover "auditoria imutável" → "Histórico de auditoria protegido"
- Adicionar conformidade PNRS/LGPD: "Desenvolvida para apoiar operações em conformidade"
- Avisos sobre MTR/CDF serem registrados ou anexados (não emitidos pela plataforma)
- Campo `emission_agency` em `documents`

**Entrada:** Landing page e templates de documentos  
**Saída:** Textos atualizados, avisos visíveis

---

### 🔴 Fase 14 — Propostas e modelos comerciais
**Status:** Estrutura pronta (tabela `proposals` existe)  
**Escopo:**
- Três modelos: gerador paga, recicladora compra, intermediação neutra
- Campos: `modelo_comercial`, `valor_proposto`, `moeda`, `prazo_retirada_dias`, `validade_proposta`, `condicoes`, `status`, `submitted_at`
- Exibição clara de quem paga/recebe
- Status: rascunho, enviada, em_analise, aceita, recusada, cancelada, expirada
- Status financeiro: não_aplicável, aguardando_cobrança, pago, vencido

**Entrada:** Formulário em dashboard recicladora  
**Saída:** INSERT/UPDATE em `proposals`, geração de `operation` quando aceita

---

### 🔴 Fase 15 — Indicadores ambientais
**Status:** Estrutura pronta (tabela `environmental_factors` existe)  
**Escopo:**
- Tabela de fatores configuráveis por química, peso, metodologia
- Cálculos: massa processada, material segunda vida, reciclagem, lítio/níquel/cobalto/cobre recuperáveis, emissões evitadas
- Identificação como "Estimativas para fins gerenciais"
- Fallback: "Indicador indisponível — metodologia não configurada"

**Entrada:** View/painel de indicadores  
**Saída:** Queries ao `environmental_factors` com agregação

---

### 🔴 Fase 16 — Notificações em tempo real
**Status:** Estrutura pronta (tabela `notifications` existe)  
**Escopo:**
- Notificações internas: cadastro, aprovação, solicitação de info, mudança de status, proposta, documento vencendo
- Bell icon com contador
- Modal/sidebar de notificações
- E-mail via Edge Function (se configurado; senão: "Integração pendente")

**Entrada:** Banco `notifications`  
**Saída:** Push de eventos RPC ou webhook

---

### 🔴 Fase 19 — Correções da landing page
**Status:** Parcialmente completa  
**Escopo:**
- Marcar simulações com "Exemplo visual"
- CTAs funcionais: Cadastrar bateria → /auth?mode=signup, Cadastrar empresa → /auth?mode=signup, Entrar → /auth, Falar com a equipe → /contato
- Links Termos, Privacidade, Contato devem ter conteúdo real
- Diferenciar segunda vida, reutilização, reciclagem mecânica/química

**Entrada:** [src/routes/index.tsx](src/routes/index.tsx)  
**Saída:** Landing com CTAs funcionais verificadas

---

### 🔴 Fase 20 — Testes de aceitação (28 cenários obrigatórios)
**Status:** Não iniciada (estrutura em `tests/acceptance.test.mjs`)  
**Escopo:**
- Cenário: criar gerador, aprovar org, cadastrar bateria, gerar QR, coleta, triagem, lote, proposta, operação, conclusão
- Testes de RLS, suspensão, upload inválido, campos obrigatórios, celular, etc.

**Entrada:** Script de teste manual ou E2E (Playwright/Cypress)  
**Saída:** Matriz de cobertura validada

---

### 🔴 Fase 21 — Seed demonstrativo (já implementado)
**Status:** Concluído  
**Saída:** 5 contas demo + organizações em `supabase/seed.demo.sql`

---

## Ordem crítica de implementação

1. **Fase 6a** — Cadastro de bateria (gerador consegue criar ativos no banco)
2. **Fase 6** — Dashboard gerador (visualização de seus próprios ativos)
3. **Fase 7** — Dashboard operador (recebimento e triagem)
4. **Fase 2 (revisão)** — Fluxo de aprovação administrativa (gerador consegue ser aprovado)
5. **Fase 8** — Dashboard transportadora
6. **Fase 9** — Dashboard recicladora
7. **Fase 10** — Admin (aprovação/rejeição, suspensão)
8. **Fases 13–16** — Avisos legais, modelos comerciais, notificações, indicadores
9. **Fase 19** — Landing page corrigida
10. **Fase 20** — Testes de aceitação

---

## Checklist de completude do MVP

- [ ] Banco: todas as tabelas criadas com RLS
- [ ] Auth: signup → organization + registration_request
- [ ] Admin: aprovação de organização → profile.status = 'approved'
- [ ] Gerador: cadastro de bateria → código único + QR Code
- [ ] Operador: recebimento e diagnóstico
- [ ] Transportadora: coleta e entrega
- [ ] Recicladora: propostas e destinação
- [ ] Rastreabilidade: QR Code público e autorizado
- [ ] Documentos: storage privado com RLS
- [ ] Notificações: internas (e-mail pendente)
- [ ] Auditoria: histórico protegido
- [ ] Testes: 28 cenários passando
- [ ] Landing: corrigida, CTAs funcionais
- [ ] Seed: separado, bloqueado fora de dev

---

## Recursos estimados

| Fase | Componentes | Queries | Triggers | Testes | Dias |
|------|-------------|---------|----------|--------|------|
| 6a   | 1 formulário, 1 upload | 1 POST | 1 (qr_gen) | 2 | 2 |
| 6    | 1 dashboard, 5 cards, filtro | 3-4 | 0 | 3 | 2 |
| 7    | 1 dashboard, 3 modais | 4-5 | 2 | 4 | 3 |
| 2 (revisão) | 1 status display, update | 1 UPDATE | 1 | 2 | 1 |
| 8    | 1 dashboard, agenda | 2-3 | 1 | 3 | 2 |
| 9    | 1 dashboard, propostas | 3-4 | 1 | 3 | 3 |
| 10   | 2-3 páginas admin | 4-5 | 2 | 4 | 3 |
| 13-16| Avisos + notificações | 1-2 | 1 | 2 | 2 |
| 19   | Landing revisada | 0 | 0 | 1 | 1 |
| 20   | Script de teste | - | - | 28 | 3 |
| **Total** | - | - | - | - | **22 dias** |

---

## Próximas ações imediatas

1. Testar cadastro com campos completos em `/auth?mode=signup` no browser
2. Criar formulário de cadastro de bateria em rota nova `/app/gerador/bateria/nova`
3. Implementar listagem de baterias no dashboard gerador com query real
4. Criar fluxo visual de aprovação administrativa

---

## Referências

- Especificação completa: [USER_REQUIREMENTS.md]
- Auditoria do projeto: [PROJECT_AUDIT.md]
- Teste de aceitação: [tests/acceptance.test.mjs]
- Seed demonstrativo: [supabase/seed.demo.sql]
- Migrations: [supabase/migrations/]

---

**Versão:** 1.0  
**Data:** 15 de julho de 2026  
**Status:** Pronto para implementação incremental
