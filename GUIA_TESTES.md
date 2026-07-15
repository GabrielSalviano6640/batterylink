# 🧪 Guia de Teste - BatteryLink Brasil MVP

Este guia ajuda você a testar todas as funcionalidades implementadas no fluxo operacional completo.

---

## 🚀 Começando

1. **Inicie o servidor de desenvolvimento:**
   ```bash
   npm run dev
   ```
   Abra em: `http://localhost:8081`

2. **Prepare dados de teste:**
   - Você pode usar os dados do seed demo já carregados
   - Ou criar novos usuários durante o teste

---

## 📋 Roteiro de Testes

### ✅ Teste 1: Signup com Dados de Empresa

**Objetivo:** Validar captura completa de dados de organização

1. Clique em **"Criar conta"** (se não autenticado)
2. Preencha:
   - **Pessoal:** Nome, email, telefone, senha
   - **Empresa:** Razão social, CNPJ
   - **Endereço:** CEP, cidade, estado, endereço
   - **Cargo:** Seletor de papel (gerador, operador, etc.)
3. **Resultado esperado:**
   - ✅ Conta criada
   - ✅ Organização criada no banco
   - ✅ Request de aprovação pendente para admin
   - 💬 Mensagem: "Cadastro concluído. Aguarde aprovação de administrador"

---

### ✅ Teste 2: Aprovação de Organização (Admin)

**Objetivo:** Validar fluxo de aprovação com notificação

1. **Faça login como admin** (user com role admin):
   - Ou crie um usuário e atualize `user_roles` no Supabase para role='admin'
   
2. Navegue até `/app/admin/pending-organizations`

3. Você deve ver:
   - ✅ Lista de organizações pending à esquerda (com scroll)
   - ✅ Nenhuma selecionada inicialmente

4. Clique em uma organização na lista

5. No painel direito deve aparecer:
   - ✅ Razão social
   - ✅ CNPJ
   - ✅ Tipo de organização
   - ✅ Endereço completo
   - ✅ Email e telefone

6. Clique em **"Aprovar"**

7. **Resultado esperado:**
   - ✅ Status muda para "aprovada"
   - ✅ Usuário recebe notificação
   - ✅ Organização sai da lista pending
   - ✅ Pode fazer login com nova organização

---

### ✅ Teste 3: Cadastro de Bateria (Gerador)

**Objetivo:** Validar captura de specs técnicos e upload de foto

1. Faça login como **Gerador** (usuário com role gerador, em org aprovada)

2. Navegue até `/app/gerador/bateria/nova`

3. Preencha todos os campos:
   - **Identificação:** Origem, Fabricante, Modelo, Número de série
   - **Specs:** Química (dropdown), Capacidade (kWh), Tensão, Quantidade, Peso, SoH (%)
   - **Estado:** Estado aparente (dropdown), Urgência (dropdown), Checkboxes de risco
   - **Localização:** CEP (deve autocompletar), Cidade, Estado, Endereço
   - **Documentos:** Arraste ou clique para adicionar fotos

4. Clique em **"Cadastrar Bateria"**

5. **Resultado esperado:**
   - ✅ Redirecionado para `/app/gerador`
   - ✅ Toast: "Bateria cadastrada com sucesso!"
   - ✅ Bateria aparece no dashboard
   - ✅ Fotos enviadas para storage
   - ✅ Código único e tracking token gerados
   - ✅ Evento de criação registrado

---

### ✅ Teste 4: Dashboard do Gerador (Visualização)

**Objetivo:** Validar KPIs e filtros

1. Ainda como **Gerador**, você está em `/app/gerador`

2. Verifique os KPIs (topo):
   - ✅ **Total cadastradas:** Deve mostrar a bateria criada
   - ✅ **Em coleta:** Inicialmente 0
   - ✅ **Concluídas:** Inicialmente 0
   - ✅ **Taxa de conclusão:** Inicialmente 0%

3. Verifique a **tabela**:
   - ✅ Coluna Código (código_unico)
   - ✅ Coluna Fabricante/Modelo
   - ✅ Coluna Química (badge)
   - ✅ Coluna SoH%
   - ✅ Coluna Status (badge azul "Cadastrada")
   - ✅ Coluna Data

