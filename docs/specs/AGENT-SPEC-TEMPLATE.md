# AGENT-SPEC-TEMPLATE.md
# Template de especificação por agente

> Copie este arquivo para `agents/<cliente>/<canal>/spec/PRD_AGENT.md` e preencha.

## 1. Identidade do agente

- Cliente: `<NOME DO CLIENTE>`
- Canal: `whatsapp | webchat | instagram_dm | ...`
- Nome interno do agente: `<agent_name>`

## 2. Objetivo do agente

Descreva em 3–5 linhas o que o agente faz e, principalmente, o que ele NÃO faz.

## 3. Usuários e casos de uso

Liste:
- Tipos de usuário (cliente final, lead, etc.)
- 3–5 casos de uso principais (ex.: Consultar estoque, agendar consulta)

## 4. Escopo e limites

- Escopo (O que ele responde):
  - ...
- Fora de escopo (O que ele NUNCA responde):
  - ...

## 5. Integrações e ferramentas

- Ferramentas/Toolkits:
  - `tool_crm_get_customer_by_phone`
  - `tool_stock_check_availability`
- Regras de falha das ferramentas.

## 6. Tom e estilo

- Idioma: Português do Brasil.
- Estilo: Cordial, objetivo, profissional.

## 7. Fluxos principais (referência a `flows.md`)

- Descrever em `flows.md` fluxos de atendimento ou caminhos críticos.

## 8. Critérios de sucesso do agente

- Exemplo: % de conversas resolvidas, zero vazamento de dados, conformidade nos testes.
