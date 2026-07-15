# ⚡ INÍCIO RÁPIDO (5 MINUTOS)

**Status:** ✅ Pronto para começar agora  
**Tempo estimado:** 5 minutos até primeira bateria cadastrada

---

## 🚀 Passo 1: Iniciar o servidor (1 min)

```bash
# Abra PowerShell/Terminal e rode:
cd c:\Users\Fernanda\Documents\GitHub\batterylink
npm run dev
```

**Resultado esperado:**
```
  VITE v8.1.4  ready in 2345 ms

  ➜  Local:   http://localhost:8081/
```

✅ Abra no navegador: `http://localhost:8081`

---

## 📝 Passo 2: Criar conta (1 min)

1. Clique em **"Criar conta"** (canto direito)

2. Preencha o formulário:
   - **Nome:** João Silva
   - **Email:** joao@example.com
   - **Telefone:** (11) 99999-9999
   - **Senha:** SenhaForte123!

3. Clique em **próximo** (ou scroll)

4. Preencha empresa:
   - **Razão Social:** Silva Baterias LTDA
   - **CNPJ:** 12.345.678/0001-90
   - **Tipo:** Gerador de resíduos

5. Preencha endereço:
   - **CEP:** 01310-100 (São Paulo)
   - Cidade/estado auto-preenchem
   - **Rua:** Avenida Paulista 1000

6. Preencha cargo:
   - **Cargo solicitado:** Gerador de resíduos

7. Marque checkboxes:
   - ✅ Concordo com Termos
   - ✅ Concordo com Privacidade
   - ✅ Concordo com regulamentações

8. Clique em **"Cadastrar"**

✅ Mensagem: "Cadastro concluído. Aguarde aprovação de administrador"

---

## 👨‍💼 Passo 3: Simular aprovação (1 min)

**Importante:** Para testes locais, você precisa fazer login como admin e aprovar.

1. **Faça logout** (canto direito → Sair)

2. Clique em **"Fazer login"**

3. Use credenciais de admin (se tiver seed precarregado):
   - **Email:** admin@batterylink.com
   - **Senha:** Supabase123!

4. Se não funcionar:
   - Acesse Supabase Dashboard manualmente
   - Atualize status de organização para "aprovada"
   - Ou use SQL no Supabase console:
     ```sql
     UPDATE companies SET status = 'aprovada', 
                         aprovado_por = '...', 
                         aprovado_em = now() 
     WHERE razao_social = 'Silva Baterias LTDA'
     ```

✅ Agora você é admin e vê todas as orgs

---

## 📸 Passo 4: Cadastrar bateria (2 min)

1. **Faça logout** e faça login com a conta criada (joao@example.com)

2. Você deve ser redirecionado para `/app/gerador` (dashboard)

3. Clique em **"+ Cadastrar bateria"** (ou vá para `/app/gerador/bateria/nova`)

4. Preencha **Seção 1 - Identificação:**
   - Origem: Descarga pessoal
   - Fabricante: LG
   - Modelo: BLX-18650
   - Número série: SN123456789

5. Preencha **Seção 2 - Especificações:**
   - Química: LFP
   - Capacidade: 48 kWh
   - Tensão: 400 V
   - Quantidade: 1
   - Peso: 200 kg
   - SoH: 85%

6. Preencha **Seção 3 - Estado/Riscos:**
   - Estado: Bom funcionamento
   - Urgência: Normal
   - Desmarque riscos (não há)

7. Preencha **Seção 4 - Localização:**
   - CEP: 01310-100 (auto-completa)
   - Endereço: Avenida Paulista 1000

8. **Seção 5 - Documentos:**
   - Clique para adicionar foto (opcional)

9. Clique em **"Cadastrar Bateria"**

✅ Mensagem: "Bateria cadastrada com sucesso!"  
✅ Redirecionado para dashboard do gerador  
✅ Bateria aparece na tabela com:
- Código único (auto-gerado)
- Fabricante/Modelo
- SoH
- Status: "Cadastrada"
- Data de criação

---

## 🎉 Pronto!

Você acaba de:
1. ✅ Criar conta com dados de empresa
2. ✅ Simular aprovação de admin
3. ✅ Cadastrar primeira bateria
4. ✅ Ver bateria no dashboard

---

## 🔍 Próximos testes (opcional)

### Visualizar detalhes da bateria
1. Clique no ícone de olho na tabela
2. Você vê: QR code, specs, timeline

### Testar como Operador
1. Crie outro usuário (operador@example.com) com role "Operador"
2. Aprove a mesma organização para role "Operador"
3. Vá para `/app/operador`
4. Vê a bateria em "Em triagem"
5. Clique e mude status para "diagnostico_concluido"

### Testar como Admin
1. Crie conta normal
2. Faça login como admin
3. Vá para `/app/admin/pending-organizations`
4. Aprove a organização

**Para mais testes:** Consulte `GUIA_TESTES.md` (8 testes completos)

---

## 🆘 Troubleshooting Rápido

### ❌ "Erro ao criar conta"
- Verifique CNPJ (formato: XX.XXX.XXX/XXXX-XX)
- Verifique CEP (formato: XXXXX-XXX)
- Verifique telefone (formato: (XX) 9XXXX-XXXX)

### ❌ "Botão 'Cadastrar' não funciona"
- Preencha todos os campos obrigatórios (todos têm *)
- Verifique se há erros em vermelho

### ❌ "Bateria não aparece no dashboard"
- Recarregue a página (F5)
- Verifique se está logado como gerador
- Verifique se organização está "aprovada" (não "pending")

### ❌ Supabase não conecta
- Verifique variáveis de ambiente (.env.local)
- Verifique se tem internet
- Verifique credenciais Supabase (certo projeto?)

---

## 📚 Ler Depois

- **5 min:** `SUMARIO_ENTREGA.md` (resumo visual)
- **10 min:** `README_IMPLEMENTACAO.md` (overview)
- **30 min:** `GUIA_TESTES.md` (8 testes completos)
- **45 min:** `INVENTARIO_TECNICO.md` (referência técnica)

---

## ✅ Checklist de Validação

Após seguir este guia, você deve ter:

- [ ] Servidor rodando em `http://localhost:8081`
- [ ] Conta criada com dados de empresa
- [ ] Organização aprovada no sistema
- [ ] Login funcionando
- [ ] Dashboard do gerador visível
- [ ] Primeira bateria cadastrada
- [ ] Bateria aparecendo na tabela
- [ ] Detalhes de bateria acessível

**Se tudo está marcado ✅, o sistema está funcionando!**

---

## 🎯 Próximo Passo

1. **Continuar testando:** Abra `GUIA_TESTES.md` para 7 testes adicionais
2. **Entender arquitetura:** Leia `INVENTARIO_TECNICO.md`
3. **Ver status completo:** Consulte `STATUS_IMPLEMENTACAO.md`

---

**⏱️ Tempo total:** ~5 minutos  
**Resultado:** 1 bateria cadastrada + 3 testes funcionando ✨

**Sucesso! 🚀**