4. Clique no **ícone de olho** na bateria

5. **Resultado esperado:**
   - ✅ Redireciona para `/app/gerador/bateria/$batteryId`
   - ✅ Detalhes completos aparecem

---

### ✅ Teste 5: Detalhe de Bateria

**Objetivo:** Validar timeline e QR code

1. Você está em `/app/gerador/bateria/$batteryId`

2. Verifique as seções:
   - ✅ **Código único** (copyable com ícone)
   - ✅ **Químicas** (badge LFP/NMC/etc)
   - ✅ **Status** (badge)
   - ✅ **QR Code** com link rastreável
   - ✅ **Especificações** (Capacidade, Tensão, Quantidade, Peso, SoH)
   - ✅ **Estado e riscos** (badges coloridas para risco térmico/avaria)
   - ✅ **Localização** (endereço + CEP)
   - ✅ **Linha do tempo** (eventos registrados)

3. Clique no **link QR Code** (Visualizar)

4. **Resultado esperado:**
   - ✅ Abre página de rastreamento público
   - ✅ Mostra status e localização

5. Clique no código único (com ícone copy)

6. **Resultado esperado:**
   - ✅ Código copiado para clipboard
   - ✅ Ícone muda para checkmark temporariamente

---

### ✅ Teste 6: Dashboard do Operador (Triagem)

**Objetivo:** Validar seleção de bateria e transitions de status

1. Faça login como **Operador** (user com role operador)

2. Navegue até `/app/operador`

3. Verifique os **KPIs**:
   - ✅ "Em triagem" = 1 (a bateria que criamos)
   - ✅ "Lotes formados" = 0
   - ✅ "Diagnóstico" = 0
   - ✅ "Propostas" = 0

4. Clique na **bateria na tabela**

5. No painel direito deve aparecer:
   - ✅ Fabricante/Modelo
   - ✅ Código único
   - ✅ Status atual: "Em triagem"
   - ✅ SoH%, Capacidade
   - ✅ Badge de "Segura" (sem riscos) ou riscos específicos
   - ✅ Botões: "Concluir triagem" e "Pular diagnóstico"

6. Clique em **"Concluir triagem"**

7. **Resultado esperado:**
   - ✅ Status muda para "diagnostico_concluido"
   - ✅ Toast: "Status atualizado com sucesso!"
   - ✅ KPIs atualizam: "Diagnóstico" agora = 1
   - ✅ Bateria sai da lista de "Em triagem"

8. Se quiser, clique em **"Enviar para proposta"** (novo botão)

9. **Resultado esperado:**
   - ✅ Status muda para "proposta_enviada"
   - ✅ "Propostas" KPI aumenta

---

### ✅ Teste 7: Dashboard da Recicladora (Propostas)

**Objetivo:** Validar visualização de propostas e decisões

1. Faça login como **Recicladora** (user com role recicladora)

2. Navegue até `/app/recicladora`

3. **Importante:** Você deve ter no banco:
   - Uma proposta criada para sua organização
   - Ou a bateria do teste anterior deve estar vinculada a uma proposta

4. Se não houver propostas:
   - Use Supabase Dashboard para inserir uma:
     ```sql
     INSERT INTO battery_proposals 
     (id, operador_user_id, recicladora_organization_id, proposta_id, status, valor_proposto)
     VALUES 
     (uuid_generate_v4(), '<operador_id>', '<recicladora_org_id>', 'PROP-001', 'enviada', 5000)
     ```

5. Verifique os **KPIs**:
   - ✅ "Propostas ativas" = quantidade de status enviada
   - ✅ "Valor total em propostas" = soma dos valores
   - ✅ "Valor em propostas aceitas" = 0 inicialmente

6. Clique em uma **proposta na tabela**

7. No painel direito deve aparecer:
   - ✅ ID da proposta
   - ✅ Status atual
   - ✅ Valor proposto em R$
   - ✅ Quantidade de baterias
   - ✅ Valor total do lote
   - ✅ Botões: "Aceitar" e "Rejeitar"

