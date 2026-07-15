# Roteiro de aceitação do MVP

Execute este roteiro somente em uma instância de desenvolvimento isolada, com o seed opcional `supabase/seed.demo.sql`. Não utilize dados pessoais reais.

## Fluxo ponta a ponta

1. Entrar como gerador demo e confirmar a faixa de ambiente demonstrativo.
2. Cadastrar e submeter uma organização geradora.
3. Entrar como administrador, aprovar a organização e conferir auditoria/notificação.
4. Cadastrar uma bateria e confirmar persistência, código único e QR Code.
5. Anexar uma foto válida e rejeitar arquivo inválido ou maior que 15 MB.
6. Entrar como operador, assumir a solicitação pela fila sanitizada e aceitá-la.
7. Criar coleta selecionando uma transportadora aprovada.
8. Entrar como outra transportadora e confirmar que a coleta não aparece.
9. Entrar como a transportadora atribuída, aceitar, agendar e registrar chegada, retirada, transporte e entrega.
10. Entrar como operador, confirmar triagem, registrar diagnóstico e classificação.
11. Criar lote, adicionar a bateria e publicar.
12. Entrar como recicladora, visualizar o lote e enviar proposta.
13. Entrar como uma segunda recicladora e confirmar que a proposta concorrente não aparece.
14. Entrar como operador, encaminhar e aceitar a proposta; confirmar criação da operação.
15. Confirmar transporte/entrega ao destinador, recebimento pela recicladora e peso efetivo.
16. Anexar comprovantes privados, registrar destinação e validar documentos.
17. Concluir a operação e verificar linha do tempo, notificações e auditoria.
18. Atualizar e fechar a página; entrar novamente e confirmar persistência.

## Casos negativos obrigatórios

- Conta suspensa: não consegue consultar nem alterar tabelas operacionais.
- Acesso cruzado: gerador, operador, transportadora e recicladora não veem ativos de outra organização.
- Proposta expirada: envio/edição é rejeitado pelo banco.
- Status inválido: transição fora da máquina de estados é rejeitada.
- Documento privado: URL pública falha; acesso assinado exige autorização.
- Upload inválido: extensão, MIME ou tamanho inválido é rejeitado.
- CNPJ duplicado: cadastro é rejeitado pelo índice normalizado.
- Campos obrigatórios/UF: interface e banco rejeitam valores inválidos.
- Filtros, ordenação e paginação: resultados e contagem permanecem consistentes.
- Celular e teclado: 360 px sem rolagem horizontal indevida; foco visível e navegação completa.

## Evidências

Para cada passo, registre usuário/perfil, horário, ID criado, status anterior/novo e captura da tela. O MVP só deve ser marcado como concluído quando todos os itens acima estiverem aprovados em ambiente isolado.
