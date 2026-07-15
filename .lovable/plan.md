## BatteryLink Brasil — Evolução do MVP (execução econômica)

O escopo enviado é muito amplo (5 perfis, RBAC, banco relacional completo, financeiro, propostas, rastreabilidade com QR, auditoria, certificados, notificações). Entregar tudo de uma vez consumiria muitos créditos e ficaria frágil. Proponho fatiar em fases, aproveitando o que já existe (landing, 4 formulários, mock do portal, SEO).

### Fase 1 — Fundamentos de acesso e conteúdo (esta rodada)
Objetivo: transformar o site atual em plataforma real com login e áreas privadas por perfil, sem ainda ativar banco.

1. **Landing**: adicionar seções faltantes (problema, solução, benefícios ambientais/econômicos, rastreabilidade, segurança/LGPD, FAQ) e novo CTA "Sou operador de triagem" + "Entrar na plataforma". Reaproveitar componentes existentes.
2. **Novo formulário** `/operador` (triagem) no mesmo padrão dos outros 4.
3. **Rodapé**: links para `/termos` e `/privacidade` (2 páginas estáticas curtas com disclaimer de validação por profissional habilitado).
4. **FAQ** como seção acordeão na landing (sem rota nova).

Sem backend nesta fase — mantém custo baixo.

### Fase 2 — Lovable Cloud + Auth + RBAC (rodada seguinte)
- Ativar Lovable Cloud.
- Tabelas: `profiles`, `user_roles` (enum: gerador, reciclador, transportadora, operador, admin), `companies`, `registration_requests`.
- Auth email/senha + Google, recuperação de senha, página `/auth` e `/reset-password`.
- Layout `_authenticated` + subrotas por perfil (`/app/gerador`, `/app/reciclador`, etc.) com gate por role via `has_role()`.
- Fluxo "aguardando aprovação" + tela admin básica para aprovar/recusar.

### Fase 3 — Núcleo operacional
- Tabelas: `batteries`, `lots`, `collections`, `proposals`, `documents`, `audit_log`.
- CRUD do gerador (cadastro de bateria + timeline de status + upload).
- CRUD do operador (diagnóstico + classificação + criação de lote).
- Lista de lotes para reciclador com envio de proposta.
- Lista de coletas para transportadora com aceitar/atualizar status.
- Código único `BAT-2026-000001` e QR Code (biblioteca client-side).

### Fase 4 — Admin, financeiro, certificados, notificações
- Painel admin com todas as abas listadas.
- Financeiro (modelos de cobrança configuráveis por operação).
- Geração de certificado PDF com QR.
- Notificações internas (tabela + sino no header); integrações externas ficam preparadas mas desligadas.

### Fase 5 — Relatórios, indicadores, auditoria completa, exportações
- Dashboards com filtros, export CSV/PDF/Excel.
- Log de auditoria imutável (RLS bloqueando delete).
- Preparação para 2FA, WhatsApp, pagamentos, nota fiscal, mapas.

### Disclaimers legais
Todo texto regulatório/ambiental exibirá aviso: "Conteúdo informativo — validação por profissional habilitado é obrigatória antes do uso oficial."

---

**Nesta resposta vou executar apenas a Fase 1.** Se aprovar, seguimos para Fase 2 na próxima mensagem (é onde entra o backend). Isso mantém o consumo de créditos previsível e evita retrabalho.