8. Clique em **"Aceitar proposta"**

9. **Resultado esperado:**
   - ✅ Status muda para "aceita"
   - ✅ Toast: "Proposta marcada como aceita!"
   - ✅ Botões mudam para: "Iniciar operação"
   - ✅ "Valor em propostas aceitas" atualiza

10. Clique em **"Iniciar operação"**

11. **Resultado esperado:**
    - ✅ Status muda para "operacao_em_andamento"
    - ✅ KPI "Em operação" aumenta

12. Clique em **"Concluir operação"**

13. **Resultado esperado:**
    - ✅ Status muda para "operacao_concluida"
    - ✅ Proposta sai da lista (se filtrada por "enviada")

---

### ✅ Teste 8: Dashboard da Transportadora (Coletas)

**Objetivo:** Validar gestão de coletas (se configurado)

1. Faça login como **Transportadora** (user com role transportadora)

2. Navegue até `/app/transportadora`

3. **Importante:** Você deve ter coletas no banco para sua organização
   - Se não houver, o sistema mostrará "Nenhuma coleta disponível"
   - Você pode inserir uma via SQL:
     ```sql
     INSERT INTO collections 
     (id, transportadora_organization_id, cidade_coleta, data_coleta, status)
     VALUES 
     (uuid_generate_v4(), '<transportadora_org_id>', 'São Paulo', now(), 'agendada')
     ```

4. Verifique os **KPIs**:
   - ✅ "Agendadas", "Em transporte", "Entregues", "Com atraso"

5. Clique em uma **coleta**

6. No painel direito deve aparecer:
   - ✅ Cidade + endereço
   - ✅ Data marcada
   - ✅ Contato (telefone clicável)
   - ✅ Lista de baterias
   - ✅ Status atual
   - ✅ Botão: "Iniciar transporte"

7. Clique em **"Iniciar transporte"**

8. **Resultado esperado:**
    - ✅ Status muda para "em_transporte"
    - ✅ Botão muda para "Marcar como entregue"

9. Clique em **"Marcar como entregue"**

10. **Resultado esperado:**
    - ✅ Status muda para "entregue"
    - ✅ KPIs atualizam
    - ✅ Botão desaparece

---

## 🔧 Troubleshooting

### ❌ "Erro ao carregar baterias"
- **Causa:** Usuário não tem organização vinculada
- **Solução:** Crie uma novo perfil e aprove a organização

### ❌ "Organização não encontrada"
- **Causa:** organization_id não foi salvo no profiles
- **Solução:** Verifique em Supabase se o profiles tem o ID correto

### ❌ Dashboard vazio
- **Causa:** Dados ainda não existem no banco
- **Solução:** Insira dados de teste via Supabase Dashboard SQL

### ❌ Upload de foto não funciona
- **Causa:** Bucket "battery-files" não existe ou falta RLS
- **Solução:** Crie bucket em Storage tab de Supabase

---

## ✅ Checklist Final

- [ ] Signup com dados de empresa funciona
- [ ] Admin consegue aprovar organizações
- [ ] Gerador consegue cadastrar baterias
- [ ] Dashboard do Gerador mostra KPIs corretos
- [ ] Detalhe da bateria mostra all specs
- [ ] Operador consegue fazer triagem
- [ ] Recicladora consegue aceitar propostas
- [ ] Transportadora consegue gerenciar coletas
- [ ] Toast notifications aparecem
- [ ] Paginação funciona em dashboards
- [ ] Filtros funcionam e atualizam tabela
- [ ] Status badges têm cores corretas
- [ ] Botões de ação funcionam

---

## 🎯 Próximo Passo

Se todos os testes passarem, você pode:

1. **Preencher seed com dados realistas** (src/seed.demo.sql)
2. **Rodar testes de aceitação:** `npm run test:acceptance`
3. **Deploy em produção** com Supabase
4. **Integrar notificações por email** (SendGrid/Brevo)

---

**Boa sorte com os testes! 🚀**
