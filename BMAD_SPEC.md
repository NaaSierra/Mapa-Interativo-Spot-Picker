# Especificação do Projeto: Mapa Interativo de Estandes

## 1. Visão Geral (Business)
- Objetivo: WebApp para alinhar a equipe Executiva e de Produção sobre os espaços/estandes vendidos.
- Problema resolvido: Eliminar a falta de alinhamento e a "dança das cadeiras" na alocação de estandes.
- Público: Equipe interna de Vendas e Produção.

## 2. Requisitos de Funcionalidades (Model)
- Mapa Interativo: Exibir layout do mapa de estandes com status por cores (Livre/Ocupado).
- Ação 1 - Alocar: Permitir selecionar um espaço livre e vincular a um cliente.
- Ação 2 - Combinar Espaços: Permitir selecionar múltiplos estandes vagos e uni-los em um único espaço para o mesmo cliente.
- Ação 3 - Consulta e Detalhes: Clicar em um espaço para ver/editar (Cliente, Status, Responsável, Observações, Histórico de alteração, posição, tamanho, rotação, duplicar, excluir, bloquear edições).

## 3. Arquitetura e Integrações (Architecture)
- Plataforma: WebApp (HTML, CSS, JavaScript).
- Jotform: Exibir iFrame de consulta de espaços disponíveis.
- Monday.com: Sincronizar localização quando houver mudança.
- Slack: Enviar mensagem automática em um canal sempre que ocorrer alteração de status.

## 4. Design
- Interface simples, limpa e responsiva.
- Analise a pasta 'figma' para entender o layout visual.
